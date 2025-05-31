import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

export class QuarkdownLanguageClient {
    private client: LanguageClient | undefined;
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Quarkdown Language Server');
    }

    public async start(context: vscode.ExtensionContext): Promise<void> {
        if (this.client) return;

        const command = process.platform === 'win32' ? 'cmd' : 'quarkdown';
        const args = process.platform === 'win32'
            ? ['/c', 'quarkdown.bat', 'language-server']
            : ['language-server'];

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

        try {
            await this.client.start();
            context.subscriptions.push(this.client);
        } catch (error) {
            vscode.window.showInformationMessage(
                'Quarkdown Language Server could not start.',
                'Learn More'
            ).then(selection => {
                if (selection === 'Learn More') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/iamgio/quarkdown'));
                }
            });
        }
    }

    public async stop(): Promise<void> {
        if (this.client) {
            await this.client.stop();
            this.client = undefined;
        }
    }
}
