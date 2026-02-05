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

/* 
SQL SCHEMA FOR SUPABASE (Run this in Supabase SQL Editor):

create table projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references auth.users not null,
  created_at timestamptz default now()
);

create table assets (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects on delete cascade,
  name text not null,
  type text not null,
  storage_path text,
  position jsonb,
  data jsonb, -- For annotations
  created_at timestamptz default now()
);

create table shared_links (
  id uuid default gen_random_uuid() primary key,
  asset_id uuid references assets on delete cascade,
  pin_hash text,
  viewer_email text,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

*/