import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as http from 'http';
import { getQuarkdownCompilerCommandArgs } from './utils';
import { DEFAULT_PREVIEW_PORT, OUTPUT_CHANNELS } from './constants';
import { Strings } from './strings';

export interface ServerEvents {
    onReady: (url: string) => void;
    onError: (error: string) => void;
    onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
}

/**
 * Manages the Quarkdown server process and network communication for live preview.
 */
export class QuarkdownLivePreviewServer {
    private process: cp.ChildProcess | undefined;
    private readonly outputChannel: vscode.OutputChannel;
    private readonly port: number = DEFAULT_PREVIEW_PORT;
    private serverReadyTimer: NodeJS.Timeout | undefined;
    private isStopping = false;
    private events: ServerEvents | undefined;

    public readonly url: string = `http://localhost:${this.port}/live`;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.preview);
    }

    public setEventHandlers(events: ServerEvents): void {
        this.events = events;
    }

    /** Start the Quarkdown server for a file */
    public async start(filePath: string): Promise<void> {
        await this.stop();

        const { command, args, cwd } = getQuarkdownCompilerCommandArgs(filePath, [
            '--preview', '--watch',
            '--server-port', this.port.toString()
        ]);
        
        this.outputChannel.appendLine(`[server] Starting: ${command} ${args.join(' ')}`);

        try {
            this.process = cp.execFile(command, args, { cwd });

            this.process.on('exit', (code, signal) => {
                this.outputChannel.appendLine(`[server] Process exited (code=${code} signal=${signal})`);
                this.cleanup();
                this.events?.onExit(code, signal);
            });
            
            this.process.on('error', (error: NodeJS.ErrnoException) => {
                this.outputChannel.appendLine(`[server] Process error: ${error.message}`);
                const errorMessage = error.code === 'ENOENT' 
                    ? 'Quarkdown not found. Please install Quarkdown first.'
                    : error.message;
                this.cleanup();
                this.events?.onError(errorMessage);
            });

            // Wait for the server to become ready
            void this.waitForServerReady(30, 250)
                .then((ready) => {
                    if (!ready) {
                        this.outputChannel.appendLine('[server] Server did not become ready in initial window; continuing to poll.');
                        this.startContinuousServerPolling();
                        return;
                    }
                    this.outputChannel.appendLine('[server] Server is ready.');
                    this.events?.onReady(this.url);
                })
                .catch((err) => {
                    this.outputChannel.appendLine(`[server] waitForServerReady error: ${err}`);
                    this.events?.onError(`Server startup error: ${err}`);
                });

        } catch (error) {
            this.outputChannel.appendLine(`[server] Failed to start: ${error}`);
            this.events?.onError(`Failed to start server: ${error}`);
        }
    }

    /** Stop the server process */
    public async stop(): Promise<void> {
        if (this.isStopping) return;
        this.isStopping = true;

        if (this.process?.pid) {
            const pid = this.process.pid;
            this.outputChannel.appendLine(`[server] Stopping process ${pid}`);
            await new Promise<void>((resolve) => {
                if (process.platform === 'win32') {
                    cp.exec(`taskkill /pid ${pid} /t /f`, () => resolve());
                } else {
                    this.process!.once('exit', () => resolve());
                    this.process!.kill('SIGTERM');
                }
            });
        }

        this.cleanup();
        this.isStopping = false;
    }

    public isRunning(): boolean {
        return !!this.process;
    }

    /** Check if the server is ready to accept connections */
    public async isReady(): Promise<boolean> {
        return this.waitForServerReady(1, 200);
    }

    private cleanup(): void {
        this.process = undefined;
        this.stopContinuousServerPolling();
    }

    /** Polls the server until it starts or we time out */
    private async waitForServerReady(tries = 20, delayMs = 300): Promise<boolean> {
        const tryOnce = (): Promise<boolean> =>
            new Promise<boolean>((resolve) => {
                const req = http.get(this.url, { timeout: delayMs }, (res) => {
                    res.resume();
                    resolve(true);
                });
                req.on('timeout', () => {
                    req.destroy();
                    resolve(false);
                });
                req.on('error', () => resolve(false));
            });

        for (let i = 0; i < tries; i++) {
            const ok = await tryOnce();
            if (ok) return true;
            await new Promise(r => setTimeout(r, delayMs));
        }
        return false;
    }

    private startContinuousServerPolling(): void {
        this.stopContinuousServerPolling();
        this.serverReadyTimer = setInterval(async () => {
            const ready = await this.waitForServerReady(1, 200);
            if (ready) {
                this.outputChannel.appendLine('[server] Server became ready during polling.');
                this.events?.onReady(this.url);
                this.stopContinuousServerPolling();
            }
        }, 1000);
    }

    private stopContinuousServerPolling(): void {
        if (this.serverReadyTimer) {
            clearInterval(this.serverReadyTimer);
            this.serverReadyTimer = undefined;
        }
    }
}
