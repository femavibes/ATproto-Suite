-- Add global communal moderation settings to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS global_communal_enabled BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS global_threshold_spam INTEGER DEFAULT 10;
ALTER TABLE users ADD COLUMN IF NOT EXISTS global_threshold_sexual INTEGER DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS global_threshold_harassment INTEGER DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS global_threshold_illegal INTEGER DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS global_cross_type_percentage INTEGER DEFAULT 20;
ALTER TABLE users ADD COLUMN IF NOT EXISTS global_user_ban_threshold_spam INTEGER DEFAULT 15;
ALTER TABLE users ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual INTEGER DEFAULT 8;
ALTER TABLE users ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment INTEGER DEFAULT 8;
ALTER TABLE users ADD COLUMN IF NOT EXISTS global_user_ban_threshold_illegal INTEGER DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS global_user_ban_cross_type_percentage INTEGER DEFAULT 20;

-- Add per-feed communal moderation disable option
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS communal_enabled BOOLEAN DEFAULT true;