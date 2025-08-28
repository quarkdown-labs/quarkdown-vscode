import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { VIEW_TYPES } from './constants';
import { Strings } from './strings';

export interface WebviewEvents {
    onDispose: () => void;
}

/**
 * Manages the preview webview panel and its content
 */
export class PreviewWebview {
    private webviewPanel: vscode.WebviewPanel | undefined;
    private events: WebviewEvents | undefined;
    private allowedOrigins: string = '';

    public setEventHandlers(events: WebviewEvents): void {
        this.events = events;
    }

    /** Set the allowed origins for the webview CSP */
    public setAllowedOrigins(origins: string[]): void {
        this.allowedOrigins = origins.join(' ');
    }

    /** Create and show the webview with a loading screen */
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
        this.webviewPanel.onDidDispose(() => {
            this.webviewPanel = undefined;
            this.events?.onDispose();
        });
    }

    /** Update the webview to show the preview content */
    public loadPreview(url: string): void {
        if (!this.webviewPanel) {
            this.show();
        }
        
        if (this.webviewPanel) {
            this.webviewPanel.title = Strings.previewPanelTitle;
            this.webviewPanel.webview.html = this.getWebviewHtml();
            // Post message after the DOM is set
            setTimeout(() => this.webviewPanel?.webview.postMessage({ command: 'setSrc', url }), 0);
        }
    }

    /** Set the webview title to indicate waiting state */
    public showWaiting(): void {
        if (this.webviewPanel) {
            this.webviewPanel.title = Strings.previewWaitingTitle;
        }
    }

    /** Dispose the webview panel */
    public dispose(): void {
        if (this.webviewPanel) {
            try {
                this.webviewPanel.dispose();
            } catch { }
            this.webviewPanel = undefined;
        }
    }

    public isVisible(): boolean {
        return !!this.webviewPanel;
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
            console.error(`Failed to read webview HTML at ${htmlPath.fsPath}: ${e}`);
            return `<!DOCTYPE html><html><body>Failed to load preview UI.</body></html>`;
        }

        return raw
            .replace(/__FRAME_ORIGINS__/g, this.allowedOrigins)
            .replace(/__LOADING_MESSAGE__/g, Strings.loadingMessage)
            .replace(/__STILL_WAITING_MESSAGE__/g, Strings.stillWaitingMessage);
    }
}
