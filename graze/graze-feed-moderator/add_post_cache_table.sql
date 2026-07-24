-- Create post cache table
CREATE TABLE IF NOT EXISTS post_cache (
    id SERIAL PRIMARY KEY,
    post_uri TEXT UNIQUE NOT NULL,
    post_text TEXT,
    author_did TEXT,
    author_handle TEXT,
    author_display_name TEXT,
    author_avatar TEXT,
    created_at TIMESTAMP,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_post_cache_uri (post_uri)
);

-- Create author cache table
CREATE TABLE IF NOT EXISTS author_cache (
    id SERIAL PRIMARY KEY,
    author_did TEXT UNIQUE NOT NULL,
    handle TEXT,
    display_name TEXT,
    avatar TEXT,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_author_cache_did (author_did)
);