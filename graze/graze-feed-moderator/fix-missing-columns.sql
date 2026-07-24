-- Add missing threshold columns for user_profiles table

-- Child Safety
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_child_safety_harassment integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_child_safety_privacy integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_child_safety_harassment integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_child_safety_privacy integer DEFAULT 15;

-- Rule categories
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_rule_ban_evasion integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_rule_prohibited_sales integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_rule_site_security integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_rule_ban_evasion integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_rule_prohibited_sales integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_rule_site_security integer DEFAULT 15;

-- Self-harm categories
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_self_harm_content integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_self_harm_ed integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_self_harm_stunts integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_self_harm_substances integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm_content integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm_ed integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm_stunts integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_self_harm_substances integer DEFAULT 15;

-- Sexual categories
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_sexual_abuse_content integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_sexual_animal integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_sexual_deepfake integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_sexual_ncii integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_sexual_unlabeled integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_abuse_content integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_animal integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_deepfake integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_ncii integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_sexual_unlabeled integer DEFAULT 15;

-- Violence categories
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_violence_animal integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_violence_glorification integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_violence_graphic_content integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_violence_threats integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_violence_trafficking integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_animal integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_glorification integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_graphic_content integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_threats integer DEFAULT 15;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_violence_trafficking integer DEFAULT 15;

-- Other category (already added but including for completeness)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_other integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_other integer DEFAULT 15;

-- Other subcategory under other
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_threshold_other_other integer DEFAULT 5;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_threshold_other_other integer DEFAULT 15;

-- Opt-in columns for new categories
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_child_safety_harassment boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_child_safety_privacy boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_rule_ban_evasion boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_rule_prohibited_sales boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_rule_site_security boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_self_harm_content boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_self_harm_ed boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_self_harm_stunts boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_self_harm_substances boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_sexual_abuse_content boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_sexual_animal boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_sexual_deepfake boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_sexual_ncii boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_sexual_unlabeled boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_violence_animal boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_violence_glorification boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_violence_graphic_content boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_violence_threats boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_violence_trafficking boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_other boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_opt_in_other_other boolean DEFAULT true;

-- User ban opt-in columns for new categories
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_child_safety_harassment boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_child_safety_privacy boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_rule_ban_evasion boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_rule_prohibited_sales boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_rule_site_security boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_self_harm_content boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_self_harm_ed boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_self_harm_stunts boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_self_harm_substances boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_abuse_content boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_animal boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_deepfake boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_ncii boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_sexual_unlabeled boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_animal boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_glorification boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_graphic_content boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_threats boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_violence_trafficking boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_other boolean DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS global_user_ban_opt_in_other_other boolean DEFAULT true;