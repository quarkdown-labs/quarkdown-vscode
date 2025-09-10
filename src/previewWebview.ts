import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { VIEW_TYPES } from './constants';
import { Strings } from './strings';

export interface WebviewEvents {
    /** Called when the webview panel is disposed */
    onDispose: () => void;
}

/**
 * Manages the preview webview panel and its content.
 * 
 * This class encapsulates all webview-related functionality including:
 * - Creating and managing the webview panel
 * - Loading preview content from URLs
 * - Handling webview lifecycle events
 * - Managing Content Security Policy for preview content
 */
export class PreviewWebview {
    private webviewPanel: vscode.WebviewPanel | undefined;
    private events: WebviewEvents | undefined;
    private allowedOrigins = '';

    /**
     * Set event handlers for webview lifecycle events.
     */
    public setEventHandlers(events: WebviewEvents): void {
        this.events = events;
    }

    /** 
     * Set the allowed origins for the webview Content Security Policy.
     * This is important for security when loading external content.
     * 
     * @param origins Array of allowed origin URLs
     */
    public setAllowedOrigins(origins: string[]): void {
        this.allowedOrigins = origins.join(' ');
    }

    /** 
     * Create and show the webview with a loading screen.
     * If webview already exists, it will be revealed and updated.
     */
    public show(): void {
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

        // Set up disposal handler
        this.webviewPanel.onDidDispose(() => {
            this.webviewPanel = undefined;
            this.events?.onDispose();
        });
    }

    /** 
     * Update the webview to show the preview content from the given URL.
     * 
     * @param url URL of the preview server to load
     */
    public loadPreview(url: string): void {
        if (!this.webviewPanel) {
            this.show();
        }

        if (this.webviewPanel) {
            this.webviewPanel.title = Strings.previewPanelTitle;
            this.webviewPanel.webview.html = this.getWebviewHtml();

            // Post message after DOM is ready to load the preview URL
            setTimeout(() => {
                this.webviewPanel?.webview.postMessage({
                    command: 'setSrc',
                    url
                });
            }, 0);
        }
    }

    /** 
     * Set the webview title to indicate waiting state.
     * Used during server startup when the preview is not yet ready.
     */
    public showWaiting(): void {
        if (this.webviewPanel) {
            this.webviewPanel.title = Strings.previewWaitingTitle;
        }
    }

    /** 
     * Dispose the webview panel and clean up resources.
     */
    public dispose(): void {
        if (this.webviewPanel) {
            try {
                this.webviewPanel.dispose();
            } catch (error) {
                // Ignore disposal errors - panel might already be disposed
            }
            this.webviewPanel = undefined;
        }
    }

    /**
     * Check if the webview is currently visible.
     */
    public isVisible(): boolean {
        return !!this.webviewPanel;
    }

    /** 
     * Load HTML template and inject CSP + localized strings.
     * 
     * @returns HTML content for the webview with injected values
     */
    private getWebviewHtml(): string {
        // Find the extension to get the correct path to assets
        const containingExt = vscode.extensions.all.find(e => __dirname.startsWith(e.extensionUri.fsPath));

        const baseUri = containingExt?.extensionUri ?? vscode.Uri.file(path.dirname(__dirname));
        const htmlPath = vscode.Uri.joinPath(baseUri, 'assets', 'preview.html');

        let htmlContent: string;
        try {
            htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
        } catch (error) {
            console.error(`Failed to read webview HTML at ${htmlPath.fsPath}: ${error}`);
            return this.getFallbackHtml();
        }

        // Inject dynamic values into the HTML template
        return htmlContent
            .replace(/__FRAME_ORIGINS__/g, this.allowedOrigins)
            .replace(/__LOADING_MESSAGE__/g, Strings.loadingMessage)
            .replace(/__STILL_WAITING_MESSAGE__/g, Strings.stillWaitingMessage);
    }

    /**
     * Generate fallback HTML when the template file cannot be loaded.
     */
    private getFallbackHtml(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Quarkdown Preview</title>
</head>
<body>
    <div style="padding: 20px; font-family: system-ui; text-align: center;">
        <h2>Quarkdown Preview</h2>
        <p>Failed to load preview interface. Please check the extension installation.</p>
    </div>
</body>
</html>`;
    }
}
