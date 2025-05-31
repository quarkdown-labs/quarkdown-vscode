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
        vscode.commands.registerCommand('quarkdown.restartLanguageServer', () => restart(context))
    );
}

function insertTemplate(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Open a file first.');
        return;
    }

    editor.insertSnippet(new vscode.SnippetString('# TODO\n'));
}

async function livePreview(): Promise<void> {
    const editor = vscode.window.activeTextEditor;

    if (!editor || !editor.document.fileName.endsWith('.qmd')) {
        vscode.window.showWarningMessage('Open a Quarkdown (.qmd) file first.');
        return;
    }

    if (editor.document.isDirty && !(await editor.document.save())) {
        vscode.window.showErrorMessage('Save file before preview.');
        return;
    }

    QuarkdownPreviewManager.getInstance().startPreview(editor.document.fileName);
}

async function restart(context: vscode.ExtensionContext): Promise<void> {
    try {
        await client.stop();
        await client.start(context);
        vscode.window.showInformationMessage('Language Server restarted');
    } catch {
        vscode.window.showErrorMessage('Restart failed');
    }
}

export function deactivate(): Thenable<void> {
    QuarkdownPreviewManager.getInstance().stopPreview();
    return client.stop();
}
