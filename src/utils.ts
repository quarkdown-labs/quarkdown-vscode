import * as vscode from 'vscode';

export function getQuarkdownCommandArgs(additionalArgs: string[]): { command: string; args: string[] } {
    const config = vscode.workspace.getConfiguration('quarkdown');
    const quarkdownPath = config.get<string>('path', 'quarkdown');

    if (process.platform === 'win32') {
        const batPath = quarkdownPath.endsWith('.bat') ? quarkdownPath : `${quarkdownPath}.bat`;
        return {
            command: 'cmd',
            args: ['/c', batPath, ...additionalArgs]
        };
    }

    return {
        command: quarkdownPath,
        args: additionalArgs
    };
}
