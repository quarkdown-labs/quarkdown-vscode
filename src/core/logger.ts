/**
 * Interface for logging operations.
 * This abstraction allows for different logging implementations
 * (VS Code output channels, console, file, etc.)
 */
export interface Logger {
    /** Log an informational message */
    info(message: string): void;
    /** Log an error message */
    error(message: string): void;
    /** Log a warning message */
    warn(message: string): void;
    /** Show the log output to the user (if applicable) */
    show?(): void;
}

/**
 * Simple console-based logger implementation.
 * Useful for testing and non-VS Code environments.
 */
export class ConsoleLogger implements Logger {
    private readonly prefix: string;

    constructor(prefix = '') {
        this.prefix = prefix ? `[${prefix}] ` : '';
    }

    public info(message: string): void {
        console.log(`${this.prefix}${message}`);
    }

    public error(message: string): void {
        console.error(`${this.prefix}${message}`);
    }

    public warn(message: string): void {
        console.warn(`${this.prefix}${message}`);
    }
}

/**
 * No-operation logger that discards all messages.
 * Useful for testing or when logging is not needed.
 */
export class NoOpLogger implements Logger {
    public info(): void {
        /* no-op */
    }
    public error(): void {
        /* no-op */
    }
    public warn(): void {
        /* no-op */
    }
}
