-- Phase 1.2: Migrate data from users table to user_profiles table

-- First, insert/update user_profiles with data from users table
INSERT INTO user_profiles (
    did, handle, subscription_tier, is_admin, bsky_password,
    backfill_count, backfill_reset_date, last_sync_at, global_ban_list,
    global_communal_enabled, global_threshold_spam, global_threshold_sexual, 
    global_threshold_harassment, global_threshold_illegal, global_cross_type_percentage,
    global_user_ban_threshold_spam, global_user_ban_threshold_sexual,
    global_user_ban_threshold_harassment, global_user_ban_threshold_illegal,
    global_user_ban_cross_type_percentage, autoblock_main_account,
    access_jwt, refresh_jwt, session_expires_at, created_at, updated_at
)
SELECT 
    u.did, u.handle, u.subscription_tier, u.is_admin, u.bsky_password,
    u.backfill_count, u.backfill_reset_date, u.last_sync_at, u.global_ban_list,
    u.global_communal_enabled, u.global_threshold_spam, u.global_threshold_sexual,
    u.global_threshold_harassment, u.global_threshold_illegal, u.global_cross_type_percentage,
    u.global_user_ban_threshold_spam, u.global_user_ban_threshold_sexual,
    u.global_user_ban_threshold_harassment, u.global_user_ban_threshold_illegal,
    u.global_user_ban_cross_type_percentage, u.autoblock_main_account,
    u.access_jwt, u.refresh_jwt, u.session_expires_at, u.created_at, u.updated_at
FROM users u
ON CONFLICT (did) DO UPDATE SET
    subscription_tier = EXCLUDED.subscription_tier,
    is_admin = EXCLUDED.is_admin,
    bsky_password = EXCLUDED.bsky_password,
    backfill_count = EXCLUDED.backfill_count,
    backfill_reset_date = EXCLUDED.backfill_reset_date,
    last_sync_at = EXCLUDED.last_sync_at,
    global_ban_list = EXCLUDED.global_ban_list,
    global_communal_enabled = EXCLUDED.global_communal_enabled,
    global_threshold_spam = EXCLUDED.global_threshold_spam,
    global_threshold_sexual = EXCLUDED.global_threshold_sexual,
    global_threshold_harassment = EXCLUDED.global_threshold_harassment,
    global_threshold_illegal = EXCLUDED.global_threshold_illegal,
    global_cross_type_percentage = EXCLUDED.global_cross_type_percentage,
    global_user_ban_threshold_spam = EXCLUDED.global_user_ban_threshold_spam,
    global_user_ban_threshold_sexual = EXCLUDED.global_user_ban_threshold_sexual,
    global_user_ban_threshold_harassment = EXCLUDED.global_user_ban_threshold_harassment,
    global_user_ban_threshold_illegal = EXCLUDED.global_user_ban_threshold_illegal,
    global_user_ban_cross_type_percentage = EXCLUDED.global_user_ban_cross_type_percentage,
    autoblock_main_account = EXCLUDED.autoblock_main_account,
    access_jwt = EXCLUDED.access_jwt,
    refresh_jwt = EXCLUDED.refresh_jwt,
    session_expires_at = EXCLUDED.session_expires_at,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;