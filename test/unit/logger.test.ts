import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleLogger, NoOpLogger } from '../../src/core/logger';

describe('ConsoleLogger', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('logs info/error/warn with [prefix]', () => {
        const logger = new ConsoleLogger('Test');

        logger.info('hello');
        logger.error('oops');
        logger.warn('careful');

        expect(logSpy).toHaveBeenCalledWith('[Test] hello');
        expect(errorSpy).toHaveBeenCalledWith('[Test] oops');
        expect(warnSpy).toHaveBeenCalledWith('[Test] careful');
    });

    it('logs without brackets when prefix is empty', () => {
        const logger = new ConsoleLogger();

        logger.info('bare message');

        expect(logSpy).toHaveBeenCalledWith('bare message');
    });
});

describe('NoOpLogger', () => {
    it('produces no console output', () => {
        const logSpy = vi.spyOn(console, 'log');
        const errorSpy = vi.spyOn(console, 'error');
        const warnSpy = vi.spyOn(console, 'warn');

        const logger = new NoOpLogger();
        logger.info('should not appear');
        logger.error('should not appear');
        logger.warn('should not appear');

        expect(logSpy).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();

        vi.restoreAllMocks();
    });
});
