import { describe, it, expect, afterEach } from 'vitest';
import { HttpPoller } from '../../src/core/httpPoller';
import { createTestHttpServer, TestHttpServer } from '../helpers/testHttpServer';

describe('HttpPoller', () => {
    let server: TestHttpServer | undefined;

    afterEach(async () => {
        await server?.close();
        server = undefined;
    });

    describe('checkOnce', () => {
        it('returns true for a responding server', async () => {
            server = await createTestHttpServer();

            const result = await HttpPoller.checkOnce(server.url);

            expect(result).toBe(true);
        });

        it('returns false for a non-existent server', async () => {
            const result = await HttpPoller.checkOnce('http://127.0.0.1:1', 200);

            expect(result).toBe(false);
        });

        it('returns true even for non-200 status', async () => {
            server = await createTestHttpServer((_req, res) => {
                res.statusCode = 500;
                res.end();
            });

            const result = await HttpPoller.checkOnce(server.url);

            expect(result).toBe(true);
        });

        it('returns false when server delays past timeout', async () => {
            server = await createTestHttpServer((_req, res) => {
                // Never respond — let the timeout trigger
                setTimeout(() => res.end(), 10_000);
            });

            const result = await HttpPoller.checkOnce(server.url, 50);

            expect(result).toBe(false);
        });
    });

    describe('pollUntilReady', () => {
        it('returns true immediately for a ready server', async () => {
            server = await createTestHttpServer();

            const result = await HttpPoller.pollUntilReady({
                url: server.url,
                maxAttempts: 5,
                delayMs: 10,
            });

            expect(result).toBe(true);
        });

        it('returns true after delayed startup', async () => {
            let requestCount = 0;

            server = await createTestHttpServer((_req, res) => {
                requestCount++;
                if (requestCount < 3) {
                    res.destroy(); // Reject early requests
                    return;
                }
                res.end('ok');
            });

            const result = await HttpPoller.pollUntilReady({
                url: server.url,
                maxAttempts: 10,
                delayMs: 50,
                timeout: 200,
            });

            expect(result).toBe(true);
        });

        it('returns false after exhausting maxAttempts', async () => {
            // Point at a port that definitely isn't listening
            const result = await HttpPoller.pollUntilReady({
                url: 'http://127.0.0.1:1',
                maxAttempts: 3,
                delayMs: 10,
                timeout: 50,
            });

            expect(result).toBe(false);
        });
    });
});
