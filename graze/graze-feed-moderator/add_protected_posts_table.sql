CREATE TABLE IF NOT EXISTS protected_posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_uri TEXT NOT NULL,
  feed_id TEXT NOT NULL,
  protected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, post_uri, feed_id)
);

CREATE INDEX IF NOT EXISTS idx_protected_posts_user_post ON protected_posts(user_id, post_uri);
CREATE INDEX IF NOT EXISTS idx_protected_posts_lookup ON protected_posts(post_uri, feed_id);