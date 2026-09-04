import * as vscode from 'vscode';
import { PdfExportService, PdfExportConfig, PdfExportEvents } from './core/pdfExportService';
import { VSCodeLogger } from './vscode/vscodeLogger';
import { getQuarkdownConfig } from './config';
import { Strings } from './strings';
import { OUTPUT_CHANNELS } from './constants';

/**
 * Orchestrates PDF export functionality by coordinating with the Quarkdown CLI.
 *
 * This class acts as the coordinator between the Quarkdown executable and VS Code,
 * handling the export lifecycle and user feedback.
 */
export class QuarkdownPdfExporter {
    private static instance: QuarkdownPdfExporter | undefined;
    private exportService: PdfExportService;
    private readonly logger: VSCodeLogger;

    private constructor() {
        this.exportService = new PdfExportService();
        this.logger = new VSCodeLogger(OUTPUT_CHANNELS.pdfExport);
    }

    public static getInstance(): QuarkdownPdfExporter {
        return this.instance || (this.instance = new QuarkdownPdfExporter());
    }

    /**
     * Dispose the exporter if one was ever created, leaving it absent afterwards.
     * Avoids constructing an exporter, and its output channel, purely to shut it down.
     */
    public static async disposeInstance(): Promise<void> {
        await QuarkdownPdfExporter.instance?.dispose();
        QuarkdownPdfExporter.instance = undefined;
    }

    /**
     * Initiates the PDF export process for the given document.
     * @param document The VS Code text document to export.
     */
    public async export(document: vscode.TextDocument): Promise<void> {
        const config = getQuarkdownConfig();

        const exportConfig: PdfExportConfig = {
            executablePath: config.executablePath,
            filePath: document.fileName,
            outputDirectory: config.outputDirectory,
            additionalArgs: config.additionalCompilerOptions,
            logger: this.logger,
        };

        vscode.window.showInformationMessage(Strings.exportInProgress);

        const events: PdfExportEvents = {
            onSuccess: (exportInfo) => {
                const items: Record<string, () => void> = {};
                if (exportInfo) {
                    const [exportPath, pathType] = exportInfo;
                    items[Strings.openPdf] = () => {
                        const uri = vscode.Uri.file(exportPath);
                        if (pathType === 'file') {
                            vscode.env.openExternal(uri);
                        } else if (pathType === 'folder') {
                            vscode.commands.executeCommand('revealFileInOS', uri);
                        }
                    };
                }
                vscode.window
                    .showInformationMessage(Strings.exportSucceeded, ...Object.keys(items))
                    .then((selection) => {
                        if (selection && selection in items) items[selection]();
                    });
            },
            onError: (error) => {
                vscode.window.showErrorMessage(error);
            },
            // onProgress events are automatically logged by the service
        };

        try {
            await this.exportService.exportToPdf(exportConfig, events);
        } catch (error) {
            const errorMessage = `Export failed: ${error}`;
            vscode.window.showErrorMessage(errorMessage);
            this.logger.error(errorMessage);
        }
    }

    /**
     * Cancel any export still running and release the output channel.
     * Should be called during extension deactivation: an abandoned export otherwise
     * outlives the editor, along with the Node and browser processes beneath it.
     */
    public async dispose(): Promise<void> {
        await this.exportService.cancel();
        this.logger.dispose();
    }
}
