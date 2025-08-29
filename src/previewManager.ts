import * as vscode from 'vscode';
import { QuarkdownLivePreviewServer, ServerEvents } from './quarkdownServer';
import { PreviewWebview, WebviewEvents } from './previewWebview';
import { DEFAULT_PREVIEW_PORT } from './constants';
import { Strings } from './strings';

/**
 * Orchestrates the preview functionality by coordinating the server and webview
 * Singleton ensures only one preview session at a time
 */
export class QuarkdownPreviewManager {
    private static instance: QuarkdownPreviewManager;
    private server: QuarkdownLivePreviewServer;
    private webview: PreviewWebview;
    private currentFilePath: string | undefined;

    private constructor() {
        this.server = new QuarkdownLivePreviewServer();
        this.webview = new PreviewWebview();
        this.setupEventHandlers();
    }

    public static getInstance(): QuarkdownPreviewManager {
        return this.instance || (this.instance = new QuarkdownPreviewManager());
    }

    private setupEventHandlers(): void {
        // Set up server event handlers
        this.server.setEventHandlers({
            onReady: (url: string) => {
                this.webview.loadPreview(url);
            },
            onError: (error: string) => {
                vscode.window.showErrorMessage(`Preview Error: ${error}`);
                if (error.includes('Quarkdown not found')) {
                    this.showInstallError();
                }
            },
            onExit: () => {
                this.cleanup();
            }
        });

        // Set up webview event handlers
        this.webview.setEventHandlers({
            onDispose: () => {
                if (this.server.isRunning()) {
                    void this.stopPreview();
                }
            }
        });
    }

    /** Start (or restart) the preview for a file */
    public async startPreview(filePath: string): Promise<void> {
        await this.stopPreview();

        this.currentFilePath = filePath;
        
        // Configure webview with allowed origins
        const port = DEFAULT_PREVIEW_PORT;
        this.webview.setAllowedOrigins([
            `http://localhost:${port}/live`,
            `http://127.0.0.1:${port}/live`,
            `http://localhost:${port}`,
            `http://127.0.0.1:${port}`,
        ]);

        // Show webview with loading screen immediately
        this.webview.show();
        vscode.window.showInformationMessage(Strings.previewStartingInfo);

        // Start the server (this will trigger webview update when ready)
        await this.server.start(filePath);
    }

    /** Stop the preview process */
    public async stopPreview(): Promise<void> {
        await this.server.stop();
        this.cleanup();
    }

    public isPreviewRunning(): boolean {
        return this.server.isRunning();
    }

    public getCurrentPreviewFile(): string | undefined {
        return this.currentFilePath;
    }

    private cleanup(): void {
        this.currentFilePath = undefined;
        this.webview.dispose();
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
