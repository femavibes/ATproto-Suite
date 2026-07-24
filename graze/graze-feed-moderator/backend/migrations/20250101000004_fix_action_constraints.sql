-- Fix action constraints to match frontend options

-- Drop existing constraints
ALTER TABLE modmaster_report_settings DROP CONSTRAINT IF EXISTS modmaster_report_settings_action_check;
ALTER TABLE custom_labeler_report_settings DROP CONSTRAINT IF EXISTS custom_labeler_report_settings_action_check;

-- Add updated constraints with correct action values
ALTER TABLE modmaster_report_settings 
ADD CONSTRAINT modmaster_report_settings_action_check 
CHECK (action IN ('remove_all_account', 'remove_all_configured', 'remove_selected', 'ban_global_only', 'ban_all_feeds', 'ban_global_and_feeds', 'ban_selected', 'log_only', 'command_only'));

ALTER TABLE custom_labeler_report_settings 
ADD CONSTRAINT custom_labeler_report_settings_action_check 
CHECK (action IN ('remove_all_account', 'remove_all_configured', 'remove_selected', 'ban_global_only', 'ban_all_feeds', 'ban_global_and_feeds', 'ban_selected', 'log_only', 'command_only'));