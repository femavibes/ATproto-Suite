-- Add backup columns to preserve user settings before sync
-- These store the original values so they can be restored when sync is disabled

-- User profiles backup columns for global thresholds
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS backup_global_threshold_misleading INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_harassment INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_violence INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_sexual INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_child_safety INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_self_harm INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_rule INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_misleading_spam INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_misleading_scam INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_misleading_bot INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_misleading_impersonation INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_misleading_elections INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_harassment_troll INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_harassment_targeted INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_harassment_hate_speech INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_threshold_harassment_doxxing INTEGER;

-- User profiles backup columns for ban thresholds
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_misleading INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_harassment INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_violence INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_sexual INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_child_safety INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_self_harm INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_rule INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_misleading_spam INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_misleading_scam INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_misleading_bot INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_misleading_impersonation INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_misleading_elections INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_harassment_troll INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_harassment_targeted INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_harassment_hate_speech INTEGER,
ADD COLUMN IF NOT EXISTS backup_global_user_ban_threshold_harassment_doxxing INTEGER;

-- Feeds backup columns for post thresholds
ALTER TABLE feeds 
ADD COLUMN IF NOT EXISTS backup_threshold_misleading INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_harassment INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_violence INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_sexual INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_child_safety INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_self_harm INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_rule INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_misleading_spam INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_misleading_scam INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_misleading_bot INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_misleading_impersonation INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_misleading_elections INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_harassment_troll INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_harassment_targeted INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_harassment_hate_speech INTEGER,
ADD COLUMN IF NOT EXISTS backup_threshold_harassment_doxxing INTEGER;

-- Feeds backup columns for ban thresholds
ALTER TABLE feeds 
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_misleading INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_harassment INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_violence INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_sexual INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_child_safety INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_self_harm INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_rule INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_misleading_spam INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_misleading_scam INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_misleading_bot INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_misleading_impersonation INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_misleading_elections INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_harassment_troll INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_harassment_targeted INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_harassment_hate_speech INTEGER,
ADD COLUMN IF NOT EXISTS backup_user_ban_threshold_harassment_doxxing INTEGER;