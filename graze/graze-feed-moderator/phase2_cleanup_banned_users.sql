-- Phase 2.3: Clean up banned_users table - remove duplicate profile data

-- Remove avatar_url and display_name columns since they're now in user_profiles
ALTER TABLE banned_users DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE banned_users DROP COLUMN IF EXISTS display_name;

-- Add foreign key for banned_user_id to reference user_profiles
-- First, we need to populate banned_user_id for existing records
UPDATE banned_users SET banned_user_id = (
    SELECT id FROM user_profiles WHERE did = banned_users.banned_did
) WHERE banned_did IS NOT NULL AND banned_user_id IS NULL;

-- Add the foreign key constraint
ALTER TABLE banned_users ADD CONSTRAINT banned_users_banned_user_id_fkey 
    FOREIGN KEY (banned_user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;