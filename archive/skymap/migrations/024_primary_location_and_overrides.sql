-- Add primary location support and admin overrides to user_labels
-- Migration 024: Primary Location and Label Overrides

-- Add columns to user_labels table
ALTER TABLE user_labels 
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS added_by VARCHAR(50) DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS max_labels_override INTEGER DEFAULT NULL;

-- Create unique constraint: only one primary location per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_labels_primary_per_user 
  ON user_labels(did) 
  WHERE is_primary = true AND active = true;

-- Set first label as primary for existing users
WITH first_labels AS (
  SELECT DISTINCT ON (did) id
  FROM user_labels
  WHERE active = true
  ORDER BY did, created_at ASC
)
UPDATE user_labels
SET is_primary = true
WHERE id IN (SELECT id FROM first_labels);

-- Add index for faster primary location queries
CREATE INDEX IF NOT EXISTS idx_user_labels_primary 
  ON user_labels(did, is_primary) 
  WHERE active = true;

-- Add comment
COMMENT ON COLUMN user_labels.is_primary IS 'Indicates the users primary/main location shown on map';
COMMENT ON COLUMN user_labels.added_by IS 'Who added this label: admin or user (for future self-service)';
COMMENT ON COLUMN user_labels.max_labels_override IS 'Admin override for max labels (NULL = use default 3)';
