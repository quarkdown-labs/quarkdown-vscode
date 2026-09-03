import * as cp from 'child_process';
import { Logger, NoOpLogger } from './logger';

/**
 * Events that can be emitted by a managed process.
 */
export interface ProcessEvents {
    /** Called when the process outputs to stdout */
    onStdout?: (data: string) => void;
    /** Called when the process outputs to stderr */
    onStderr?: (data: string) => void;
    /** Called when the process encounters an error */
    onError?: (error: NodeJS.ErrnoException) => void;
    /** Called when the process exits */
    onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

/**
 * Configuration for starting a process.
 */
export interface ProcessConfig {
    command: string;
    args: string[];
    cwd?: string;
    events?: ProcessEvents;
    /** Logger for termination diagnostics (defaults to {@link NoOpLogger}) */
    logger?: Logger;
}

/**
 * Pure process management class that handles child process lifecycle
 * without any VS Code dependencies. This allows for better separation
 * of concerns and easier testing.
 *
 * The class tracks one child at a time and terminates it as a whole tree, so a caller
 * such as a preview server can restart without racing the previous process for a port.
 * See {@link stop} for the exact guarantee and its one exception.
 */
export class ProcessManager {
    /** Delay before escalating a termination request to an unconditional kill. */
    private static readonly KILL_TIMEOUT_MS = 5000;
    /** Extra delay after escalation before {@link stop} gives up waiting for the exit event. */
    private static readonly GIVE_UP_TIMEOUT_MS = 2000;

    private process: cp.ChildProcess | undefined;
    /** The in-flight termination, shared by every caller of {@link stop} until it settles. */
    private stopping: Promise<void> | undefined;
    /** Reporting channel for the current child; replaced by every {@link start}. */
    private logger: Logger = new NoOpLogger();

    /**
     * Start a new process with the given configuration.
     * If a process is already running, it will be stopped first.
     *
     * @param config Process configuration including command, args, and event handlers
     */
    public async start(config: ProcessConfig): Promise<void> {
        await this.stop();

        this.logger = config.logger ?? new NoOpLogger();

        try {
            // On Unix the child leads its own process group, so one signal reaches wrapper
            // scripts that did not exec, whatever they launched, and any grandchildren.
            // Windows must stay attached: `detached` there lets the child outlive the
            // extension host rather than die with it, and its tree is walked by
            // `taskkill /t` anyway.
            const child = cp.spawn(config.command, config.args, {
                cwd: config.cwd,
                detached: process.platform !== 'win32',
            });
            this.process = child;

            if (config.events?.onStdout && child.stdout) {
                child.stdout.on('data', (data) => {
                    config.events!.onStdout!(data.toString());
                });
            }

            if (config.events?.onStderr && child.stderr) {
                child.stderr.on('data', (data) => {
                    config.events!.onStderr!(data.toString());
                });
            }

            if (config.events?.onError) {
                child.on('error', config.events.onError);
            }

            if (config.events?.onExit) {
                child.on('exit', config.events.onExit);
            }

            // A child stopped earlier can outlive the call that stopped it, so its late
            // exit event must not clear the reference to the process that replaced it.
            child.on('exit', () => this.detach(child));
        } catch (error) {
            this.process = undefined;
            throw error;
        }
    }

    /**
     * Stop the currently running process and the whole tree below it.
     *
     * Concurrent callers share one termination and receive the same promise. It settles
     * only once the child has exited, so a caller that stops and restarts cannot spawn a
     * replacement while the previous process still holds resources such as a fixed server
     * port. The exception is a child that survives forced termination: it is abandoned,
     * leaving {@link isRunning} false while the operating system process may persist.
     */
    public stop(): Promise<void> {
        if (!this.process) {
            return Promise.resolve();
        }

        if (this.stopping) {
            return this.stopping;
        }

        const stopping = this.terminate(this.process).finally(() => {
            if (this.stopping === stopping) {
                this.stopping = undefined;
            }
        });
        this.stopping = stopping;

        return stopping;
    }

    /**
     * Terminate one specific child and settle once its exit event has fired.
     *
     * The exit event is the only reliable proof that a process is gone: on Windows
     * `taskkill` reports failure for trees that were already partly dead, and on Unix the
     * signal call returns long before the child is reaped.
     *
     * Termination escalates to an unconditional kill after {@link KILL_TIMEOUT_MS}; a
     * child surviving even that is abandoned {@link GIVE_UP_TIMEOUT_MS} later, so this
     * never hands the caller a promise that cannot settle.
     */
    private terminate(child: cp.ChildProcess): Promise<void> {
        const pid = child.pid;

        if (pid === undefined) {
            this.detach(child);
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            // Declared as a function so the give-up timer below can remove this listener
            // while the timers it clears are still declared in their natural order.
            function onExit(): void {
                clearTimeout(escalateTimer);
                clearTimeout(giveUpTimer);
                resolve();
            }

            const escalateTimer = setTimeout(() => {
                this.logger.warn(`Process ${pid} did not exit within ${ProcessManager.KILL_TIMEOUT_MS}ms, forcing`);
                this.killTree(pid, true);
            }, ProcessManager.KILL_TIMEOUT_MS);

            const giveUpTimer = setTimeout(() => {
                child.removeListener('exit', onExit);
                this.logger.error(`Process ${pid} survived forced termination; abandoning its handle`);
                this.detach(child);
                resolve();
            }, ProcessManager.KILL_TIMEOUT_MS + ProcessManager.GIVE_UP_TIMEOUT_MS);

            child.once('exit', onExit);
            this.killTree(pid, false);
        });
    }

    /**
     * Request termination of the whole process tree rooted at `pid`.
     * Never settles anything by itself: whether the tree is gone is decided by the
     * caller observing the child's exit event.
     *
     * @param force Skip the graceful request and kill unconditionally
     */
    private killTree(pid: number, force: boolean): void {
        if (process.platform === 'win32') {
            // `/t` takes the whole tree, which matters because this extension's direct
            // child is a `cmd` wrapper and the process worth killing is its grandchild.
            // A non-zero exit code is not evidence that nothing died — it is also returned
            // when a tree member vanished between enumeration and kill, or when one member
            // denied access — so it is logged rather than acted upon.
            cp.exec(`taskkill /pid ${pid} /t /f`, (error, _stdout, stderr) => {
                if (error) {
                    this.logger.warn(`taskkill for pid ${pid} exited with ${error.code}: ${stderr.trim()}`);
                }
            });
            return;
        }

        const signal: NodeJS.Signals = force ? 'SIGKILL' : 'SIGTERM';

        try {
            // A negative pid targets the process group created by `detached: true`.
            process.kill(-pid, signal);
        } catch {
            try {
                process.kill(pid, signal);
            } catch {
                // Nothing left to signal, or no permission to signal it. Either way
                // the exit event, not this call, decides when the child is gone.
            }
        }
    }

    /**
     * Drop the reference to `child`, but only while it is still the tracked process.
     */
    private detach(child: cp.ChildProcess): void {
        if (this.process === child) {
            this.process = undefined;
        }
    }

    /**
     * Check if a process is currently running.
     */
    public isRunning(): boolean {
        return !!this.process && this.stopping === undefined;
    }

    /**
     * Get the process ID if available.
     */
    public getPid(): number | undefined {
        return this.process?.pid;
    }

    /**
     * Wait for the current process to exit.
     * Resolves with the exit code (null if terminated by signal).
     * Resolves immediately if no process is running.
     *
     * @param timeoutMs Optional timeout in milliseconds. Rejects with an error if exceeded.
     */
    public waitForExit(timeoutMs?: number): Promise<number | null> {
        const child = this.process;

        if (!child) {
            return Promise.resolve(null);
        }

        return new Promise<number | null>((resolve, reject) => {
            let timer: NodeJS.Timeout | undefined;

            const onExit = (code: number | null) => {
                if (timer) {
                    clearTimeout(timer);
                }
                resolve(code);
            };

            child.once('exit', onExit);

            if (timeoutMs !== undefined) {
                timer = setTimeout(() => {
                    child.removeListener('exit', onExit);
                    reject(new Error(`Process did not exit within ${timeoutMs}ms`));
                }, timeoutMs);
            }
        });
    }
}
