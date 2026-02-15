import * as cp from 'child_process';

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
}

/**
 * Pure process management class that handles child process lifecycle
 * without any VS Code dependencies. This allows for better separation
 * of concerns and easier testing.
 */
export class ProcessManager {
    /** Timeout before escalating SIGTERM to SIGKILL during stop(). */
    private static readonly KILL_TIMEOUT_MS = 5000;

    private process: cp.ChildProcess | undefined;
    private isTerminating = false;

    /**
     * Start a new process with the given configuration.
     * If a process is already running, it will be stopped first.
     *
     * @param config Process configuration including command, args, and event handlers
     */
    public async start(config: ProcessConfig): Promise<void> {
        await this.stop();

        try {
            this.process = cp.spawn(config.command, config.args, { cwd: config.cwd });

            if (config.events?.onStdout && this.process.stdout) {
                this.process.stdout.on('data', (data) => {
                    config.events!.onStdout!(data.toString());
                });
            }

            if (config.events?.onStderr && this.process.stderr) {
                this.process.stderr.on('data', (data) => {
                    config.events!.onStderr!(data.toString());
                });
            }

            if (config.events?.onError) {
                this.process.on('error', config.events.onError);
            }

            if (config.events?.onExit) {
                this.process.on('exit', config.events.onExit);
            }

            // Clean up references when process exits
            this.process.on('exit', () => {
                this.process = undefined;
                this.isTerminating = false;
            });
        } catch (error) {
            this.process = undefined;
            throw error;
        }
    }

    /**
     * Stop the currently running process.
     * Uses appropriate termination method based on platform.
     */
    public async stop(): Promise<void> {
        if (!this.process || this.isTerminating) {
            return;
        }

        this.isTerminating = true;
        const pid = this.process.pid;

        if (!pid) {
            this.process = undefined;
            this.isTerminating = false;
            return;
        }

        return new Promise<void>((resolve) => {
            let resolved = false;
            let killTimer: NodeJS.Timeout | undefined;

            const doResolve = () => {
                if (!resolved) {
                    resolved = true;
                    if (killTimer) {
                        clearTimeout(killTimer);
                    }
                    resolve();
                }
            };

            // On all platforms, wait for the exit event to ensure the process is truly gone.
            // This prevents port conflicts when restarting immediately.
            this.process!.once('exit', doResolve);

            if (process.platform === 'win32') {
                // On Windows, use taskkill to force terminate the process tree
                cp.exec(`taskkill /pid ${pid} /t /f`, (error) => {
                    if (error) {
                        // If taskkill fails (e.g. process not found), resolve to avoid hanging
                        doResolve();
                    }
                });
            } else {
                // On Unix-like systems, send SIGTERM and wait for graceful exit
                this.process!.kill('SIGTERM');

                // If the process ignores SIGTERM, escalate to SIGKILL after 5 seconds
                killTimer = setTimeout(() => {
                    if (!resolved) {
                        try {
                            this.process?.kill('SIGKILL');
                        } catch {
                            // Process may have already exited
                            doResolve();
                        }
                    }
                }, ProcessManager.KILL_TIMEOUT_MS);
            }
        });
    }

    /**
     * Check if a process is currently running.
     */
    public isRunning(): boolean {
        return !!this.process && !this.isTerminating;
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
        if (!this.process) {
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

            this.process!.once('exit', onExit);

            if (timeoutMs !== undefined) {
                timer = setTimeout(() => {
                    this.process?.removeListener('exit', onExit);
                    reject(new Error(`Process did not exit within ${timeoutMs}ms`));
                }, timeoutMs);
            }
        });
    }
}
