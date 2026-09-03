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
        return this.server?.url ?? 'http://127.0.0.1:8099/live';
    }

    public setEventHandlers(events: ServerEvents): void {
        this.events = events;
    }

    /** Start the Quarkdown server for a file */
    public async start(filePath: string): Promise<void> {
        await this.stop();

        const config = getQuarkdownConfig();

        const server = new QuarkdownServer({
            executablePath: config.executablePath,
            filePath: filePath,
            outputDirectory: config.outputDirectory,
            additionalArgs: config.additionalCompilerOptions,
            logger: this.logger,
        });
        this.server = server;

        // Set up event forwarding. Every handler is bound to this specific server: one
        // stopped earlier can outlive the call that stopped it, and its late events must
        // not be reported as, or clear the reference to, the server that replaced it.
        const isCurrent = () => this.server === server;

        const serverEvents: QuarkdownServerEvents = {
            onReady: (url) => {
                if (isCurrent()) {
                    this.events?.onReady(url);
                }
            },
            onError: (error) => {
                if (isCurrent()) {
                    this.events?.onError(error);
                }
            },
            onExit: (code, signal) => {
                if (!isCurrent()) {
                    return;
                }
                this.cleanup();
                this.events?.onExit(code, signal);
            },
        };

        server.setEventHandlers(serverEvents);

        try {
            await server.start();
        } catch (error) {
            this.logger.error(`Failed to start server: ${error}`);
            this.events?.onError(`Failed to start server: ${error}`);
        }
    }

    /** Stop the server process */
    public async stop(): Promise<void> {
        const server = this.server;

        if (!server) {
            return;
        }

        await server.stop();

        // A start() may have replaced the server while the stop was in flight.
        if (this.server === server) {
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
