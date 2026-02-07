/**
 * Environment Configuration with Validation
 */

import { StorageConfig } from '../types';

export interface EnvConfig {
    workerUrl: string;
    supabaseUrl: string;
    supabaseKey: string;
    cesiumIonToken?: string;
    googleMapsApiKey?: string;
}

export interface EnvValidationResult {
    isValid: boolean;
    config: EnvConfig | null;
    errors: string[];
    warnings: string[];
}

const getRawEnv = () => ({
    workerUrl: import.meta.env.VITE_WORKER_URL || '',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    cesiumIonToken: import.meta.env.VITE_CESIUM_ION_TOKEN || undefined,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || undefined,
});

const isValidUrl = (url: string): boolean => {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

export const validateEnvConfig = (): EnvValidationResult => {
    const rawEnv = getRawEnv();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rawEnv.workerUrl) {
        warnings.push('VITE_WORKER_URL is not set. R2 storage features will be disabled.');
    } else if (!isValidUrl(rawEnv.workerUrl)) {
        errors.push('VITE_WORKER_URL is not a valid URL.');
    }

    if (!rawEnv.supabaseUrl) {
        warnings.push('VITE_SUPABASE_URL is not set. Database features will be disabled.');
    } else if (!isValidUrl(rawEnv.supabaseUrl)) {
        errors.push('VITE_SUPABASE_URL is not a valid URL.');
    }

    if (!rawEnv.supabaseKey) {
        warnings.push('VITE_SUPABASE_ANON_KEY is not set. Database features will be disabled.');
    }

    if (errors.length > 0) {
        return { isValid: false, config: null, errors, warnings };
    }

    return { isValid: true, config: rawEnv, errors: [], warnings };
};

export const getStorageConfigFromEnv = (): StorageConfig | null => {
    const result = validateEnvConfig();
    if (!result.config) return null;

    const { workerUrl, supabaseUrl, supabaseKey } = result.config;
    if (!workerUrl && !supabaseUrl && !supabaseKey) return null;

    return {
        workerUrl,
        supabaseUrl: supabaseUrl || undefined,
        supabaseKey: supabaseKey || undefined,
    };
};
