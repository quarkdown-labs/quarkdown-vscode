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
    /**
     * Identifies the current preview session. Every start or stop request opens a new one,
     * which lets an in-flight startPreview() detect that it has been superseded while
     * awaiting and bail out, instead of taking the webview over from a newer session.
     */
    private sessionId = 0;

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
        const serverEvents: ServerEvents = {
            onReady: (url: string) => {
                void this.webview.loadPreview(url);
            },
            onError: (error: string) => {
                vscode.window.showErrorMessage(`Preview Error: ${error}`);
                if (error.includes('Quarkdown not found')) {
                    this.showInstallError();
                }
            },
            onExit: () => {
                this.cleanup();
            },
        };
        this.server.setEventHandlers(serverEvents);

        const webviewEvents: WebviewEvents = {
            onDispose: () => {
                if (this.server.isRunning()) {
                    void this.stopPreview();
                }
            },
        };
        this.webview.setEventHandlers(webviewEvents);
    }

    /**
     * Start (or restart) the preview for a file.
     *
     * @param filePath Path to the .qd file to preview
     */
    public async startPreview(filePath: string): Promise<void> {
        const session = ++this.sessionId;

        await this.stopSession();

        if (this.sessionId !== session) {
            return;
        }

        this.currentFilePath = filePath;

        const port = DEFAULT_PREVIEW_PORT;
        this.webview.setAllowedOrigins([
            `http://localhost:${port}/live`,
            `http://127.0.0.1:${port}/live`,
            `http://0.0.0.0:${port}/live`,
            `http://localhost:${port}`,
            `http://127.0.0.1:${port}`,
            `http://0.0.0.0:${port}`,
        ]);

        // Shown before the server exists, so the wait is a loading screen rather than
        // nothing at all.
        await this.webview.show();

        if (this.sessionId !== session) {
            return;
        }

        vscode.window.showInformationMessage(Strings.previewStartingInfo);

        // Returns once the process is spawned; the webview is filled in later, from the
        // onReady handler.
        await this.server.start(filePath);
    }

    /**
     * Stop the preview process and cleanup resources.
     */
    public async stopPreview(): Promise<void> {
        this.sessionId++;
        await this.stopSession();
    }

    /**
     * Stop the running server and tear down its UI, leaving the current session open.
     * Used by {@link startPreview}, which owns the session it is setting up.
     */
    private async stopSession(): Promise<void> {
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
        vscode.window
            .showErrorMessage(Strings.previewInstallErrorTitle, Strings.previewInstallGuide)
            .then((selection) => {
                if (selection === Strings.previewInstallGuide) {
                    void vscode.env.openExternal(vscode.Uri.parse('https://github.com/iamgio/quarkdown'));
                }
            });
    }

    /**
     * Dispose of all resources when the extension is deactivated.
     * Should be called during extension deactivation.
     */
    public async dispose(): Promise<void> {
        await this.stopPreview();
        this.server.dispose();
    }
}
