-- Add autoblock system logs table for comprehensive historical tracking
CREATE TABLE IF NOT EXISTS autoblock_system_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'auth_failure', 'auth_recovery', 'auth_retry', 'auth_success', 'autoblock_success', 'autoblock_failure'
  message TEXT NOT NULL,
  details TEXT,
  account_type VARCHAR(20), -- 'main', 'monitored'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_autoblock_system_logs_user_created ON autoblock_system_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autoblock_system_logs_event_type ON autoblock_system_logs(event_type);