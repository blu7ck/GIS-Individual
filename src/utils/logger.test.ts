import { describe, it, expect } from 'vitest';
import { logger, reportError } from './logger';

describe('logger', () => {
    it('should have debug, info, warn, error methods', () => {
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.log).toBe('function');
    });

    it('should not throw when calling log methods', () => {
        expect(() => logger.debug('test')).not.toThrow();
        expect(() => logger.info('test')).not.toThrow();
        expect(() => logger.warn('test')).not.toThrow();
        expect(() => logger.error('test')).not.toThrow();
    });
});

describe('reportError', () => {
    it('should not throw when reporting error', () => {
        const error = new Error('Test error');
        expect(() => reportError(error, { context: 'test' })).not.toThrow();
    });
});
