-- ============================================
-- POINT CLOUD PIPELINE MIGRATION
-- Adds columns for dual-output LAS/LAZ processing
-- ============================================

-- Add new columns to assets table
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'READY',
ADD COLUMN IF NOT EXISTS potree_url TEXT,
ADD COLUMN IF NOT EXISTS tiles_url TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create index for efficient status queries (e.g., finding PROCESSING assets)
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status) WHERE status != 'READY';

-- Add comments for documentation
COMMENT ON COLUMN assets.status IS 'Processing status: UPLOADING, PROCESSING, READY, ERROR';
COMMENT ON COLUMN assets.potree_url IS 'URL to Potree octree output for PotreeViewer';
COMMENT ON COLUMN assets.tiles_url IS 'URL to 3D Tiles output for Cesium';
COMMENT ON COLUMN assets.error_message IS 'Error details if processing failed';
COMMENT ON COLUMN assets.metadata IS 'Point cloud metadata: pointCount, formatVersion, boundingBox';
