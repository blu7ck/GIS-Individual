-- ============================================
-- COMPLETE DATABASE SCHEMA MIGRATION
-- Drops existing tables and recreates from scratch
-- ============================================

-- Drop existing policies first (if they exist)
-- DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
-- DROP POLICY IF EXISTS "Users can create their own projects" ON projects;
-- DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
-- DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;

-- DROP POLICY IF EXISTS "Users can view assets in their projects" ON assets;
-- DROP POLICY IF EXISTS "Users can create assets in their projects" ON assets;
-- DROP POLICY IF EXISTS "Users can update assets in their projects" ON assets;
-- DROP POLICY IF EXISTS "Users can delete assets in their projects" ON assets;

-- DROP POLICY IF EXISTS "Anyone can view shared links" ON shared_links;
-- DROP POLICY IF EXISTS "Users can create shared links for their assets" ON shared_links;
-- DROP POLICY IF EXISTS "Users can create shared links for their projects" ON shared_links;

-- Drop existing indexes
-- DROP INDEX IF EXISTS idx_projects_parent_project_id;
-- DROP INDEX IF EXISTS idx_projects_linked_asset_id;
-- DROP INDEX IF EXISTS idx_projects_is_measurements_folder;
-- DROP INDEX IF EXISTS idx_projects_unique_measurements_folder;
-- DROP INDEX IF EXISTS idx_shared_links_project_id;
-- DROP INDEX IF EXISTS idx_shared_links_asset_id;

-- Drop existing tables (CASCADE will handle dependencies)
DROP TABLE IF EXISTS shared_links CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS projects CASCADE; 

-- ============================================
-- CREATE TABLES
-- ============================================

-- 1. Projects Table (with folder structure support)
-- Note: linked_asset_id will be added after assets table is created (circular dependency)
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Folder structure support
  parent_project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  is_measurements_folder BOOLEAN DEFAULT FALSE NOT NULL,
  linked_asset_id UUID -- Will add foreign key constraint after assets table is created
);

-- 2. Assets Table
CREATE TABLE assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  storage_path TEXT,
  url TEXT,
  position JSONB,
  data JSONB, -- For annotations (GeoJSON content)
  visible BOOLEAN DEFAULT TRUE,
  opacity NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Shared Links Table (supports both single asset and project shares)
CREATE TABLE shared_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE, -- NULL for project shares
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- NULL for single asset shares
  asset_ids JSONB DEFAULT '[]'::jsonb, -- Array of asset IDs for project shares
  pin_hash TEXT,
  viewer_email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Constraint: Either asset_id OR project_id must be set (not both, not neither)
  CONSTRAINT shared_links_asset_or_project CHECK (
    (asset_id IS NOT NULL AND project_id IS NULL) OR 
    (asset_id IS NULL AND project_id IS NOT NULL)
  )
);

-- Add foreign key constraint for linked_asset_id (after assets table exists)
ALTER TABLE projects
ADD CONSTRAINT fk_projects_linked_asset_id 
FOREIGN KEY (linked_asset_id) REFERENCES assets(id) ON DELETE CASCADE;

-- ============================================
-- CREATE INDEXES
-- ============================================

-- Projects indexes
CREATE INDEX idx_projects_parent_project_id ON projects(parent_project_id) WHERE parent_project_id IS NOT NULL;
CREATE INDEX idx_projects_linked_asset_id ON projects(linked_asset_id) WHERE linked_asset_id IS NOT NULL;
CREATE INDEX idx_projects_is_measurements_folder ON projects(is_measurements_folder) WHERE is_measurements_folder = TRUE;

-- Unique constraint: Only one measurements folder per parent_project_id and linked_asset_id combination
CREATE UNIQUE INDEX idx_projects_unique_measurements_folder 
ON projects(parent_project_id, linked_asset_id) 
WHERE is_measurements_folder = TRUE;

-- Shared links indexes
CREATE INDEX idx_shared_links_project_id ON shared_links(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_shared_links_asset_id ON shared_links(asset_id) WHERE asset_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;

-- Projects Policies
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = owner_id);

-- Assets Policies
CREATE POLICY "Users can view assets in their projects"
  ON assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = assets.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Allow access to assets via shared links (for secure public access)
-- This policy allows anonymous users to view assets that are part of a valid shared link
CREATE POLICY "Anyone can view assets via shared links"
  ON assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_links
      WHERE (
        -- Single asset share: direct match
        (shared_links.asset_id = assets.id)
        OR
        -- Project share: check if asset ID exists in asset_ids JSONB array
        (
          shared_links.project_id IS NOT NULL
          AND shared_links.asset_ids IS NOT NULL
          AND (
            -- Check if assets.id (as text) exists in the JSONB array
            shared_links.asset_ids @> to_jsonb(assets.id::text)
            OR
            -- Alternative: check if any element in array matches asset ID (handles both string and UUID formats)
            EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(shared_links.asset_ids) AS elem
              WHERE elem = assets.id::text
            )
    )
        )
      )
      -- Only allow access to non-expired shared links
      AND shared_links.expires_at > NOW()
    )
  );

CREATE POLICY "Users can create assets in their projects"
  ON assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = assets.project_id
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update assets in their projects"
  ON assets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = assets.project_id
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete assets in their projects"
  ON assets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = assets.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Shared Links Policies
CREATE POLICY "Anyone can view shared links"
  ON shared_links FOR SELECT
  USING (expires_at > NOW());

CREATE POLICY "Users can create shared links for their assets"
  ON shared_links FOR INSERT
  WITH CHECK (
    -- For single asset shares
    (
      asset_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM assets
        JOIN projects ON projects.id = assets.project_id
        WHERE assets.id = shared_links.asset_id
        AND projects.owner_id = auth.uid()
    )
    ) OR
    -- For project shares
    (
      project_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = shared_links.project_id
        AND projects.owner_id = auth.uid()
      )
    )
  );

-- ============================================
-- COMMENTS (Documentation)
-- ============================================

COMMENT ON TABLE projects IS 'Projects table with folder hierarchy support for measurements';
COMMENT ON COLUMN projects.parent_project_id IS 'Parent project ID for folder hierarchy. NULL for root projects.';
COMMENT ON COLUMN projects.is_measurements_folder IS 'Flag to identify auto-generated measurements folders.';
COMMENT ON COLUMN projects.linked_asset_id IS 'Asset ID this measurements folder is linked to (for 3D Tiles measurements).';

COMMENT ON TABLE assets IS 'Assets table storing files, KML, 3D Tiles, and annotations';
COMMENT ON COLUMN assets.data IS 'JSONB data for annotations (GeoJSON content)';
COMMENT ON COLUMN assets.position IS 'JSONB position data for asset placement';

COMMENT ON TABLE shared_links IS 'Shared links table supporting both single asset and project shares';
COMMENT ON COLUMN shared_links.asset_id IS 'Single asset ID (NULL for project shares)';
COMMENT ON COLUMN shared_links.project_id IS 'Project ID (NULL for single asset shares)';
COMMENT ON COLUMN shared_links.asset_ids IS 'Array of asset IDs included in project share (JSONB array)';

COMMENT ON INDEX idx_projects_unique_measurements_folder IS 'Ensures only one measurements folder exists per parent_project_id and linked_asset_id combination';
