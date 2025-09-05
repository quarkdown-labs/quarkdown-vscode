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
            this.process = cp.execFile(config.command, config.args, { cwd: config.cwd });

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
            if (process.platform === 'win32') {
                // On Windows, use taskkill to force terminate the process tree
                cp.exec(`taskkill /pid ${pid} /t /f`, () => resolve());
            } else {
                // On Unix-like systems, send SIGTERM and wait for exit
                this.process!.once('exit', () => resolve());
                this.process!.kill('SIGTERM');
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
}
