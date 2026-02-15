import * as vscode from 'vscode';
import * as config from './config';
import { QUARKDOWN_EXTENSION } from './constants';
import { QuarkdownCommandBuilder } from './core/commandBuilder';

/**
 * Resolve the Quarkdown executable command + arguments, accounting for platform differences.
 * On Windows we attempt to call the .bat launcher (auto-appended if missing).
 *
 * @param additionalArgs Additional CLI arguments to pass to Quarkdown.
 * @returns Object containing a command & args suitable for `cp.spawn` / `cp.execFile`.
 * @deprecated Use QuarkdownCommandBuilder.buildCommand instead for better separation of concerns.
 */
export function getQuarkdownCommandArgs(additionalArgs: string[]): { command: string; args: string[] } {
    const executablePath = config.getExecutablePath();
    const { command, args } = QuarkdownCommandBuilder.buildCommand(executablePath, additionalArgs);
    return { command, args };
}

/**
 * Like {@link getQuarkdownCommandArgs}, but with specific handy defaults for compilation.
 * @param filePath Path to the main Quarkdown source file to compile.
 * @param additionalArgs Additional command line arguments.
 * @deprecated Use QuarkdownCommandBuilder.buildCompileCommand instead for better separation of concerns.
 */
export function getQuarkdownCompilerCommandArgs(
    filePath: string,
    additionalArgs: string[]
): { command: string; args: string[]; cwd: string } {
    const executablePath = config.getExecutablePath();
    const outputDir = config.getOutputDirectory();
    const commandConfig = QuarkdownCommandBuilder.buildCompileCommand(
        executablePath,
        filePath,
        outputDir,
        additionalArgs
    );

    return {
        command: commandConfig.command,
        args: commandConfig.args,
        cwd: commandConfig.cwd!,
    };
}

/**
 * Determine whether the given file name appears to be a Quarkdown document.
 *
 * @param fileName File name or path to check
 * @returns true if the file has a .qd extension, false otherwise
 */
export function isQuarkdownFile(fileName: string | undefined): boolean {
    return !!fileName && fileName.toLowerCase().endsWith(QUARKDOWN_EXTENSION);
}

/**
 * Get the current active Quarkdown document from VS Code editor.
 *
 * @returns The active Quarkdown document, or undefined if none is active
 */
export function getActiveQuarkdownDocument(): vscode.TextDocument | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isQuarkdownFile(editor.document.fileName)) {
        return undefined;
    }
    return editor.document;
}
