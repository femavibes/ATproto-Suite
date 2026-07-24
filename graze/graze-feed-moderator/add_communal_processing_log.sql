CREATE TABLE IF NOT EXISTS communal_processing_log (
  post_uri TEXT PRIMARY KEY,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_communal_processing_log_processed_at 
ON communal_processing_log(processed_at);