import * as assert from 'assert';
import { getExecutablePath, getOutputDirectory, getQuarkdownConfig } from '../../src/config';

suite('Config', () => {
    test('getExecutablePath() returns "quarkdown" by default', () => {
        const value = getExecutablePath();
        assert.strictEqual(value, 'quarkdown');
    });

    test('getOutputDirectory() returns path ending with "output" by default', () => {
        const value = getOutputDirectory();
        assert.ok(value.endsWith('output'), `Expected path ending with "output", got "${value}"`);
    });

    test('getQuarkdownConfig() returns object with both properties', () => {
        const config = getQuarkdownConfig();
        assert.strictEqual(typeof config.executablePath, 'string');
        assert.strictEqual(typeof config.outputDirectory, 'string');
    });
});
