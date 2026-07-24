-- Image permission requests from users
-- request_type: 'user_images' or 'event_images' (or 'both' for tier 2)

CREATE TABLE IF NOT EXISTS image_requests (
  id SERIAL PRIMARY KEY,
  did TEXT NOT NULL,
  handle TEXT,
  request_type TEXT NOT NULL DEFAULT 'tier2' CHECK (request_type IN ('tier2')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  request_message TEXT, -- Optional message from user
  admin_notes TEXT, -- Notes from admin
  reviewed_by TEXT, -- Admin handle who reviewed
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_image_requests_did ON image_requests(did);
CREATE INDEX IF NOT EXISTS idx_image_requests_status ON image_requests(status);
CREATE INDEX IF NOT EXISTS idx_image_requests_created ON image_requests(created_at DESC);
