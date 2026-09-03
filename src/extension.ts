import * as vscode from 'vscode';
import { QuarkdownLanguageClient } from './client';
import { QuarkdownPreviewManager } from './previewManager';
import { QuarkdownCommands } from './commands';
import { VIEW_TYPES } from './constants';

let client: QuarkdownLanguageClient;

/**
 * Extension activation entrypoint.
 * Sets up language configuration, registers commands, and initializes services.
 */
export function activate(context: vscode.ExtensionContext): void {
    client = new QuarkdownLanguageClient();
    void client.start(context);

    setupLanguageConfiguration();
    registerCommands(context);
    registerWebviewSerializer(context);
    registerDocumentCloseHandler(context);
}

/**
 * Configure language-specific settings for Quarkdown files.
 */
function setupLanguageConfiguration(): void {
    vscode.languages.setLanguageConfiguration('quarkdown', {
        wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?\s]+)/g,
    });
}

/**
 * Register all extension commands with their handlers.
 */
function registerCommands(context: vscode.ExtensionContext): void {
    const commands = [
        vscode.commands.registerCommand('quarkdown.startPreview', QuarkdownCommands.startPreview),
        vscode.commands.registerCommand('quarkdown.stopPreview', QuarkdownCommands.stopPreview),
        vscode.commands.registerCommand('quarkdown.exportPdf', QuarkdownCommands.exportToPdf),
        vscode.commands.registerCommand('quarkdown.restartLanguageServer', () => {
            return QuarkdownCommands.restartLanguageServer(
                context,
                async (ctx) => {
                    const newClient = new QuarkdownLanguageClient();
                    await newClient.start(ctx);
                    return newClient;
                },
                () => client,
                (newClient) => {
                    client = newClient;
                }
            );
        }),
    ];

    context.subscriptions.push(...commands);
}

/**
 * Register webview panel serializer to prevent unwanted restoration.
 * Ensures preview webviews are not restored when VS Code starts up.
 */
function registerWebviewSerializer(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.window.registerWebviewPanelSerializer(VIEW_TYPES.preview, {
            async deserializeWebviewPanel(panel: vscode.WebviewPanel): Promise<void> {
                try {
                    panel.dispose();
                } catch (_error) {
                    // Ignore disposal errors
                }
            },
        })
    );
}

/**
 * Register document close handler for automatic preview cleanup.
 * Stops preview when its source document is closed.
 */
function registerDocumentCloseHandler(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument((document) => {
            const manager = QuarkdownPreviewManager.getInstance();
            if (document.fileName === manager.getCurrentPreviewFile()) {
                void manager.stopPreview();
            }
        })
    );
}

/**
 * Extension deactivation hook.
 * Cleans up resources and stops services.
 */
export async function deactivate(): Promise<void> {
    const previewManager = QuarkdownPreviewManager.getInstance();
    await previewManager.dispose();

    if (client) {
        client.dispose();
        await client.stop();
    }
}
