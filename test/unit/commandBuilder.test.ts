import { describe, it, expect, afterEach } from 'vitest';
import { QuarkdownCommandBuilder } from '../../src/core/commandBuilder';

describe('QuarkdownCommandBuilder', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
        // Restore original platform after each test
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    describe('buildCommand', () => {
        it('returns command and args directly on Unix', () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });

            const result = QuarkdownCommandBuilder.buildCommand('/usr/bin/quarkdown', ['arg1', 'arg2']);

            expect(result.command).toBe('/usr/bin/quarkdown');
            expect(result.args).toEqual(['arg1', 'arg2']);
        });

        it('wraps with cmd /c on Windows', () => {
            Object.defineProperty(process, 'platform', { value: 'win32' });

            const result = QuarkdownCommandBuilder.buildCommand('quarkdown', ['arg1']);

            expect(result.command).toBe('cmd');
            expect(result.args[0]).toBe('/c');
            expect(result.args[1]).toBe('quarkdown');
            expect(result.args[2]).toBe('arg1');
        });
    });

    describe('buildCompileCommand', () => {
        it('produces correct args and cwd', () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });

            const result = QuarkdownCommandBuilder.buildCompileCommand(
                'quarkdown',
                '/home/user/project/main.qd',
                '/home/user/project/output'
            );

            expect(result.args).toContain('c');
            expect(result.args).toContain('main.qd');
            expect(result.args).toContain('--out');
            expect(result.args).toContain('/home/user/project/output');
            expect(result.args).not.toContain('--browser');
            expect(result.cwd).toBe('/home/user/project');
        });

        it('includes additional args', () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });

            const result = QuarkdownCommandBuilder.buildCompileCommand(
                'quarkdown',
                '/project/main.qd',
                '/project/out',
                ['--extra', 'flag']
            );

            expect(result.args).toContain('--extra');
            expect(result.args).toContain('flag');
        });
    });

    describe('buildLanguageServerCommand', () => {
        it('includes language-server argument', () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });

            const result = QuarkdownCommandBuilder.buildLanguageServerCommand('quarkdown');

            expect(result.args).toEqual(['language-server']);
        });
    });

    describe('buildPdfExportCommand', () => {
        it('includes --pdf flag and excludes --browser', () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });

            const result = QuarkdownCommandBuilder.buildPdfExportCommand(
                'quarkdown',
                '/project/main.qd',
                '/project/out'
            );

            expect(result.args).toContain('--pdf');
            expect(result.args).not.toContain('--browser');
        });
    });

    describe('buildPreviewCommand', () => {
        it('includes --preview, --watch, --server-port, and stringified port', () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });

            const result = QuarkdownCommandBuilder.buildPreviewCommand(
                'quarkdown',
                '/project/main.qd',
                '/project/out',
                9999
            );

            expect(result.args).toContain('--preview');
            expect(result.args).toContain('--watch');
            expect(result.args).toContain('--server-port');
            expect(result.args).toContain('9999');
            expect(result.args).toContain('--browser');
            expect(result.args).toContain('none');
        });
    });
});
