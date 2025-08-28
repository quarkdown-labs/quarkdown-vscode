import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as http from 'http';
import * as fs from 'fs';
import { getQuarkdownCommandArgs, getQuarkdownCompilerCommandArgs } from './utils';
import { DEFAULT_PREVIEW_PORT, OUTPUT_CHANNELS, VIEW_TYPES } from './constants';
import { Strings } from './strings';

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
    private webviewPanel: vscode.WebviewPanel | undefined;
    private isStopping = false;
    private serverReadyTimer: NodeJS.Timeout | undefined;

    private readonly url: string = `http://localhost:${this.port}`;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.preview);
    }

    public static getInstance(): QuarkdownPreviewManager {
        return this.instance || (this.instance = new QuarkdownPreviewManager());
    }

    /** Load HTML template and inject CSP + strings */
    private getWebviewHtml(): string {
        const ext = vscode.extensions.getExtension('Quarkdown.quarkdown-vscode')
            || vscode.extensions.all.find(e => e.packageJSON?.name === 'quarkdown-vscode');
        const baseUri = ext ? ext.extensionUri : vscode.Uri.file(path.dirname(__dirname));
        const htmlPath = vscode.Uri.joinPath(baseUri, 'assets', 'preview.html');
        let raw: string;
        try {
            raw = fs.readFileSync(htmlPath.fsPath, 'utf8');
        } catch (e) {
            this.outputChannel.appendLine(`[preview] Failed to read webview HTML at ${htmlPath.fsPath}: ${e}`);
            return `<!DOCTYPE html><html><body>Failed to load preview UI.</body></html>`;
        }

        const allowedOrigins = [`http://localhost:${this.port}`, `http://127.0.0.1:${this.port}`].join(' ');

        return raw
            .replace(/__FRAME_ORIGINS__/g, allowedOrigins)
            .replace(/__LOADING_MESSAGE__/g, Strings.loadingMessage)
            .replace(/__STILL_WAITING_MESSAGE__/g, Strings.stillWaitingMessage);
    }

    /** Start (or restart) the preview for a file */
    public async startPreview(filePath: string): Promise<void> {
        await this.stopPreview();

        const { command, args } = getQuarkdownCompilerCommandArgs(filePath, [
            '--preview', '--watch',
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
            vscode.window.showInformationMessage(Strings.previewStartingInfo);
            // Prepare the Webview immediately with a loading screen
            this.openWebviewWithLoading();
            // Wait for the local server to become ready, then load it in the webview
            void this.waitForServerReady(this.url, 30, 250)
                .then((ready) => {
                    if (!ready) {
                        this.outputChannel.appendLine('[preview] Server did not become ready in initial window; continuing to poll.');
                        if (this.webviewPanel) this.webviewPanel.title = Strings.previewWaitingTitle;
                        // Continue polling in background until ready
                        this.startContinuousServerPolling();
                        return;
                    }
                    this.outputChannel.appendLine('[preview] Server is ready. Loading in Webview.');
                    this.updateWebviewContent(this.url);
                })
                .catch((err) => this.outputChannel.appendLine(`[preview] waitForServerReady error: ${err}`));
        } catch (error) {
            this.outputChannel.appendLine(`[preview] Failed to start: ${error}`);
            this.showInstallError();
            this.cleanup();
        }
    }

    /** Create the webview with a loading screen */
    private openWebviewWithLoading(): void {
        if (this.webviewPanel) {
            this.webviewPanel.reveal(vscode.ViewColumn.Beside);
            this.webviewPanel.webview.html = this.getWebviewHtml();
            return;
        }

        this.webviewPanel = vscode.window.createWebviewPanel(
            VIEW_TYPES.preview,
            Strings.previewPanelTitle,
            { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        this.webviewPanel.webview.html = this.getWebviewHtml();
        this.webviewPanel.onDidDispose(() => {
            this.webviewPanel = undefined;
            if (!this.isStopping && this.previewProcess) {
                void this.stopPreview();
            }
            this.stopContinuousServerPolling();
        });
    }

    /** Replace the webview HTML with the live iframe content */
    private updateWebviewContent(url: string): void {
        if (!this.webviewPanel) {
            this.openWebviewWithLoading();
        }
        if (this.webviewPanel) {
            this.webviewPanel.title = Strings.previewPanelTitle;
            this.webviewPanel.webview.html = this.getWebviewHtml();
            // Post message after the DOM is set
            setTimeout(() => this.webviewPanel?.webview.postMessage({ command: 'setSrc', url }), 0);
        }
    }

    /** Stop the preview process */
    public async stopPreview(): Promise<void> {
        if (this.isStopping) return;
        this.isStopping = true;

        if (this.previewProcess?.pid) {
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
        }

        await this.cleanup();
        this.isStopping = false;
    }

    public isPreviewRunning(): boolean {
        return !!this.previewProcess;
    }

    public getCurrentPreviewFile(): string | undefined {
        return this.currentFilePath;
    }

    private async cleanup(): Promise<void> {
        this.previewProcess = undefined;
        this.currentFilePath = undefined;
        if (this.webviewPanel) {
            try {
                this.webviewPanel.dispose();
            } catch { }
            this.webviewPanel = undefined;
        }
        this.stopContinuousServerPolling();
    }

    /** Polls the preview server until it starts or we time out */
    private async waitForServerReady(url: string, tries = 20, delayMs = 300): Promise<boolean> {
        const tryOnce = (): Promise<boolean> =>
            new Promise<boolean>((resolve) => {
                const req = http.get(url, { timeout: delayMs }, (res) => {
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
            const ready = await this.waitForServerReady(this.url, 1, 200);
            if (ready) {
                this.outputChannel.appendLine('[preview] Server became ready. Updating Webview.');
                this.updateWebviewContent(this.url);
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

    private showInstallError(): void {
        vscode.window.showErrorMessage(
            Strings.previewInstallErrorTitle,
            Strings.previewInstallGuide
        ).then(selection => {
            if (selection === Strings.previewInstallGuide) {
                void vscode.env.openExternal(vscode.Uri.parse('https://github.com/iamgio/quarkdown'));
            }
        });
    }
}
