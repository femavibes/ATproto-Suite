-- Add banned users table to track per-user, per-list bans

CREATE TABLE banned_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    banned_handle VARCHAR(255) NOT NULL,
    banned_did VARCHAR(255),
    list_type VARCHAR(50) NOT NULL, -- 'global' or feed_id
    list_identifier VARCHAR(255), -- null for global, feed_id for per-feed
    reason VARCHAR(500),
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    banned_by_did VARCHAR(255) NOT NULL,
    UNIQUE(user_id, banned_handle, list_type, list_identifier)
);

-- Index for performance
CREATE INDEX idx_banned_users_user_id ON banned_users(user_id);
CREATE INDEX idx_banned_users_handle ON banned_users(banned_handle);
CREATE INDEX idx_banned_users_list ON banned_users(list_type, list_identifier);