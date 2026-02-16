import * as vscode from 'vscode';
import { PdfExportService, PdfExportConfig, PdfExportEvents } from './core/pdfExportService';
import { VSCodeLogger } from './vscode/vscodeLogger';
import { getQuarkdownConfig } from './config';
import { getActiveQuarkdownDocument } from './vscode/utils';
import { Strings } from './strings';

/**
 * Export the active .qd file to PDF using VS Code integration.
 * Provides user feedback through VS Code's notification system.
 */
export async function exportToPDF(): Promise<void> {
    const document = getActiveQuarkdownDocument();
    if (!document) {
        vscode.window.showWarningMessage(Strings.openQuarkdownFirst);
        return;
    }

    if (document.isDirty && !(await document.save())) {
        vscode.window.showErrorMessage(Strings.saveBeforeExport);
        return;
    }

    const config = getQuarkdownConfig();
    const logger = new VSCodeLogger('Quarkdown PDF Export');

    const exportConfig: PdfExportConfig = {
        executablePath: config.executablePath,
        filePath: document.fileName,
        outputDirectory: config.outputDirectory,
        logger: logger,
    };

    const exportService = new PdfExportService();

    // Show initial progress message
    vscode.window.showInformationMessage(Strings.exportInProgress);

    const events: PdfExportEvents = {
        onSuccess: (exportInfo) => {
            const items = exportInfo ? [Strings.openPdf] : [];
            vscode.window.showInformationMessage(Strings.exportSucceeded, ...items).then((selection) => {
                if (selection === Strings.openPdf && exportInfo) {
                    const [exportPath, pathType] = exportInfo;
                    const uri = vscode.Uri.file(exportPath);
                    if (pathType === 'file') {
                        vscode.env.openExternal(uri);
                    } else if (pathType === 'folder') {
                        vscode.commands.executeCommand('revealFileInOS', uri);
                    }
                }
            });
            logger.dispose();
        },
        onError: (error) => {
            vscode.window.showErrorMessage(error);
            logger.dispose();
        },
        // onProgress events are automatically logged by the service
    };

    try {
        await exportService.exportToPdf(exportConfig, events);
    } catch (error) {
        const errorMessage = `Export failed: ${error}`;
        vscode.window.showErrorMessage(errorMessage);
        logger.error(errorMessage);
        logger.dispose();
    }
}
