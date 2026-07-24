-- Track interaction records so Jetstream delete events can decrement counters.
CREATE TABLE IF NOT EXISTS post_engagement_events (
  action_uri TEXT PRIMARY KEY,
  subject_post_uri TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_engagement_events_subject ON post_engagement_events(subject_post_uri);
CREATE INDEX IF NOT EXISTS idx_post_engagement_events_kind ON post_engagement_events(kind);
