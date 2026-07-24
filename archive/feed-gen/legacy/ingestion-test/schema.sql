-- Test posts table
CREATE TABLE posts (
  cid TEXT PRIMARY KEY,
  uri TEXT NOT NULL,
  text TEXT,
  author_did TEXT NOT NULL,
  author_handle TEXT,
  has_images BOOLEAN DEFAULT FALSE,
  has_video BOOLEAN DEFAULT FALSE,
  has_link BOOLEAN DEFAULT FALSE,
  language TEXT,
  like_count INTEGER DEFAULT 0,
  repost_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL,
  indexed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_author ON posts(author_did);

-- Ingestion runs tracking
CREATE TABLE ingestion_runs (
  id SERIAL PRIMARY KEY,
  run_name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  posts_received INTEGER DEFAULT 0,
  posts_saved INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  avg_posts_per_second DECIMAL(10,2),
  peak_posts_per_second INTEGER,
  status TEXT DEFAULT 'running'
);

-- Per-second metrics
CREATE TABLE ingestion_metrics (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES ingestion_runs(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  posts_count INTEGER NOT NULL,
  db_write_ms INTEGER,
  memory_mb INTEGER
);

CREATE INDEX idx_metrics_run ON ingestion_metrics(run_id, timestamp);
