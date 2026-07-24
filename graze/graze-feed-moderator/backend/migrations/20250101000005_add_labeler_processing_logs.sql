-- Add table for labeler processing logs

CREATE TABLE IF NOT EXISTS labeler_processing_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
  labeler_type TEXT NOT NULL CHECK (labeler_type IN ('modmaster', 'custom')),
  report_type TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'user')),
  post_uri TEXT,
  target_handle TEXT,
  target_did TEXT,
  action_taken TEXT NOT NULL,
  feed_id TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'pending')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labeler_processing_logs_user_id ON labeler_processing_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_labeler_processing_logs_labeler_type ON labeler_processing_logs(labeler_type);
CREATE INDEX IF NOT EXISTS idx_labeler_processing_logs_created_at ON labeler_processing_logs(created_at);