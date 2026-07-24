-- Migrate user ban thresholds to hierarchical structure
-- Add new hierarchical user ban threshold columns

-- Main category thresholds
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_misleading INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_harassment INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_violence INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_sexual INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_child_safety INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_self_harm INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_rule INTEGER;

-- Subcategory opt-in flags (default true for enabled subcategories)
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_misleading_spam BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_misleading_bot BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_misleading_impersonation BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_misleading_other BOOLEAN DEFAULT false;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_harassment_targeted BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_harassment_doxxing BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_harassment_other BOOLEAN DEFAULT false;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_violence_threat BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_violence_graphic BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_violence_other BOOLEAN DEFAULT false;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_sexual_nudity BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_sexual_pornography BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_sexual_other BOOLEAN DEFAULT false;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_child_safety_csam BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_child_safety_grooming BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_child_safety_other BOOLEAN DEFAULT false;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_self_harm_suicide BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_self_harm_cutting BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_self_harm_other BOOLEAN DEFAULT false;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_rule_copyright BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_rule_trademark BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_opt_in_rule_other BOOLEAN DEFAULT false;

-- Subcategory specific thresholds (NULL means inherit from main category)
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_misleading_spam INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_misleading_bot INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_misleading_impersonation INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_misleading_other INTEGER;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_harassment_targeted INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_harassment_doxxing INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_harassment_other INTEGER;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_violence_threat INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_violence_graphic INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_violence_other INTEGER;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_sexual_nudity INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_sexual_pornography INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_sexual_other INTEGER;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_child_safety_csam INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_child_safety_grooming INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_child_safety_other INTEGER;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_self_harm_suicide INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_self_harm_cutting INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_self_harm_other INTEGER;

ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_rule_copyright INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_rule_trademark INTEGER;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_rule_other INTEGER;

-- Cross-type percentages for user bans
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_same_category_cross_percentage INTEGER DEFAULT 50;

-- Migrate existing legacy data to new hierarchical structure
UPDATE feeds SET 
  user_ban_threshold_misleading = COALESCE(user_ban_threshold_spam, 15),
  user_ban_threshold_harassment = COALESCE(user_ban_threshold_harassment, 8),
  user_ban_threshold_violence = COALESCE(user_ban_threshold_illegal, 5),
  user_ban_threshold_sexual = COALESCE(user_ban_threshold_sexual, 8)
WHERE user_ban_threshold_misleading IS NULL 
   OR user_ban_threshold_harassment IS NULL 
   OR user_ban_threshold_violence IS NULL 
   OR user_ban_threshold_sexual IS NULL;

-- Set default thresholds for new categories
UPDATE feeds SET 
  user_ban_threshold_child_safety = 3,
  user_ban_threshold_self_harm = 5,
  user_ban_threshold_rule = 8
WHERE user_ban_threshold_child_safety IS NULL 
   OR user_ban_threshold_self_harm IS NULL 
   OR user_ban_threshold_rule IS NULL;

-- Add global user ban settings table
CREATE TABLE IF NOT EXISTS global_user_ban_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    
    -- Main category thresholds
    global_user_ban_threshold_misleading INTEGER DEFAULT 15,
    global_user_ban_threshold_harassment INTEGER DEFAULT 8,
    global_user_ban_threshold_violence INTEGER DEFAULT 5,
    global_user_ban_threshold_sexual INTEGER DEFAULT 8,
    global_user_ban_threshold_child_safety INTEGER DEFAULT 3,
    global_user_ban_threshold_self_harm INTEGER DEFAULT 5,
    global_user_ban_threshold_rule INTEGER DEFAULT 8,
    
    -- Subcategory opt-in flags
    global_user_ban_opt_in_misleading_spam BOOLEAN DEFAULT true,
    global_user_ban_opt_in_misleading_bot BOOLEAN DEFAULT true,
    global_user_ban_opt_in_misleading_impersonation BOOLEAN DEFAULT true,
    global_user_ban_opt_in_misleading_other BOOLEAN DEFAULT false,
    
    global_user_ban_opt_in_harassment_targeted BOOLEAN DEFAULT true,
    global_user_ban_opt_in_harassment_doxxing BOOLEAN DEFAULT true,
    global_user_ban_opt_in_harassment_other BOOLEAN DEFAULT false,
    
    global_user_ban_opt_in_violence_threat BOOLEAN DEFAULT true,
    global_user_ban_opt_in_violence_graphic BOOLEAN DEFAULT true,
    global_user_ban_opt_in_violence_other BOOLEAN DEFAULT false,
    
    global_user_ban_opt_in_sexual_nudity BOOLEAN DEFAULT true,
    global_user_ban_opt_in_sexual_pornography BOOLEAN DEFAULT true,
    global_user_ban_opt_in_sexual_other BOOLEAN DEFAULT false,
    
    global_user_ban_opt_in_child_safety_csam BOOLEAN DEFAULT true,
    global_user_ban_opt_in_child_safety_grooming BOOLEAN DEFAULT true,
    global_user_ban_opt_in_child_safety_other BOOLEAN DEFAULT false,
    
    global_user_ban_opt_in_self_harm_suicide BOOLEAN DEFAULT true,
    global_user_ban_opt_in_self_harm_cutting BOOLEAN DEFAULT true,
    global_user_ban_opt_in_self_harm_other BOOLEAN DEFAULT false,
    
    global_user_ban_opt_in_rule_copyright BOOLEAN DEFAULT true,
    global_user_ban_opt_in_rule_trademark BOOLEAN DEFAULT true,
    global_user_ban_opt_in_rule_other BOOLEAN DEFAULT false,
    
    -- Subcategory specific thresholds
    global_user_ban_threshold_misleading_spam INTEGER,
    global_user_ban_threshold_misleading_bot INTEGER,
    global_user_ban_threshold_misleading_impersonation INTEGER,
    global_user_ban_threshold_misleading_other INTEGER,
    
    global_user_ban_threshold_harassment_targeted INTEGER,
    global_user_ban_threshold_harassment_doxxing INTEGER,
    global_user_ban_threshold_harassment_other INTEGER,
    
    global_user_ban_threshold_violence_threat INTEGER,
    global_user_ban_threshold_violence_graphic INTEGER,
    global_user_ban_threshold_violence_other INTEGER,
    
    global_user_ban_threshold_sexual_nudity INTEGER,
    global_user_ban_threshold_sexual_pornography INTEGER,
    global_user_ban_threshold_sexual_other INTEGER,
    
    global_user_ban_threshold_child_safety_csam INTEGER,
    global_user_ban_threshold_child_safety_grooming INTEGER,
    global_user_ban_threshold_child_safety_other INTEGER,
    
    global_user_ban_threshold_self_harm_suicide INTEGER,
    global_user_ban_threshold_self_harm_cutting INTEGER,
    global_user_ban_threshold_self_harm_other INTEGER,
    
    global_user_ban_threshold_rule_copyright INTEGER,
    global_user_ban_threshold_rule_trademark INTEGER,
    global_user_ban_threshold_rule_other INTEGER,
    
    -- Cross-type percentages
    global_user_ban_same_category_cross_percentage INTEGER DEFAULT 50,
    global_user_ban_cross_type_percentage INTEGER DEFAULT 20,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id)
);

-- Update user_reports table to use hierarchical report types
-- Add new report_type_hierarchical column
ALTER TABLE user_reports ADD COLUMN IF NOT EXISTS report_type_hierarchical VARCHAR(100);

-- Migrate existing legacy report types to hierarchical format
UPDATE user_reports SET report_type_hierarchical = 
  CASE 
    WHEN report_type = 'spam' THEN 'misleading-spam'
    WHEN report_type = 'harassment' THEN 'harassment-targeted'
    WHEN report_type = 'illegal' THEN 'violence-threat'
    WHEN report_type = 'sexual' THEN 'sexual-nudity'
    ELSE 'other'
  END
WHERE report_type_hierarchical IS NULL;

-- Create index for new hierarchical report type
CREATE INDEX IF NOT EXISTS idx_user_reports_hierarchical_type ON user_reports(report_type_hierarchical);

-- Note: Keep legacy columns for backward compatibility during transition
-- They can be removed in a future migration once all systems are updated