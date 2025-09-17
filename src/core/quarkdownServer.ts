import { ProcessManager, ProcessConfig } from '../core/processManager';
import { QuarkdownCommandBuilder } from './commandBuilder';
import { HttpPoller } from '../core/httpPoller';
import { Logger, NoOpLogger } from '../core/logger';

/**
 * Configuration for the Quarkdown server.
 */
export interface QuarkdownServerConfig {
    /** Path to the Quarkdown executable */
    executablePath: string;
    /** File path to compile */
    filePath: string;
    /** Additional command line arguments */
    additionalArgs?: string[];
    /** Server port (defaults to 8099) */
    port?: number;
    /** Output directory */
    outputDirectory: string;
    /** Logger instance (defaults to NoOpLogger) */
    logger?: Logger;
}

/**
 * Events emitted by the Quarkdown server.
 */
export interface QuarkdownServerEvents {
    /** Called when the server is ready to accept connections */
    onReady?: (url: string) => void;
    /** Called when an error occurs */
    onError?: (error: string) => void;
    /** Called when the server process exits */
    onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

/**
 * Pure Quarkdown server management class without VS Code dependencies.
 * Handles the lifecycle of the Quarkdown preview server process and
 * monitors its availability through HTTP polling.
 */
export class QuarkdownServer {
    private readonly processManager: ProcessManager;
    private readonly config: Required<QuarkdownServerConfig>;
    private readonly logger: Logger;
    private events?: QuarkdownServerEvents;
    private pollingTimer?: NodeJS.Timeout;

    public readonly url: string;

    constructor(config: QuarkdownServerConfig) {
        this.processManager = new ProcessManager();
        this.config = {
            port: 8099,
            additionalArgs: [],
            logger: new NoOpLogger(),
            ...config
        };
        this.logger = this.config.logger;
        this.url = `http://localhost:${this.config.port}/live`;
    }

    /**
     * Set event handlers for server lifecycle events.
     */
    public setEventHandlers(events: QuarkdownServerEvents): void {
        this.events = events;
    }

    /**
     * Start the Quarkdown server with live preview and watch mode.
     */
    public async start(): Promise<void> {
        this.logger.info(`Starting Quarkdown server for ${this.config.filePath}`);

        const command = QuarkdownCommandBuilder.buildPreviewCommand(
            this.config.executablePath,
            this.config.filePath,
            this.config.outputDirectory,
            this.config.port,
            this.config.additionalArgs
        );

        this.logger.info(`Starting Preview: ${command.command} ${command.args.join(' ')}`);

        const processConfig: ProcessConfig = {
            command: command.command,
            args: command.args,
            cwd: command.cwd,
            events: {
                onError: (error) => {
                    this.logger.error(`Process error: ${error.message}`);
                    const errorMessage = error.code === 'ENOENT'
                        ? 'Quarkdown not found. Please install Quarkdown first.'
                        : error.message;
                    this.events?.onError?.(errorMessage);
                },
                onExit: (code, signal) => {
                    this.logger.info(`Process exited (code=${code} signal=${signal})`);
                    this.stopPolling();
                    this.events?.onExit?.(code, signal);
                }
            }
        };

        try {
            await this.processManager.start(processConfig);
            this.logger.info(`Process started with PID: ${this.processManager.getPid()}`);

            // Start monitoring server availability
            void this.startServerMonitoring();

        } catch (error) {
            this.logger.error(`Failed to start process: ${error}`);
            this.events?.onError?.(`Failed to start server: ${error}`);
        }
    }

    /**
     * Stop the Quarkdown server.
     */
    public async stop(): Promise<void> {
        this.logger.info('Stopping Quarkdown server');
        this.stopPolling();
        await this.processManager.stop();
    }

    /**
     * Check if the server process is running.
     */
    public isRunning(): boolean {
        return this.processManager.isRunning();
    }

    /**
     * Check if the server is ready to accept HTTP connections.
     */
    public async isReady(): Promise<boolean> {
        return HttpPoller.checkOnce(this.url);
    }

    /**
     * Start monitoring the server's HTTP availability.
     * First does an initial check with multiple attempts, then starts continuous polling.
     */
    private async startServerMonitoring(): Promise<void> {
        this.logger.info('Monitoring server availability...');

        // Initial check with higher timeout tolerance
        const initialCheck = await HttpPoller.pollUntilReady({
            url: this.url,
            maxAttempts: 30,
            delayMs: 250,
            timeout: 250
        });

        if (initialCheck) {
            this.logger.info('Server is ready');
            this.events?.onReady?.(this.url);
            return;
        }

        this.logger.info('Server not ready in initial window, continuing to poll...');
        this.startContinuousPolling();
    }

    /**
     * Start continuous polling to detect when server becomes available.
     */
    private startContinuousPolling(): void {
        this.stopPolling();

        this.pollingTimer = setInterval(async () => {
            const ready = await HttpPoller.checkOnce(this.url, 200);
            if (ready) {
                this.logger.info('Server became ready during polling');
                this.events?.onReady?.(this.url);
                this.stopPolling();
            }
        }, 1000);
    }

    /**
     * Stop continuous polling.
     */
    private stopPolling(): void {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = undefined;
        }
    }
}
