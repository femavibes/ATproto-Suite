-- Add table for tracking hidden trending posts per user
CREATE TABLE IF NOT EXISTS hidden_trending_posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_uri TEXT NOT NULL,
    hidden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_uri)
);

CREATE INDEX idx_hidden_trending_posts_user_id ON hidden_trending_posts(user_id);