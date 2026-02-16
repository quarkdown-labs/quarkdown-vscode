import * as vscode from 'vscode';
import { PdfExportService, PdfExportConfig, PdfExportEvents } from './core/pdfExportService';
import { VSCodeLogger } from './vscode/vscodeLogger';
import { getQuarkdownConfig } from './config';
import { Strings } from './strings';

/**
 * Orchestrates PDF export functionality by coordinating with the Quarkdown CLI.
 *
 * This class acts as the coordinator between the Quarkdown executable and VS Code,
 * handling the export lifecycle and user feedback.
 */
export class QuarkdownPdfExporter {
    private static instance: QuarkdownPdfExporter;
    private exportService: PdfExportService;

    private constructor() {
        this.exportService = new PdfExportService();
    }

    public static getInstance(): QuarkdownPdfExporter {
        return this.instance || (this.instance = new QuarkdownPdfExporter());
    }

    /**
     * Initiates the PDF export process for the given document.
     * @param document The VS Code text document to export.
     */
    public async export(document: vscode.TextDocument): Promise<void> {
        const config = getQuarkdownConfig();
        const logger = new VSCodeLogger('Quarkdown PDF Export');

        const exportConfig: PdfExportConfig = {
            executablePath: config.executablePath,
            filePath: document.fileName,
            outputDirectory: config.outputDirectory,
            logger: logger,
        };

        // Show initial progress message
        vscode.window.showInformationMessage(Strings.exportInProgress);

        const events: PdfExportEvents = {
            onSuccess: () => {
                vscode.window.showInformationMessage(Strings.exportSucceeded);
                logger.dispose();
            },
            onError: (error) => {
                vscode.window.showErrorMessage(error);
                logger.dispose();
            },
            // onProgress events are automatically logged by the service
        };

        try {
            await this.exportService.exportToPdf(exportConfig, events);
        } catch (error) {
            const errorMessage = `Export failed: ${error}`;
            vscode.window.showErrorMessage(errorMessage);
            logger.error(errorMessage);
            logger.dispose();
        }
    }
}
