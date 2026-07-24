-- Add source tracking to post_reports and user_reports tables
ALTER TABLE post_reports ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'ozone';
ALTER TABLE user_reports ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'ozone';

-- Update existing records to have 'ozone' as default source
UPDATE post_reports SET source = 'ozone' WHERE source IS NULL;
UPDATE user_reports SET source = 'ozone' WHERE source IS NULL;