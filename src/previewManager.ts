import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { getQuarkdownCommandArgs } from './utils';
import { DEFAULT_PREVIEW_PORT, OUTPUT_CHANNELS } from './constants';

/**
 * Manages a single live Quarkdown preview process & its associated browser view.
 * Singleton ensures only one process (port) at a time for now.
 */
export class QuarkdownPreviewManager {
    private static instance: QuarkdownPreviewManager;
    private previewProcess: cp.ChildProcess | undefined;
    private currentFilePath: string | undefined;
    private readonly outputChannel: vscode.OutputChannel;
    private readonly port: number = DEFAULT_PREVIEW_PORT;

    private readonly url: string = `http://localhost:${this.port}`;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.preview);
    }

    public static getInstance(): QuarkdownPreviewManager {
        return this.instance || (this.instance = new QuarkdownPreviewManager());
    }

    /** Start (or restart) the preview for a file. */
    public async startPreview(filePath: string): Promise<void> {
        await this.stopPreview();

        const { command, args } = getQuarkdownCommandArgs([
            'c', filePath,
            '--preview', '--watch',
            '--browser', 'none',
            '--server-port', this.port.toString()
        ]);
        this.outputChannel.appendLine(`[preview] Starting: ${command} ${args.join(' ')}`);

        try {
            this.previewProcess = cp.execFile(command, args, { cwd: path.dirname(filePath) });
            this.previewProcess.on('exit', (code, signal) => {
                this.outputChannel.appendLine(`[preview] Process exited (code=${code} signal=${signal})`);
                this.cleanup();
            });
            this.previewProcess.on('error', (error: NodeJS.ErrnoException) => {
                this.outputChannel.appendLine(`[preview] Process error: ${error.message}`);
                if (error.code === 'ENOENT') this.showInstallError();
                this.cleanup();
            });

            this.currentFilePath = filePath;
            vscode.window.showInformationMessage('Starting live preview...');
            setTimeout(() => void this.openInSideView(), 3000); // delay to allow server startup
        } catch (error) {
            this.outputChannel.appendLine(`[preview] Failed to start: ${error}`);
            this.showInstallError();
            this.cleanup();
        }
    }

    /** Reveal the live preview in a side column. */
    private async openInSideView(): Promise<void> {
        try {
            await vscode.commands.executeCommand('simpleBrowser.show', this.url);
            await vscode.commands.executeCommand('workbench.action.moveEditorToNextGroup');
        } catch (error) {
            this.outputChannel.appendLine(`[preview] Failed to open side view: ${error}`);
        }
    }

    /** Stop the preview process, if running. */
    public async stopPreview(): Promise<void> {
        if (!this.previewProcess?.pid) {
            await this.cleanup();
            return;
        }

        const pid = this.previewProcess.pid;
        this.outputChannel.appendLine(`[preview] Stopping process ${pid}`);
        await new Promise<void>((resolve) => {
            if (process.platform === 'win32') {
                cp.exec(`taskkill /pid ${pid} /t /f`, () => resolve());
            } else {
                this.previewProcess!.once('exit', () => resolve());
                this.previewProcess!.kill('SIGTERM');
            }
        });

        await this.cleanup();
    }

    /** Current running status. */
    public isPreviewRunning(): boolean {
        return !!this.previewProcess;
    }

    /** File currently previewed, if any. */
    public getCurrentPreviewFile(): string | undefined {
        return this.currentFilePath;
    }

    private async cleanup(): Promise<void> {
        this.previewProcess = undefined;
        this.currentFilePath = undefined;

        await this.closeBrowser();
    }

    /** Close the preview's browser tab. */
    private async closeBrowser() {
        this.outputChannel.appendLine(`[preview] Closing browser tab for ${this.url}`);

        const browserTab = vscode.window.tabGroups.all
            .flatMap(g => g.tabs)
            .find(t => {
                const input = t.input as any;
                return typeof input?.viewType === 'string' && input.viewType.includes('simpleBrowser.view');
            });

        if (browserTab) {
            await vscode.window.tabGroups.close(browserTab);
        }
    }

    private showInstallError(): void {
        vscode.window.showErrorMessage(
            'Preview failed to start. Please check your Quarkdown installation.',
            'Install Guide'
        ).then(selection => {
            if (selection === 'Install Guide') {
                void vscode.env.openExternal(vscode.Uri.parse('https://github.com/iamgio/quarkdown'));
            }
        });
    }
}

