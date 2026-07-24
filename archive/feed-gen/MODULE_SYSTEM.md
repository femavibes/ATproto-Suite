# Module System Specification

## Overview

Modules are external services that hook into the feed-gen pipeline at specific stages. They can run locally (installed on same server), remotely (external API), or hybrid (local + external dependency).

## Pipeline Stages (Hook Points)

```
Firehose → [SOURCE] → Keyword Filter → [ENRICHMENT] → Rule Evaluation → [SCORING] → Sorting → [INJECTION] → Response → [ANALYTICS]
                                                                          ↑
                                                                   [ACCESS CONTROL]
```

| Hook | What it does | When it runs | Example |
|------|-------------|--------------|---------|
| Source | Provides posts from non-firehose sources | Ingestion time | RSS importer, manual posts |
| Enrichment | Adds fields to posts for rules/scoring | After ingest, before or during rule eval | Sentiment, video bitrate, location |
| Access Control | Gates who can see a feed | Query time, before anything | Patreon check, "follow to unlock" |
| Scoring | Adjusts post scores for ranking | Query time, after rules pass | Personalization, recency boost |
| Injection | Inserts posts into final feed | Query time, after sorting | Ads, rotating posts |
| Analytics | Receives what was served | After response sent (fire & forget) | Impression tracking |

## Module Connection Modes

### Fully Installed (runs locally)
- Module code runs on your server
- Has its own database (or tables in shared DB)
- Does its own background processing
- Example: Near You scoring — always running, consuming firehose, tracking behavior

### External Service (API calls)
- Module runs somewhere else entirely
- Feed-gen calls it via HTTP when needed
- Example: Sentiment analysis API, third-party toxicity filter

### Hybrid (installed + external dependency)
- Runs locally but depends on an external API for data
- Example: YouTube metadata enricher — local worker that calls YouTube API

## Module Manifest

Every module declares what it is and how it behaves:

```json
{
  "id": "video-bitrate-enrichment",
  "name": "Video Bitrate Analyzer",
  "version": "1.0.0",
  "author": "did:plc:abc123",

  "connection_mode": "installed",

  "hooks": ["enrichment"],
  "endpoints": {
    "enrichment": "/module/enrich"
  },

  "timing": "async",
  "fallback": "skip_field",
  "timeout_ms": 5000,
  "ttl": 86400,

  "provides_fields": [
    {"id": "video_bitrate", "label": "Video Bitrate (kbps)", "type": "number"},
    {"id": "video_duration", "label": "Video Duration (sec)", "type": "number"},
    {"id": "video_codec", "label": "Video Codec", "type": "string"}
  ],

  "requires_context": [],

  "depends_on": [],

  "config_schema": {
    "analyze_audio": {"type": "boolean", "default": false},
    "max_file_size_mb": {"type": "number", "default": 100}
  }
}
```

## Timing & Fallback Behavior

Modules declare default timing, but users can override per-condition in the visual editor.

### Timing

- **sync** — Must complete before pipeline continues. Blocks until result or timeout.
- **async** — Runs in background. Post proceeds without this data. Results cached when ready.

### Fallback (what happens when data isn't available)

- **skip_field** — Post passes rules without that field. If a rule references the field, it's treated as "condition not applicable" (passes by default).
- **exclude_post** — Post is hidden from feed until enrichment completes. Strict mode.
- **default_value** — Use a specified fallback value until real data arrives.

### Re-evaluation

Post assignment is NOT permanent. When new enrichment data arrives:

1. Post gets re-evaluated against feed rules
2. If it still passes → stays in feed
3. If it now fails → removed from feed
4. If it was excluded and now passes → added to feed

This means a post that was allowed because a module was down can be retroactively removed once the module recovers and flags it.

## Scoring Module Contract

### Input (what feed-gen sends):

```json
{
  "posts": [
    {
      "uri": "at://did:plc:xxx/app.bsky.feed.post/rkey",
      "cid": "abc123",
      "text": "...",
      "author_did": "did:plc:xxx",
      "created_at": "2025-01-15T10:30:00Z",
      "enrichments": {
        "sentiment": 0.85,
        "distance_km": 12.5
      },
      "base_score": 50
    }
  ],
  "user_context": {
    "did": "did:plc:user123",
    "location": {"lat": 40.7, "lng": -74.0},
    "follows": ["did:plc:a", "did:plc:b"]
  },
  "config": {
    "freshness_decay_minutes": 30
  }
}
```

### Output (what module returns):

```json
{
  "scores": {
    "at://did:plc:xxx/app.bsky.feed.post/rkey": {
      "adjustment": 150,
      "factors": {
        "distance": 80,
        "interest_match": 50,
        "freshness": 20
      }
    }
  }
}
```

## Enrichment Module Contract

### Input:

```json
{
  "posts": [
    {
      "uri": "at://...",
      "cid": "abc123",
      "text": "Check out this video",
      "embed": {"$type": "app.bsky.embed.video", "video": {"size": 5000000}}
    }
  ],
  "config": {
    "analyze_audio": false
  }
}
```

### Output:

```json
{
  "results": {
    "abc123": {
      "video_bitrate": 2500,
      "video_duration": 30.5,
      "video_codec": "h264"
    }
  }
}
```

## Source Module Contract

### Input:

```json
{
  "since": "2025-01-15T10:00:00Z",
  "limit": 100,
  "config": {
    "rss_url": "https://example.com/feed.xml"
  }
}
```

### Output:

```json
{
  "posts": [
    {
      "uri": "at://did:plc:xyz/app.bsky.feed.post/rkey1",
      "text": "...",
      "author_did": "did:plc:xyz",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

## Access Control Module Contract

### Input:

```json
{
  "user_did": "did:plc:user123",
  "feed_id": "uuid",
  "config": {
    "patreon_tier": "supporter"
  }
}
```

### Output (denied):

```json
{
  "has_access": false,
  "gate_post": {
    "text": "Subscribe on Patreon to access this feed!",
    "uri": "at://did:plc:feedowner/app.bsky.feed.post/gate-post-rkey"
  }
}
```

### Output (allowed):

```json
{
  "has_access": true
}
```

## Injection Module Contract

### Input:

```json
{
  "feed_id": "uuid",
  "page_size": 30,
  "page_number": 1,
  "user_context": {
    "did": "did:plc:user123"
  },
  "config": {
    "frequency": 5,
    "max_per_page": 2
  }
}
```

### Output:

```json
{
  "injections": [
    {"position": 4, "uri": "at://did:plc:ad/app.bsky.feed.post/ad1"},
    {"position": 9, "uri": "at://did:plc:ad/app.bsky.feed.post/ad2"}
  ]
}
```

## Analytics Module Contract

### Input (fire and forget):

```json
{
  "feed_id": "uuid",
  "user_did": "did:plc:user123",
  "posts_served": [
    {"uri": "at://...", "position": 0},
    {"uri": "at://...", "position": 1}
  ],
  "served_at": "2025-01-15T10:30:00Z"
}
```

### Output: None (202 Accepted)

## Module Dependencies

Modules can declare dependencies on other modules:

```json
{
  "depends_on": ["location-enrichment"]
}
```

- Platform ensures dependencies run first
- If dependency isn't installed, module installation is blocked
- Circular dependencies are rejected

## Module Lifecycle

### Installation
1. User adds module (URL + manifest or from marketplace)
2. Platform validates manifest
3. If `connection_mode: "installed"` — module runs migrations, starts workers
4. Module appears in visual editor sidebar under appropriate tabs
5. Module's `provides_fields` become available as rule conditions

### Runtime
1. Platform calls module at declared hook points
2. Results cached locally per TTL
3. On cache miss or expiry, platform calls module again
4. If module is down, fallback behavior applies

### Uninstallation
1. User removes module
2. Platform asks: "Keep cached data?" (yes = keep tables, no = drop)
3. Rules referencing module fields get flagged as broken
4. Module removed from visual editor sidebar

## Data Flow: Feed-Gen as Central Hub

Feed-gen is the central data store. Modules read from it and write back to it.

### Post Data

Feed-gen stores core post fields from ingestion. Modules enrich posts and push results back. Enrichment data is stored on the post so any module or rule can reference it.

```json
{
  "cid": "abc123",
  "uri": "at://...",
  "text": "Check out this video",
  "author_did": "did:plc:xyz",
  "has_images": false,
  "has_video": true,
  "language": "en",
  "post_type": "post",
  "created_at": "2025-01-15T10:30:00Z",
  "enrichments": {
    "video-bitrate": {"bitrate": 2500, "duration": 30, "codec": "h264"},
    "sentiment": {"score": 0.85, "label": "positive"},
    "toxicity": {"score": 0.02}
  }
}
```

Any rule in the visual editor can reference any enrichment field from any installed module.

### User Profile

Feed-gen maintains an extensible user profile. Starts with basics, grows as modules contribute data back.

```json
{
  "did": "did:plc:user123",
  "follows": ["did:plc:a", "did:plc:b"],
  "followers": ["did:plc:c"],
  "interactions": {
    "likes": [{"uri": "at://...", "at": "2025-01-15T10:00:00Z"}],
    "reposts": []
  },
  "module_data": {
    "location-enrichment": {"lat": 40.7, "lng": -74.0, "city": "New York"},
    "interest-profiler": {"interests": ["urbanism", "transit"], "confidence": 0.8}
  }
}
```

Modules can write to `module_data` via the webhook. Other modules can read it via the context feed-gen passes to them.

### The Hub Pattern

```
Module A (location) writes user_location to feed-gen
    ↓
Feed-gen stores it in user profile
    ↓
Module B (scoring) requests user context from feed-gen
    ↓
Feed-gen sends full profile including location data from Module A
    ↓
Module B uses location for distance-based scoring
```

Neither module knows about the other. Feed-gen brokers the data.

### Webhook: Module Pushes Data Back

Modules push enrichment results and user data back to feed-gen:

**Post enrichment complete:**
```
POST http://feed-gen/hooks/enrichment-complete
{
  "module_id": "video-bitrate",
  "results": {
    "cid_abc": {"bitrate": 2500, "duration": 30},
    "cid_def": {"bitrate": 800, "duration": 120}
  }
}
```

**User data update:**
```
POST http://feed-gen/hooks/user-data
{
  "module_id": "location-enrichment",
  "users": {
    "did:plc:user123": {"lat": 40.7, "lng": -74.0, "city": "New York"}
  }
}
```

Feed-gen receives this, stores it, and triggers re-evaluation of affected posts/feeds if needed.

## Graceful Degradation

- **Enrichment module down** → Posts pass rules without that field (or excluded, per user config)
- **Scoring module down** → Posts served with base score only (chronological or rule-assigned score)
- **Injection module down** → Feed served without injections
- **Access control module down** → Configurable: fail open (allow) or fail closed (deny)
- **Source module down** → No new posts from that source, existing posts still served

## Visual Editor Integration

Modules appear in the visual editor based on their hooks:

- **Enrichment modules** → Their `provides_fields` appear as condition options in rule nodes
- **Scoring modules** → Appear in the Scoring tab as draggable blocks
- **Injection modules** → Appear in the Injection tab
- **Source modules** → Appear in the Sources tab

Per-condition override in visual editor:

```
[Video Bitrate] [>] [2000]
  Timing: ⏳ Async (allow post, remove later if fails)
  
[Toxicity Score] [<] [0.7]
  Timing: ⚡ Sync (block post until enriched)
```

User picks behavior per condition based on how critical that field is.
