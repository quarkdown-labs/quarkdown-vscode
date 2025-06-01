import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getQuarkdownCommandArgs } from './utils';

export class QuarkdownPreviewManager {
    private static instance: QuarkdownPreviewManager;
    private process: cp.ChildProcess | undefined;

    private constructor() { }

    public static getInstance(): QuarkdownPreviewManager {
        return this.instance || (this.instance = new QuarkdownPreviewManager());
    }

    public async startPreview(filePath: string): Promise<void> {
        this.stopPreview();

        const { command, args } = getQuarkdownCommandArgs(['c', filePath, '-w', '-p']);

        try {
            this.process = cp.execFile(command, args, {
                cwd: path.dirname(filePath)
            }, (error) => {
                if (error) {
                    this.showError();
                }
            });

            vscode.window.showInformationMessage('Starting live preview...');

            setTimeout(() => {
                vscode.commands.executeCommand('simpleBrowser.show', 'http://localhost:8089');
            }, 2000);
        } catch {
            this.showError();
        }
    }

    public stopPreview(): void {
        if (this.process) {
            this.process.kill();
            this.process = undefined;
        }
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
}
