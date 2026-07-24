-- Complete Feed Moderator Database Schema
-- This file contains ALL tables and columns needed by the application

-- User profiles table (main user table)
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    did TEXT UNIQUE NOT NULL,
    handle TEXT,
    display_name TEXT,
    avatar_url TEXT,
    bsky_password TEXT,
    user_decrypt_url TEXT,
    user_api_key TEXT,
    subscription_tier VARCHAR(20) DEFAULT 'free',
    is_admin BOOLEAN DEFAULT FALSE,
    global_communal_enabled BOOLEAN DEFAULT FALSE,
    autoblock_main_account BOOLEAN DEFAULT FALSE,
    
    -- Global thresholds
    global_threshold_spam INTEGER DEFAULT 3,
    global_threshold_sexual INTEGER DEFAULT 3,
    global_threshold_harassment INTEGER DEFAULT 3,
    global_threshold_illegal INTEGER DEFAULT 3,
    global_threshold_misleading INTEGER DEFAULT 3,
    global_threshold_violence INTEGER DEFAULT 3,
    global_threshold_child_safety INTEGER DEFAULT 3,
    global_threshold_self_harm INTEGER DEFAULT 3,
    global_threshold_rule INTEGER DEFAULT 3,
    
    -- Global subcategory thresholds
    global_threshold_misleading_spam INTEGER,
    global_threshold_misleading_scam INTEGER,
    global_threshold_misleading_bot INTEGER,
    global_threshold_misleading_impersonation INTEGER,
    global_threshold_misleading_elections INTEGER,
    global_threshold_misleading_other INTEGER,
    global_threshold_harassment_troll INTEGER,
    global_threshold_harassment_targeted INTEGER,
    global_threshold_harassment_hate_speech INTEGER,
    global_threshold_harassment_doxxing INTEGER,
    global_threshold_harassment_other INTEGER,
    
    -- Global user ban thresholds
    global_user_ban_threshold_spam INTEGER DEFAULT 5,
    global_user_ban_threshold_sexual INTEGER DEFAULT 5,
    global_user_ban_threshold_harassment INTEGER DEFAULT 5,
    global_user_ban_threshold_illegal INTEGER DEFAULT 5,
    global_user_ban_threshold_misleading INTEGER DEFAULT 5,
    global_user_ban_threshold_violence INTEGER DEFAULT 5,
    global_user_ban_threshold_child_safety INTEGER DEFAULT 5,
    global_user_ban_threshold_self_harm INTEGER DEFAULT 5,
    global_user_ban_threshold_rule INTEGER DEFAULT 5,
    
    -- Cross-type percentages
    global_cross_type_percentage INTEGER DEFAULT 50,
    global_user_ban_cross_type_percentage INTEGER DEFAULT 50,
    
    -- ModMaster: Custom labeler support
    custom_labeler_did TEXT,
    custom_labeler_ozone_url TEXT,
    custom_labeler_password TEXT,
    non_user_post_removal_weight DECIMAL DEFAULT 0.5,
    non_user_ban_weight DECIMAL DEFAULT 0.5,
    
    -- Session management
    access_jwt TEXT,
    refresh_jwt TEXT,
    session_expires_at TIMESTAMP,
    
    -- Global ban list
    global_ban_list TEXT,
    global_ban_list_name TEXT,
    
    -- Backfill limits
    backfill_count_25 INTEGER DEFAULT 0,
    backfill_count_50 INTEGER DEFAULT 0,
    backfill_count_100 INTEGER DEFAULT 0,
    backfill_reset_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feeds table
CREATE TABLE IF NOT EXISTS feeds (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    feed_id VARCHAR(255) NOT NULL,
    feed_name VARCHAR(255) NOT NULL,
    feed_display_name TEXT,
    
    -- Basic opt-ins
    opt_in_spam BOOLEAN DEFAULT true,
    opt_in_misleading BOOLEAN DEFAULT true,
    opt_in_sexual BOOLEAN DEFAULT false,
    opt_in_harassment BOOLEAN DEFAULT true,
    opt_in_illegal BOOLEAN DEFAULT true,
    
    -- Detailed subcategory opt-ins
    opt_in_misleading_spam BOOLEAN DEFAULT TRUE,
    opt_in_misleading_scam BOOLEAN DEFAULT TRUE,
    opt_in_misleading_bot BOOLEAN DEFAULT TRUE,
    opt_in_misleading_impersonation BOOLEAN DEFAULT TRUE,
    opt_in_misleading_elections BOOLEAN DEFAULT TRUE,
    opt_in_misleading_other BOOLEAN DEFAULT FALSE,
    opt_in_harassment_troll BOOLEAN DEFAULT TRUE,
    opt_in_harassment_targeted BOOLEAN DEFAULT TRUE,
    opt_in_harassment_hate_speech BOOLEAN DEFAULT TRUE,
    opt_in_harassment_doxxing BOOLEAN DEFAULT TRUE,
    opt_in_harassment_other BOOLEAN DEFAULT FALSE,
    opt_in_violence_animal BOOLEAN DEFAULT TRUE,
    opt_in_violence_threats BOOLEAN DEFAULT TRUE,
    opt_in_violence_graphic_content BOOLEAN DEFAULT TRUE,
    opt_in_violence_glorification BOOLEAN DEFAULT TRUE,
    opt_in_violence_trafficking BOOLEAN DEFAULT TRUE,
    opt_in_violence_other BOOLEAN DEFAULT FALSE,
    opt_in_sexual_unlabeled BOOLEAN DEFAULT TRUE,
    opt_in_sexual_abuse_content BOOLEAN DEFAULT TRUE,
    opt_in_sexual_ncii BOOLEAN DEFAULT TRUE,
    opt_in_sexual_deepfake BOOLEAN DEFAULT TRUE,
    opt_in_sexual_animal BOOLEAN DEFAULT TRUE,
    opt_in_sexual_other BOOLEAN DEFAULT FALSE,
    opt_in_child_safety_privacy BOOLEAN DEFAULT TRUE,
    opt_in_child_safety_harassment BOOLEAN DEFAULT TRUE,
    opt_in_self_harm_content BOOLEAN DEFAULT TRUE,
    opt_in_self_harm_ed BOOLEAN DEFAULT TRUE,
    opt_in_self_harm_stunts BOOLEAN DEFAULT TRUE,
    opt_in_self_harm_substances BOOLEAN DEFAULT TRUE,
    opt_in_self_harm_other BOOLEAN DEFAULT FALSE,
    opt_in_rule_site_security BOOLEAN DEFAULT TRUE,
    opt_in_rule_prohibited_sales BOOLEAN DEFAULT TRUE,
    opt_in_rule_ban_evasion BOOLEAN DEFAULT TRUE,
    opt_in_rule_other BOOLEAN DEFAULT FALSE,
    
    -- User ban opt-ins
    user_ban_opt_in_misleading_spam BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_misleading_scam BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_misleading_bot BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_misleading_impersonation BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_misleading_elections BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_misleading_other BOOLEAN DEFAULT FALSE,
    user_ban_opt_in_harassment_troll BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_harassment_targeted BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_harassment_hate_speech BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_harassment_doxxing BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_harassment_other BOOLEAN DEFAULT FALSE,
    user_ban_opt_in_violence_animal BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_violence_threats BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_violence_graphic_content BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_violence_glorification BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_violence_trafficking BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_violence_other BOOLEAN DEFAULT FALSE,
    user_ban_opt_in_sexual_unlabeled BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_sexual_abuse_content BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_sexual_ncii BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_sexual_deepfake BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_sexual_animal BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_sexual_other BOOLEAN DEFAULT FALSE,
    user_ban_opt_in_child_safety_privacy BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_child_safety_harassment BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_self_harm_content BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_self_harm_ed BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_self_harm_stunts BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_self_harm_substances BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_self_harm_other BOOLEAN DEFAULT FALSE,
    user_ban_opt_in_rule_site_security BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_rule_prohibited_sales BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_rule_ban_evasion BOOLEAN DEFAULT TRUE,
    user_ban_opt_in_rule_other BOOLEAN DEFAULT FALSE,
    
    -- Thresholds
    cross_type_percentage INTEGER DEFAULT 50,
    same_category_cross_percentage INTEGER DEFAULT 50,
    user_ban_cross_type_percentage INTEGER DEFAULT 50,
    user_ban_same_category_cross_percentage INTEGER DEFAULT 50,
    
    -- Per-feed thresholds
    threshold_spam INTEGER,
    threshold_misleading INTEGER,
    threshold_sexual INTEGER,
    threshold_harassment INTEGER,
    threshold_violence INTEGER,
    threshold_child_safety INTEGER,
    threshold_self_harm INTEGER,
    threshold_rule INTEGER,
    threshold_illegal INTEGER,
    
    -- Per-feed subcategory thresholds
    threshold_misleading_spam INTEGER,
    threshold_misleading_scam INTEGER,
    threshold_misleading_bot INTEGER,
    threshold_misleading_impersonation INTEGER,
    threshold_misleading_elections INTEGER,
    threshold_misleading_other INTEGER,
    threshold_harassment_troll INTEGER,
    threshold_harassment_targeted INTEGER,
    threshold_harassment_hate_speech INTEGER,
    threshold_harassment_doxxing INTEGER,
    threshold_harassment_other INTEGER,
    
    -- Per-feed user ban thresholds
    user_ban_threshold_spam INTEGER,
    user_ban_threshold_misleading INTEGER,
    user_ban_threshold_sexual INTEGER,
    user_ban_threshold_harassment INTEGER,
    user_ban_threshold_violence INTEGER,
    user_ban_threshold_child_safety INTEGER,
    user_ban_threshold_self_harm INTEGER,
    user_ban_threshold_rule INTEGER,
    user_ban_threshold_illegal INTEGER,
    
    -- Per-feed user ban subcategory thresholds
    user_ban_threshold_misleading_spam INTEGER,
    user_ban_threshold_misleading_scam INTEGER,
    user_ban_threshold_misleading_bot INTEGER,
    user_ban_threshold_misleading_impersonation INTEGER,
    user_ban_threshold_misleading_elections INTEGER,
    user_ban_threshold_misleading_other INTEGER,
    user_ban_threshold_harassment_troll INTEGER,
    user_ban_threshold_harassment_targeted INTEGER,
    user_ban_threshold_harassment_hate_speech INTEGER,
    user_ban_threshold_harassment_doxxing INTEGER,
    user_ban_threshold_harassment_other INTEGER,
    
    -- Ban lists
    feed_ban_list TEXT,
    feed_ban_list_name TEXT,
    global_ban_list TEXT,
    
    -- Communal moderation
    communal_enabled BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, feed_id)
);

-- Post reports table
CREATE TABLE IF NOT EXISTS post_reports (
    id SERIAL PRIMARY KEY,
    post_uri VARCHAR(500) NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    reporter_did VARCHAR(255) NOT NULL,
    source VARCHAR(50) DEFAULT 'ozone',
    labeler_did TEXT,
    report_weight DECIMAL DEFAULT 1.0,
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_uri, report_type, reporter_did)
);

-- User reports table
CREATE TABLE IF NOT EXISTS user_reports (
    id SERIAL PRIMARY KEY,
    reported_user_did TEXT NOT NULL,
    report_type TEXT NOT NULL,
    reporter_did TEXT NOT NULL,
    post_uri TEXT,
    source VARCHAR(50) DEFAULT 'ozone',
    labeler_did TEXT,
    report_weight DECIMAL DEFAULT 1.0,
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ModMaster: User report type settings
CREATE TABLE IF NOT EXISTS user_report_type_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('remove_all', 'ban_all', 'log_only', 'command_only')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, report_type)
);

-- ModMaster: Feed report type overrides
CREATE TABLE IF NOT EXISTS feed_report_type_overrides (
  id SERIAL PRIMARY KEY,
  feed_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  action TEXT CHECK (action IN ('remove_all', 'ban_all', 'log_only', 'command_only')),
  non_user_post_weight DECIMAL,
  non_user_ban_weight DECIMAL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(feed_id, report_type)
);

-- Moderation log table
CREATE TABLE IF NOT EXISTS moderation_log (
    id SERIAL PRIMARY KEY,
    post_uri VARCHAR(500),
    account_did VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    feed_id VARCHAR(255),
    moderator_did VARCHAR(255) NOT NULL,
    reason VARCHAR(255),
    target_handle TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Moderation history table
CREATE TABLE IF NOT EXISTS moderation_history (
    id SERIAL PRIMARY KEY,
    post_uri TEXT NOT NULL,
    action TEXT NOT NULL,
    feed_id TEXT,
    moderator_did TEXT NOT NULL,
    reason TEXT,
    target_handle TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Command executions table
CREATE TABLE IF NOT EXISTS command_executions (
    id SERIAL PRIMARY KEY,
    reporter_did TEXT NOT NULL,
    post_uri TEXT NOT NULL,
    command_type TEXT NOT NULL,
    command_text TEXT NOT NULL,
    affected_feeds TEXT[] NOT NULL,
    execution_status TEXT NOT NULL CHECK (execution_status IN ('success', 'failed', 'unauthorized')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Communal processing log table
CREATE TABLE IF NOT EXISTS communal_processing_log (
    id SERIAL PRIMARY KEY,
    post_uri TEXT,
    report_id INTEGER,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_taken VARCHAR(50),
    details TEXT
);

-- Banned users table
CREATE TABLE IF NOT EXISTS banned_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    banned_handle TEXT NOT NULL,
    banned_did TEXT,
    banned_user_id INTEGER REFERENCES user_profiles(id),
    list_type TEXT NOT NULL,
    list_identifier TEXT,
    reason TEXT,
    banned_by_did TEXT NOT NULL,
    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, banned_handle, list_type, list_identifier)
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    uri TEXT UNIQUE NOT NULL,
    cid TEXT,
    author_id INTEGER REFERENCES user_profiles(id),
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Protected posts table
CREATE TABLE IF NOT EXISTS protected_posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    post_uri TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_uri)
);

-- Hidden trending posts table
CREATE TABLE IF NOT EXISTS hidden_trending_posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    post_uri TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_uri)
);

-- Hidden trending banned users table
CREATE TABLE IF NOT EXISTS hidden_trending_banned_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    banned_handle TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, banned_handle)
);

-- Feed groups table
CREATE TABLE IF NOT EXISTS feed_groups (
    id SERIAL PRIMARY KEY,
    owner_user_id INTEGER REFERENCES user_profiles(id),
    group_name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feed group members table
CREATE TABLE IF NOT EXISTS feed_group_members (
    feed_id TEXT NOT NULL,
    group_id INTEGER REFERENCES feed_groups(id),
    PRIMARY KEY (feed_id, group_id)
);

-- Group moderators table
CREATE TABLE IF NOT EXISTS group_moderators (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES feed_groups(id),
    moderator_did TEXT NOT NULL,
    moderator_handle TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{remove,ban}',
    granted_by_did TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, moderator_did)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('autoblock_success', 'account_failure')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Post cache table
CREATE TABLE IF NOT EXISTS post_cache (
    id SERIAL PRIMARY KEY,
    post_uri TEXT UNIQUE NOT NULL,
    post_text TEXT,
    author_did TEXT,
    author_handle TEXT,
    author_display_name TEXT,
    author_avatar TEXT,
    created_at TIMESTAMP,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Author cache table
CREATE TABLE IF NOT EXISTS author_cache (
    id SERIAL PRIMARY KEY,
    author_did TEXT UNIQUE NOT NULL,
    handle TEXT,
    display_name TEXT,
    avatar TEXT,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User whitelists table
CREATE TABLE IF NOT EXISTS user_whitelists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    whitelisted_did TEXT NOT NULL,
    whitelisted_handle TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, whitelisted_did)
);

-- Feed whitelists table
CREATE TABLE IF NOT EXISTS feed_whitelists (
    id SERIAL PRIMARY KEY,
    feed_id TEXT NOT NULL,
    whitelisted_did TEXT NOT NULL,
    whitelisted_handle TEXT,
    is_blacklist BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feed_id, whitelisted_did)
);

-- User accounts table (for autoblock)
CREATE TABLE IF NOT EXISTS user_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    did VARCHAR(255) NOT NULL,
    handle VARCHAR(255) NOT NULL,
    app_password VARCHAR(255),
    avatar_url VARCHAR(500),
    display_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, did)
);

-- Block lists table
CREATE TABLE IF NOT EXISTS block_lists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    list_uri VARCHAR(500) NOT NULL,
    list_name VARCHAR(255) NOT NULL,
    is_global BOOLEAN DEFAULT true,
    target_account_id INTEGER REFERENCES user_accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, list_uri)
);

-- Processed blocks table
CREATE TABLE IF NOT EXISTS processed_blocks (
    id SERIAL PRIMARY KEY,
    user_account_id INTEGER REFERENCES user_accounts(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    blocker_did VARCHAR(255) NOT NULL,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_account_id, message_id)
);

-- Autoblock log table
CREATE TABLE IF NOT EXISTS autoblock_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    blocker_did VARCHAR(255) NOT NULL,
    blocker_handle VARCHAR(255),
    blocked_account_id INTEGER REFERENCES user_accounts(id) ON DELETE CASCADE,
    blocked_account_handle TEXT,
    list_id INTEGER REFERENCES block_lists(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Account status table
CREATE TABLE IF NOT EXISTS account_status (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('main', 'monitored')),
    handle VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'failed')),
    error_message TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id, account_type)
);

-- Monitored accounts table
CREATE TABLE IF NOT EXISTS monitored_accounts (
    id SERIAL PRIMARY KEY,
    owner_user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    did VARCHAR(255) NOT NULL,
    handle VARCHAR(255) NOT NULL,
    app_password TEXT NOT NULL,
    avatar_url TEXT,
    display_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    access_jwt TEXT,
    refresh_jwt TEXT,
    session_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_user_id, did)
);

-- Daily usage table (for rate limiting)
CREATE TABLE IF NOT EXISTS daily_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    removal_count INTEGER DEFAULT 0,
    api_call_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Create all indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_did ON user_profiles(did);
CREATE INDEX IF NOT EXISTS idx_user_profiles_handle ON user_profiles(handle);
CREATE INDEX IF NOT EXISTS idx_feeds_user_id ON feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_uri ON post_reports(post_uri);
CREATE INDEX IF NOT EXISTS idx_post_reports_type ON post_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_post_reports_labeler_did ON post_reports(labeler_did);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user ON user_reports(reported_user_did);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports(reporter_did);
CREATE INDEX IF NOT EXISTS idx_user_reports_labeler ON user_reports(labeler_did);
CREATE INDEX IF NOT EXISTS idx_user_report_type_settings_user_id ON user_report_type_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_report_type_overrides_feed_id ON feed_report_type_overrides(feed_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_post_uri ON moderation_log(post_uri);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created_at ON moderation_log(created_at);
CREATE INDEX IF NOT EXISTS idx_communal_processing_log_post_uri ON communal_processing_log(post_uri);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_cache_uri ON post_cache(post_uri);
CREATE INDEX IF NOT EXISTS idx_author_cache_did ON author_cache(author_did);
CREATE INDEX IF NOT EXISTS idx_user_whitelists_user_id ON user_whitelists(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_whitelists_feed_id ON feed_whitelists(feed_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_user_id ON user_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_block_lists_user_id ON block_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_processed_blocks_account_id ON processed_blocks(user_account_id);
CREATE INDEX IF NOT EXISTS idx_autoblock_log_user_id ON autoblock_log(user_id);
CREATE INDEX IF NOT EXISTS idx_account_status_lookup ON account_status(account_type, status);
CREATE INDEX IF NOT EXISTS idx_monitored_accounts_owner ON monitored_accounts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_monitored_accounts_did ON monitored_accounts(did);
CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date);

-- Create admin user (update with actual admin DID)
INSERT INTO user_profiles (did, handle, is_admin, subscription_tier) 
VALUES ('did:plc:your-admin-did', 'your-handle.bsky.social', true, 'paid')
ON CONFLICT (did) DO UPDATE SET is_admin = true;
