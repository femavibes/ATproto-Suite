-- Phase 1.4: Update all foreign keys to reference user_profiles instead of users

-- Create the mapping table again (since it was temporary)
CREATE TEMP TABLE user_id_mapping AS
SELECT 
    u.id as old_users_id,
    up.id as new_user_profiles_id,
    u.did,
    u.handle
FROM users u
JOIN user_profiles up ON u.did = up.did;

-- Update feeds table
UPDATE feeds SET user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = feeds.user_id
) WHERE user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Update daily_usage table
UPDATE daily_usage SET user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = daily_usage.user_id
) WHERE user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Update banned_users table
UPDATE banned_users SET user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = banned_users.user_id
) WHERE user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Update sync_tracking table
UPDATE sync_tracking SET user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = sync_tracking.user_id
) WHERE user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Update hidden_trending_posts table
UPDATE hidden_trending_posts SET user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = hidden_trending_posts.user_id
) WHERE user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Update hidden_trending_banned_users table
UPDATE hidden_trending_banned_users SET user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = hidden_trending_banned_users.user_id
) WHERE user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Update user_whitelists table
UPDATE user_whitelists SET user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = user_whitelists.user_id
) WHERE user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Update protected_posts table
UPDATE protected_posts SET user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = protected_posts.user_id
) WHERE user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Update user_accounts table
UPDATE user_accounts SET user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = user_accounts.user_id
) WHERE user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Update block_lists table
UPDATE block_lists SET user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = block_lists.user_id
) WHERE user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Update autoblock_log table
UPDATE autoblock_log SET user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = autoblock_log.user_id
) WHERE user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Update monitored_accounts table (owner_user_id column)
UPDATE monitored_accounts SET owner_user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = monitored_accounts.owner_user_id
) WHERE owner_user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Update notifications table
UPDATE notifications SET user_id = (
    SELECT new_user_profiles_id FROM user_id_mapping WHERE old_users_id = notifications.user_id
) WHERE user_id IN (SELECT old_users_id FROM user_id_mapping);

-- Show summary of updates
SELECT 'feeds' as table_name, COUNT(*) as updated_rows FROM feeds WHERE user_id IN (SELECT new_user_profiles_id FROM user_id_mapping)
UNION ALL
SELECT 'banned_users', COUNT(*) FROM banned_users WHERE user_id IN (SELECT new_user_profiles_id FROM user_id_mapping)
UNION ALL
SELECT 'block_lists', COUNT(*) FROM block_lists WHERE user_id IN (SELECT new_user_profiles_id FROM user_id_mapping)
UNION ALL
SELECT 'autoblock_log', COUNT(*) FROM autoblock_log WHERE user_id IN (SELECT new_user_profiles_id FROM user_id_mapping)
UNION ALL
SELECT 'monitored_accounts', COUNT(*) FROM monitored_accounts WHERE owner_user_id IN (SELECT new_user_profiles_id FROM user_id_mapping)
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications WHERE user_id IN (SELECT new_user_profiles_id FROM user_id_mapping);