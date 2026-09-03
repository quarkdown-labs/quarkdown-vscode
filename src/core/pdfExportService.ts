import { ProcessManager, ProcessConfig } from './processManager';
import { QuarkdownCommandBuilder } from './commandBuilder';
import { Logger, NoOpLogger } from './logger';
import { getPathFromPdfExportOutput } from './utils';

/**
 * Configuration for PDF export operation.
 */
export interface PdfExportConfig {
    /** Path to the Quarkdown executable */
    executablePath: string;
    /** Path to the source .qd file */
    filePath: string;
    /** Output directory for the PDF */
    outputDirectory: string;
    /** Additional command line arguments appended to the compiler invocation */
    additionalArgs?: string[];
    /** Logger for operation tracking */
    logger?: Logger;
}

/**
 * Events that can occur during PDF export.
 */
export interface PdfExportEvents {
    /** Called when the export process outputs to stdout */
    onProgress?: (data: string) => void;
    /** Called when the export succeeds */
    onSuccess?: (exportInfo?: undefined | [string, 'file' | 'folder']) => void;
    /** Called when the export fails */
    onError?: (error: string) => void;
}

/**
 * Pure PDF export service without VS Code dependencies.
 * Handles the compilation of Quarkdown files to PDF format.
 */
export class PdfExportService {
    private readonly logger: Logger = new NoOpLogger();
    /**
     * The exports currently in flight, one process each. A single shared process would
     * make each new export terminate its predecessor, since starting a process stops
     * whatever that manager was already running.
     */
    private readonly running = new Set<ProcessManager>();

    /**
     * Export a Quarkdown file to PDF.
     *
     * @param config Export configuration
     * @param events Event handlers for progress tracking
     * @returns Promise that resolves when export completes
     */
    public async exportToPdf(config: PdfExportConfig, events?: PdfExportEvents): Promise<void> {
        const logger = config.logger || this.logger;
        const processManager = new ProcessManager();

        // Local to this export: concurrent exports must not overwrite each other's output.
        let lastStdoutData: string | undefined;

        const command = QuarkdownCommandBuilder.buildPdfExportCommand(
            config.executablePath,
            config.filePath,
            config.outputDirectory,
            config.additionalArgs
        );

        logger.info(`Starting PDF export: ${command.command} ${command.args.join(' ')}`);

        let stderrBuffer = '';

        const processConfig: ProcessConfig = {
            command: command.command,
            args: command.args,
            cwd: command.cwd,
            logger,
            events: {
                onStdout: (data) => {
                    logger.info(data.trim());
                    events?.onProgress?.(data);
                    lastStdoutData = data;
                },
                onStderr: (data) => {
                    stderrBuffer += data;
                    logger.warn(data.trim());
                    events?.onProgress?.(data);
                },
                onError: (error) => {
                    const errorMessage =
                        error.code === 'ENOENT'
                            ? 'Quarkdown not found. Please install Quarkdown first.'
                            : error.message;
                    logger.error(`Process error: ${errorMessage}`);
                    events?.onError?.(errorMessage);
                },
                onExit: (code) => {
                    if (code !== 0) {
                        const errorMessage = `PDF export failed with exit code ${code}`;
                        logger.error(errorMessage);
                        events?.onError?.(errorMessage);
                        return;
                    }

                    if (stderrBuffer.trim()) {
                        const errorMessage = `PDF export failed: ${stderrBuffer.trim()}`;
                        logger.error(errorMessage);
                        events?.onError?.(errorMessage);
                    } else {
                        logger.info('PDF export completed successfully');
                        const exportInfo = () => {
                            if (!lastStdoutData) {
                                logger.warn('No stdout data to parse for export path');
                                return undefined;
                            }
                            const path = getPathFromPdfExportOutput(lastStdoutData);
                            if (!path) {
                                logger.warn('Failed to extract export path from stdout data');
                                return undefined;
                            }
                            return path;
                        };
                        events?.onSuccess?.(exportInfo());
                    }
                },
            },
        };

        this.running.add(processManager);

        try {
            await processManager.start(processConfig);
            await processManager.waitForExit();
        } catch (error) {
            logger.error(`Failed to start PDF export: ${error}`);
            events?.onError?.(`Failed to start PDF export: ${error}`);
            throw error;
        } finally {
            this.running.delete(processManager);
        }
    }

    /**
     * Whether at least one export is currently in flight.
     */
    public isExporting(): boolean {
        return this.running.size > 0;
    }

    /**
     * Terminate every export in flight and resolve once each process is gone.
     *
     * Quarkdown's PDF pipeline spawns Node and a headless browser of its own, which the
     * JVM does not take down when it is signalled, so termination relies on
     * {@link ProcessManager} reaching the whole tree.
     */
    public async cancel(): Promise<void> {
        await Promise.all([...this.running].map((processManager) => processManager.stop()));
    }
}
