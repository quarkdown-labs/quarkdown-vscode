import * as assert from 'assert';
import { isQuarkdownFile, getActiveQuarkdownDocument, getPathFromPdfExportOutput } from '../../src/utils';

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

    test('getActiveQuarkdownDocument: undefined with no active editor', () => {
        const doc = getActiveQuarkdownDocument();
        assert.strictEqual(doc, undefined);
    });

    test('getPathFromPdfExportOutput: extracts path from success message', () => {
        const output = 'Success: @ /home/user/document.pdf';
        const path = getPathFromPdfExportOutput(output);
        assert.strictEqual(path, '/home/user/document.pdf');
    });

    test('getPathFromPdfExportOutput: extracts path with ANSI color codes', () => {
        const output = '\u001b[37m[12:34]\u001b[m \u001b[32mSuccess\u001b[m @ /home/user/document.pdf';
        const path = getPathFromPdfExportOutput(output);
        assert.strictEqual(path, '/home/user/document.pdf');
    });

    test('getPathFromPdfExportOutput: returns undefined if no match', () => {
        const output = 'Another message without path';
        const path = getPathFromPdfExportOutput(output);
        assert.strictEqual(path, undefined);
    });
});
