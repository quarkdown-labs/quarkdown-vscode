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

/** Poll until `check` stops throwing, or rethrow its failure once `timeoutMs` elapses. */
async function waitUntil(check: () => void, timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
        try {
            check();
            return;
        } catch (error) {
            if (Date.now() > deadline) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }
}

/** Whether a pid is still alive and signallable from this process. */
function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

describe('ProcessManager termination', () => {
    /**
     * Start a Node child running `script`, held open by an interval, and resolve with its
     * pid only once the child reports itself ready. Signalling a child that has not
     * finished booting merely tests the default signal disposition, not the handler
     * `script` installs.
     */
    async function startReadyChild(manager: ProcessManager, script: string): Promise<number> {
        let stdout = '';

        await manager.start({
            command: 'node',
            args: ['-e', `${script} setInterval(() => {}, 1000); console.log('ready');`],
            events: { onStdout: (data) => (stdout += data) },
        });

        await waitUntil(() => expect(stdout).toContain('ready'));

        return manager.getPid()!;
    }

    /** A child that delays its exit, the way a server draining open connections does. */
    const SLOW_TO_EXIT = "process.on('SIGTERM', () => setTimeout(() => process.exit(0), 800));";
    /** A child that ignores the graceful request outright. */
    const IGNORES_SIGTERM = "process.on('SIGTERM', () => {});";

    it('shares a single promise between concurrent stop() callers', async () => {
        const manager = new ProcessManager();
        const pid = await startReadyChild(manager, SLOW_TO_EXIT);

        const first = manager.stop();
        const second = manager.stop();

        // The second caller must not be told "already handled" and let through early.
        expect(second).toBe(first);

        await second;
        expect(isAlive(pid)).toBe(false);
        expect(manager.isRunning()).toBe(false);
    });

    it('stop() resolves only once the child has really exited', async () => {
        const manager = new ProcessManager();
        const pid = await startReadyChild(manager, SLOW_TO_EXIT);

        let stopped = false;
        const stopping = manager.stop().then(() => {
            stopped = true;
        });

        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(stopped).toBe(false);
        expect(isAlive(pid)).toBe(true);

        await stopping;
        expect(isAlive(pid)).toBe(false);
    });

    it('escalates to an unconditional kill when the child ignores SIGTERM', async () => {
        const manager = new ProcessManager();
        const pid = await startReadyChild(manager, IGNORES_SIGTERM);

        await manager.stop();

        expect(isAlive(pid)).toBe(false);
        expect(manager.isRunning()).toBe(false);
    });

    it('terminates the whole process group, not just the direct child', async () => {
        const manager = new ProcessManager();
        let stdout = '';

        // `sh` does not exec here, so `sleep` is a grandchild: unreachable by a signal
        // aimed at the direct child alone.
        await manager.start({
            command: 'sh',
            args: ['-c', 'sleep 60 & echo $!; wait'],
            events: { onStdout: (data) => (stdout += data) },
        });

        await waitUntil(() => expect(stdout.trim()).toMatch(/^\d+$/));
        const grandchild = Number(stdout.trim());
        expect(isAlive(grandchild)).toBe(true);

        await manager.stop();
        await waitUntil(() => expect(isAlive(grandchild)).toBe(false));
    });

    it('stop() is a no-op after the child has exited on its own', async () => {
        const manager = new ProcessManager();
        await manager.start({ command: 'true', args: [] });

        await manager.waitForExit(5000);
        await manager.stop();

        expect(manager.isRunning()).toBe(false);
        expect(manager.getPid()).toBeUndefined();
    });
});
