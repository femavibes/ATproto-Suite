-- Phase 1.4a: Drop all foreign key constraints that reference users table

ALTER TABLE feeds DROP CONSTRAINT IF EXISTS feeds_user_id_fkey;
ALTER TABLE daily_usage DROP CONSTRAINT IF EXISTS daily_usage_user_id_fkey;
ALTER TABLE banned_users DROP CONSTRAINT IF EXISTS banned_users_user_id_fkey;
ALTER TABLE sync_tracking DROP CONSTRAINT IF EXISTS sync_tracking_user_id_fkey;
ALTER TABLE hidden_trending_posts DROP CONSTRAINT IF EXISTS hidden_trending_posts_user_id_fkey;
ALTER TABLE hidden_trending_banned_users DROP CONSTRAINT IF EXISTS hidden_trending_banned_users_user_id_fkey;
ALTER TABLE user_whitelists DROP CONSTRAINT IF EXISTS user_whitelists_user_id_fkey;
ALTER TABLE protected_posts DROP CONSTRAINT IF EXISTS protected_posts_user_id_fkey;
ALTER TABLE user_accounts DROP CONSTRAINT IF EXISTS user_accounts_user_id_fkey;
ALTER TABLE block_lists DROP CONSTRAINT IF EXISTS block_lists_user_id_fkey;
ALTER TABLE autoblock_log DROP CONSTRAINT IF EXISTS autoblock_log_user_id_fkey;
ALTER TABLE monitored_accounts DROP CONSTRAINT IF EXISTS monitored_accounts_owner_user_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;