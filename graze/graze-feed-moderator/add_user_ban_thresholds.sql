-- Add user ban thresholds to feeds table
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_spam INTEGER DEFAULT 15;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_sexual INTEGER DEFAULT 8;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_harassment INTEGER DEFAULT 8;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_threshold_illegal INTEGER DEFAULT 5;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS user_ban_cross_type_percentage INTEGER DEFAULT 20;

-- Create user ban reports table to track reports against users
CREATE TABLE IF NOT EXISTS user_reports (
    id SERIAL PRIMARY KEY,
    reported_user_did VARCHAR(255) NOT NULL,
    report_type VARCHAR(100) NOT NULL, -- spam, sexual, harassment, illegal (excluding misleading/other)
    reporter_did VARCHAR(255) NOT NULL,
    post_uri VARCHAR(500), -- optional: the post that triggered the user report
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(reported_user_did, report_type, reporter_did, post_uri)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_reports_user_did ON user_reports(reported_user_did);
CREATE INDEX IF NOT EXISTS idx_user_reports_type ON user_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported_at ON user_reports(reported_at);