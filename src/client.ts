import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, State } from 'vscode-languageclient/node';
import { getQuarkdownCommandArgs } from './utils';
import { OUTPUT_CHANNELS } from './constants';

/** Wrapper around VSCode's LanguageClient providing lifecycle convenience & diagnostics. */
export class QuarkdownLanguageClient {
    private client: LanguageClient | undefined;
    private readonly outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNELS.languageServer);
    }

    /** Start the language server if not already running. */
    public async start(context: vscode.ExtensionContext): Promise<void> {
        if (this.client) return; // Already started.

        const { command, args } = getQuarkdownCommandArgs(['language-server']);
        const serverOptions: ServerOptions = { run: { command, args }, debug: { command, args } };
        const clientOptions: LanguageClientOptions = {
            documentSelector: [{ scheme: 'file', language: 'quarkdown' }],
            synchronize: { fileEvents: vscode.workspace.createFileSystemWatcher('**/*.qd') },
            outputChannel: this.outputChannel
        };

        this.client = new LanguageClient('quarkdownLanguageServer', 'Quarkdown Language Server', serverOptions, clientOptions);

        this.client.onDidChangeState(event => {
            if (event.newState === State.Stopped) {
                this.outputChannel.appendLine('[language-server] Stopped unexpectedly');
            }
        });

        try {
            this.client.registerProposedFeatures();
            await this.client.start();
            context.subscriptions.push(this.client);
            this.outputChannel.appendLine('[language-server] Started successfully');
        } catch (error) {
            this.outputChannel.appendLine(`[language-server] Failed to start: ${String(error)}`);
            this.client = undefined;
            vscode.window.showErrorMessage(
                'Quarkdown Language Server could not start. Check the Output panel for details.',
                'Show Output', 'Learn More'
            ).then(selection => {
                if (selection === 'Show Output') {
                    this.outputChannel.show();
                } else if (selection === 'Learn More') {
                    void vscode.env.openExternal(vscode.Uri.parse('https://github.com/iamgio/quarkdown'));
                }
            });
        }
    }

    /** Stop the language server (if running). */
    public async stop(): Promise<void> {
        if (!this.client) return;
        try {
            if (this.client.state !== State.Stopped) {
                await this.client.stop();
            }
        } catch (error) {
            this.outputChannel.appendLine(`[language-server] Error stopping: ${String(error)}`);
        } finally {
            this.client = undefined;
        }
    }
}

