import * as vscode from 'vscode';
import { QuarkdownLanguageClient } from './client';
import { QuarkdownPreviewManager } from './previewManager';

let client: QuarkdownLanguageClient;

export function activate(context: vscode.ExtensionContext): void {
    client = new QuarkdownLanguageClient();
    client.start(context);

    vscode.languages.setLanguageConfiguration('quarkdown', {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('quarkdown.insertTemplate', insertTemplate),
        vscode.commands.registerCommand('quarkdown.livePreview', livePreview),
        vscode.commands.registerCommand('quarkdown.restartLanguageServer', () => restart(context)),
    );
}

function insertTemplate(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Please open a file first.');
        return;
    }

    editor.insertSnippet(new vscode.SnippetString('# Retrieve this from LSP\n'));
}

async function livePreview(): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor || !editor.document.fileName.endsWith('.qmd')) {
        vscode.window.showWarningMessage('Please open a Quarkdown (.qmd) file first.');
        return;
    }

    if (editor.document.isDirty && !(await editor.document.save())) {
        vscode.window.showErrorMessage('Please save the file before starting preview.');
        return;
    }

    QuarkdownPreviewManager.getInstance().startPreview(editor.document.fileName);
}

async function restart(context: vscode.ExtensionContext): Promise<void> {
    try {
        if (client) {
            await client.stop();
        }
        client = new QuarkdownLanguageClient();
        await client.start(context);
        vscode.window.showInformationMessage('Quarkdown Language Server restarted successfully.');
    } catch (error) {
        vscode.window.showErrorMessage('Failed to restart Language Server.');
    }
}

export function deactivate(): Thenable<void> {
    QuarkdownPreviewManager.getInstance().stopPreview();
    return client.stop();
}
