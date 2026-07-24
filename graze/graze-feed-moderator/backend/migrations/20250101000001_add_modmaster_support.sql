-- Phase 1: ModMaster Labeler System - Database Schema
-- Add custom labeler support and report type settings

-- Add custom labeler fields to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS custom_labeler_did TEXT,
ADD COLUMN IF NOT EXISTS custom_labeler_ozone_url TEXT,
ADD COLUMN IF NOT EXISTS custom_labeler_password TEXT,
ADD COLUMN IF NOT EXISTS non_user_post_removal_weight DECIMAL DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS non_user_ban_weight DECIMAL DEFAULT 0.5;

-- User report type settings (global defaults per user)
CREATE TABLE IF NOT EXISTS user_report_type_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('remove_all', 'ban_all', 'log_only', 'command_only')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, report_type)
);

CREATE INDEX IF NOT EXISTS idx_user_report_type_settings_user_id ON user_report_type_settings(user_id);

-- Feed report type overrides (per-feed overrides)
CREATE TABLE IF NOT EXISTS feed_report_type_overrides (
  id SERIAL PRIMARY KEY,
  feed_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  action TEXT CHECK (action IN ('remove_all', 'ban_all', 'log_only', 'command_only')),
  non_user_post_weight DECIMAL,
  non_user_ban_weight DECIMAL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(feed_id, report_type)
);

CREATE INDEX IF NOT EXISTS idx_feed_report_type_overrides_feed_id ON feed_report_type_overrides(feed_id);

-- Add report source tracking (which labeler the report came from)
ALTER TABLE post_reports 
ADD COLUMN IF NOT EXISTS labeler_did TEXT,
ADD COLUMN IF NOT EXISTS report_weight DECIMAL DEFAULT 1.0;

CREATE INDEX IF NOT EXISTS idx_post_reports_labeler_did ON post_reports(labeler_did);

-- Add user report tracking for ban thresholds
CREATE TABLE IF NOT EXISTS user_reports (
  id SERIAL PRIMARY KEY,
  reported_user_did TEXT NOT NULL,
  reporter_did TEXT NOT NULL,
  report_type TEXT NOT NULL,
  labeler_did TEXT,
  report_weight DECIMAL DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user ON user_reports(reported_user_did);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports(reporter_did);
CREATE INDEX IF NOT EXISTS idx_user_reports_labeler ON user_reports(labeler_did);
