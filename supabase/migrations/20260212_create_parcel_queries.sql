-- Create parcel_queries table
CREATE TABLE IF NOT EXISTS parcel_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query_mode TEXT NOT NULL CHECK (query_mode IN ('by_click', 'by_admin')),
  query_key TEXT NOT NULL, -- Format: "mahalleId-ada-parsel" or "lat-lon"
  tkgm_properties JSONB NOT NULL,
  geometry_geojson JSONB NOT NULL,
  metrics JSONB NOT NULL,
  elevation JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index to prevent duplicate entries for the same parcel/point for a user
-- This allows the UPSERT/refresh logic to work
CREATE UNIQUE INDEX IF NOT EXISTS parcel_queries_user_key ON parcel_queries(user_id, query_key);

-- Enable RLS
ALTER TABLE parcel_queries ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own parcel queries" 
ON parcel_queries FOR ALL 
USING (auth.uid() = user_id);

-- Comment for clarity
COMMENT ON TABLE parcel_queries IS 'Stores engineering and attribute data for queried TKGM parcels.';
