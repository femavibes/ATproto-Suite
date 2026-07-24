"""Configuration for feed-assignment-worker."""

import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://feedgen:feedgen@localhost:5440/feedgen",
)

# Batch size for unassigned posts scanned each loop.
ASSIGNMENT_BATCH_SIZE = int(os.getenv("ASSIGNMENT_BATCH_SIZE", "5000"))

# Poll interval (seconds) between assignment sweeps.
ASSIGNMENT_POLL_SECONDS = float(os.getenv("ASSIGNMENT_POLL_SECONDS", "2.0"))

# External ATProto list cache refresh TTL
LIST_CACHE_TTL_SECONDS = int(os.getenv("LIST_CACHE_TTL_SECONDS", "600"))

# Public Bluesky API host for list resolution
BSKY_PUBLIC_HOST = os.getenv("BSKY_PUBLIC_HOST", "https://public.api.bsky.app")

# Engagement refresh worker settings
ENGAGEMENT_REFRESH_POLL_SECONDS = float(os.getenv("ENGAGEMENT_REFRESH_POLL_SECONDS", "30"))
ENGAGEMENT_REFRESH_BATCH_SIZE = int(os.getenv("ENGAGEMENT_REFRESH_BATCH_SIZE", "25"))
ENGAGEMENT_REFRESH_STALE_MINUTES = int(os.getenv("ENGAGEMENT_REFRESH_STALE_MINUTES", "15"))
