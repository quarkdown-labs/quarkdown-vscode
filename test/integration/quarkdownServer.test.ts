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
    /** Extra temp directories created by individual tests, cleaned up after server stops. */
    const extraDirs: string[] = [];

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qd-test-'));
    });

    afterEach(async () => {
        await server?.stop();
        // Clean up temp directory contents
        for (const entry of fs.readdirSync(tmpDir)) {
            fs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true });
        }
        // Clean up extra dirs after server has released file handles
        for (const dir of extraDirs) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        extraDirs.length = 0;
    });

    const fixturePath = path.resolve(__dirname, '../../test/fixtures/sample.qd');

    /**
     * Poll a file until its content differs from the given value, or until timeout.
     */
    async function pollUntilChanged(filePath: string, previousContent: string, timeoutMs: number): Promise<boolean> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const current = fs.readFileSync(filePath, 'utf-8');
            if (current !== previousContent) return true;
            await new Promise((r) => setTimeout(r, 300));
        }
        return false;
    }

    /** Helper to start a server and wait for it to be ready. */
    function startAndWaitForReady(filePath: string, port: number): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            server = new QuarkdownServer({
                executablePath: QUARKDOWN_PATH!,
                filePath,
                outputDirectory: tmpDir,
                port,
            });

            server.setEventHandlers({
                onReady: (url) => resolve(url),
                onError: (err) => reject(new Error(err)),
            });

            void server.start();
        });
    }

    it('starts real preview server and fires onReady', async () => {
        const readyUrl = await startAndWaitForReady(fixturePath, 18099);

        expect(readyUrl).toContain('127.0.0.1');
    });

    it('server responds to HTTP after ready', async () => {
        const readyUrl = await startAndWaitForReady(fixturePath, 18100);

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
        await startAndWaitForReady(fixturePath, 18101);

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

    /**
     * Find `index.html` inside the output directory.
     * Quarkdown nests output in a subdirectory named after the document.
     */
    function findIndexHtml(dir: string): string | undefined {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const found = findIndexHtml(full);
                if (found) return found;
            } else if (entry.name === 'index.html') {
                return full;
            }
        }
        return undefined;
    }

    it('preview produces an output folder with a non-empty index.html', async () => {
        await startAndWaitForReady(fixturePath, 18103);

        const indexPath = findIndexHtml(tmpDir);
        expect(indexPath, 'index.html should exist in output directory').toBeDefined();

        const content = fs.readFileSync(indexPath!, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
    });

    it('modifying the source file updates index.html', async () => {
        // Use a separate directory for the source file so the output watcher
        // doesn't interfere with change detection.
        const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qd-src-'));
        extraDirs.push(srcDir);
        const srcFile = path.join(srcDir, 'source.qd');
        fs.copyFileSync(fixturePath, srcFile);

        await startAndWaitForReady(srcFile, 18104);

        const indexPath = findIndexHtml(tmpDir);
        expect(indexPath, 'index.html should exist before modification').toBeDefined();

        const originalContent = fs.readFileSync(indexPath!, 'utf-8');

        // Let the file watcher fully settle before modifying
        await new Promise((r) => setTimeout(r, 2000));

        // Modify the source file while the preview server is watching
        fs.writeFileSync(srcFile, '# Updated\n\nNew paragraph content.\n');

        // Wait for the watcher to pick up the change and recompile
        const changed = await pollUntilChanged(indexPath!, originalContent, 30_000);
        expect(changed, 'index.html should have changed after modifying the source').toBe(true);
    });

    /**
     * Whether a request to `url` is refused, meaning nothing is listening any more.
     *
     * Binding the port instead would not answer the question: SO_REUSEADDR lets a probe
     * bind 127.0.0.1 while the server still holds the wildcard address, so a running
     * server reads as gone.
     */
    function isRefused(url: string): Promise<boolean> {
        return new Promise((resolve) => {
            const request = http.get(url, (res) => {
                res.resume();
                resolve(false);
            });
            request.on('error', () => resolve(true));
            request.setTimeout(2000, () => {
                request.destroy();
                resolve(false);
            });
        });
    }

    it('stops serving by the time stop() resolves', async () => {
        const readyUrl = await startAndWaitForReady(fixturePath, 18105);
        expect(await isRefused(readyUrl), 'server should answer while it runs').toBe(false);

        await server.stop();

        // stop() resolving has to mean the process is gone, not merely that it was
        // signalled. On Windows this exercises the taskkill path, whose exit code used to
        // be read as proof of death even while the tree was still dying.
        expect(await isRefused(readyUrl), 'server should be gone once stop() resolves').toBe(true);
    });

    it('starts again on the same port immediately after a stop', async () => {
        const port = 18106;
        await startAndWaitForReady(fixturePath, port);

        await server.stop();

        // Closing a preview and reopening it straight away is the ordinary case that used
        // to leave an untracked server behind: the replacement could not bind the port the
        // previous one still held, and never became ready.
        const readyUrl = await startAndWaitForReady(fixturePath, port);
        expect(readyUrl).toContain(String(port));
        expect(server.isRunning()).toBe(true);
    });

    it('fires error for invalid executable', async () => {
        // On Unix, a nonexistent command triggers an ENOENT error event.
        // On Windows, `cmd /c nonexistent` spawns successfully but exits
        // with a non-zero code, so we accept either onError or onExit.
        const result = await new Promise<string>((resolve) => {
            server = new QuarkdownServer({
                executablePath: '/nonexistent/quarkdown',
                filePath: fixturePath,
                outputDirectory: tmpDir,
            });

            server.setEventHandlers({
                onError: (err) => resolve(err),
                onExit: (code) => resolve(`exited with code ${code}`),
            });

            void server.start();
        });

        expect(result.length).toBeGreaterThan(0);
    });
});
