-- Add session columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_jwt TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_jwt TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMP;

-- Add session columns to monitored_accounts table  
ALTER TABLE monitored_accounts ADD COLUMN IF NOT EXISTS access_jwt TEXT;
ALTER TABLE monitored_accounts ADD COLUMN IF NOT EXISTS refresh_jwt TEXT;
ALTER TABLE monitored_accounts ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMP;