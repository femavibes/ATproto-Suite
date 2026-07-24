-- Create monitored_accounts table for autoblock feature
CREATE TABLE IF NOT EXISTS monitored_accounts (
    id SERIAL PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    did VARCHAR(255) NOT NULL,
    handle VARCHAR(255) NOT NULL,
    app_password TEXT NOT NULL, -- encrypted
    avatar_url TEXT,
    display_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_user_id, did) -- Same user can't add same account twice
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_monitored_accounts_owner ON monitored_accounts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_monitored_accounts_did ON monitored_accounts(did);