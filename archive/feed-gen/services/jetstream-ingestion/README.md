# Jetstream Ingestion Service

## Purpose

Connect to Bluesky Jetstream firehose, filter posts using Aho-Corasick keyword matching, and save matching English posts to database.

## Dependencies

- PostgreSQL (write posts, track cursor)
- Keywords file (placeholder until feed system is built)

## Failure Impact

New posts not ingested (existing feeds work)

## Restart Behavior

Safe anytime (uses cursor to resume from last position)

## Filtering Strategy

1. **Aho-Corasick**: Fast keyword matching (O(n) where n = post length)
2. **Language Detection**: English only (using langdetect)
3. **Save**: Only posts that match keywords AND are English

## Cursor Tracking

Tracks position in Jetstream using `jetstream_cursor` table to resume after restart.
