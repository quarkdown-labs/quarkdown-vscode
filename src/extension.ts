import * as vscode from 'vscode';
import { QuarkdownLanguageClient } from './client';
import { QuarkdownPreviewManager } from './previewManager';
import { isQuarkdownFile } from './utils';

let client: QuarkdownLanguageClient;

/** Extension activation entrypoint. */
export function activate(context: vscode.ExtensionContext): void {
    client = new QuarkdownLanguageClient();
    void client.start(context);

    vscode.languages.setLanguageConfiguration('quarkdown', {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('quarkdown.insertTemplate', insertTemplate),
        vscode.commands.registerCommand('quarkdown.startPreview', startPreview),
        vscode.commands.registerCommand('quarkdown.stopPreview', stopPreview),
        vscode.commands.registerCommand('quarkdown.restartLanguageServer', () => restart(context))
    );

    // Stop preview automatically when its document closes.
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(document => {
            const mgr = QuarkdownPreviewManager.getInstance();
            if (document.fileName === mgr.getCurrentPreviewFile()) {
                void mgr.stopPreview();
            }
        })
    );
}

/** Insert a minimal starter template. */
function insertTemplate(): void {
    // TODO: Retrieve this from LSP
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Please open a file first.');
        return;
    }
    void editor.insertSnippet(new vscode.SnippetString('# Retrieve this from LSP\n'));
}

/** Start a live preview for the active Quarkdown document. */
async function startPreview(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isQuarkdownFile(editor.document.fileName)) {
        vscode.window.showWarningMessage('Please open a Quarkdown (.qd) file first.');
        return;
    }
    if (editor.document.isDirty && !(await editor.document.save())) {
        vscode.window.showErrorMessage('Please save the file before starting preview.');
        return;
    }
    await QuarkdownPreviewManager.getInstance().startPreview(editor.document.fileName);
}

/** Stop an active live preview (if one is running). */
async function stopPreview(): Promise<void> {
    const previewManager = QuarkdownPreviewManager.getInstance();
    if (previewManager.isPreviewRunning()) {
        await previewManager.stopPreview();
        vscode.window.showInformationMessage('Live preview stopped.');
    } else {
        vscode.window.showInformationMessage('No preview is currently running.');
    }
}

/** Restart the Quarkdown language server. */
async function restart(context: vscode.ExtensionContext): Promise<void> {
    try {
        if (client) await client.stop();
        client = new QuarkdownLanguageClient();
        await client.start(context);
        vscode.window.showInformationMessage('Quarkdown Language Server restarted successfully.');
    } catch {
        vscode.window.showErrorMessage('Failed to restart Language Server.');
    }
}

/** Extension deactivation hook. */
export async function deactivate(): Promise<void> {
    await QuarkdownPreviewManager.getInstance().stopPreview();
    return client.stop();
}

