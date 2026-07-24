-- Performance optimization indexes
-- Add these indexes to improve query performance

-- Moderation history indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moderation_history_moderator_created 
ON moderation_history(moderator_did, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moderation_history_post_uri 
ON moderation_history(post_uri);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moderation_history_action_created 
ON moderation_history(action, created_at DESC);

-- Moderation log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moderation_log_target_created 
ON moderation_log(target_handle, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moderation_log_action_created 
ON moderation_log(action, created_at DESC);

-- Banned users indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_banned_users_user_list 
ON banned_users(user_id, list_type, banned_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_banned_users_handle_lower 
ON banned_users(LOWER(banned_handle));

-- Post reports indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_reports_uri_type 
ON post_reports(post_uri, report_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_reports_created 
ON post_reports(reported_at DESC);

-- User reports indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_did_type 
ON user_reports(reported_user_did, report_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_reports_created 
ON user_reports(reported_at DESC);

-- Feeds indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feeds_user_name 
ON feeds(user_id, feed_name);

-- User profiles indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_did 
ON user_profiles(did);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_handle 
ON user_profiles(handle);

-- Protected posts indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_protected_posts_uri_feed 
ON protected_posts(post_uri, feed_id);

-- Trending optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hidden_trending_posts_uri 
ON hidden_trending_posts(post_uri);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hidden_trending_banned_users_handle 
ON hidden_trending_banned_users(banned_handle);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moderation_history_composite 
ON moderation_history(moderator_did, action, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_banned_users_composite 
ON banned_users(user_id, list_type, list_identifier, banned_at DESC);

-- Partial indexes for active data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moderation_history_recent 
ON moderation_history(created_at DESC) 
WHERE created_at >= NOW() - INTERVAL '30 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_reports_recent 
ON post_reports(reported_at DESC) 
WHERE reported_at >= NOW() - INTERVAL '30 days';

-- Analyze tables after creating indexes
ANALYZE moderation_history;
ANALYZE moderation_log;
ANALYZE banned_users;
ANALYZE post_reports;
ANALYZE user_reports;
ANALYZE feeds;
ANALYZE user_profiles;
ANALYZE protected_posts;