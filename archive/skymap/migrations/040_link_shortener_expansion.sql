-- Link shortener expansion: custom slugs and link types

ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS link_type VARCHAR(20) DEFAULT 'auto';
ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS custom_slug VARCHAR(100);
ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_short_urls_slug ON short_urls(custom_slug) WHERE custom_slug IS NOT NULL;

-- Backfill existing rows as 'auto' type
UPDATE short_urls SET link_type = 'auto' WHERE link_type IS NULL;
