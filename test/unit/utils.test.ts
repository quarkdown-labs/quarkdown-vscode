import { suite, assert, test } from 'vitest';
import { getPathFromPdfExportOutput, isQuarkdownFile } from '../../src/core/utils';

suite('Utils', () => {
    test('isQuarkdownFile: true for .qd extension', () => {
        assert.strictEqual(isQuarkdownFile('document.qd'), true);
    });

    test('isQuarkdownFile: true for paths with .qd', () => {
        assert.strictEqual(isQuarkdownFile('/home/user/project/main.qd'), true);
    });

    test('isQuarkdownFile: false for .md extension', () => {
        assert.strictEqual(isQuarkdownFile('readme.md'), false);
    });

    test('isQuarkdownFile: false for empty string', () => {
        assert.strictEqual(isQuarkdownFile(''), false);
    });

    test('isQuarkdownFile: false for undefined', () => {
        assert.strictEqual(isQuarkdownFile(undefined), false);
    });

    test('getPathFromPdfExportOutput: extracts path from success message', () => {
        const output = 'Success: @ /home/user/document.pdf';
        const path = getPathFromPdfExportOutput(output);
        assert.deepEqual(path, ['/home/user/document.pdf', 'file']);
    });

    test('getPathFromPdfExportOutput: extracts path (folder) from success message', () => {
        const output = 'Success: @ /home/user/output';
        const path = getPathFromPdfExportOutput(output);
        assert.deepEqual(path, ['/home/user/output', 'folder']);
    });

    test('getPathFromPdfExportOutput: extracts path with ANSI color codes', () => {
        const output = '\u001b[37m[12:34]\u001b[m \u001b[32mSuccess\u001b[m @ /home/user/document.pdf';
        const path = getPathFromPdfExportOutput(output);
        assert.deepEqual(path, ['/home/user/document.pdf', 'file']);
    });

    test('getPathFromPdfExportOutput: returns undefined if no match', () => {
        const output = 'Another message without path';
        const path = getPathFromPdfExportOutput(output);
        assert.strictEqual(path, undefined);
    });
});
