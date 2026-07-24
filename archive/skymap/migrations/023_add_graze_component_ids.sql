-- Add support for multiple Graze component IDs per region (for split nodes)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS graze_component_ids JSONB;

-- Migrate existing single component IDs to array format
UPDATE locations 
SET graze_component_ids = jsonb_build_array(graze_component_id::text::int)
WHERE graze_component_id IS NOT NULL AND graze_component_ids IS NULL;
