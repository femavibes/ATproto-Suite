-- Persist assignment prefilter hints per feed for candidate narrowing.
ALTER TABLE feeds
  ADD COLUMN IF NOT EXISTS prefilter_hints JSONB;
