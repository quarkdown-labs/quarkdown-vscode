import * as http from 'http';

/**
 * A lightweight HTTP server for testing HTTP polling logic.
 * Binds to an OS-assigned port to avoid conflicts.
 */
export interface TestHttpServer {
    /** The full URL the server is listening on (e.g. `http://127.0.0.1:12345`). */
    url: string;
    /** The underlying Node HTTP server instance. */
    server: http.Server;
    /** Gracefully close the server. */
    close(): Promise<void>;
}

/**
 * Create a test HTTP server that responds with the given status code.
 * The server binds to port 0, so the OS assigns a free port.
 *
 * @param handler Optional request handler. Defaults to 200 OK with empty body.
 */
export function createTestHttpServer(
    handler: http.RequestListener = (_req, res) => res.end()
): Promise<TestHttpServer> {
    return new Promise((resolve, reject) => {
        const server = http.createServer(handler);

        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                server.close();
                reject(new Error('Unexpected server address format'));
                return;
            }

            resolve({
                url: `http://127.0.0.1:${addr.port}`,
                server,
                close: () =>
                    new Promise<void>((res, rej) => {
                        server.close((err) => (err ? rej(err) : res()));
                    }),
            });
        });

        server.on('error', reject);
    });
}
