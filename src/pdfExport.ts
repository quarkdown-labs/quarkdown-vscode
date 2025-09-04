import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { getQuarkdownCommandArgs, getQuarkdownCompilerCommandArgs, isQuarkdownFile } from './utils';
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

    const filePath = editor.document.fileName;
    const { command, args, cwd } = getQuarkdownCompilerCommandArgs(filePath, ['--pdf']);

    const taskName = 'Quarkdown PDF Export';
    const output = vscode.window.createOutputChannel(taskName);

    output.appendLine(`[export] Running: ${command} ${args.join(' ')}`);

    vscode.window.showInformationMessage(Strings.exportInProgress);

    try {
        let stderrBuf = '';

        await new Promise<void>((resolve, reject) => {
            const child = cp.execFile(command, args, { cwd });

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
