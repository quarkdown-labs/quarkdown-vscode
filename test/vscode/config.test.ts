import * as assert from 'assert';
import {
    getAdditionalCompilerOptions,
    getExecutablePath,
    getOutputDirectory,
    getQuarkdownConfig,
} from '../../src/config';

suite('Config', () => {
    test('getExecutablePath() returns "quarkdown" by default', () => {
        const value = getExecutablePath();
        assert.strictEqual(value, 'quarkdown');
    });

    test('getOutputDirectory() returns path ending with "output" by default', () => {
        const value = getOutputDirectory();
        assert.ok(value.endsWith('output'), `Expected path ending with "output", got "${value}"`);
    });

    test('getAdditionalCompilerOptions() returns empty array by default', () => {
        const value = getAdditionalCompilerOptions();
        assert.ok(Array.isArray(value), 'Expected an array');
        assert.strictEqual(value.length, 0);
    });

    test('getQuarkdownConfig() returns object with all properties', () => {
        const config = getQuarkdownConfig();
        assert.strictEqual(typeof config.executablePath, 'string');
        assert.strictEqual(typeof config.outputDirectory, 'string');
        assert.ok(Array.isArray(config.additionalCompilerOptions));
    });
});
