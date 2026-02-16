import { suite, assert, test } from 'vitest';
import { isQuarkdownFile } from '../../src/core/utils';

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
});
