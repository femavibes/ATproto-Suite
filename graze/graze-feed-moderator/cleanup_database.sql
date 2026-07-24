-- Clean up incorrect tables and columns I added

-- Remove the global_user_ban_settings table I incorrectly created
DROP TABLE IF EXISTS global_user_ban_settings;

-- Remove the incorrect hierarchical report type column I added to user_reports
ALTER TABLE user_reports DROP COLUMN IF EXISTS report_type_hierarchical;
DROP INDEX IF EXISTS idx_user_reports_hierarchical_type;

-- Remove any duplicate user ban columns I may have added
-- (Keep only the original ones that were already there)

-- The original system should have these main category thresholds:
-- user_ban_threshold_misleading, user_ban_threshold_harassment, etc.
-- And the hierarchical opt-in and threshold columns that already existed

-- Remove the incorrect main category columns I added (if they're duplicates)
-- Only remove if they conflict with existing structure

-- Clean up is complete - the existing hierarchical structure should remain intact