-- Add account status tracking table for frontend alerts
CREATE TABLE IF NOT EXISTS account_status (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('main', 'monitored')),
    handle VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'failed')),
    error_message TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id, account_type)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_account_status_lookup ON account_status(account_type, status);