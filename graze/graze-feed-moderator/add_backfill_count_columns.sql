-- Add separate backfill count columns for different post counts
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS backfill_count_25 INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS backfill_count_50 INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS backfill_count_100 INTEGER DEFAULT 0;

-- Migrate existing backfill_count to backfill_count_50 (assuming most were 50-post backfills)
UPDATE user_profiles SET backfill_count_50 = COALESCE(backfill_count, 0) WHERE backfill_count IS NOT NULL;

-- Keep the old column for backward compatibility but can be dropped later
-- ALTER TABLE user_profiles DROP COLUMN IF EXISTS backfill_count;