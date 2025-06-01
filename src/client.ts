import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, State } from 'vscode-languageclient/node';
import { getQuarkdownCommandArgs } from './utils';
import * as fs from 'fs';

export class QuarkdownLanguageClient {
    private client: LanguageClient | undefined;
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Quarkdown Language Server');
    }

    public async start(context: vscode.ExtensionContext): Promise<void> {
        if (this.client) return;

        const { command, args } = getQuarkdownCommandArgs(['language-server']);
        const serverOptions: ServerOptions = {
            run: { command, args },
            debug: { command, args }
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: [{ scheme: 'file', language: 'quarkdown' }],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/*.qmd')
            },
            outputChannel: this.outputChannel
        };

        this.client = new LanguageClient(
            'quarkdownLanguageServer',
            'Quarkdown Language Server',
            serverOptions,
            clientOptions
        );

        this.client.onDidChangeState((event) => {
            if (event.newState === State.Stopped) {
                this.outputChannel.appendLine('Language server stopped unexpectedly');
            }
        });

        try {
            await this.client.start();
            context.subscriptions.push(this.client);
            this.outputChannel.appendLine('Quarkdown Language Server started successfully');
        } catch (error) {
            this.client = undefined;
            this.outputChannel.appendLine(`Failed to start language server: ${error}`);
            vscode.window.showErrorMessage(
                'Quarkdown Language Server could not start. Check the Output panel for details.',
                'Show Output', 'Learn More'
            ).then(selection => {
                if (selection === 'Show Output') {
                    this.outputChannel.show();
                } else if (selection === 'Learn More') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/iamgio/quarkdown'));
                }
            });
        }
    }

    public async stop(): Promise<void> {
        if (this.client && this.client.state !== State.Stopped) {
            try {
                await this.client.stop();
            } catch (error) {
                this.outputChannel.appendLine(`Error stopping language client: ${error}`);
            } finally {
                this.client = undefined;
            }
        } else {
            this.client = undefined;
        }
    }
}
