import { QuarkdownServer, QuarkdownServerEvents } from './core/quarkdownServer';
import { VSCodeLogger } from './vscode/vscodeLogger';
import { getQuarkdownConfig } from './config';
import { OUTPUT_CHANNELS } from './constants';

export interface ServerEvents {
    onReady: (url: string) => void;
    onError: (error: string) => void;
    onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
}

/**
 * VS Code-specific wrapper around the core QuarkdownServer.
 * Provides VS Code integration while delegating core functionality
 * to the platform-independent QuarkdownServer class.
 */
export class QuarkdownLivePreviewServer {
    private server: QuarkdownServer | undefined;
    private readonly logger: VSCodeLogger;
    private events: ServerEvents | undefined;

    constructor() {
        this.logger = new VSCodeLogger(OUTPUT_CHANNELS.preview);
    }

    public get url(): string {
        return this.server?.url ?? 'http://localhost:8099/live';
    }

    public setEventHandlers(events: ServerEvents): void {
        this.events = events;
    }

    /** Start the Quarkdown server for a file */
    public async start(filePath: string): Promise<void> {
        await this.stop();

        const config = getQuarkdownConfig();

        this.server = new QuarkdownServer({
            executablePath: config.executablePath,
            filePath: filePath,
            outputDirectory: config.outputDirectory,
            logger: this.logger
        });

        // Set up event forwarding
        const serverEvents: QuarkdownServerEvents = {
            onReady: (url) => {
                this.events?.onReady(url);
            },
            onError: (error) => {
                this.events?.onError(error);
            },
            onExit: (code, signal) => {
                this.cleanup();
                this.events?.onExit(code, signal);
            }
        };

        this.server.setEventHandlers(serverEvents);

        try {
            await this.server.start();
        } catch (error) {
            this.logger.error(`Failed to start server: ${error}`);
            this.events?.onError(`Failed to start server: ${error}`);
        }
    }

    /** Stop the server process */
    public async stop(): Promise<void> {
        if (this.server) {
            await this.server.stop();
            this.cleanup();
        }
    }

    public isRunning(): boolean {
        return this.server?.isRunning() ?? false;
    }

    /** Check if the server is ready to accept connections */
    public async isReady(): Promise<boolean> {
        return this.server?.isReady() ?? false;
    }

    private cleanup(): void {
        this.server = undefined;
    }

    /**
     * Dispose of resources when no longer needed.
     * Should be called during extension deactivation.
     */
    public dispose(): void {
        this.logger.dispose();
    }
}
