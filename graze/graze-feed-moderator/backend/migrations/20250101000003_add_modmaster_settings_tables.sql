-- Add ModMaster settings and report configuration tables

-- Add ModMaster settings to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS modmaster_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS modmaster_weight DECIMAL DEFAULT 1.0;

-- ModMaster report settings (per user, per report type, per target type)
CREATE TABLE IF NOT EXISTS modmaster_report_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('posts', 'users')),
  action TEXT NOT NULL CHECK (action IN ('remove_all_account', 'remove_all_configured', 'remove_selected', 'ban_global_only', 'ban_all_feeds', 'ban_global_and_feeds', 'ban_selected', 'log_only', 'command_only')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, report_type, target_type)
);

CREATE INDEX IF NOT EXISTS idx_modmaster_report_settings_user_id ON modmaster_report_settings(user_id);

-- Custom labeler report settings (per user, per report type, per target type)
CREATE TABLE IF NOT EXISTS custom_labeler_report_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('posts', 'users')),
  action TEXT NOT NULL CHECK (action IN ('remove_all_account', 'remove_all_configured', 'remove_selected', 'ban_global_only', 'ban_all_feeds', 'ban_global_and_feeds', 'ban_selected', 'log_only', 'command_only')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, report_type, target_type)
);

CREATE INDEX IF NOT EXISTS idx_custom_labeler_report_settings_user_id ON custom_labeler_report_settings(user_id);

-- Add post_uri to user_reports if it doesn't exist (for context)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_reports' AND column_name='post_uri') THEN
    ALTER TABLE user_reports ADD COLUMN post_uri TEXT;
  END IF;
END $$;

-- Add source column to user_reports if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_reports' AND column_name='source') THEN
    ALTER TABLE user_reports ADD COLUMN source TEXT DEFAULT 'ozone';
  END IF;
END $$;