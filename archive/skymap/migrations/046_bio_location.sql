-- Bio term mappings: admin-configured terms for matching location from user bios
-- Strength: 'strong' = unambiguous, works standalone (cold matching)
--           'loose' = only valid when we already suspect this city (confirmation matching)

CREATE TABLE IF NOT EXISTS bio_term_mappings (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id),
  term VARCHAR(200) NOT NULL,
  strength VARCHAR(10) NOT NULL DEFAULT 'strong', -- 'strong' | 'loose'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bio_term_location ON bio_term_mappings(location_id, LOWER(term));
CREATE INDEX IF NOT EXISTS idx_bio_term_term ON bio_term_mappings(LOWER(term));

-- Add source toggle for bio location to user feed settings
ALTER TABLE user_feed_settings ADD COLUMN IF NOT EXISTS source_bio_location BOOLEAN DEFAULT NULL;
