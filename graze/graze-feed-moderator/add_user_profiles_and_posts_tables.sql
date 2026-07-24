-- Create user_profiles table for caching user information
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    did TEXT UNIQUE NOT NULL,
    handle TEXT,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create posts table for caching post information
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    post_uri TEXT UNIQUE NOT NULL,
    author_id INTEGER REFERENCES user_profiles(id),
    text_content TEXT,
    created_at TIMESTAMP,
    images JSONB,
    videos JSONB,
    embeds JSONB,
    reply_to TEXT,
    quote_post TEXT,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_did ON user_profiles(did);
CREATE INDEX IF NOT EXISTS idx_user_profiles_handle ON user_profiles(handle);
CREATE INDEX IF NOT EXISTS idx_posts_uri ON posts(post_uri);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_cached_at ON posts(cached_at);