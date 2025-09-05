import * as vscode from 'vscode';
import { Logger } from '../core/logger';

/**
 * VS Code OutputChannel-based logger implementation.
 * Provides integration with VS Code's output panel system.
 */
export class VSCodeLogger implements Logger {
    private readonly outputChannel: vscode.OutputChannel;

    constructor(channelName: string) {
        this.outputChannel = vscode.window.createOutputChannel(channelName);
    }

    public info(message: string): void {
        this.outputChannel.appendLine(message);
    }

    public error(message: string): void {
        this.outputChannel.appendLine(`ERROR: ${message}`);
    }

    public warn(message: string): void {
        this.outputChannel.appendLine(`WARNING: ${message}`);
    }

    public show(): void {
        this.outputChannel.show();
    }

    /**
     * Dispose of the output channel when no longer needed.
     * Should be called during extension deactivation.
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
}
