import * as vscode from 'vscode';
import { CONFIG_KEYS, CONFIG_ROOT } from './constants';

/**
 * Resolve the Quarkdown executable command + arguments, accounting for platform differences.
 * On Windows we attempt to call the .bat launcher (auto-appended if missing).
 *
 * @param additionalArgs Additional CLI arguments to pass to Quarkdown.
 * @returns Object containing a command & args suitable for `cp.spawn` / `cp.execFile`.
 */
export function getQuarkdownCommandArgs(additionalArgs: string[]): { command: string; args: string[] } {
    const config = vscode.workspace.getConfiguration(CONFIG_ROOT);
    const quarkdownPath = config.get<string>(CONFIG_KEYS.executablePath, 'quarkdown');

    if (process.platform === 'win32') {
        const batPath = quarkdownPath.endsWith('.bat') ? quarkdownPath : `${quarkdownPath}.bat`;
        return { command: 'cmd', args: ['/c', batPath, ...additionalArgs] };
    }
    return { command: quarkdownPath, args: additionalArgs };
}

/** Determine whether the given file name appears to be a Quarkdown document. */
export function isQuarkdownFile(fileName: string | undefined): boolean {
    return !!fileName && fileName.toLowerCase().endsWith('.qd');
}

