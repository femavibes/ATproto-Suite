-- Fix recent_posts.created_at to use timestamptz for proper timezone handling
ALTER TABLE recent_posts ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
