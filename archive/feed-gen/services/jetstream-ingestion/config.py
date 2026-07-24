"""Configuration for jetstream-ingestion service."""

import os
from pathlib import Path

# Database configuration
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://feedgen:feedgen@postgres:5432/feedgen"
)

# Jetstream WebSocket URL
JETSTREAM_URL: str = os.getenv(
    "JETSTREAM_URL",
    "wss://jetstream2.us-east.bsky.network/subscribe?"
    "wantedCollections=app.bsky.feed.post&"
    "wantedCollections=app.bsky.feed.like&"
    "wantedCollections=app.bsky.feed.repost"
)

# Keywords file path (placeholder until feed system is built)
KEYWORDS_FILE: str = os.getenv(
    "KEYWORDS_FILE",
    str(Path(__file__).parent.parent.parent / "keywords.txt")
)

# Language filter
LANGUAGE_FILTER: str = os.getenv("LANGUAGE_FILTER", "en")  # English only

# Batch size for database commits
BATCH_SIZE: int = int(os.getenv("BATCH_SIZE", "100"))

# Maximum time to wait before flushing a partial batch.
BATCH_FLUSH_SECONDS: float = float(os.getenv("BATCH_FLUSH_SECONDS", "1.0"))

# Service name
SERVICE_NAME: str = "jetstream-ingestion"

# When True, only index posts that pass at least one live feed graph (same engine as assignment).
# Short-circuit evaluation inside the graph. Keyword + English prefilters are SKIPPED so feeds
# that rely only on graph logic (e.g. regex) still work; expect higher CPU (many more graph evals).
INGESTION_GRAPH_MATCH_ENABLED: bool = os.getenv(
    "INGESTION_GRAPH_MATCH", ""
).strip().lower() in ("1", "true", "yes")

# Reload feed graphs from DB at most this often (seconds).
INGESTION_FEED_GRAPH_CACHE_SECONDS: float = float(
    os.getenv("INGESTION_FEED_GRAPH_CACHE_SECONDS", "60")
)
