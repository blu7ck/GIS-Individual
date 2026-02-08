import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cache Supabase clients to avoid multiple instances
const clientCache = new Map<string, SupabaseClient>();

// These should ideally come from environment variables or the settings panel
// For this demo structure, we will initialize it dynamically in App.tsx
// based on user settings, but here is the helper class.

export const createSupabaseClient = (url: string, key: string): SupabaseClient => {
    // Create a unique cache key from URL and key
    const cacheKey = `${url}:${key}`;

    // Return cached client if it exists
    if (clientCache.has(cacheKey)) {
        return clientCache.get(cacheKey)!;
    }

    // Create new client and cache it
    const client = createClient(url, key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
    clientCache.set(cacheKey, client);

    return client;
};

export const checkSupabaseConnection = async (url: string, key: string): Promise<boolean> => {
    try {
        const client = createSupabaseClient(url, key);
        // Try to fetch a single row or head - 'projects' table should be accessible to authenticated users
        const { error } = await client.from('projects').select('id').limit(1);
        if (error && error.code !== 'PGRST116') { // Ignore "no rows" errors, real connection errors matter
            console.warn('Supabase connection check failed:', error.message);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Supabase connection error:', e);
        return false;
    }
};

// Optional: Clear cache function if needed
export const clearSupabaseClientCache = () => {
    clientCache.clear();
};
