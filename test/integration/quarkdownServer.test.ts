import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as http from 'http';
import { QuarkdownServer } from '../../src/core/quarkdownServer';

const QUARKDOWN_PATH = process.env.QUARKDOWN_PATH;

/**
 * Integration tests that exercise the real Quarkdown CLI.
 * Skipped when the QUARKDOWN_PATH environment variable is not set.
 */
describe.skipIf(!QUARKDOWN_PATH)('QuarkdownServer (integration)', () => {
    let server: QuarkdownServer;
    let tmpDir: string;

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qd-test-'));
    });

    afterEach(async () => {
        await server?.stop();
        // Clean up temp directory contents
        for (const entry of fs.readdirSync(tmpDir)) {
            fs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true });
        }
    });

    const fixturePath = path.resolve(__dirname, '../../test/fixtures/sample.qd');

    it('starts real preview server and fires onReady', async () => {
        const readyUrl = await new Promise<string>((resolve, reject) => {
            server = new QuarkdownServer({
                executablePath: QUARKDOWN_PATH!,
                filePath: fixturePath,
                outputDirectory: tmpDir,
                port: 0, // Let Quarkdown choose, or use a high port
            });

            // Use a high port to avoid conflicts
            server = new QuarkdownServer({
                executablePath: QUARKDOWN_PATH!,
                filePath: fixturePath,
                outputDirectory: tmpDir,
                port: 18099,
            });

            server.setEventHandlers({
                onReady: (url) => resolve(url),
                onError: (err) => reject(new Error(err)),
            });

            void server.start();
        });

        expect(readyUrl).toContain('localhost');
    });

    it('server responds to HTTP after ready', async () => {
        const readyUrl = await new Promise<string>((resolve, reject) => {
            server = new QuarkdownServer({
                executablePath: QUARKDOWN_PATH!,
                filePath: fixturePath,
                outputDirectory: tmpDir,
                port: 18100,
            });

            server.setEventHandlers({
                onReady: (url) => resolve(url),
                onError: (err) => reject(new Error(err)),
            });

            void server.start();
        });

        // Make an HTTP request to the ready URL
        const statusCode = await new Promise<number>((resolve, reject) => {
            http.get(readyUrl, (res) => {
                res.resume();
                resolve(res.statusCode ?? 0);
            }).on('error', reject);
        });

        expect(statusCode).toBeGreaterThanOrEqual(200);
        expect(statusCode).toBeLessThan(500);
    });

    it('stop() terminates the process', async () => {
        await new Promise<void>((resolve, reject) => {
            server = new QuarkdownServer({
                executablePath: QUARKDOWN_PATH!,
                filePath: fixturePath,
                outputDirectory: tmpDir,
                port: 18101,
            });

            server.setEventHandlers({
                onReady: () => resolve(),
                onError: (err) => reject(new Error(err)),
            });

            void server.start();
        });

        expect(server.isRunning()).toBe(true);
        await server.stop();
        expect(server.isRunning()).toBe(false);
    });

    it('fires onExit after stop', async () => {
        const exitPromise = new Promise<number | null>((resolve, reject) => {
            server = new QuarkdownServer({
                executablePath: QUARKDOWN_PATH!,
                filePath: fixturePath,
                outputDirectory: tmpDir,
                port: 18102,
            });

            server.setEventHandlers({
                onReady: () => void server.stop(),
                onError: (err) => reject(new Error(err)),
                onExit: (code) => resolve(code),
            });

            void server.start();
        });

        const exitCode = await exitPromise;
        expect(exitCode).toBeTypeOf('number');
    });

    it('fires error for invalid executable', async () => {
        const errorMsg = await new Promise<string>((resolve) => {
            server = new QuarkdownServer({
                executablePath: '/nonexistent/quarkdown',
                filePath: fixturePath,
                outputDirectory: tmpDir,
            });

            server.setEventHandlers({
                onError: (err) => resolve(err),
            });

            void server.start();
        });

        expect(errorMsg.length).toBeGreaterThan(0);
    });
});
