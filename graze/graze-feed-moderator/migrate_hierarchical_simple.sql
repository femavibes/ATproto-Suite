-- Simple Hierarchical Report Types Migration
-- Only adds missing columns for hierarchical system

-- Add new hierarchical opt-in columns (30 subcategories)
-- misleading (6 types)
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_misleading_spam BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_misleading_scam BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_misleading_bot BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_misleading_impersonation BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_misleading_elections BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_misleading_other BOOLEAN DEFAULT false;

-- harassment (5 types)
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_harassment_troll BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_harassment_targeted BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_harassment_hate_speech BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_harassment_doxxing BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_harassment_other BOOLEAN DEFAULT false;

-- violence (6 types)
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_violence_animal BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_violence_threats BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_violence_graphic_content BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_violence_glorification BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_violence_trafficking BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_violence_other BOOLEAN DEFAULT false;

-- sexual (6 types)
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_sexual_unlabeled BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_sexual_abuse_content BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_sexual_ncii BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_sexual_deepfake BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_sexual_animal BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_sexual_other BOOLEAN DEFAULT false;

-- child-safety (2 types)
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_child_safety_privacy BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_child_safety_harassment BOOLEAN DEFAULT false;

-- self-harm (5 types)
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_self_harm_content BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_self_harm_ed BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_self_harm_stunts BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_self_harm_substances BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_self_harm_other BOOLEAN DEFAULT false;

-- rule (4 types)
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_rule_site_security BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_rule_prohibited_sales BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_rule_ban_evasion BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS opt_in_rule_other BOOLEAN DEFAULT false;

-- Add missing main category threshold columns (only add what doesn't exist)
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_violence INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_child_safety INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_self_harm INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_rule INTEGER DEFAULT 3;

-- Add subcategory threshold override columns (30 columns, NULL = use main category)
-- misleading subcategory thresholds
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_misleading_spam INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_misleading_scam INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_misleading_bot INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_misleading_impersonation INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_misleading_elections INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_misleading_other INTEGER DEFAULT NULL;

-- harassment subcategory thresholds
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_harassment_troll INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_harassment_targeted INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_harassment_hate_speech INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_harassment_doxxing INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_harassment_other INTEGER DEFAULT NULL;

-- violence subcategory thresholds
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_violence_animal INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_violence_threats INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_violence_graphic_content INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_violence_glorification INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_violence_trafficking INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_violence_other INTEGER DEFAULT NULL;

-- sexual subcategory thresholds
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_sexual_unlabeled INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_sexual_abuse_content INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_sexual_ncii INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_sexual_deepfake INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_sexual_animal INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_sexual_other INTEGER DEFAULT NULL;

-- child-safety subcategory thresholds
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_child_safety_privacy INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_child_safety_harassment INTEGER DEFAULT NULL;

-- self-harm subcategory thresholds
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_self_harm_content INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_self_harm_ed INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_self_harm_stunts INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_self_harm_substances INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_self_harm_other INTEGER DEFAULT NULL;

-- rule subcategory thresholds
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_rule_site_security INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_rule_prohibited_sales INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_rule_ban_evasion INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_rule_other INTEGER DEFAULT NULL;

-- other subcategory threshold
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS threshold_other_main INTEGER DEFAULT NULL;

-- Add feed display name for command parsing
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS feed_display_name TEXT;
UPDATE feeds SET feed_display_name = feed_name WHERE feed_display_name IS NULL;

-- Create command execution logging table
CREATE TABLE IF NOT EXISTS command_executions (
    id SERIAL PRIMARY KEY,
    reporter_did TEXT NOT NULL,
    post_uri TEXT NOT NULL,
    command_type TEXT NOT NULL,
    command_text TEXT NOT NULL,
    affected_feeds TEXT[], -- Array of feed IDs
    execution_status TEXT NOT NULL, -- 'success', 'failed', 'unauthorized'
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_command_executions_reporter ON command_executions(reporter_did);
CREATE INDEX IF NOT EXISTS idx_command_executions_post ON command_executions(post_uri);