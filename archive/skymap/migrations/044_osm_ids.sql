-- Add OpenStreetMap identifiers to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS osm_id BIGINT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS osm_type VARCHAR(10); -- 'node', 'way', 'relation'

CREATE INDEX IF NOT EXISTS idx_locations_osm_id ON locations(osm_id) WHERE osm_id IS NOT NULL;
