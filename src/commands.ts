import * as vscode from 'vscode';
import { QuarkdownPreviewManager } from './previewManager';
import { exportToPDF } from './pdfExport';
import { getActiveQuarkdownDocument } from './utils';
import { Strings } from './strings';

/**
 * Centralized command handlers for the Quarkdown extension.
 *
 * This module provides a clean separation between command registration
 * and command implementation, making the code more maintainable and testable.
 */
export class QuarkdownCommands {
    /**
     * Start a live preview for the active Quarkdown document.
     * Validates document state and provides user feedback.
     */
    public static async startPreview(): Promise<void> {
        const document = getActiveQuarkdownDocument();
        if (!document) {
            vscode.window.showWarningMessage(Strings.openQuarkdownFirst);
            return;
        }

        if (document.isDirty && !(await document.save())) {
            vscode.window.showErrorMessage(Strings.saveBeforePreview);
            return;
        }

        try {
            await QuarkdownPreviewManager.getInstance().startPreview(document.fileName);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start preview: ${error}`);
        }
    }

    /**
     * Stop an active live preview (if one is running).
     * Provides appropriate user feedback based on preview state.
     */
    public static async stopPreview(): Promise<void> {
        const previewManager = QuarkdownPreviewManager.getInstance();

        if (previewManager.isPreviewRunning()) {
            try {
                await previewManager.stopPreview();
                vscode.window.showInformationMessage(Strings.previewStopped);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to stop preview: ${error}`);
            }
        } else {
            vscode.window.showInformationMessage(Strings.previewNotRunning);
        }
    }

    /**
     * Export the active Quarkdown document to PDF.
     * Delegates to the PDF export module.
     */
    public static async exportToPdf(): Promise<void> {
        try {
            await exportToPDF();
        } catch (error) {
            vscode.window.showErrorMessage(`PDF export failed: ${error}`);
        }
    }

    /**
     * Restart the Quarkdown language server.
     *
     * @param context VS Code extension context
     * @param clientFactory Function to create a new language client
     * @param currentClient Current language client to restart
     */
    public static async restartLanguageServer<T extends { stop(): Promise<void> }>(
        context: vscode.ExtensionContext,
        clientFactory: (context: vscode.ExtensionContext) => Promise<T>,
        getCurrentClient: () => T | undefined,
        setCurrentClient: (client: T) => void
    ): Promise<void> {
        try {
            const currentClient = getCurrentClient();
            if (currentClient) {
                await currentClient.stop();
            }

            const newClient = await clientFactory(context);
            setCurrentClient(newClient);

            vscode.window.showInformationMessage(Strings.lsRestarted);
        } catch (error) {
            vscode.window.showErrorMessage(Strings.lsRestartFailed);
            console.error('Language server restart failed:', error);
        }
    }
}
