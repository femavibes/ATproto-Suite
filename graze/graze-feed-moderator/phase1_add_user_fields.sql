-- Phase 1.1: Add missing fields to user_profiles table to consolidate with users table

-- Add subscription and admin fields
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'none';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bsky_password VARCHAR(255);

-- Add user management fields
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS backfill_count INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS backfill_reset_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_ban_list TEXT;

-- Add global communal moderation settings
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_communal_enabled BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_spam INTEGER DEFAULT 10;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_sexual INTEGER DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_harassment INTEGER DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_illegal INTEGER DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_cross_type_percentage INTEGER DEFAULT 20;

-- Add global user ban thresholds
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_spam INTEGER DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual INTEGER DEFAULT 8;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment INTEGER DEFAULT 8;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_illegal INTEGER DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_cross_type_percentage INTEGER DEFAULT 20;

-- Add autoblock settings
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS autoblock_main_account BOOLEAN DEFAULT true;

-- Add session management
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS access_jwt TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS refresh_jwt TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMP WITHOUT TIME ZONE;

-- Add created_at timestamp
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;