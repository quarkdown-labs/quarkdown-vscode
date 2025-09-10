import * as vscode from 'vscode';
import { QuarkdownLivePreviewServer, ServerEvents } from './quarkdownServer';
import { PreviewWebview, WebviewEvents } from './previewWebview';
import { DEFAULT_PREVIEW_PORT } from './constants';
import { Strings } from './strings';

/**
 * Orchestrates the preview functionality by coordinating the server and webview.
 * Singleton ensures only one preview session at a time.
 * 
 * This class acts as the coordinator between the Quarkdown server and the VS Code webview,
 * handling the lifecycle and communication between both components.
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

    /**
     * Set up event handlers to coordinate between server and webview.
     */
    private setupEventHandlers(): void {
        // Server event handlers
        const serverEvents: ServerEvents = {
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
        };
        this.server.setEventHandlers(serverEvents);

        // Webview event handlers
        const webviewEvents: WebviewEvents = {
            onDispose: () => {
                if (this.server.isRunning()) {
                    void this.stopPreview();
                }
            }
        };
        this.webview.setEventHandlers(webviewEvents);
    }

    /** 
     * Start (or restart) the preview for a file.
     * 
     * @param filePath Path to the .qd file to preview
     */
    public async startPreview(filePath: string): Promise<void> {
        await this.stopPreview();

        this.currentFilePath = filePath;

        // Configure webview with allowed origins for the preview server
        const port = DEFAULT_PREVIEW_PORT;
        this.webview.setAllowedOrigins([
            `http://localhost:${port}/live`,
            `http://127.0.0.1:${port}/live`,
            `http://0.0.0.0:${port}/live`,
            `http://localhost:${port}`,
            `http://127.0.0.1:${port}`,
            `http://0.0.0.0:${port}`,
        ]);

        // Show webview with loading screen immediately for better UX
        this.webview.show();
        vscode.window.showInformationMessage(Strings.previewStartingInfo);

        // Start the server (this will trigger webview update when ready)
        await this.server.start(filePath);
    }

    /** 
     * Stop the preview process and cleanup resources.
     */
    public async stopPreview(): Promise<void> {
        await this.server.stop();
        this.cleanup();
    }

    /**
     * Check if a preview is currently running.
     */
    public isPreviewRunning(): boolean {
        return this.server.isRunning();
    }

    /**
     * Get the file path of the currently previewed file.
     */
    public getCurrentPreviewFile(): string | undefined {
        return this.currentFilePath;
    }

    /**
     * Clean up resources and state.
     */
    private cleanup(): void {
        this.currentFilePath = undefined;
        this.webview.dispose();
    }

    /**
     * Show installation error with helpful guidance.
     */
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

    /**
     * Dispose of all resources when the extension is deactivated.
     * Should be called during extension deactivation.
     */
    public dispose(): void {
        void this.stopPreview();
        this.server.dispose();
    }
}
