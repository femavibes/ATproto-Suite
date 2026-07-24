-- Create sync tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS sync_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    list_type VARCHAR(50) NOT NULL,
    sync_type VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'manual', 'automatic', 'startup'
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed'
    added_count INTEGER DEFAULT 0,
    removed_count INTEGER DEFAULT 0,
    error_message TEXT,
    last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unique constraint for user_id + list_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_tracking_user_list 
ON sync_tracking(user_id, list_type);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_sync_tracking_status ON sync_tracking(status);
CREATE INDEX IF NOT EXISTS idx_sync_tracking_last_sync ON sync_tracking(last_sync_at);

-- Clean up duplicate banned users (keep the earliest entry for each user/list combination)
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, LOWER(banned_handle), list_type 
            ORDER BY banned_at ASC
        ) as rn
    FROM banned_users
)
DELETE FROM banned_users 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Add constraint to prevent future duplicates
ALTER TABLE banned_users 
DROP CONSTRAINT IF EXISTS unique_user_handle_list;

ALTER TABLE banned_users 
ADD CONSTRAINT unique_user_handle_list 
UNIQUE (user_id, banned_handle, list_type);

-- Add sync_failed column if it doesn't exist
ALTER TABLE banned_users 
ADD COLUMN IF NOT EXISTS sync_failed BOOLEAN DEFAULT FALSE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_banned_users_sync_failed ON banned_users(sync_failed) WHERE sync_failed = TRUE;
CREATE INDEX IF NOT EXISTS idx_banned_users_user_list ON banned_users(user_id, list_type);
CREATE INDEX IF NOT EXISTS idx_banned_users_handle_lower ON banned_users(user_id, LOWER(banned_handle));