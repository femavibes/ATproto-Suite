-- URL shortener table for event links
CREATE TABLE IF NOT EXISTS short_urls (
  id SERIAL PRIMARY KEY,
  short_code VARCHAR(10) UNIQUE NOT NULL, -- e.g., "ABC123"
  full_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- Optional: can expire after some time
  click_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_short_urls_code ON short_urls(short_code);
CREATE INDEX IF NOT EXISTS idx_short_urls_expires ON short_urls(expires_at) WHERE expires_at IS NOT NULL;
