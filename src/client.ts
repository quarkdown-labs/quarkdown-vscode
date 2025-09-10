import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, State } from 'vscode-languageclient/node';
import { QuarkdownCommandBuilder } from './core/commandBuilder';
import { getQuarkdownConfig } from './config';
import { OUTPUT_CHANNELS } from './constants';
import { VSCodeLogger } from './vscode/vscodeLogger';

/** 
 * Wrapper around VSCode's LanguageClient providing lifecycle convenience & diagnostics.
 * Handles the Quarkdown language server integration with improved error handling and logging.
 */
export class QuarkdownLanguageClient {
    private client: LanguageClient | undefined;
    private readonly logger: VSCodeLogger;

    constructor() {
        this.logger = new VSCodeLogger(OUTPUT_CHANNELS.languageServer);
    }

    /** Start the language server if not already running. */
    public async start(context: vscode.ExtensionContext): Promise<void> {
        if (this.client) {
            this.logger.info('Language server already started');
            return;
        }

        const config = getQuarkdownConfig();
        const { command, args } = QuarkdownCommandBuilder.buildLanguageServerCommand(config.executablePath);

        const serverOptions: ServerOptions = {
            run: { command, args },
            debug: { command, args }
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: [{ scheme: 'file', language: 'quarkdown' }],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/*.qd')
            },
            outputChannel: this.logger['outputChannel'] // Access the underlying output channel
        };

        this.client = new LanguageClient(
            'quarkdownLanguageServer',
            'Quarkdown Language Server',
            serverOptions,
            clientOptions
        );

        // Set up state change monitoring
        this.client.onDidChangeState(event => {
            if (event.newState === State.Stopped) {
                this.logger.error('Stopped unexpectedly');
            }
        });

        try {
            this.client.registerProposedFeatures();
            await this.client.start();
            context.subscriptions.push(this.client);
            this.logger.info('Started successfully');
        } catch (error) {
            this.logger.error(`Failed to start: ${String(error)}`);
            this.client = undefined;
            await this.showLanguageServerError();
        }
    }

    /** Stop the language server (if running). */
    public async stop(): Promise<void> {
        if (!this.client) {
            return;
        }

        try {
            if (this.client.state !== State.Stopped) {
                await this.client.stop();
            }
        } catch (error) {
            this.logger.error(`Error stopping: ${String(error)}`);
        } finally {
            this.client = undefined;
        }
    }

    /**
     * Show an error dialog when the language server fails to start.
     * Provides helpful actions for the user.
     */
    private async showLanguageServerError(): Promise<void> {
        const selection = await vscode.window.showErrorMessage(
            'Quarkdown Language Server could not start. Check the Output panel for details.',
            'Show Output',
            'Learn More'
        );

        if (selection === 'Show Output') {
            this.logger.show();
        } else if (selection === 'Learn More') {
            await vscode.env.openExternal(
                vscode.Uri.parse('https://github.com/iamgio/quarkdown')
            );
        }
    }

    /**
     * Dispose of resources when no longer needed.
     * Should be called during extension deactivation.
     */
    public dispose(): void {
        this.logger.dispose();
    }
}

