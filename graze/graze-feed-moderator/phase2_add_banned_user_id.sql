-- Add banned_user_id column to banned_users table
ALTER TABLE banned_users ADD COLUMN IF NOT EXISTS banned_user_id INTEGER;

-- Populate banned_user_id for existing records
UPDATE banned_users SET banned_user_id = (
    SELECT id FROM user_profiles WHERE did = banned_users.banned_did
) WHERE banned_did IS NOT NULL;

-- Add foreign key constraint
ALTER TABLE banned_users ADD CONSTRAINT banned_users_banned_user_id_fkey 
    FOREIGN KEY (banned_user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;