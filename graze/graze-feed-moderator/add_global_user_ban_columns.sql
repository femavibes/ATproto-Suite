-- Add missing global user ban hierarchical columns to user_profiles table

-- Main category thresholds (these already exist, but let's make sure)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading INTEGER DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment INTEGER DEFAULT 8;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence INTEGER DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual INTEGER DEFAULT 8;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_child_safety INTEGER DEFAULT 3;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm INTEGER DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_rule INTEGER DEFAULT 8;

-- Cross-type percentages
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_same_category_cross_percentage INTEGER DEFAULT 50;

-- Subcategory opt-in flags
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_misleading_spam BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_misleading_scam BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_misleading_bot BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_misleading_impersonation BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_misleading_elections BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_misleading_other BOOLEAN DEFAULT false;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_harassment_troll BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_harassment_targeted BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_harassment_hate_speech BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_harassment_doxxing BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_harassment_other BOOLEAN DEFAULT false;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_animal BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_threats BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_graphic_content BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_glorification BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_trafficking BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_other BOOLEAN DEFAULT false;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_unlabeled BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_abuse_content BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_ncii BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_deepfake BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_animal BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_other BOOLEAN DEFAULT false;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_child_safety_privacy BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_child_safety_harassment BOOLEAN DEFAULT false;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_self_harm_content BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_self_harm_ed BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_self_harm_stunts BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_self_harm_substances BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_self_harm_other BOOLEAN DEFAULT false;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_rule_site_security BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_rule_prohibited_sales BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_rule_ban_evasion BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_rule_other BOOLEAN DEFAULT false;

-- Subcategory specific thresholds
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading_spam INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading_scam INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading_bot INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading_impersonation INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading_elections INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading_other INTEGER;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment_troll INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment_targeted INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment_hate_speech INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment_doxxing INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment_other INTEGER;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_animal INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_threats INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_graphic_content INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_glorification INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_trafficking INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_other INTEGER;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_unlabeled INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_abuse_content INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_ncii INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_deepfake INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_animal INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_other INTEGER;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_child_safety_privacy INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_child_safety_harassment INTEGER;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm_content INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm_ed INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm_stunts INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm_substances INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm_other INTEGER;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_rule_site_security INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_rule_prohibited_sales INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_rule_ban_evasion INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_rule_other INTEGER;