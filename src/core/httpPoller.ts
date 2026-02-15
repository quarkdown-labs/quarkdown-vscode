import * as http from 'http';

/**
 * Configuration for HTTP polling.
 */
export interface HttpPollerConfig {
    /** URL to poll */
    url: string;
    /** Request timeout in milliseconds */
    timeout?: number;
    /** Number of attempts before giving up */
    maxAttempts?: number;
    /** Delay between attempts in milliseconds */
    delayMs?: number;
}

/**
 * Pure HTTP utility class for checking server availability.
 * No VS Code dependencies, making it easily testable and reusable.
 */
export class HttpPoller {
    /**
     * Poll a URL until it responds successfully or times out.
     *
     * @param config Polling configuration
     * @returns Promise that resolves to true if server responds, false if timeout
     */
    public static async pollUntilReady(config: HttpPollerConfig): Promise<boolean> {
        const { url, timeout = 200, maxAttempts = 20, delayMs = 300 } = config;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const success = await this.checkOnce(url, timeout);
            if (success) {
                return true;
            }

            if (attempt < maxAttempts - 1) {
                await this.delay(delayMs);
            }
        }

        return false;
    }

    /**
     * Check if a URL responds successfully once.
     *
     * @param url URL to check
     * @param timeout Request timeout in milliseconds
     * @returns Promise that resolves to true if successful, false otherwise
     */
    public static async checkOnce(url: string, timeout = 200): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const req = http.get(url, { timeout }, (res) => {
                res.resume(); // Consume response to free up memory
                resolve(true);
            });

            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * Simple promise-based delay utility.
     *
     * @param ms Milliseconds to delay
     */
    private static delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
