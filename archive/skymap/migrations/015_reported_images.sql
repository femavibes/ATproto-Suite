-- Create reported_images table for image moderation

CREATE TABLE IF NOT EXISTS reported_images (
  id SERIAL PRIMARY KEY,
  reporter_did TEXT NOT NULL,
  reporter_handle TEXT,
  image_url TEXT NOT NULL,
  image_type VARCHAR(20) NOT NULL, -- 'profile', 'event', 'pin'
  related_id INTEGER, -- user_labels.id, events.id, or locations.id
  reason VARCHAR(100), -- 'copyright', 'inappropriate', 'illegal', 'spam', 'other'
  details TEXT, -- Optional additional details
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'denied', 'resolved'
  reviewed_at TIMESTAMP,
  reviewed_by TEXT, -- admin DID
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_reported_images_status ON reported_images(status);
CREATE INDEX idx_reported_images_image_url ON reported_images(image_url);
CREATE INDEX idx_reported_images_image_type ON reported_images(image_type);
CREATE INDEX idx_reported_images_created_at ON reported_images(created_at DESC);
