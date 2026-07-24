-- Fix autoblock table structure
-- Rename user_accounts to monitored_accounts to avoid confusion
-- Remove problematic constraints

BEGIN;

-- Create new monitored_accounts table with better structure
CREATE TABLE IF NOT EXISTS monitored_accounts (
    id SERIAL PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    did VARCHAR(255) NOT NULL,
    handle VARCHAR(255) NOT NULL,
    app_password TEXT, -- encrypted
    avatar_url TEXT,
    display_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Allow same account to be monitored by multiple users
    UNIQUE(owner_user_id, did)
);

-- Migrate data from user_accounts to monitored_accounts if it exists
INSERT INTO monitored_accounts (owner_user_id, did, handle, app_password, avatar_url, display_name, is_active, created_at, updated_at)
SELECT user_id, did, handle, app_password, avatar_url, display_name, is_active, created_at, updated_at
FROM user_accounts
ON CONFLICT (owner_user_id, did) DO NOTHING;

-- Update foreign key references
UPDATE block_lists 
SET target_account_id = ma.id 
FROM monitored_accounts ma, user_accounts ua
WHERE block_lists.target_account_id = ua.id 
AND ma.owner_user_id = ua.user_id 
AND ma.did = ua.did;

UPDATE autoblock_log 
SET blocked_account_id = ma.id 
FROM monitored_accounts ma, user_accounts ua
WHERE autoblock_log.blocked_account_id = ua.id 
AND ma.owner_user_id = ua.user_id 
AND ma.did = ua.did;

-- Drop old table
DROP TABLE IF EXISTS user_accounts;

COMMIT;