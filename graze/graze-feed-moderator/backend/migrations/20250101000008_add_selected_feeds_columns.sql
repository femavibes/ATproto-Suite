-- Add selected_feeds column to modmaster_report_settings
ALTER TABLE modmaster_report_settings 
ADD COLUMN selected_feeds TEXT[];

-- Add selected_feeds column to custom_labeler_report_settings
ALTER TABLE custom_labeler_report_settings 
ADD COLUMN selected_feeds TEXT[];