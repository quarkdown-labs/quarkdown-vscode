import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export class QuarkdownPreviewManager {
    private static instance: QuarkdownPreviewManager;
    private process: cp.ChildProcess | undefined;

    private constructor() { }

    public static getInstance(): QuarkdownPreviewManager {
        return this.instance || (this.instance = new QuarkdownPreviewManager());
    }

    public async startPreview(filePath: string): Promise<void> {
        this.stopPreview();

        const isWindows = process.platform === 'win32';
        const command = isWindows ? 'cmd' : 'quarkdown';
        const args = isWindows
            ? ['/c', 'quarkdown.bat', 'c', filePath, '-w', '-p']
            : ['c', filePath, '-w', '-p'];

        try {
            this.process = cp.spawn(command, args, {
                cwd: path.dirname(filePath),
                stdio: 'ignore'
            });

            this.process.on('error', this.showError);
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
        vscode.window.showErrorMessage('Preview failed to start.', 'Install Guide')
            .then(selection => {
                if (selection === 'Install Guide') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/iamgio/quarkdown'));
                }
            });
    }
}
