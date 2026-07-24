-- Corrected migration to match actual post removal subcategories
-- First, remove the incorrect columns I added

-- Remove incorrect user ban columns that don't match your actual subcategories
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_misleading_spam;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_misleading_bot;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_misleading_impersonation;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_misleading_other;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_harassment_targeted;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_harassment_doxxing;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_harassment_other;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_violence_threat;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_violence_graphic;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_violence_other;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_sexual_nudity;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_sexual_pornography;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_sexual_other;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_child_safety_csam;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_child_safety_grooming;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_child_safety_other;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_self_harm_suicide;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_self_harm_cutting;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_self_harm_other;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_rule_copyright;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_rule_trademark;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_opt_in_rule_other;

-- Remove incorrect threshold columns
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_misleading_spam;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_misleading_bot;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_misleading_impersonation;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_misleading_other;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_harassment_targeted;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_harassment_doxxing;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_harassment_other;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_violence_threat;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_violence_graphic;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_violence_other;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_sexual_nudity;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_sexual_pornography;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_sexual_other;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_child_safety_csam;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_child_safety_grooming;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_child_safety_other;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_self_harm_suicide;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_self_harm_cutting;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_self_harm_other;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_rule_copyright;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_rule_trademark;
ALTER TABLE feeds DROP COLUMN IF EXISTS user_ban_threshold_rule_other;

-- Now add the CORRECT user ban columns that match your actual post removal subcategories

-- User ban opt-in flags matching actual subcategories
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_misleading_spam BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_misleading_scam BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_misleading_bot BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_misleading_impersonation BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_misleading_elections BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_misleading_other BOOLEAN DEFAULT false;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_harassment_troll BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_harassment_targeted BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_harassment_hate_speech BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_harassment_doxxing BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_harassment_other BOOLEAN DEFAULT false;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_violence_animal BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_violence_threats BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_violence_graphic_content BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_violence_glorification BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_violence_trafficking BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_violence_other BOOLEAN DEFAULT false;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_sexual_unlabeled BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_sexual_abuse_content BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_sexual_ncii BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_sexual_deepfake BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_sexual_animal BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_sexual_other BOOLEAN DEFAULT false;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_child_safety_privacy BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_child_safety_harassment BOOLEAN DEFAULT false;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_self_harm_content BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_self_harm_ed BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_self_harm_stunts BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_self_harm_substances BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_self_harm_other BOOLEAN DEFAULT false;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_rule_site_security BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_rule_prohibited_sales BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_rule_ban_evasion BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_rule_other BOOLEAN DEFAULT false;

-- User ban threshold columns matching actual subcategories
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_misleading_spam INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_misleading_scam INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_misleading_bot INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_misleading_impersonation INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_misleading_elections INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_misleading_other INTEGER;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_harassment_troll INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_harassment_targeted INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_harassment_hate_speech INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_harassment_doxxing INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_harassment_other INTEGER;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_violence_animal INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_violence_threats INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_violence_graphic_content INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_violence_glorification INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_violence_trafficking INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_violence_other INTEGER;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_sexual_unlabeled INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_sexual_abuse_content INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_sexual_ncii INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_sexual_deepfake INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_sexual_animal INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_sexual_other INTEGER;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_child_safety_privacy INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_child_safety_harassment INTEGER;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_self_harm_content INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_self_harm_ed INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_self_harm_stunts INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_self_harm_substances INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_self_harm_other INTEGER;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_rule_site_security INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_rule_prohibited_sales INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_rule_ban_evasion INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_rule_other INTEGER;

-- Also add threshold for "other" main category
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_other_main INTEGER;

-- Drop and recreate the global_user_ban_settings table with correct structure
DROP TABLE IF EXISTS global_user_ban_settings;

-- Note: The main category thresholds and cross-type percentages are already correct
-- user_ban_threshold_misleading, user_ban_threshold_harassment, etc. are fine
-- user_ban_same_category_cross_percentage and user_ban_cross_type_percentage are fine

-- The user_reports table hierarchical migration is also fine since it's just mapping legacy to new