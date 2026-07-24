-- Migration 029: User Settings for Media and NSFW Preferences
-- Stores user preferences for displaying images/videos and NSFW content

CREATE TABLE IF NOT EXISTS user_settings (
  user_did TEXT PRIMARY KEY,
  show_media BOOLEAN DEFAULT FALSE,
  nsfw_preference TEXT DEFAULT 'hide' CHECK (nsfw_preference IN ('hide', 'blur', 'show')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_show_media ON user_settings(show_media);
CREATE INDEX IF NOT EXISTS idx_user_settings_nsfw ON user_settings(nsfw_preference);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();
