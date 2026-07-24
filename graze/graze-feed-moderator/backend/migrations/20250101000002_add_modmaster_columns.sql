-- Add missing ModMaster columns to existing tables

-- Add columns to user_reports if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_reports' AND column_name='labeler_did') THEN
    ALTER TABLE user_reports ADD COLUMN labeler_did TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_reports' AND column_name='report_weight') THEN
    ALTER TABLE user_reports ADD COLUMN report_weight DECIMAL DEFAULT 1.0;
  END IF;
END $$;

-- Add columns to post_reports if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='post_reports' AND column_name='labeler_did') THEN
    ALTER TABLE post_reports ADD COLUMN labeler_did TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='post_reports' AND column_name='report_weight') THEN
    ALTER TABLE post_reports ADD COLUMN report_weight DECIMAL DEFAULT 1.0;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_reports_labeler ON user_reports(labeler_did);
CREATE INDEX IF NOT EXISTS idx_post_reports_labeler_did ON post_reports(labeler_did);
