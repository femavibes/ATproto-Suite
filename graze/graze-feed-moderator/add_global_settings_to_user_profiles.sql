-- Add global communal moderation settings to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_communal_enabled BOOLEAN DEFAULT true;

-- Post removal thresholds for main categories
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_misleading INTEGER DEFAULT 10;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_harassment INTEGER DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_violence INTEGER DEFAULT 3;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_sexual INTEGER DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_child_safety INTEGER DEFAULT 2;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_self_harm INTEGER DEFAULT 3;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_rule INTEGER DEFAULT 5;

-- Post removal thresholds for subcategories (misleading)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_misleading_spam INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_misleading_scam INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_misleading_impersonation INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_misleading_bot INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_misleading_deepfake INTEGER;

-- Post removal thresholds for subcategories (harassment)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_harassment_targeted INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_harassment_doxxing INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_harassment_stalking INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_harassment_bullying INTEGER;

-- Post removal thresholds for subcategories (violence)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_violence_threat INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_violence_graphic INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_violence_extremism INTEGER;

-- Post removal thresholds for subcategories (sexual)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_sexual_nudity INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_sexual_graphic INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_sexual_solicitation INTEGER;

-- Post removal thresholds for subcategories (child safety)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_child_safety_exploitation INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_child_safety_grooming INTEGER;

-- Post removal thresholds for subcategories (self harm)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_self_harm_suicide INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_self_harm_eating INTEGER;

-- Post removal thresholds for subcategories (rule)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_rule_spam INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_rule_copyright INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_rule_privacy INTEGER;

-- Opt-in settings for subcategories (misleading)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_misleading_spam BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_misleading_scam BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_misleading_impersonation BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_misleading_bot BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_misleading_deepfake BOOLEAN DEFAULT true;

-- Opt-in settings for subcategories (harassment)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_harassment_targeted BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_harassment_doxxing BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_harassment_stalking BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_harassment_bullying BOOLEAN DEFAULT true;

-- Opt-in settings for subcategories (violence)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_violence_threat BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_violence_graphic BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_violence_extremism BOOLEAN DEFAULT true;

-- Opt-in settings for subcategories (sexual)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_sexual_nudity BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_sexual_graphic BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_sexual_solicitation BOOLEAN DEFAULT true;

-- Opt-in settings for subcategories (child safety)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_child_safety_exploitation BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_child_safety_grooming BOOLEAN DEFAULT true;

-- Opt-in settings for subcategories (self harm)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_self_harm_suicide BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_self_harm_eating BOOLEAN DEFAULT true;

-- Opt-in settings for subcategories (rule)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_rule_spam BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_rule_copyright BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_rule_privacy BOOLEAN DEFAULT true;

-- Cross-type percentage settings
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_same_category_cross_percentage INTEGER DEFAULT 50;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_cross_type_percentage INTEGER DEFAULT 20;

-- User ban thresholds for main categories
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading INTEGER DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment INTEGER DEFAULT 8;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence INTEGER DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual INTEGER DEFAULT 8;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_child_safety INTEGER DEFAULT 3;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm INTEGER DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_rule INTEGER DEFAULT 8;

-- User ban thresholds for subcategories (misleading)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading_spam INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading_scam INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading_impersonation INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading_bot INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_misleading_deepfake INTEGER;

-- User ban thresholds for subcategories (harassment)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment_targeted INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment_doxxing INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment_stalking INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_harassment_bullying INTEGER;

-- User ban thresholds for subcategories (violence)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_threat INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_graphic INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_extremism INTEGER;

-- User ban thresholds for subcategories (sexual)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_nudity INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_graphic INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_solicitation INTEGER;

-- User ban thresholds for subcategories (child safety)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_child_safety_exploitation INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_child_safety_grooming INTEGER;

-- User ban thresholds for subcategories (self harm)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm_suicide INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm_eating INTEGER;

-- User ban thresholds for subcategories (rule)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_rule_spam INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_rule_copyright INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_rule_privacy INTEGER;

-- User ban opt-in settings for subcategories (misleading)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_misleading_spam BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_misleading_scam BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_misleading_impersonation BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_misleading_bot BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_misleading_deepfake BOOLEAN DEFAULT true;

-- User ban opt-in settings for subcategories (harassment)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_harassment_targeted BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_harassment_doxxing BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_harassment_stalking BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_harassment_bullying BOOLEAN DEFAULT true;

-- User ban opt-in settings for subcategories (violence)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_threat BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_graphic BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_extremism BOOLEAN DEFAULT true;

-- User ban opt-in settings for subcategories (sexual)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_nudity BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_graphic BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_solicitation BOOLEAN DEFAULT true;

-- User ban opt-in settings for subcategories (child safety)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_child_safety_exploitation BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_child_safety_grooming BOOLEAN DEFAULT true;

-- User ban opt-in settings for subcategories (self harm)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_self_harm_suicide BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_self_harm_eating BOOLEAN DEFAULT true;

-- User ban opt-in settings for subcategories (rule)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_rule_spam BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_rule_copyright BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_rule_privacy BOOLEAN DEFAULT true;

-- User ban cross-type percentage settings
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_same_category_cross_percentage INTEGER DEFAULT 50;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_cross_type_percentage INTEGER DEFAULT 20;