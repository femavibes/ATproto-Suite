-- Hierarchical Report Types Migration
-- Migrates from 6 flat report types to 30 hierarchical subcategories + 8 main categories

BEGIN;

-- Backup existing opt-in settings before migration
CREATE TEMP TABLE feeds_backup AS 
SELECT id, user_id, feed_id, feed_name, 
       opt_in_spam, opt_in_misleading, opt_in_sexual, opt_in_harassment, opt_in_illegal, opt_in_other
FROM feeds;

-- Drop old opt-in columns (keep opt_in_other for now)
ALTER TABLE feeds DROP COLUMN IF EXISTS opt_in_spam;
ALTER TABLE feeds DROP COLUMN IF EXISTS opt_in_misleading;
ALTER TABLE feeds DROP COLUMN IF EXISTS opt_in_sexual;
ALTER TABLE feeds DROP COLUMN IF EXISTS opt_in_harassment;
ALTER TABLE feeds DROP COLUMN IF EXISTS opt_in_illegal;

-- Add new hierarchical opt-in columns (30 subcategories)
-- misleading (6 types)
ALTER TABLE feeds ADD COLUMN opt_in_misleading_spam BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_misleading_scam BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_misleading_bot BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_misleading_impersonation BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_misleading_elections BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_misleading_other BOOLEAN DEFAULT false;

-- harassment (5 types)
ALTER TABLE feeds ADD COLUMN opt_in_harassment_troll BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_harassment_targeted BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_harassment_hate_speech BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_harassment_doxxing BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_harassment_other BOOLEAN DEFAULT false;

-- violence (6 types)
ALTER TABLE feeds ADD COLUMN opt_in_violence_animal BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_violence_threats BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_violence_graphic_content BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_violence_glorification BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_violence_trafficking BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_violence_other BOOLEAN DEFAULT false;

-- sexual (6 types)
ALTER TABLE feeds ADD COLUMN opt_in_sexual_unlabeled BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_sexual_abuse_content BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_sexual_ncii BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_sexual_deepfake BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_sexual_animal BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_sexual_other BOOLEAN DEFAULT false;

-- child-safety (2 types)
ALTER TABLE feeds ADD COLUMN opt_in_child_safety_privacy BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_child_safety_harassment BOOLEAN DEFAULT false;

-- self-harm (5 types)
ALTER TABLE feeds ADD COLUMN opt_in_self_harm_content BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_self_harm_ed BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_self_harm_stunts BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_self_harm_substances BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_self_harm_other BOOLEAN DEFAULT false;

-- rule (4 types)
ALTER TABLE feeds ADD COLUMN opt_in_rule_site_security BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_rule_prohibited_sales BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_rule_ban_evasion BOOLEAN DEFAULT false;
ALTER TABLE feeds ADD COLUMN opt_in_rule_other BOOLEAN DEFAULT false;

-- other (1 type) - already exists, ensure it's set correctly
-- opt_in_other already exists, no need to add

-- Add main category threshold columns (8 categories)
ALTER TABLE feeds ADD COLUMN threshold_misleading INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_harassment INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_violence INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_sexual INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_child_safety INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_self_harm INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_rule INTEGER DEFAULT 3;
ALTER TABLE feeds ADD COLUMN threshold_other INTEGER DEFAULT 3;

-- Add subcategory threshold override columns (30 columns, NULL = use main category)
-- misleading subcategory thresholds
ALTER TABLE feeds ADD COLUMN threshold_misleading_spam INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_misleading_scam INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_misleading_bot INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_misleading_impersonation INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_misleading_elections INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_misleading_other INTEGER DEFAULT NULL;

-- harassment subcategory thresholds
ALTER TABLE feeds ADD COLUMN threshold_harassment_troll INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_harassment_targeted INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_harassment_hate_speech INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_harassment_doxxing INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_harassment_other INTEGER DEFAULT NULL;

-- violence subcategory thresholds
ALTER TABLE feeds ADD COLUMN threshold_violence_animal INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_violence_threats INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_violence_graphic_content INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_violence_glorification INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_violence_trafficking INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_violence_other INTEGER DEFAULT NULL;

-- sexual subcategory thresholds
ALTER TABLE feeds ADD COLUMN threshold_sexual_unlabeled INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_sexual_abuse_content INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_sexual_ncii INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_sexual_deepfake INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_sexual_animal INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_sexual_other INTEGER DEFAULT NULL;

-- child-safety subcategory thresholds
ALTER TABLE feeds ADD COLUMN threshold_child_safety_privacy INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_child_safety_harassment INTEGER DEFAULT NULL;

-- self-harm subcategory thresholds
ALTER TABLE feeds ADD COLUMN threshold_self_harm_content INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_self_harm_ed INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_self_harm_stunts INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_self_harm_substances INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_self_harm_other INTEGER DEFAULT NULL;

-- rule subcategory thresholds
ALTER TABLE feeds ADD COLUMN threshold_rule_site_security INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_rule_prohibited_sales INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_rule_ban_evasion INTEGER DEFAULT NULL;
ALTER TABLE feeds ADD COLUMN threshold_rule_other INTEGER DEFAULT NULL;

-- other subcategory threshold
ALTER TABLE feeds ADD COLUMN threshold_other_main INTEGER DEFAULT NULL;

-- Migration: Set all existing feeds to opt into 'other' only
UPDATE feeds SET opt_in_other = true;

-- Add feed display name for command parsing
ALTER TABLE feeds ADD COLUMN feed_display_name TEXT;
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
CREATE INDEX IF NOT EXISTS idx_feeds_opt_in_other ON feeds(opt_in_other);
CREATE INDEX IF NOT EXISTS idx_command_executions_reporter ON command_executions(reporter_did);
CREATE INDEX IF NOT EXISTS idx_command_executions_post ON command_executions(post_uri);

COMMIT;

-- Log migration completion
INSERT INTO moderation_log (action, moderator_did, reason) 
VALUES ('system_migration', 'system', 'Hierarchical report types migration completed');