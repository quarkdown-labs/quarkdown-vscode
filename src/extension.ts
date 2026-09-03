import * as vscode from 'vscode';
import { QuarkdownLanguageClient } from './client';
import { QuarkdownPreviewManager } from './previewManager';
import { QuarkdownPdfExporter } from './pdfExport';
import { QuarkdownCommands } from './commands';
import { VIEW_TYPES } from './constants';

/**
 * Deadline for the whole of {@link deactivate}, set below the host's own cap so that
 * running out of time is something this extension observes rather than something done
 * to it.
 */
const DEACTIVATE_TIMEOUT_MS = 4000;

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
 *
 * VS Code allows every installed extension's deactivate() a combined five seconds before
 * calling exit(), so these shutdowns run concurrently rather than in sequence: waiting up
 * to five seconds for the preview to exit and then again for the language server does not
 * fit in that budget. Whatever has not finished by {@link DEACTIVATE_TIMEOUT_MS} is left
 * behind either way, but losing to this deadline leaves a log line to diagnose.
 */
export async function deactivate(): Promise<void> {
    await withDeadline(
        Promise.allSettled([
            QuarkdownPreviewManager.disposeInstance(),
            QuarkdownPdfExporter.disposeInstance(),
            stopLanguageClient(),
        ]),
        DEACTIVATE_TIMEOUT_MS
    );
}

/**
 * Stop and release the language client, if one was ever started.
 */
async function stopLanguageClient(): Promise<void> {
    if (!client) {
        return;
    }

    client.dispose();
    await client.stop();
}

/**
 * Resolve once `work` settles or `timeoutMs` elapses, whichever happens first, reporting
 * the timeout. Nothing is cancelled on expiry; the work is merely no longer awaited.
 */
async function withDeadline(work: Promise<unknown>, timeoutMs: number): Promise<void> {
    let timer: NodeJS.Timeout | undefined;

    const expiry = new Promise<'expired'>((resolve) => {
        timer = setTimeout(() => resolve('expired'), timeoutMs);
    });

    const outcome = await Promise.race([work.then(() => 'settled' as const), expiry]);
    clearTimeout(timer);

    if (outcome === 'expired') {
        console.warn(`Quarkdown: deactivation did not finish within ${timeoutMs}ms`);
    }
}
