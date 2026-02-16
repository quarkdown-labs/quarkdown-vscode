import { describe, it, expect, afterEach } from 'vitest';
import { ProcessManager } from '../../src/core/processManager';

describe('ProcessManager', () => {
    const manager = new ProcessManager();

    afterEach(async () => {
        await manager.stop();
    });

    it('spawns a process and isRunning() returns true', async () => {
        await manager.start({ command: 'sleep', args: ['10'] });

        expect(manager.isRunning()).toBe(true);
        expect(manager.getPid()).toBeTypeOf('number');
    });

    it('captures stdout', async () => {
        const chunks: string[] = [];

        await manager.start({
            command: 'echo',
            args: ['hello world'],
            events: { onStdout: (data) => chunks.push(data) },
        });

        await manager.waitForExit(5000);
        expect(chunks.join('')).toContain('hello world');
    });

    it('captures stderr', async () => {
        const chunks: string[] = [];

        await manager.start({
            command: 'node',
            args: ['-e', 'process.stderr.write("err msg")'],
            events: { onStderr: (data) => chunks.push(data) },
        });

        await manager.waitForExit(5000);
        expect(chunks.join('')).toContain('err msg');
    });

    it('fires onExit with code 0', async () => {
        let exitCode: number | null = null;

        await manager.start({
            command: 'true',
            args: [],
            events: { onExit: (code) => (exitCode = code) },
        });

        await manager.waitForExit(5000);
        expect(exitCode).toBe(0);
    });

    it('fires onExit with non-zero code', async () => {
        let exitCode: number | null = null;

        await manager.start({
            command: 'node',
            args: ['-e', 'process.exit(42)'],
            events: { onExit: (code) => (exitCode = code) },
        });

        await manager.waitForExit(5000);
        expect(exitCode).toBe(42);
    });

    it('fires onError for nonexistent command (ENOENT)', async () => {
        let errorCode: string | undefined;

        await manager.start({
            command: 'this-command-does-not-exist-xyz',
            args: [],
            events: { onError: (err) => (errorCode = err.code) },
        });

        // Give time for the error event to fire
        await new Promise((r) => setTimeout(r, 500));
        expect(errorCode).toBe('ENOENT');
    });

    it('stop() terminates a running process', async () => {
        await manager.start({ command: 'sleep', args: ['60'] });
        expect(manager.isRunning()).toBe(true);

        await manager.stop();
        expect(manager.isRunning()).toBe(false);
    });

    it('stop() is a no-op on a fresh manager', async () => {
        const fresh = new ProcessManager();
        await fresh.stop(); // should not throw
        expect(fresh.isRunning()).toBe(false);
    });

    it('getPid() returns undefined before start and after stop', async () => {
        const fresh = new ProcessManager();
        expect(fresh.getPid()).toBeUndefined();

        await fresh.start({ command: 'sleep', args: ['10'] });
        expect(fresh.getPid()).toBeTypeOf('number');

        await fresh.stop();
        expect(fresh.getPid()).toBeUndefined();
    });

    it('waitForExit resolves with exit code', async () => {
        await manager.start({ command: 'node', args: ['-e', 'process.exit(7)'] });

        const code = await manager.waitForExit(5000);
        expect(code).toBe(7);
    });

    it('waitForExit resolves null when no process is running', async () => {
        const fresh = new ProcessManager();
        const code = await fresh.waitForExit();

        expect(code).toBeNull();
    });

    it('waitForExit rejects on timeout', async () => {
        await manager.start({ command: 'sleep', args: ['60'] });

        await expect(manager.waitForExit(50)).rejects.toThrow(/did not exit within/);
    });
});
