import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getQuarkdownCommandArgs } from './utils';

export class QuarkdownPreviewManager {
    private static instance: QuarkdownPreviewManager;
    private process: cp.ChildProcess | undefined;
    private currentFilePath: string | undefined;
    private isStopping: boolean = false;

    private constructor() { }

    public static getInstance(): QuarkdownPreviewManager {
        return this.instance || (this.instance = new QuarkdownPreviewManager());
    }

    public async startPreview(filePath: string): Promise<void> {
        if (this.process && this.currentFilePath === filePath) {
            vscode.window.showInformationMessage('Live preview is already running for this file.');
            return;
        }

        this.stopPreview();
        this.isStopping = false;

        const { command, args } = getQuarkdownCommandArgs(['c', filePath, '-w', '-p']);

        try {
            this.process = cp.execFile(command, args, {
                cwd: path.dirname(filePath)
            }, (error) => {
                if (error && !this.isStopping && error.code === 'ENOENT') {
                    this.showError();
                    this.cleanup();
                }
            });

            this.process.on('exit', (code, signal) => {
                this.cleanup();
            });

            this.process.on('error', (error: NodeJS.ErrnoException) => {
                if (!this.isStopping && error.code === 'ENOENT') {
                    this.showError();
                }
                this.cleanup();
            });

            this.currentFilePath = filePath;
            vscode.window.showInformationMessage('Starting live preview...');

            setTimeout(() => {
                vscode.commands.executeCommand('simpleBrowser.show', 'http://localhost:8089');
            }, 2000);
        } catch {
            if (!this.isStopping) {
                this.showError();
            }
            this.cleanup();
        }
    }

    public stopPreview(): void {
        this.isStopping = true;

        const currentProcess = this.process;
        if (currentProcess && currentProcess.pid) {
            const pid = currentProcess.pid;
            this.process = undefined;

            try {
                if (process.platform === 'win32') {
                    cp.execSync(`taskkill /pid ${pid} /t /f`, { stdio: 'ignore' });
                } else {
                    process.kill(-pid, 'SIGKILL');
                }
            } catch (e) {
                if (currentProcess && !currentProcess.killed) {
                    try {
                        process.kill(pid, 'SIGKILL');
                    } catch (killError) {
                        /* ??? */
                    }
                }
            }
        }
        this.cleanup();
    }

    private cleanup(): void {
        this.process = undefined;
        this.currentFilePath = undefined;
        this.isStopping = false;
    }

    private showError(): void {
        vscode.window.showErrorMessage(
            'Preview failed to start. Please check your Quarkdown installation.',
            'Install Guide'
        ).then(selection => {
            if (selection === 'Install Guide') {
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/iamgio/quarkdown'));
            }
        });
    }

    public isPreviewRunning(): boolean {
        return this.process !== undefined;
    }

    public getCurrentPreviewFile(): string | undefined {
        return this.currentFilePath;
    }
}
