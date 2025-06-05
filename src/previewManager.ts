import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getQuarkdownCommandArgs } from './utils';

export class QuarkdownPreviewManager {
    private static instance: QuarkdownPreviewManager;
    private process: cp.ChildProcess | undefined;
    private currentFilePath: string | undefined;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Quarkdown Preview');
    }

    public static getInstance(): QuarkdownPreviewManager {
        return this.instance || (this.instance = new QuarkdownPreviewManager());
    }

    public async startPreview(filePath: string): Promise<void> {
        if (this.process && this.currentFilePath === filePath) {
            vscode.window.showInformationMessage('Live preview is already running for this file.');
            return;
        }

        this.stopPreview();

        const { command, args } = getQuarkdownCommandArgs(['c', filePath, '-w', '-p']);
        try {
            this.process = cp.execFile(command, args, { cwd: path.dirname(filePath) });

            this.process.on('exit', () => this.cleanup());
            this.process.on('error', (error: NodeJS.ErrnoException) => {
                this.outputChannel.appendLine(`Quarkdown process error: ${error.message}`);
                if (error.code === 'ENOENT') this.showError();
                this.cleanup();
            });

            this.currentFilePath = filePath;
            vscode.window.showInformationMessage('Starting live preview...');
            setTimeout(() => vscode.commands.executeCommand('simpleBrowser.show', 'http://localhost:8089'), 2000);
        } catch (error) {
            this.outputChannel.appendLine(`Failed to start preview: ${error}`);
            this.showError();
            this.cleanup();
        }
    }

    public async stopPreview(): Promise<void> {
        if (this.process?.pid) {
            const pid = this.process.pid;
            this.outputChannel.appendLine(`Stopping process ${pid}`);
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
    }

    private cleanup(): void {
        this.process = undefined;
        this.currentFilePath = undefined;
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
        return !!this.process;
    }

    public getCurrentPreviewFile(): string | undefined {
        return this.currentFilePath;
    }
}
