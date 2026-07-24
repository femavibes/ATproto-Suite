-- Migrate legacy main category reports to specific subtypes
-- This fixes the threshold display issues caused by old "harassment" and "spam" reports

-- Update user_reports table
UPDATE user_reports SET report_type = 'harassment-other' WHERE report_type = 'harassment';
UPDATE user_reports SET report_type = 'misleading-spam' WHERE report_type = 'spam';

-- Update post_reports table  
UPDATE post_reports SET report_type = 'harassment-other' WHERE report_type = 'harassment';
UPDATE post_reports SET report_type = 'misleading-spam' WHERE report_type = 'spam';

-- Verify the migration
SELECT 'user_reports' as table_name, report_type, COUNT(*) as count 
FROM user_reports 
WHERE report_type IN ('harassment', 'spam', 'harassment-other', 'misleading-spam')
GROUP BY report_type
UNION ALL
SELECT 'post_reports' as table_name, report_type, COUNT(*) as count 
FROM post_reports 
WHERE report_type IN ('harassment', 'spam', 'harassment-other', 'misleading-spam')
GROUP BY report_type
ORDER BY table_name, report_type;