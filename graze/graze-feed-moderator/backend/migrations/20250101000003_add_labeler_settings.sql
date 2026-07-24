-- Add ModMaster settings to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS modmaster_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS modmaster_weight DECIMAL(3,2) DEFAULT 1.0;

-- Create ModMaster report settings table
CREATE TABLE IF NOT EXISTS modmaster_report_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('posts', 'users')),
  action VARCHAR(20) NOT NULL CHECK (action IN ('remove_all', 'remove_selected', 'ban_all', 'ban_selected', 'log_only', 'command_only', 'escalate')),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, report_type, target_type)
);

-- Create custom labeler report settings table
CREATE TABLE IF NOT EXISTS custom_labeler_report_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('posts', 'users')),
  action VARCHAR(20) NOT NULL CHECK (action IN ('remove_all', 'remove_selected', 'ban_all', 'ban_selected', 'log_only', 'command_only', 'escalate')),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, report_type, target_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_modmaster_report_settings_user_id ON modmaster_report_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_labeler_report_settings_user_id ON custom_labeler_report_settings(user_id);