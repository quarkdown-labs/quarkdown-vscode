import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PdfExportService } from '../../src/core/pdfExportService';
import { ProcessManager } from '../../src/core/processManager';

vi.mock('../../src/core/processManager');

describe('PdfExportService', () => {
    let service: PdfExportService;

    const defaultConfig = {
        executablePath: 'quarkdown',
        filePath: '/project/main.qd',
        outputDirectory: '/project/output',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        service = new PdfExportService();

        // Default mock: start succeeds, waitForExit resolves immediately
        vi.mocked(ProcessManager.prototype.start).mockResolvedValue(undefined);
        vi.mocked(ProcessManager.prototype.waitForExit).mockResolvedValue(0);
        vi.mocked(ProcessManager.prototype.stop).mockResolvedValue(undefined);
        vi.mocked(ProcessManager.prototype.isRunning).mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('spawns process with --pdf in args', async () => {
        vi.mocked(ProcessManager.prototype.start).mockImplementation(async (config) => {
            // Simulate immediate success exit
            config.events?.onExit?.(0, null);
        });

        await service.exportToPdf(defaultConfig);

        expect(ProcessManager.prototype.start).toHaveBeenCalledOnce();
        const config = vi.mocked(ProcessManager.prototype.start).mock.calls[0][0];
        expect(config.args).toContain('--pdf');
    });

    it('fires onSuccess on exit code 0 with empty stderr', async () => {
        vi.mocked(ProcessManager.prototype.start).mockImplementation(async (config) => {
            config.events?.onExit?.(0, null);
        });

        const onSuccess = vi.fn();
        await service.exportToPdf(defaultConfig, { onSuccess });

        expect(onSuccess).toHaveBeenCalledOnce();
    });

    it('fires onError on non-zero exit code', async () => {
        vi.mocked(ProcessManager.prototype.start).mockImplementation(async (config) => {
            config.events?.onExit?.(1, null);
        });

        const onError = vi.fn();
        await service.exportToPdf(defaultConfig, { onError });

        expect(onError).toHaveBeenCalledWith(expect.stringContaining('exit code 1'));
    });

    it('fires onError when stderr has content even with code 0', async () => {
        vi.mocked(ProcessManager.prototype.start).mockImplementation(async (config) => {
            config.events?.onStderr?.('something went wrong');
            config.events?.onExit?.(0, null);
        });

        const onError = vi.fn();
        await service.exportToPdf(defaultConfig, { onError });

        expect(onError).toHaveBeenCalledWith(expect.stringContaining('something went wrong'));
    });

    it('forwards stdout/stderr to onProgress', async () => {
        vi.mocked(ProcessManager.prototype.start).mockImplementation(async (config) => {
            config.events?.onStdout?.('progress 50%');
            config.events?.onStderr?.('warn: something');
            config.events?.onExit?.(0, null);
        });

        const onProgress = vi.fn();
        await service.exportToPdf(defaultConfig, { onProgress });

        expect(onProgress).toHaveBeenCalledWith('progress 50%');
        expect(onProgress).toHaveBeenCalledWith('warn: something');
    });

    it('fires onError with install message on ENOENT', async () => {
        vi.mocked(ProcessManager.prototype.start).mockImplementation(async (config) => {
            const err = new Error('spawn ENOENT') as NodeJS.ErrnoException;
            err.code = 'ENOENT';
            config.events?.onError?.(err);
        });

        const onError = vi.fn();
        await service.exportToPdf(defaultConfig, { onError });

        expect(onError).toHaveBeenCalledWith(expect.stringContaining('install'));
    });

    it('isExporting() delegates to ProcessManager.isRunning', () => {
        vi.mocked(ProcessManager.prototype.isRunning).mockReturnValue(true);
        expect(service.isExporting()).toBe(true);

        vi.mocked(ProcessManager.prototype.isRunning).mockReturnValue(false);
        expect(service.isExporting()).toBe(false);
    });

    it('cancel() calls ProcessManager.stop', async () => {
        await service.cancel();

        expect(ProcessManager.prototype.stop).toHaveBeenCalledOnce();
    });
});
