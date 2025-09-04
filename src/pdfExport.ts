import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { getQuarkdownCommandArgs, isQuarkdownFile } from './utils';
import { Strings } from './strings';

/** Export the active .qd file to PDF. */
export async function exportToPDF(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isQuarkdownFile(editor.document.fileName)) {
        vscode.window.showWarningMessage(Strings.openQuarkdownFirst);
        return;
    }

    if (editor.document.isDirty && !(await editor.document.save())) {
        vscode.window.showErrorMessage(Strings.saveBeforeExport);
        return;
    }

    const selection = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: Strings.chooseFolder,
        defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri
    });

    if (!selection || selection.length === 0) {
        return;
    }

    const outDir = selection[0].fsPath;
    const filePath = editor.document.fileName;

    const cwd = path.dirname(filePath);

    const args = ['c', path.basename(filePath), '--pdf', '-o', outDir];
    const { command, args: resolvedArgs } = getQuarkdownCommandArgs(args);

    const taskName = 'Quarkdown PDF Export';
    const output = vscode.window.createOutputChannel(taskName);

    output.show(true);
    output.appendLine(`[export] Running: ${command} ${resolvedArgs.join(' ')}`);
    output.appendLine(`[export] cwd: ${cwd}`);

    try {
        let stderrBuf = '';

        await new Promise<void>((resolve, reject) => {
            const child = cp.execFile(command, resolvedArgs, { cwd });

            child.stdout?.on('data', (d) => output.append(d.toString()));
            child.stderr?.on('data', (d) => {
                const s = d.toString();
                stderrBuf += s;
                output.append(s);
            });

            child.on('error', (err: NodeJS.ErrnoException) => {
                const msg = err.code === 'ENOENT' ? Strings.quarkdownNotFound : err.message;
                reject(new Error(msg));
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`${Strings.exportFailed}: (code ${code})`));
                    return;
                }
                if (stderrBuf.trim()) {
                    reject(new Error(`${Strings.exportFailed}: ${stderrBuf.trim()}`));
                } else {
                    resolve();
                }
            });
        });

        vscode.window.showInformationMessage(Strings.exportSucceeded);
    } catch (err: any) {
        vscode.window.showErrorMessage(`${err?.message ?? String(err)}`);
    }
}
