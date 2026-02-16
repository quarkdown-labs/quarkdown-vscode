import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuarkdownServer } from '../../src/core/quarkdownServer';
import { ProcessManager } from '../../src/core/processManager';
import { HttpPoller } from '../../src/core/httpPoller';

vi.mock('../../src/core/processManager');
vi.mock('../../src/core/httpPoller');

describe('QuarkdownServer', () => {
    let server: QuarkdownServer;

    const defaultConfig = {
        executablePath: 'quarkdown',
        filePath: '/project/main.qd',
        outputDirectory: '/project/output',
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default: process starts fine, poll fails initially
        vi.mocked(ProcessManager.prototype.start).mockResolvedValue(undefined);
        vi.mocked(ProcessManager.prototype.stop).mockResolvedValue(undefined);
        vi.mocked(ProcessManager.prototype.isRunning).mockReturnValue(false);
        vi.mocked(ProcessManager.prototype.getPid).mockReturnValue(1234);
        vi.mocked(HttpPoller.pollUntilReady).mockResolvedValue(false);
        vi.mocked(HttpPoller.checkOnce).mockResolvedValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('URL includes configured port; defaults to 8099', () => {
        server = new QuarkdownServer(defaultConfig);
        expect(server.url).toBe('http://localhost:8099/live');

        server = new QuarkdownServer({ ...defaultConfig, port: 3000 });
        expect(server.url).toBe('http://localhost:3000/live');
    });

    it('start() calls ProcessManager.start with preview command', async () => {
        server = new QuarkdownServer(defaultConfig);
        vi.mocked(HttpPoller.pollUntilReady).mockResolvedValue(true);

        await server.start();

        expect(ProcessManager.prototype.start).toHaveBeenCalledOnce();

        const config = vi.mocked(ProcessManager.prototype.start).mock.calls[0][0];
        expect(config.args).toContain('--preview');
        expect(config.args).toContain('--watch');
        expect(config.args).toContain('--server-port');
    });

    it('start() fires onReady when initial pollUntilReady succeeds', async () => {
        vi.mocked(HttpPoller.pollUntilReady).mockResolvedValue(true);

        server = new QuarkdownServer(defaultConfig);
        const onReady = vi.fn();
        server.setEventHandlers({ onReady });

        await server.start();
        // Allow async monitoring to complete
        await vi.waitFor(() => expect(onReady).toHaveBeenCalledWith('http://localhost:8099/live'));
    });

    it('start() begins continuous polling when initial poll fails', async () => {
        vi.useFakeTimers();
        vi.mocked(HttpPoller.pollUntilReady).mockResolvedValue(false);
        vi.mocked(HttpPoller.checkOnce).mockResolvedValue(false);

        server = new QuarkdownServer(defaultConfig);
        const onReady = vi.fn();
        server.setEventHandlers({ onReady });

        await server.start();

        // Advance past the initial poll — monitoring starts continuous polling
        await vi.advanceTimersByTimeAsync(1500);

        // Server not yet ready
        expect(onReady).not.toHaveBeenCalled();

        // Now server becomes ready
        vi.mocked(HttpPoller.checkOnce).mockResolvedValue(true);
        await vi.advanceTimersByTimeAsync(1000);

        expect(onReady).toHaveBeenCalledWith('http://localhost:8099/live');

        vi.useRealTimers();
    });

    it('continuous polling fires onError after 120 failed attempts', async () => {
        vi.useFakeTimers();
        vi.mocked(HttpPoller.pollUntilReady).mockResolvedValue(false);
        vi.mocked(HttpPoller.checkOnce).mockResolvedValue(false);

        server = new QuarkdownServer(defaultConfig);
        const onError = vi.fn();
        server.setEventHandlers({ onError });

        await server.start();

        // Advance through all 120 poll attempts (1 second each)
        for (let i = 0; i < 121; i++) {
            await vi.advanceTimersByTimeAsync(1000);
        }

        expect(onError).toHaveBeenCalledWith(expect.stringContaining('not become ready'));

        vi.useRealTimers();
    });

    it('forwards ENOENT error as install message', async () => {
        vi.mocked(ProcessManager.prototype.start).mockImplementation(async (config) => {
            // Simulate the process emitting an ENOENT error
            const err = new Error('spawn ENOENT') as NodeJS.ErrnoException;
            err.code = 'ENOENT';
            config.events?.onError?.(err);
        });

        server = new QuarkdownServer(defaultConfig);
        const onError = vi.fn();
        server.setEventHandlers({ onError });

        await server.start();

        expect(onError).toHaveBeenCalledWith(expect.stringContaining('install'));
    });

    it('forwards process exit event', async () => {
        vi.mocked(ProcessManager.prototype.start).mockImplementation(async (config) => {
            config.events?.onExit?.(1, null);
        });

        server = new QuarkdownServer(defaultConfig);
        const onExit = vi.fn();
        server.setEventHandlers({ onExit });

        await server.start();

        expect(onExit).toHaveBeenCalledWith(1, null);
    });

    it('stop() calls ProcessManager.stop and clears polling', async () => {
        vi.useFakeTimers();
        vi.mocked(HttpPoller.pollUntilReady).mockResolvedValue(false);

        server = new QuarkdownServer(defaultConfig);
        await server.start();

        await server.stop();

        expect(ProcessManager.prototype.stop).toHaveBeenCalled();

        vi.useRealTimers();
    });

    it('isRunning() delegates to ProcessManager', () => {
        server = new QuarkdownServer(defaultConfig);

        vi.mocked(ProcessManager.prototype.isRunning).mockReturnValue(true);
        expect(server.isRunning()).toBe(true);

        vi.mocked(ProcessManager.prototype.isRunning).mockReturnValue(false);
        expect(server.isRunning()).toBe(false);
    });

    it('isReady() delegates to HttpPoller.checkOnce', async () => {
        server = new QuarkdownServer(defaultConfig);

        vi.mocked(HttpPoller.checkOnce).mockResolvedValue(true);
        expect(await server.isReady()).toBe(true);

        vi.mocked(HttpPoller.checkOnce).mockResolvedValue(false);
        expect(await server.isReady()).toBe(false);
    });
});
