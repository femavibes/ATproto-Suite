-- Auto-block system tables

-- User accounts for auto-block monitoring (alt accounts)
CREATE TABLE user_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    did VARCHAR(255) NOT NULL,
    handle VARCHAR(255) NOT NULL,
    app_password VARCHAR(255), -- encrypted app password
    avatar_url VARCHAR(500),
    display_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, did)
);

-- Block lists for auto-block system
CREATE TABLE block_lists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    list_uri VARCHAR(500) NOT NULL, -- AT-URI of the Bluesky list
    list_name VARCHAR(255) NOT NULL,
    is_global BOOLEAN DEFAULT true, -- global list for all accounts
    target_account_id INTEGER REFERENCES user_accounts(id) ON DELETE CASCADE, -- specific account list (premium feature)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, list_uri)
);

-- Processed block notifications to avoid duplicates
CREATE TABLE processed_blocks (
    id SERIAL PRIMARY KEY,
    user_account_id INTEGER REFERENCES user_accounts(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    blocker_did VARCHAR(255) NOT NULL,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_account_id, message_id)
);

-- Auto-block log for tracking actions
CREATE TABLE autoblock_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    blocker_did VARCHAR(255) NOT NULL,
    blocker_handle VARCHAR(255),
    blocked_account_id INTEGER REFERENCES user_accounts(id) ON DELETE CASCADE,
    list_id INTEGER REFERENCES block_lists(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'added', 'already_exists', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_user_accounts_user_id ON user_accounts(user_id);
CREATE INDEX idx_user_accounts_did ON user_accounts(did);
CREATE INDEX idx_block_lists_user_id ON block_lists(user_id);
CREATE INDEX idx_processed_blocks_account_id ON processed_blocks(user_account_id);
CREATE INDEX idx_autoblock_log_user_id ON autoblock_log(user_id);
CREATE INDEX idx_autoblock_log_created_at ON autoblock_log(created_at);