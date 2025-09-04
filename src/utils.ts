import * as vscode from 'vscode';
import * as config from './config';
import { QUARKDOWN_EXTENSION } from './constants';
import path from 'path';

/**
 * Resolve the Quarkdown executable command + arguments, accounting for platform differences.
 * On Windows we attempt to call the .bat launcher (auto-appended if missing).
 *
 * @param additionalArgs Additional CLI arguments to pass to Quarkdown.
 * @returns Object containing a command & args suitable for `cp.spawn` / `cp.execFile`.
 */
export function getQuarkdownCommandArgs(additionalArgs: string[]): { command: string; args: string[] } {
    const executablePath = config.getExecutablePath();
    if (process.platform === 'win32') {
        const launcher = path.extname(executablePath) ? executablePath : `${executablePath}.cmd`;
        return { command: 'cmd', args: ['/c', launcher, ...additionalArgs] };
    }
    return { command: executablePath, args: additionalArgs };
}

/**
 * Like {@link getQuarkdownCommandArgs}, but with specific handy defaults for compilation.
 * @param filePath Path to the main Quarkdown source file to compile.
 */
export function getQuarkdownCompilerCommandArgs(filePath: string, additionalArgs: string[]): { command: string; args: string[] } {
    return getQuarkdownCommandArgs([
        'c', path.basename(filePath),
        '--out', config.getOutputDirectory(),
        '--browser', 'none',
        ...additionalArgs
    ]);
}

/** Determine whether the given file name appears to be a Quarkdown document. */
export function isQuarkdownFile(fileName: string | undefined): boolean {
    return !!fileName && fileName.toLowerCase().endsWith(QUARKDOWN_EXTENSION);
}

