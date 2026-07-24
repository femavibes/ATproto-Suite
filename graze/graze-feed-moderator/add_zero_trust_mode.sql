-- Add zero-trust authentication mode support
-- This allows users to optionally use their own authentication proxy

ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS zero_trust_mode BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS zero_trust_proxy_url TEXT,
ADD COLUMN IF NOT EXISTS zero_trust_api_key TEXT,
ADD COLUMN IF NOT EXISTS zero_trust_status VARCHAR(20) DEFAULT 'inactive' CHECK (zero_trust_status IN ('inactive', 'pending', 'active', 'offline'));

-- Create index for zero-trust users
CREATE INDEX IF NOT EXISTS idx_user_profiles_zero_trust ON user_profiles(zero_trust_mode) WHERE zero_trust_mode = TRUE;

-- Add operation queue table for offline proxy handling
CREATE TABLE IF NOT EXISTS zero_trust_operation_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('graze_remove', 'graze_restore', 'list_add', 'list_remove')),
    operation_data JSONB NOT NULL,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 10,
    next_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_zero_trust_queue_user ON zero_trust_operation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_zero_trust_queue_retry ON zero_trust_operation_queue(next_retry_at) WHERE retry_count < max_retries;

COMMENT ON COLUMN user_profiles.zero_trust_mode IS 'Whether user is using zero-trust authentication proxy';
COMMENT ON COLUMN user_profiles.zero_trust_proxy_url IS 'URL of user''s authentication proxy';
COMMENT ON COLUMN user_profiles.zero_trust_api_key IS 'API key for authenticating with user''s proxy';
COMMENT ON COLUMN user_profiles.zero_trust_status IS 'Current status of zero-trust proxy connection';
COMMENT ON TABLE zero_trust_operation_queue IS 'Queue for operations when user''s proxy is offline';
