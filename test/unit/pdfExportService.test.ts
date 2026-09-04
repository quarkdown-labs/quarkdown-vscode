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

    it('forwards additionalArgs to the spawned process', async () => {
        vi.mocked(ProcessManager.prototype.start).mockImplementation(async (config) => {
            config.events?.onExit?.(0, null);
        });

        await service.exportToPdf({
            ...defaultConfig,
            additionalArgs: ['--pretty', '-Dkey=value'],
        });

        const config = vi.mocked(ProcessManager.prototype.start).mock.calls[0][0];
        expect(config.args).toContain('--pdf');
        expect(config.args).toContain('--pretty');
        expect(config.args).toContain('-Dkey=value');
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

    it('isExporting() reports whether an export is in flight', async () => {
        let duringExport: boolean | undefined;
        vi.mocked(ProcessManager.prototype.start).mockImplementation(async () => {
            duringExport = service.isExporting();
        });

        expect(service.isExporting()).toBe(false);
        await service.exportToPdf(defaultConfig);

        expect(duringExport).toBe(true);
        expect(service.isExporting()).toBe(false);
    });

    it('gives each export its own process, so one cannot terminate another', async () => {
        vi.mocked(ProcessManager.prototype.start).mockImplementation(async (config) => {
            config.events?.onExit?.(0, null);
        });

        await Promise.all([service.exportToPdf(defaultConfig), service.exportToPdf(defaultConfig)]);

        // Sharing one process would mean starting the second export stops the first.
        expect(vi.mocked(ProcessManager).mock.instances).toHaveLength(2);
    });

    it('reports each concurrent export its own output path', async () => {
        const paths: (string | undefined)[] = [];
        const onSuccess = (info?: [string, 'file' | 'folder']) => paths.push(info?.[0]);

        // The first export produces its output, the second runs to completion, and only
        // then does the first exit. Stdout held on the service rather than the export
        // would by then have been overwritten with the second export's path.
        let exitFirst: (() => void) | undefined;

        vi.mocked(ProcessManager.prototype.start)
            .mockImplementationOnce(async (config) => {
                config.events?.onStdout?.('Success @ /out/first.pdf');
                exitFirst = () => config.events?.onExit?.(0, null);
            })
            .mockImplementationOnce(async (config) => {
                config.events?.onStdout?.('Success @ /out/second.pdf');
                config.events?.onExit?.(0, null);
            });

        const first = service.exportToPdf(defaultConfig, { onSuccess });
        const second = service.exportToPdf(defaultConfig, { onSuccess });

        await second;
        exitFirst!();
        await first;

        expect(paths).toEqual(['/out/second.pdf', '/out/first.pdf']);
    });

    it('cancel() stops each export in flight', async () => {
        let finishExport: (() => void) | undefined;
        vi.mocked(ProcessManager.prototype.waitForExit).mockImplementation(
            () =>
                new Promise<number | null>((resolve) => {
                    finishExport = () => resolve(0);
                })
        );

        const exporting = service.exportToPdf(defaultConfig);
        await vi.waitFor(() => expect(service.isExporting()).toBe(true));

        await service.cancel();
        expect(ProcessManager.prototype.stop).toHaveBeenCalledOnce();

        finishExport!();
        await exporting;
        expect(service.isExporting()).toBe(false);
    });

    it('cancel() does nothing when no export is running', async () => {
        await service.cancel();

        expect(ProcessManager.prototype.stop).not.toHaveBeenCalled();
    });
});
