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
    const client = createClient(url, key);
    clientCache.set(cacheKey, client);

    return client;
};

// Optional: Clear cache function if needed
export const clearSupabaseClientCache = () => {
    clientCache.clear();
};
