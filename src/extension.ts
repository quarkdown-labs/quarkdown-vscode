import * as vscode from 'vscode';
import { QuarkdownLanguageClient } from './client';
import { QuarkdownPreviewManager } from './previewManager';
import { isQuarkdownFile } from './utils';
import { Strings } from './strings';
import { VIEW_TYPES } from './constants';
import { exportToPDF } from './pdfExport';

let client: QuarkdownLanguageClient;

/** Extension activation entrypoint. */
export function activate(context: vscode.ExtensionContext): void {
    client = new QuarkdownLanguageClient();
    void client.start(context);

    vscode.languages.setLanguageConfiguration('quarkdown', {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('quarkdown.startPreview', startPreview),
        vscode.commands.registerCommand('quarkdown.stopPreview', stopPreview),
        vscode.commands.registerCommand('quarkdown.restartLanguageServer', () => restart(context)),
        vscode.commands.registerCommand('quarkdown.exportPdf', exportToPDF)
    );

    // Ensure preview webview is not restored on vscode startup
    context.subscriptions.push(
        vscode.window.registerWebviewPanelSerializer(VIEW_TYPES.preview, {
            async deserializeWebviewPanel(panel: vscode.WebviewPanel): Promise<void> {
                try { panel.dispose(); } catch { }
            }
        })
    );

    // Stop preview automatically when its document closes.
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(document => {
            const manager = QuarkdownPreviewManager.getInstance();
            if (document.fileName === manager.getCurrentPreviewFile()) {
                void manager.stopPreview();
            }
        })
    );
}

/** Start a live preview for the active Quarkdown document. */
async function startPreview(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isQuarkdownFile(editor.document.fileName)) {
        vscode.window.showWarningMessage(Strings.openQuarkdownFirst);
        return;
    }
    if (editor.document.isDirty && !(await editor.document.save())) {
        vscode.window.showErrorMessage(Strings.saveBeforePreview);
        return;
    }
    await QuarkdownPreviewManager.getInstance().startPreview(editor.document.fileName);
}

/** Stop an active live preview (if one is running). */
async function stopPreview(): Promise<void> {
    const previewManager = QuarkdownPreviewManager.getInstance();
    if (previewManager.isPreviewRunning()) {
        await previewManager.stopPreview();
        vscode.window.showInformationMessage(Strings.previewStopped);
    } else {
        vscode.window.showInformationMessage(Strings.previewNotRunning);
    }
}

/** Restart the Quarkdown language server. */
async function restart(context: vscode.ExtensionContext): Promise<void> {
    try {
        if (client) await client.stop();
        client = new QuarkdownLanguageClient();
        await client.start(context);
        vscode.window.showInformationMessage(Strings.lsRestarted);
    } catch {
        vscode.window.showErrorMessage(Strings.lsRestartFailed);
    }
}

/** Extension deactivation hook. */
export async function deactivate(): Promise<void> {
    await QuarkdownPreviewManager.getInstance().stopPreview();
    return client.stop();
}

