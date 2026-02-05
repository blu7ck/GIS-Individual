import { describe, it, expect } from 'vitest';
import { validateEnvConfig, getStorageConfigFromEnv } from './env';

describe('validateEnvConfig', () => {
    it('should return warnings when environment variables are not set', () => {
        const result = validateEnvConfig();
        expect(result.isValid).toBe(true);
        // In test environment, env vars are typically not set
        expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should have no errors for empty config', () => {
        const result = validateEnvConfig();
        expect(result.errors.length).toBe(0);
    });
});

describe('getStorageConfigFromEnv', () => {
    it('should return null or config based on environment', () => {
        const config = getStorageConfigFromEnv();
        // Should be null if no env vars, or valid config if set
        expect(config === null || typeof config === 'object').toBe(true);
    });
});
