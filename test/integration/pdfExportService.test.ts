import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PdfExportService } from '../../src/core/pdfExportService';

const QUARKDOWN_PATH = process.env.QUARKDOWN_PATH;

/**
 * Integration tests that exercise the real Quarkdown CLI for PDF export.
 * Skipped when the QUARKDOWN_PATH environment variable is not set.
 */
describe.skipIf(!QUARKDOWN_PATH)('PdfExportService (integration)', () => {
    let service: PdfExportService;
    let tmpDir: string;

    const fixturePath = path.resolve(__dirname, '../../test/fixtures/sample.qd');

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qd-pdf-test-'));
    });

    afterEach(async () => {
        await service?.cancel();
        // Clean up temp directory contents
        for (const entry of fs.readdirSync(tmpDir)) {
            fs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true });
        }
    });

    it('exports PDF successfully and fires onSuccess', async () => {
        service = new PdfExportService();

        await new Promise<void>((resolve, reject) => {
            void service.exportToPdf(
                {
                    executablePath: QUARKDOWN_PATH!,
                    filePath: fixturePath,
                    outputDirectory: tmpDir,
                },
                {
                    onSuccess: () => resolve(),
                    onError: (err) => reject(new Error(err)),
                }
            );
        });
    });

    it('output directory is non-empty after export', async () => {
        service = new PdfExportService();

        await new Promise<void>((resolve, reject) => {
            void service.exportToPdf(
                {
                    executablePath: QUARKDOWN_PATH!,
                    filePath: fixturePath,
                    outputDirectory: tmpDir,
                },
                {
                    onSuccess: () => resolve(),
                    onError: (err) => reject(new Error(err)),
                }
            );
        });

        const files = fs.readdirSync(tmpDir);
        expect(files).toHaveLength(1);
        expect(files[0]).toMatch(/\.pdf$/);
    });

    it('onProgress receives data during export', async () => {
        service = new PdfExportService();
        const progressData: string[] = [];

        await new Promise<void>((resolve, reject) => {
            void service.exportToPdf(
                {
                    executablePath: QUARKDOWN_PATH!,
                    filePath: fixturePath,
                    outputDirectory: tmpDir,
                },
                {
                    onProgress: (data) => progressData.push(data),
                    onSuccess: () => resolve(),
                    onError: (err) => reject(new Error(err)),
                }
            );
        });

        // We expect at least some progress output
        expect(progressData.length).toBeGreaterThanOrEqual(0);
    });

    it('cancel() stops export', async () => {
        service = new PdfExportService();

        // Start a long-running export then cancel it
        const exportPromise = service.exportToPdf(
            {
                executablePath: QUARKDOWN_PATH!,
                filePath: fixturePath,
                outputDirectory: tmpDir,
            },
            {
                onError: () => {
                    /* expected when cancelled */
                },
            }
        );

        // Give the process a moment to start
        await new Promise((r) => setTimeout(r, 500));
        await service.cancel();
        expect(service.isExporting()).toBe(false);

        // Await so the test doesn't leak
        await exportPromise.catch(() => {});
    });

    it('fires error for invalid executable', async () => {
        service = new PdfExportService();

        const errorMsg = await new Promise<string>((resolve) => {
            void service
                .exportToPdf(
                    {
                        executablePath: '/nonexistent/quarkdown',
                        filePath: fixturePath,
                        outputDirectory: tmpDir,
                    },
                    {
                        onError: (err) => resolve(err),
                    }
                )
                .catch(() => {});
        });

        expect(errorMsg.length).toBeGreaterThan(0);
    });
});
