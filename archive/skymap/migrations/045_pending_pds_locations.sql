-- Store unmatched PDS location entries for future resolution
CREATE TABLE IF NOT EXISTS pending_pds_locations (
  id SERIAL PRIMARY KEY,
  did VARCHAR(200) NOT NULL,
  country VARCHAR(10),
  region VARCHAR(100),
  locality VARCHAR(100),
  atlas_key VARCHAR(100),
  osm_id BIGINT,
  osm_type VARCHAR(10),
  is_primary BOOLEAN DEFAULT false,
  raw_record JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_location_id INTEGER REFERENCES locations(id)
);
CREATE INDEX IF NOT EXISTS idx_pending_pds_did ON pending_pds_locations(did);
CREATE INDEX IF NOT EXISTS idx_pending_pds_unresolved ON pending_pds_locations(resolved_at) WHERE resolved_at IS NULL;
