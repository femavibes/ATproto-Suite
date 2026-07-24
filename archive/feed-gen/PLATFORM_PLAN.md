# Bluesky Feed Platform - Complete Architecture

> **Status:** Architecture Finalized - Ready for Development  
> **Last Updated:** 2024  
> **Philosophy:** Simple core, powerful modules, community-driven  
> **Platform Name:** TBD (options: FeedForge, SkyWeaver, Conduit, FeedFlow, etc.)  
> **Tech Stack:** Python 3.11+, FastAPI, PostgreSQL 16, Docker Compose v2

---

## 🔧 Technology Stack

### Backend: Python 3.11+ with FastAPI

**Why Python?**
- Lowest error rate for AI code generation
- Fastest development for modular architecture
- Best ecosystem for our needs (websockets, PostgreSQL, ffmpeg, async)
- Excellent type hints for safety
- Easy to read and maintain

**Performance:**
- Handles 10,000+ requests/second (far exceeds our ~42 posts/sec ingestion)
- Bottleneck is external APIs and database, not Python
- asyncio for concurrent I/O operations

**Key Libraries:**
- FastAPI - Modern async web framework
- psycopg2/asyncpg - PostgreSQL drivers
- websockets - Jetstream connection
- pydantic - Data validation with type hints

### Database: PostgreSQL 16

**Why PostgreSQL?**
- JSONB for flexible enrichment data
- Excellent performance for our scale
- Mature, stable, well-documented
- Great Python support

**Features Used:**
- JSONB columns for enrichment data
- Indexes for fast queries
- Foreign keys for data integrity
- Transactions for consistency

### Deployment: Docker Compose v2

**Why Docker Compose?**
- Simple multi-container orchestration
- Perfect for self-hosted (1-10 servers)
- Easy to understand and debug
- No Kubernetes complexity needed

**What is Docker Compose?**
- Runs multiple containers on one server
- Simple YAML configuration
- Each service in its own container
- Shared network and volumes

**Example Structure:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  jetstream-ingestion:
    build: ./services/jetstream-ingestion
    depends_on:
      - postgres
  
  feed-api:
    build: ./services/feed-api
    ports:
      - "8000:8000"
    depends_on:
      - postgres
```

**Scaling Strategy:**
- Start: Single server with Docker Compose
- Growth: Add more servers, run Docker Compose on each
- Future: Consider Kubernetes only if managing 100+ servers

### Authentication: Bluesky OAuth

**User Authentication:**
- OAuth with Bluesky (users log in with their Bluesky account)
- No password storage needed
- Automatic DID verification

**Authorization Levels:**
- **User** - Create and manage own feeds
- **Staff** - Moderate content, view analytics
- **Admin** - Full platform access, user management
- **Delegated** - Manage feeds on behalf of other users (future)

### Monitoring & Observability

**Logging:**
- Structured JSON logs from each service
- Centralized via Docker logging drivers
- Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL

**Metrics:**
- Service health checks (HTTP endpoints)
- Database connection pool stats
- Ingestion rate (posts/second)
- API response times
- Enrichment queue depths

**Alerting:**
- Service down alerts
- Database connection failures
- Ingestion lag (cursor falling behind)
- Disk space warnings

### Backup & Disaster Recovery

**PostgreSQL Backups:**
- Daily full backups
- Continuous WAL archiving
- Point-in-time recovery capability
- Backup retention: 30 days

**Cursor State:**
- Persisted in database (not just memory)
- Allows recovery from any point in last 72 hours
- Backed up with database

**Recovery Procedures:**
1. Restore database from backup
2. Restart services (they auto-resume from cursor)
3. Verify ingestion is catching up
4. Monitor for errors

---

## ⚠️ AI-First Development Philosophy

**This entire platform is designed to be built and maintained by AI.**

### Core Principles

1. **Modularity Over Efficiency**
   - Each service is completely independent
   - Services can fail without affecting others
   - Duplicate code is acceptable for isolation
   - Clear boundaries between components

2. **Stability Over Performance**
   - Simple, predictable code patterns
   - Explicit over implicit
   - No clever optimizations that obscure logic
   - Database-only communication (no complex message queues)

3. **Documentation-First**
   - Every function has a docstring explaining WHY it exists
   - Inline comments explain business logic, not syntax
   - README in every service directory
   - Architecture decisions documented in code

4. **AI-Friendly Code Style**
   - One responsibility per function
   - No deep nesting (max 3 levels)
   - Explicit error handling (no silent failures)
   - Type hints everywhere (Python) or strict types (TypeScript)
   - Small files (<500 lines)

5. **Testing Strategy**
   - Each service has integration tests
   - Tests document expected behavior
   - Can run services independently for testing
   - Database fixtures for reproducible tests

### Service Independence Rules

**Each service MUST:**
- Have its own database connection pool
- Have its own error logging
- Have its own health check endpoint
- Be restartable without affecting others
- Have a single, clear purpose

**Services MUST NOT:**
- Call other services directly (HTTP/RPC)
- Share in-memory state
- Depend on other services being online
- Use shared libraries (duplicate code instead)

### Why This Approach?

AI code generation works best with:
- ✅ Clear, isolated components
- ✅ Explicit patterns repeated across services
- ✅ Comprehensive documentation
- ✅ Simple, predictable architecture

AI struggles with:
- ❌ Complex interdependencies
- ❌ Clever abstractions
- ❌ Implicit behavior
- ❌ Tightly coupled systems

---

## 🎯 Core Vision

**What we're building:** A minimal, extensible Bluesky feed platform where the community builds most features as modules.

**Key Innovation:** 
- Simple core (~2000 lines of code)
- Plugin architecture for everything else
- Visual rule builder for complex feed logic
- Modules can extend the rule builder with custom fields

**Deployment Options:**
1. **Fully Self-Hosted** - Run everything yourself (free)
2. **Managed Ingestion** - Use our firehose parser ($5-10/month)
3. **Fully Managed** - We host everything ($50/month)

---

## 🛠️ Modular Service Architecture

> **Note:** This is a tentative guide. Services may be added, removed, or combined as the platform evolves. The key principle is independence, not a fixed number.

### Independent Services

Each service is a separate process that can fail independently:

```
┌────────────────────────────────────────────────────────────┐
│                    INDEPENDENT SERVICES                         │
│              (Each can fail without affecting others)           │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Service 1: jetstream-ingestion                                 │
│ Purpose: Connect to Jetstream, save posts to database          │
│ Dependencies: PostgreSQL only                                  │
│ Failure impact: New posts not ingested (existing feeds work)  │
│ Restart: Safe anytime (uses cursor to resume)                  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Service 2: enrichment-author-profiles                          │
│ Purpose: Fetch author info from Bluesky API                    │
│ Dependencies: PostgreSQL, Bluesky API                          │
│ Failure impact: Author info not enriched (posts still saved)  │
│ Restart: Safe anytime (picks up where it left off)             │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Service 3: enrichment-engagement                               │
│ Purpose: Update like/repost counts periodically                │
│ Dependencies: PostgreSQL, Bluesky API                          │
│ Failure impact: Engagement counts stale (feeds still work)    │
│ Restart: Safe anytime (resumes from last update)               │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Service 4: enrichment-video-metadata                           │
│ Purpose: Run ffmpeg on video posts                             │
│ Dependencies: PostgreSQL, ffmpeg                               │
│ Failure impact: Video metadata missing (videos still show)    │
│ Restart: Safe anytime (processes unprocessed videos)           │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Service 5: enrichment-labels                                   │
│ Purpose: Fetch content moderation labels                       │
│ Dependencies: PostgreSQL, Bluesky API                          │
│ Failure impact: Labels missing (content still shows)          │
│ Restart: Safe anytime (processes unlabeled posts)              │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Service 6: feed-assignment-worker                              │
│ Purpose: Evaluate feed rules, assign posts to feeds            │
│ Dependencies: PostgreSQL only                                  │
│ Failure impact: New posts not assigned (existing feeds work)  │
│ Restart: Safe anytime (processes unassigned posts)             │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Service 7: feed-api                                            │
│ Purpose: Serve feed requests to users                          │
│ Dependencies: PostgreSQL (read-only)                           │
│ Failure impact: Feeds unavailable (other services continue)   │
│ Restart: Safe anytime (stateless, no data loss)                │
│ Scaling: Can run multiple instances                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Service 8: cleanup-worker                                      │
│ Purpose: Delete old posts (runs daily)                         │
│ Dependencies: PostgreSQL only                                  │
│ Failure impact: Old posts not deleted (storage grows)         │
│ Restart: Safe anytime (cron-based, idempotent)                 │
└────────────────────────────────────────────────────────────┘
```

### Communication Pattern

**Database-Only Communication:**
- Services ONLY communicate via PostgreSQL
- No HTTP calls between services
- No message queues (initially)
- No shared memory

**Why?**
- Simple to understand and debug
- No cascading failures
- Easy to add new services
- AI can generate each service independently

**Example Flow:**
```
jetstream-ingestion writes to posts table
  ↓
enrichment-author-profiles reads posts without author_profile
  ↓
enrichment-author-profiles writes to post_enrichments table
  ↓
feed-assignment-worker reads posts + enrichments
  ↓
feed-assignment-worker writes to feed_posts table
  ↓
feed-api reads feed_posts + posts + enrichments
  ↓
feed-api returns to user
```

### Service Template Structure

Each service follows the same pattern:

```
service-name/
  README.md           # What this service does, why it exists
  main.py             # Entry point (< 100 lines)
  config.py           # Configuration (env vars, constants)
  database.py         # Database connection (duplicated across services)
  worker.py           # Main business logic
  health.py           # Health check endpoint
  Dockerfile          # Container definition
  requirements.txt    # Python dependencies
  tests/
    test_worker.py    # Integration tests
```

### Adding New Enrichment Types

To add a new enrichment (e.g., "image_analysis"):

1. Copy `enrichment-author-profiles/` to `enrichment-image-analysis/`
2. Update `worker.py` with new logic
3. Update `README.md` with purpose
4. Deploy as new service
5. No changes to other services needed

**That's it!** Complete isolation.

### The Pipeline

```
━━━ STAGE 0: ACCESS CONTROL ━━━
User requests feed
   ↓
[Access Control Modules]
- Patreon check
- Ko-fi check  
- "Follow first" check
- Custom gates
   ↓
   ├─ DENIED → Return gate post
   └─ ALLOWED → Continue

━━━ STAGE 1: INGESTION (Optional, can be disabled) ━━━
Bluesky Firehose (25k posts/min)
   ↓
[Aho-Corasick: ALL keywords from ALL feeds]
   ↓
Save to posts table (250 posts/min)
   ↓
[Source Modules can add posts here too]
- RSS importers
- Manual injection
- Alternative firehose parsers

━━━ STAGE 2: FEED ASSIGNMENT ━━━
For each post:
  For each feed:
    ↓
    [Enrichment Modules] (if needed by rules)
    - Sentiment analysis
    - Topic classification
    - Image analysis
    ↓
    [Evaluate Rule Tree]
    - Visual rule builder logic
    - Native fields + module fields
    - Complex AND/OR conditions
    ↓
    If passes → Add to feed_posts table

━━━ STAGE 3: FEED SERVING ━━━
User requests feed
   ↓
[Fetch posts from feed_posts]
   ↓
[Add pinned posts] (always on top)
   ↓
[Add rotating posts] (carousel)
   ↓
[Scoring Modules]
- Personalization
- Engagement prediction
- Custom scoring
   ↓
[Sort by score]
   ↓
[Injection Modules]
- Ad networks
- Sponsored content
   ↓
[Analytics Modules]
- Track impressions
- Log engagement
   ↓
Return to user
```

---

## 🔄 Post Enrichment System

### Enrichment Types

**1. Author Profile** (`author_profile`)
- Source: `app.bsky.actor.getProfile`
- Frequency: Once per author, cache 24 hours
- Data: handle, display_name, avatar, follower_count, following_count, bio, created_at
- Use case: Display author info, filter by follower count

**2. Engagement Metrics** (`engagement`)
- Source: `app.bsky.feed.getPostThread`
- Frequency: Every 15 minutes for recent posts
- Data: like_count, repost_count, reply_count, quote_count
- Use case: Sort by engagement, filter by popularity

**3. Video Metadata** (`video_metadata`)
- Source: `ffmpeg` (local processing)
- Frequency: Once per video post
- Data: duration, bitrate, resolution, codec, fps, file_size
- Use case: Filter by video quality, duration

**4. Content Labels** (`labels`)
- Source: `com.atproto.label.queryLabels`
- Frequency: Once per post, cache 7 days
- Data: nsfw, spam, content_warnings, moderation_flags
- Use case: Content filtering, safety

**5. Thread Context** (`thread_context`)
- Source: `app.bsky.feed.getPostThread`
- Frequency: Once per reply
- Data: parent_text, root_text, thread_depth, conversation_id
- Use case: Show context, filter by thread depth

### Enrichment Strategy

```
┌─────────────────────────────────────┐
│ Jetstream Ingestion                 │
│ - Save basic post data              │
└──────────────┬──────────────────────┘
               ↓
┌──────────────────────────────────────┐
│ Background Enrichment Workers        │
│                                      │
│ Worker 1: Author profiles            │
│ - Batch 100 unique authors           │
│ - Fetch from Bluesky API             │
│ - Cache 24 hours                     │
│                                      │
│ Worker 2: Engagement metrics         │
│ - Update posts < 24 hours old        │
│ - Every 15 minutes                   │
│ - Stop updating after 7 days         │
│                                      │
│ Worker 3: Video processing           │
│ - Queue video posts                  │
│ - Run ffmpeg analysis                │
│ - Store metadata                     │
│                                      │
│ Worker 4: Content labels             │
│ - Fetch moderation labels            │
│ - Cache 7 days                       │
└──────────────────────────────────────┘
```

### Enrichment Access Control

Some enrichments may require tier-based access:

```sql
-- In available_modules or platform config
CREATE TABLE enrichment_tiers (
  enrichment_type TEXT PRIMARY KEY,
  required_tier TEXT NOT NULL, -- 'free', 'pro', 'enterprise'
  api_cost_per_call DECIMAL(10,6),
  rate_limit_per_hour INTEGER
);

-- Example:
-- author_profile: free (cached, low cost)
-- engagement: free (cached, moderate cost)
-- video_metadata: pro (CPU intensive)
-- thread_context: pro (API intensive)
```

### Usage in Feed Rules

Enrichment data available in visual builder:

```
[Author Follower Count] > 1000
  ↓ (uses author_profile enrichment)
  
[Post Like Count] > 50
  ↓ (uses engagement enrichment)
  
[Video Duration] < 60 seconds
  ↓ (uses video_metadata enrichment)
```

---

## 📦 Database Schema

```sql
-- Shared posts table (all matched posts)
CREATE TABLE posts (
  cid TEXT PRIMARY KEY,
  uri TEXT NOT NULL UNIQUE,
  text TEXT,
  author_did TEXT NOT NULL,
  
  -- Content metadata (from Jetstream)
  has_images BOOLEAN DEFAULT FALSE,
  has_video BOOLEAN DEFAULT FALSE,
  has_link BOOLEAN DEFAULT FALSE,
  language TEXT,
  post_type TEXT, -- 'post', 'reply', 'quote'
  reply_parent TEXT, -- Parent post URI if reply
  reply_root TEXT, -- Root post URI if reply
  
  -- Ingestion metadata
  source_type TEXT DEFAULT 'native', -- 'native', 'manual', 'module'
  source_module_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL,
  indexed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_posts_uri ON posts(uri);
CREATE INDEX idx_posts_author ON posts(author_did);
CREATE INDEX idx_posts_created ON posts(created_at DESC);

-- Post enrichment data (flexible JSONB storage)
CREATE TABLE post_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_cid TEXT REFERENCES posts(cid) ON DELETE CASCADE,
  enrichment_type TEXT NOT NULL, -- 'author_profile', 'engagement', 'video_metadata', 'labels', etc.
  source_endpoint TEXT, -- API endpoint or process used (e.g., 'app.bsky.actor.getProfile', 'ffmpeg')
  data JSONB NOT NULL, -- Flexible storage for any enrichment data
  enriched_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- For data that should be refreshed
  UNIQUE(post_cid, enrichment_type)
);

CREATE INDEX idx_enrichments_post ON post_enrichments(post_cid);
CREATE INDEX idx_enrichments_type ON post_enrichments(enrichment_type);
CREATE INDEX idx_enrichments_expires ON post_enrichments(expires_at) WHERE expires_at IS NOT NULL;

-- Example enrichment data structures:
-- author_profile: {"handle": "alice.bsky.social", "display_name": "Alice", "follower_count": 1234, "avatar": "..."}
-- engagement: {"like_count": 42, "repost_count": 5, "reply_count": 3, "quote_count": 1}
-- video_metadata: {"duration": 30.5, "bitrate": 2500000, "resolution": "1920x1080", "codec": "h264"}
-- labels: {"nsfw": false, "spam": false, "content_warnings": []}
-- thread_context: {"parent_text": "...", "root_text": "...", "depth": 2}



-- Feed configuration
CREATE TABLE feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_did TEXT,
  
  -- Ingestion settings
  use_native_ingestion BOOLEAN DEFAULT TRUE,
  keywords TEXT[], -- For Aho-Corasick
  
  -- Assignment rules (visual rule builder)
  assignment_rules JSONB NOT NULL,
  -- Format: {"logic": "OR", "groups": [...]}
  
  -- Settings
  retention_days INTEGER DEFAULT 30,
  is_public BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Feed assignments (which posts belong to which feeds)
CREATE TABLE feed_posts (
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  post_cid TEXT REFERENCES posts(cid) ON DELETE CASCADE,
  base_score INTEGER DEFAULT 0,
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (feed_id, post_cid)
);

CREATE INDEX idx_feed_posts_feed ON feed_posts(feed_id, base_score DESC);

-- Pinned posts (always show at top)
CREATE TABLE feed_pinned_posts (
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  post_cid TEXT,
  post_uri TEXT,
  position INTEGER, -- Order (1 = top)
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (feed_id, post_cid)
);

-- Rotating posts (cycle through a set)
CREATE TABLE feed_rotating_posts (
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  post_cid TEXT,
  post_uri TEXT,
  rotation_group TEXT DEFAULT 'default',
  weight INTEGER DEFAULT 1, -- Higher = shown more often
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (feed_id, post_cid)
);

-- Manual posts (user-added)
CREATE TABLE feed_manual_posts (
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  post_uri TEXT NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  added_by TEXT,
  notes TEXT,
  PRIMARY KEY (feed_id, post_uri)
);

-- User lists (private lists)
CREATE TABLE user_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_did TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  members TEXT[], -- Array of DIDs
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Modules
CREATE TABLE feed_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  
  module_id TEXT NOT NULL,
  module_category TEXT NOT NULL,
  -- 'source', 'access_control', 'enrichment', 'scoring', 'injection', 'analytics'
  
  api_url TEXT NOT NULL,
  api_key TEXT, -- Encrypted
  config JSONB,
  
  execution_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_feed_modules_feed ON feed_modules(feed_id, execution_order);

-- Module marketplace
CREATE TABLE available_modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  scope TEXT NOT NULL, -- 'global', 'feed', 'user'
  description TEXT,
  documentation_url TEXT,
  author_did TEXT,
  
  -- For enrichment modules: fields they provide
  provides_fields JSONB,
  -- [{"id": "sentiment", "label": "Sentiment", "type": "string", "options": [...]}]
  
  -- UI configuration
  config_schema JSONB,
  
  -- Performance
  avg_latency_ms INTEGER,
  max_latency_ms INTEGER,
  supports_batch BOOLEAN DEFAULT FALSE,
  max_batch_size INTEGER,
  
  -- Caching
  cache_enabled BOOLEAN DEFAULT TRUE,
  cache_ttl INTEGER, -- seconds
  
  -- Pricing
  pricing_model TEXT,
  base_cost DECIMAL(10,2),
  free_tier INTEGER,
  
  -- Stats
  total_installs INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  is_verified BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enrichment cache (global scope)
CREATE TABLE enrichment_cache_global (
  post_cid TEXT,
  module_id TEXT,
  enriched_data JSONB,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  PRIMARY KEY (post_cid, module_id)
);

CREATE INDEX idx_enrichment_global_expires ON enrichment_cache_global(expires_at);

-- Enrichment cache (feed scope)
CREATE TABLE enrichment_cache_feed (
  post_cid TEXT,
  feed_id UUID,
  module_id TEXT,
  enriched_data JSONB,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  PRIMARY KEY (post_cid, feed_id, module_id)
);

CREATE INDEX idx_enrichment_feed_expires ON enrichment_cache_feed(expires_at);

-- Enrichment cache (user scope - rarely used)
CREATE TABLE enrichment_cache_user (
  post_cid TEXT,
  user_did TEXT,
  module_id TEXT,
  enriched_data JSONB,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  PRIMARY KEY (post_cid, user_did, module_id)
);

CREATE INDEX idx_enrichment_user_expires ON enrichment_cache_user(expires_at);

-- Author cache (for rule evaluation)
CREATE TABLE author_cache (
  did TEXT PRIMARY KEY,
  handle TEXT,
  follower_count INTEGER,
  following_count INTEGER,
  created_at TIMESTAMP,
  cached_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_author_cache_updated ON author_cache(cached_at);
```

---

## 🎨 Visual Feed Builder

### Terminology

**Blocks** - Visual components dragged onto the canvas (also called "Nodes" in the visual editor)

**Block Types:**

1. **Native Blocks** - Built-in platform blocks, always available, free
   - Examples: Text Contains, Language, Post Type, Author, Engagement, Recency Boost, Chronological Sort
   - Categories: Logic, Conditions, Scoring, Sorting, Injection, Sources
   - No external dependencies, no API calls, no cost

2. **Module Blocks** - External API modules from the marketplace, marked with 🔌 icon
   - Examples: Sentiment Analysis 🔌💰, RSS Feed Importer 🔌, Ad Network 🔌
   - Categories: Source Modules, Enrichment Modules, Scoring Modules, Injection Modules, Access Control Modules, Analytics Modules
   - Require module installation, may have costs, make external API calls
   - Displayed in sidebar tabs below native blocks with 🔌 badge

3. **Custom Blocks** - User-created, reusable combinations of native/module blocks (saved templates)
   - Examples: "High-Engagement Urbanism Posts" (combines Text Contains + Engagement + Post Type)
   - Created by selecting multiple connected nodes and saving as a template
   - Can be shared with other users or kept private
   - Displayed in sidebar tabs below native and module blocks with 📦 badge
   - When dragged onto canvas, expands into the original node combination

**Semi-Custom Blocks** (Middle Ground):
- **Platform Modules** - Advanced features provided by the platform team (you)
  - More sophisticated than native blocks, but still platform-maintained
  - Examples: 
    - Advanced Sentiment Analysis (platform-hosted ML model)
    - Platform Analytics Dashboard
    - Advanced Personalization Engine
    - Premium Content Moderation
  - Marked with ⚙️ icon to distinguish from external modules
  - No external API calls (runs on platform infrastructure)
  - May have usage limits, premium features, or tier-based access
  - Displayed between native blocks and external module blocks
  - **Key difference from Native**: More complex, may require configuration, may have costs/limits
  - **Key difference from External**: You maintain it, runs on your infrastructure, not third-party

**Flow Lines** - Green connections that pass posts through the pipeline
**Logic Lines** - Blue (AND) / Orange (OR) connections for conditional branching

### Builder Features

**Simple Mode** - Form-based builder for basic feeds
**Advanced Mode** - Node-based visual editor for complex logic

**Planned Features:**
- Test/Debug mode (paste post URI, see which path it takes)
- Node search/filter
- Validation warnings (orphaned blocks, missing modules)
- Performance indicators (cost, latency per block)
- Version history / undo
- Templates marketplace
- Minimap for large feeds
- Auto-routing for clean connection lines
- Live preview (see real posts as they'd appear)

---

## 🔒 Module Security & Safety

### The Problem
Modules are external code that could:
- Make infinite API calls (cost attack)
- Take too long to respond (DoS)
- Return malicious data
- Steal API keys or user data
- Crash the platform

### Multi-Layer Defense Strategy

**Layer 1: Module Verification Tiers**

1. **Unverified** (⚠️ warning badge)
   - Anyone can publish
   - Requires explicit user consent to install
   - "This module is not verified. Use at your own risk."
   - Limited to 100 installs until verified

2. **Community Verified** (✓ badge)
   - 50+ installs, 4+ star rating, no reports
   - Automatic promotion after 30 days
   - Can be demoted if issues arise

3. **Platform Verified** (✓✓ badge)
   - Manual code review by platform team
   - Security audit passed
   - Author identity verified
   - Priority support

**Layer 2: Sandboxing & Isolation**

```python
# All module calls go through proxy
class ModuleProxy:
    def __init__(self, module_config):
        self.timeout = min(module_config.max_latency_ms, 5000) / 1000
        self.rate_limiter = RateLimiter(
            max_calls_per_minute=60,
            max_calls_per_hour=1000
        )
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=60
        )
    
    async def call(self, endpoint, payload):
        # Rate limiting
        if not self.rate_limiter.allow():
            raise RateLimitError("Module exceeded rate limit")
        
        # Circuit breaker
        if self.circuit_breaker.is_open():
            raise CircuitBreakerOpen("Module is temporarily disabled")
        
        try:
            # Timeout protection
            async with timeout(self.timeout):
                response = await http_client.post(
                    endpoint,
                    json=payload,
                    headers={"X-API-Key": self.api_key}
                )
            
            # Size limit (prevent memory attacks)
            if len(response.content) > 10_000_000:  # 10MB
                raise PayloadTooLarge()
            
            self.circuit_breaker.record_success()
            return response.json()
            
        except (Timeout, ConnectionError) as e:
            self.circuit_breaker.record_failure()
            raise ModuleError(f"Module failed: {e}")
```

**Layer 3: Resource Quotas**

```python
# Per-module quotas (enforced globally)
MODULE_QUOTAS = {
    "max_calls_per_minute": 60,
    "max_calls_per_hour": 1000,
    "max_calls_per_day": 10000,
    "max_concurrent_calls": 5,
    "max_response_size_mb": 10,
    "max_timeout_ms": 5000
}

# Per-feed quotas (prevent one feed from monopolizing)
FEED_QUOTAS = {
    "max_module_calls_per_request": 10,
    "max_enrichment_modules": 5,
    "max_total_latency_ms": 3000
}
```

**Layer 4: Data Sanitization**

```python
def sanitize_module_response(response, expected_schema):
    """Validate and sanitize module responses"""
    # JSON schema validation
    validate(response, expected_schema)
    
    # Strip dangerous fields
    dangerous_keys = ['__proto__', 'constructor', 'prototype']
    clean_response = {k: v for k, v in response.items() 
                     if k not in dangerous_keys}
    
    # Limit string lengths
    for key, value in clean_response.items():
        if isinstance(value, str) and len(value) > 10000:
            clean_response[key] = value[:10000]
    
    return clean_response
```

**Layer 5: API Key Security**

```python
# API keys encrypted at rest
from cryptography.fernet import Fernet

class APIKeyVault:
    def __init__(self, master_key):
        self.cipher = Fernet(master_key)
    
    def encrypt(self, api_key):
        return self.cipher.encrypt(api_key.encode()).decode()
    
    def decrypt(self, encrypted_key):
        return self.cipher.decrypt(encrypted_key.encode()).decode()

# Keys never exposed to frontend
# Keys only decrypted in memory during module calls
# Keys rotated if module is uninstalled/reinstalled
```

**Layer 6: Monitoring & Alerts**

```python
# Real-time monitoring
class ModuleMonitor:
    def track_call(self, module_id, latency_ms, success):
        metrics.increment(f"module.{module_id}.calls")
        metrics.histogram(f"module.{module_id}.latency", latency_ms)
        
        if not success:
            metrics.increment(f"module.{module_id}.errors")
            
            # Auto-disable if error rate > 50%
            error_rate = self.get_error_rate(module_id)
            if error_rate > 0.5:
                self.disable_module(module_id)
                alert_admin(f"Module {module_id} auto-disabled")
```

### Graceful Degradation

If a module fails:
1. **Enrichment module fails** → Skip enrichment, evaluate rules without that field
2. **Scoring module fails** → Use base score (0) or fallback to chronological
3. **Injection module fails** → Skip injection, feed still works
4. **Access control fails** → Fail open (allow access) or fail closed (deny) based on config

### Module Developer Guidelines

**Required:**
- Health check endpoint (`/health`)
- Graceful timeout handling
- Idempotent operations
- Batch support (recommended)
- Error responses with codes

**Best Practices:**
- Cache aggressively
- Use CDN for static responses
- Implement retry logic
- Return partial results on timeout
- Document rate limits

---

## ⚡ Performance & Scaling

### Feed Serving Performance

**Problem:** 1000 users request same feed simultaneously

**Solution: Multi-Layer Caching**

```python
# Layer 1: CDN (Cloudflare)
# Cache feed responses for 60s
# 99% of requests never hit our servers

# Layer 2: Redis Cache
@cache(ttl=60, key="feed:{feed_id}:{cursor}:{user_did}")
async def get_feed(feed_id, cursor, user_did):
    # This only runs on cache miss
    return await build_feed(feed_id, cursor, user_did)

# Layer 3: Database Query Optimization
CREATE INDEX idx_feed_posts_cursor ON feed_posts(
    feed_id, 
    base_score DESC, 
    assigned_at DESC
) WHERE assigned_at > NOW() - INTERVAL '30 days';

# Cursor-based pagination (not offset)
SELECT * FROM feed_posts
WHERE feed_id = $1
  AND (base_score, assigned_at) < ($cursor_score, $cursor_time)
ORDER BY base_score DESC, assigned_at DESC
LIMIT 50;
```

**Cache Invalidation Strategy:**

```python
# Invalidate on:
# 1. New post assigned to feed (invalidate feed cache)
# 2. Pinned post added/removed (invalidate feed cache)
# 3. Feed rules changed (invalidate all feed caches)
# 4. User-scoped changes (invalidate user's cache only)

# Smart invalidation
class FeedCache:
    async def invalidate_feed(self, feed_id):
        # Only invalidate first page (most common)
        await redis.delete(f"feed:{feed_id}:*:page:0")
        # Let other pages expire naturally
```

**Load Balancing:**

```yaml
# docker-compose.yml
services:
  api:
    image: feedmaster-api
    deploy:
      replicas: 4  # 4 API containers
    environment:
      - DB_POOL_SIZE=10  # 10 connections each = 40 total
  
  nginx:
    image: nginx
    # Round-robin load balancing
```

### Firehose Ingestion Scaling

**Problem:** Keywords match 10k posts/min, can't process fast enough

**Solution: Queue-Based Architecture**

```python
# Ingestion Worker (single instance, stateful)
class FirehoseIngester:
    def __init__(self):
        self.keyword_matcher = AhoCorasick()
        self.queue = RedisQueue("post_queue")
        
        # Load ALL keywords from ALL feeds
        self.reload_keywords()
    
    async def process_firehose(self):
        async for event in firehose_stream():
            if event.type == "commit":
                for post in event.posts:
                    # Fast keyword matching (O(n) where n = post length)
                    if self.keyword_matcher.match(post.text):
                        # Don't process now, queue it
                        await self.queue.push({
                            "cid": post.cid,
                            "uri": post.uri,
                            "text": post.text,
                            "author": post.author,
                            "created_at": post.created_at
                        })

# Assignment Workers (multiple instances, stateless)
class AssignmentWorker:
    async def process_queue(self):
        while True:
            # Pop batch of 100 posts
            posts = await queue.pop_batch(100)
            
            # Process in parallel
            await asyncio.gather(*[
                self.assign_to_feeds(post) for post in posts
            ])
    
    async def assign_to_feeds(self, post):
        # For each feed, check if post matches rules
        for feed in self.get_relevant_feeds(post):
            if await self.evaluate_rules(feed, post):
                await db.insert_feed_post(feed.id, post.cid)
```

**Backpressure Handling:**

```python
# If queue grows too large, start dropping low-priority posts
class SmartQueue:
    MAX_SIZE = 100000
    
    async def push(self, post, priority="normal"):
        queue_size = await self.size()
        
        if queue_size > self.MAX_SIZE:
            if priority == "low":
                # Drop low-priority posts
                metrics.increment("queue.dropped.low_priority")
                return
            elif queue_size > self.MAX_SIZE * 1.5:
                # Emergency: drop everything
                metrics.increment("queue.dropped.emergency")
                return
        
        await redis.lpush(self.queue_key, json.dumps(post))
```

**Firehose Reconnection:**

```python
class ResilientFirehose:
    async def connect_with_retry(self):
        retry_delays = [1, 2, 5, 10, 30, 60]  # seconds
        
        for delay in itertools.cycle(retry_delays):
            try:
                async with firehose.subscribe() as stream:
                    self.last_cursor = await self.get_last_cursor()
                    
                    async for event in stream:
                        await self.process(event)
                        await self.save_cursor(event.seq)
                        
            except ConnectionError:
                logger.error(f"Firehose disconnected, retry in {delay}s")
                await asyncio.sleep(delay)
```

### Module Execution Order & Dependencies

**Problem:** Module B needs Module A's output

**Solution: Dependency Graph**

```python
class ModuleDependencyGraph:
    def __init__(self, modules):
        self.graph = self.build_graph(modules)
        self.execution_order = self.topological_sort()
    
    def build_graph(self, modules):
        graph = {}
        for module in modules:
            graph[module.id] = {
                "module": module,
                "depends_on": module.config.get("depends_on", []),
                "provides": module.provides_fields
            }
        return graph
    
    def topological_sort(self):
        """Returns execution order that respects dependencies"""
        visited = set()
        order = []
        
        def visit(module_id):
            if module_id in visited:
                return
            visited.add(module_id)
            
            for dep in self.graph[module_id]["depends_on"]:
                if dep not in self.graph:
                    raise DependencyError(f"Module {module_id} depends on missing module {dep}")
                visit(dep)
            
            order.append(module_id)
        
        for module_id in self.graph:
            visit(module_id)
        
        return order
    
    def detect_cycles(self):
        """Detect circular dependencies"""
        # DFS with recursion stack
        visited = set()
        rec_stack = set()
        
        def has_cycle(node):
            visited.add(node)
            rec_stack.add(node)
            
            for dep in self.graph[node]["depends_on"]:
                if dep not in visited:
                    if has_cycle(dep):
                        return True
                elif dep in rec_stack:
                    return True
            
            rec_stack.remove(node)
            return False
        
        for node in self.graph:
            if node not in visited:
                if has_cycle(node):
                    return True
        return False

# Usage
modules = feed.get_enrichment_modules()
graph = ModuleDependencyGraph(modules)

if graph.detect_cycles():
    raise ConfigError("Circular module dependencies detected")

# Execute in correct order
for module_id in graph.execution_order:
    result = await execute_module(module_id, post)
    post.enriched_data[module_id] = result
```

**Parallel Execution:**

```python
# Modules without dependencies can run in parallel
class ParallelModuleExecutor:
    async def execute(self, modules, post):
        graph = ModuleDependencyGraph(modules)
        results = {}
        
        # Group by dependency level
        levels = self.group_by_level(graph)
        
        # Execute each level in parallel
        for level in levels:
            level_results = await asyncio.gather(*[
                self.execute_module(mod, post, results)
                for mod in level
            ])
            
            for mod, result in zip(level, level_results):
                results[mod.id] = result
        
        return results
    
    def group_by_level(self, graph):
        """Group modules by dependency depth"""
        levels = []
        remaining = set(graph.graph.keys())
        
        while remaining:
            # Find modules with no unmet dependencies
            level = []
            for mod_id in remaining:
                deps = graph.graph[mod_id]["depends_on"]
                if all(d not in remaining for d in deps):
                    level.append(mod_id)
            
            if not level:
                raise DependencyError("Circular dependency detected")
            
            levels.append(level)
            remaining -= set(level)
        
        return levels
```

---

## 🏢 Multi-Tenancy & Resource Isolation

### Database Connection Pooling

```python
# Per-feed connection limits
class FeedAwareConnectionPool:
    def __init__(self, max_connections=100):
        self.pool = asyncpg.create_pool(
            min_size=10,
            max_size=max_connections
        )
        self.feed_semaphores = {}  # Per-feed limits
    
    async def acquire(self, feed_id):
        # Limit concurrent queries per feed
        if feed_id not in self.feed_semaphores:
            self.feed_semaphores[feed_id] = asyncio.Semaphore(5)
        
        async with self.feed_semaphores[feed_id]:
            return await self.pool.acquire()
```

### Resource Quotas

```python
# Per-feed quotas
class FeedQuotaManager:
    QUOTAS = {
        "free": {
            "max_posts_per_day": 10000,
            "max_module_calls_per_day": 1000,
            "max_enrichment_modules": 2,
            "max_feeds": 3
        },
        "pro": {
            "max_posts_per_day": 100000,
            "max_module_calls_per_day": 10000,
            "max_enrichment_modules": 10,
            "max_feeds": 20
        },
        "enterprise": {
            "max_posts_per_day": 1000000,
            "max_module_calls_per_day": 100000,
            "max_enrichment_modules": 50,
            "max_feeds": 100
        }
    }
    
    async def check_quota(self, feed_id, resource):
        tier = await self.get_feed_tier(feed_id)
        usage = await self.get_usage(feed_id, resource)
        limit = self.QUOTAS[tier][resource]
        
        if usage >= limit:
            raise QuotaExceeded(f"{resource} quota exceeded")
```

### Query Timeouts

```python
# Prevent slow queries from blocking others
async def query_with_timeout(query, params, timeout=5.0):
    try:
        async with asyncio.timeout(timeout):
            return await db.fetch(query, *params)
    except asyncio.TimeoutError:
        # Cancel the query
        await db.execute("SELECT pg_cancel_backend($1)", conn.pid)
        raise QueryTimeout("Query exceeded timeout")
```

---

## 💰 Cost Tracking & Billing

### Real-Time Cost Tracking

```python
class CostTracker:
    async def track_module_call(self, user_id, module_id, feed_id):
        module = await self.get_module(module_id)
        cost = module.cost_per_call
        
        # Increment user's cost counter
        await redis.hincrby(
            f"costs:user:{user_id}:daily",
            module_id,
            int(cost * 1000000)  # Store as micro-dollars
        )
        
        # Check budget
        total_cost = await self.get_daily_cost(user_id)
        budget = await self.get_user_budget(user_id)
        
        if total_cost > budget:
            await self.pause_expensive_modules(user_id)
            await self.notify_user(user_id, "Budget exceeded")
```

### Cost Estimation

```python
class CostEstimator:
    async def estimate_feed_cost(self, feed_config):
        """Estimate daily cost for a feed configuration"""
        
        # Estimate post volume
        post_volume = await self.estimate_post_volume(
            feed_config.keywords
        )
        
        # Calculate module costs
        module_costs = 0
        for module in feed_config.modules:
            if module.category == "enrichment":
                # Enrichment runs on every matched post
                calls_per_day = post_volume
            elif module.category == "scoring":
                # Scoring runs on every feed request
                calls_per_day = feed_config.estimated_requests * 50  # 50 posts per request
            
            # Apply cache hit rate
            cache_hit_rate = module.cache_hit_rate or 0.9
            actual_calls = calls_per_day * (1 - cache_hit_rate)
            
            module_costs += actual_calls * module.cost_per_call
        
        return {
            "estimated_daily_cost": module_costs,
            "post_volume": post_volume,
            "breakdown": self.get_cost_breakdown(feed_config)
        }
```

---

## 🎨 Feed Variants (One Feed, Multiple Versions)

### The Feature

Create multiple versions of a feed with slight variations:
- **Base Feed**: Urbanism posts
- **Variant 1**: Same but sorted chronologically
- **Variant 2**: Same but videos only
- **Variant 3**: Same but sorted by score

### Implementation

```sql
CREATE TABLE feed_variants (
  id UUID PRIMARY KEY,
  parent_feed_id UUID REFERENCES feeds(id),
  name TEXT NOT NULL,
  
  -- What changes from parent
  override_sorting JSONB,  -- {"type": "chronological"}
  override_filters JSONB,  -- {"has_video": true}
  override_pinned BOOLEAN DEFAULT FALSE,
  
  -- Inherits everything else from parent
  created_at TIMESTAMP DEFAULT NOW()
);

-- Variants share the same feed_posts table
-- Just apply different sorting/filtering at query time
```

### Visual Builder UI

```
[Feed: Urbanism Posts]
  ├─ 📊 Default (by score)
  ├─ ⏰ Chronological
  ├─ 🎥 Videos Only
  └─ [+ Create Variant]

Click "Create Variant":
┌─ Create Feed Variant ─────────────┐
│ Name: [Videos Only____________]   │
│                                    │
│ Changes from parent:               │
│ ☑ Override sorting                 │
│   [Chronological ▼]                │
│ ☑ Add filter                       │
│   [Has Video] [is true]            │
│ ☐ Remove pinned posts              │
│                                    │
│ [Create Variant] [Cancel]          │
└────────────────────────────────────┘
```

### Backend Logic

```python
class FeedVariant:
    async def get_posts(self, variant_id, cursor, user_did):
        variant = await db.fetch_variant(variant_id)
        parent_feed = await db.fetch_feed(variant.parent_feed_id)
        
        # Start with parent's posts
        query = """
            SELECT * FROM feed_posts
            WHERE feed_id = $1
        """
        params = [parent_feed.id]
        
        # Apply variant filters
        if variant.override_filters:
            for key, value in variant.override_filters.items():
                query += f" AND {key} = ${len(params) + 1}"
                params.append(value)
        
        # Apply variant sorting
        if variant.override_sorting:
            sort_type = variant.override_sorting["type"]
            if sort_type == "chronological":
                query += " ORDER BY created_at DESC"
            elif sort_type == "by_score":
                query += " ORDER BY base_score DESC"
        else:
            # Use parent's sorting
            query += " ORDER BY base_score DESC"
        
        return await db.fetch(query, *params)
```

### Benefits

- ✅ No duplicate ingestion/assignment work
- ✅ Shared cache (mostly)
- ✅ Easy to maintain (change parent, all variants update)
- ✅ Users can subscribe to their preferred version

---

## 🔌 Module System

### Module Scopes

**Global Modules** (cacheable, shared across all feeds)
- Results cached globally
- Same post → same result for all feeds
- Examples: video metadata, image analysis, sentiment
- Cost: Shared across all users (99% savings with cache)

**Feed-Scoped Modules** (per-feed context)
- Results depend on feed configuration
- Same post → different result per feed
- Examples: personalization (uses feed's audience), custom scoring
- Cost: Per-feed (moderate)

**User-Scoped Modules** (per-user context)
- Results depend on specific user
- Same post → different result per user
- Examples: access control, user-specific recommendations
- Cost: Per-user (expensive, rarely cached)

### Module Categories

**1. Source Modules** (provide posts)
- Alternative firehose parsers
- RSS feed importers
- Manual post injection (native)
- Twitter/Reddit scrapers
- Custom data sources

**2. Access Control Modules** (gate who can see feed)
- Patreon integration
- Ko-fi integration
- "Follow to unlock"
- "Like to unlock"
- Time-based access
- Quiz gates
- Custom membership systems

**3. Enrichment Modules** (add fields for rule builder)
- Sentiment analysis
- Topic classification
- Image analysis
- Language detection
- Custom ML models

**4. Scoring Modules** (rank posts at query time)
- Personalization
- Engagement prediction
- Recency boosting
- Custom algorithms

**5. Injection Modules** (add posts at query time)
- Ad networks
- Sponsored content
- Promotional posts

**6. Analytics Modules** (track metrics)
- Impression tracking
- Click tracking
- Engagement analytics
- Custom metrics

### Block Organization in Visual Editor

**Sidebar Tab Structure:**

Each tab (Main, Sources, Scoring, Injection, Sorting) displays blocks in this order:

1. **Native Blocks** (top)
   - Built-in platform blocks
   - Always available, no installation needed
   - No badges/icons

2. **Platform Modules** (middle - semi-custom)
   - Advanced features provided by the platform team (you)
   - More sophisticated than native blocks, but still platform-maintained
   - Marked with ⚙️ icon
   - Examples: 
     - Advanced Sentiment Analysis (platform-hosted ML model)
     - Platform Analytics Dashboard
     - Advanced Personalization Engine
   - May have usage limits, premium features, or tier-based access
   - No external API calls (runs on platform infrastructure)
   - **Key difference**: You maintain it, but it's more advanced than simple native blocks

3. **External Module Blocks** (below platform modules)
   - External API modules from marketplace
   - Marked with 🔌 icon
   - May show pricing badge (💰) if paid
   - **Only shown after installation** (via marketplace)
   - Shows verification badge (✓, ✓✓, or ⚠️)

4. **Custom Blocks** (bottom)
   - User-created saved templates
   - Marked with 📦 icon
   - Can be private or shared
   - **Only shown after creation** (user saves a template)
   - When dragged, expands into original node combination

**Note:** Modules and custom blocks appear in the same tabs (Main, Sources, Scoring, Injection, Sorting) as native blocks, but are hidden by default until installed/created.

**Visual Example:**
```
┌─ Scoring Tab ───────────────┐
│                              │
│ Native:                      │
│ • Recency Boost              │
│ • Engagement Score           │
│ • Custom Score               │
│                              │
│ ─────────────────────────── │
│ Platform Modules:             │
│ ⚙️ Advanced Sentiment        │
│ ⚙️ Platform Analytics        │
│                              │
│ ─────────────────────────── │
│ External Modules:             │
│ 🔌 Sentiment Analyzer ✓💰    │
│ 🔌 Personalization ✓         │
│                              │
│ ─────────────────────────── │
│ Custom Blocks:                │
│ 📦 High-Engagement Urbanism   │
│ 📦 Video Content Filter       │
└──────────────────────────────┘
```

### Module Manifest (module.json)

Every module must provide a manifest:

```json
{
  "id": "video-metadata",
  "name": "Video Metadata Extractor",
  "version": "1.0.0",
  "author": "did:plc:alice123",
  
  "scope": "global",
  "category": "enrichment",
  
  "cache": {
    "enabled": true,
    "ttl": 86400,
    "key_fields": ["post_cid"]
  },
  
  "performance": {
    "avg_latency_ms": 150,
    "max_latency_ms": 500,
    "supports_batch": true,
    "max_batch_size": 50
  },
  
  "pricing": {
    "model": "per_call",
    "cost_per_call": 0.001,
    "free_tier": 1000
  },
  
  "provides_fields": [
    {
      "id": "video_duration",
      "label": "Video Duration",
      "type": "number",
      "unit": "seconds"
    }
  ],
  
  "config_schema": {
    "type": "object",
    "properties": {
      "extract_audio": {
        "type": "boolean",
        "default": false
      }
    }
  },
  
  "endpoints": {
    "enrich": "https://api.example.com/v1/enrich",
    "health": "https://api.example.com/v1/health"
  }
}
```

### Performance Optimization

**Caching Strategy:**
- Global modules: Cache shared across all feeds (99% cost savings)
- Feed-scoped modules: Cache per feed configuration
- User-scoped modules: Minimal caching (real-time)

**Batch Processing:**
- Modules can process up to 100 posts per API call
- Reduces latency from 200ms × 100 = 20s to 300ms total

**Async Enrichment:**
- Posts added to feed immediately
- Enrichment happens in background
- Re-evaluate rules if enrichment changes result

**Pre-Enrichment:**
- Popular modules (used by 10+ feeds) enrich all posts proactively
- Zero latency for those feeds

### Module API Contracts

**Access Control Module:**
```json
POST https://module.com/check-access
{
  "user_did": "did:plc:user123",
  "feed_id": "uuid",
  "config": {...}
}

Response (DENIED):
{
  "has_access": false,
  "gate_post": {
    "text": "🔒 Subscribe on Patreon to access this feed!",
    "facets": [...],
    "embed": {...}
  },
  "preview_posts": 3
}

Response (ALLOWED):
{
  "has_access": true,
  "user_metadata": {...}
}
```

**Enrichment Module:**
```json
POST https://module.com/enrich
{
  "posts": [
    {"cid": "abc", "text": "I love urbanism!", "author": "did:plc:xyz"}
  ]
}

Response:
{
  "fields": {
    "abc": {
      "sentiment": "positive",
      "sentiment_score": 0.92,
      "toxicity": 0.01
    }
  }
}
```

**Scoring Module:**
```json
POST https://module.com/score
{
  "posts": [...],
  "user_context": {
    "did": "did:plc:user123",
    "follows": [...],
    "preferences": {}
  },
  "config": {...}
}

Response:
{
  "scores": {
    "abc": 150,  // Boost
    "def": -50   // Penalize
  }
}
```

**Injection Module (Ads):**
```json
POST https://module.com/get-ads
{
  "feed_id": "uuid",
  "user_context": {...},
  "slots": 3,
  "config": {
    "frequency": 5,  // Every 5 posts
    "max_per_day": 3
  }
}

Response:
{
  "ads": [
    {
      "post_uri": "at://...",
      "weight": 1,
      "metadata": {...}
    }
  ]
}
```

**Source Module:**
```json
POST https://module.com/get-posts
{
  "feed_id": "uuid",
  "since": "2024-01-15T10:00:00Z",
  "limit": 100,
  "config": {...}
}

Response:
{
  "posts": [
    {
      "uri": "at://...",
      "text": "...",
      "author": "did:plc:xyz",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## 🧪 Module Developer Validation System

### Ensuring Correct Integration

To ensure developers code modules correctly to our engine, we provide:

### 1. Developer SDK & Tools

**Module Development Kit (MDK):**
```bash
# Install MDK
npm install -g @feedplatform/mdk

# Initialize new module
mdk init sentiment-analyzer

# Test module locally
mdk test

# Validate module before publishing
mdk validate
```

**SDK Features:**
- TypeScript types for all API contracts
- Mock platform server for local testing
- Schema validation utilities
- Test data generators
- Performance benchmarking tools

### 2. API Contract Validation

**Automatic Schema Validation:**
```python
# Platform validates all module responses
from feedplatform.module_validator import validate_module_response

def call_module(module, payload):
    response = await http_client.post(module.endpoint, json=payload)
    
    # Validate response matches declared schema
    schema = module.manifest["response_schema"]
    validated = validate_module_response(response.json(), schema)
    
    if not validated.is_valid:
        raise ModuleValidationError(
            f"Module {module.id} returned invalid response: {validated.errors}"
        )
    
    return validated.data
```

**Required Schema Declaration:**
```json
{
  "response_schema": {
    "type": "object",
    "required": ["fields"],
    "properties": {
      "fields": {
        "type": "object",
        "patternProperties": {
          "^[a-z_]+$": {
            "type": ["string", "number", "boolean"]
          }
        }
      }
    }
  }
}
```

### 3. Automated Testing Requirements

**Module Test Suite (Required):**
```python
# modules/sentiment-analyzer/tests/test_enrichment.py
import pytest
from feedplatform_mdk import ModuleTester, TestPost

class TestSentimentAnalyzer(ModuleTester):
    module_id = "sentiment-analyzer"
    
    def test_basic_enrichment(self):
        """Test module enriches a single post correctly"""
        post = TestPost(text="I love urbanism!")
        result = self.call_enrich([post])
        
        assert result["fields"][post.cid]["sentiment"] == "positive"
        assert 0 <= result["fields"][post.cid]["sentiment_score"] <= 1
    
    def test_batch_enrichment(self):
        """Test module handles batch requests"""
        posts = [
            TestPost(text="Great post!"),
            TestPost(text="Terrible idea."),
            TestPost(text="Neutral statement.")
        ]
        result = self.call_enrich(posts)
        
        assert len(result["fields"]) == 3
        assert all(cid in result["fields"] for post in posts)
    
    def test_error_handling(self):
        """Test module handles errors gracefully"""
        invalid_post = TestPost(text=None)  # Invalid
        result = self.call_enrich([invalid_post])
        
        # Should return error in response, not crash
        assert "error" in result["fields"][invalid_post.cid]
    
    def test_performance(self):
        """Test module meets performance requirements"""
        posts = [TestPost() for _ in range(100)]
        start = time.time()
        result = self.call_enrich(posts)
        duration = (time.time() - start) * 1000  # ms
        
        assert duration < 5000  # Must complete in < 5s
        assert result["performance"]["avg_latency_ms"] < 500
```

**Platform Test Runner:**
```bash
# Platform runs module tests before approval
mdk test --platform

# Tests run in sandboxed environment
# Must pass all tests for module to be published
```

### 4. Pre-Publication Validation

**Automated Checks:**
```python
class ModuleValidator:
    async def validate_module(self, module_manifest, module_code):
        checks = []
        
        # 1. Manifest validation
        checks.append(self.validate_manifest(module_manifest))
        
        # 2. API contract compliance
        checks.append(await self.test_api_contracts(module_manifest))
        
        # 3. Test suite execution
        checks.append(await self.run_module_tests(module_code))
        
        # 4. Performance benchmarks
        checks.append(await self.benchmark_performance(module_code))
        
        # 5. Security scan
        checks.append(await self.security_scan(module_code))
        
        # 6. Documentation completeness
        checks.append(self.check_documentation(module_manifest))
        
        return ValidationResult(checks)
```

**Validation Checklist:**
- ✅ Manifest follows schema
- ✅ All required endpoints implemented
- ✅ Response schemas match declarations
- ✅ Test suite passes (100% coverage)
- ✅ Performance within declared limits
- ✅ No security vulnerabilities
- ✅ Documentation complete
- ✅ Health check endpoint works
- ✅ Error handling implemented
- ✅ Batch processing supported (if declared)

### 5. Runtime Validation

**Continuous Monitoring:**
```python
class ModuleMonitor:
    async def monitor_module_call(self, module_id, request, response):
        # Validate response schema
        if not self.validate_schema(response, module.schema):
            self.record_violation(module_id, "schema_mismatch")
            await self.disable_module(module_id)
        
        # Check performance
        if response.latency_ms > module.max_latency_ms:
            self.record_violation(module_id, "performance_violation")
        
        # Check error rate
        error_rate = self.get_error_rate(module_id)
        if error_rate > 0.1:  # 10% error rate
            self.record_violation(module_id, "high_error_rate")
            await self.auto_disable(module_id)
```

### 6. Developer Documentation Requirements

**Required Documentation:**
```markdown
# Module: Sentiment Analyzer

## API Contract
- Endpoint: POST /enrich
- Request: { "posts": [...] }
- Response: { "fields": { "cid": {...} } }

## Field Definitions
- `sentiment`: string ("positive", "negative", "neutral")
- `sentiment_score`: number (0-1)

## Error Codes
- 400: Invalid request
- 500: Internal error
- 503: Rate limit exceeded

## Examples
[Code examples for each endpoint]

## Testing
[How to test the module locally]
```

### 7. CI/CD Integration

**GitHub Actions Example:**
```yaml
# .github/workflows/module-validation.yml
name: Module Validation

on:
  pull_request:
    paths:
      - 'modules/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install MDK
        run: npm install -g @feedplatform/mdk
      
      - name: Validate Module
        run: mdk validate
      
      - name: Run Tests
        run: mdk test
      
      - name: Performance Benchmark
        run: mdk benchmark
      
      - name: Security Scan
        run: mdk security-scan
```

### 8. Developer Portal

**Module Developer Dashboard:**
- Module validation status
- Test results
- Performance metrics
- Error logs
- User feedback
- Revenue (if paid module)

**Validation Status:**
```
Module: sentiment-analyzer
Status: ✅ Validated
Last Check: 2024-01-15 10:30:00 UTC

Checks:
✅ Manifest valid
✅ API contracts compliant
✅ Tests passing (15/15)
✅ Performance: 145ms avg (limit: 500ms)
✅ Security: No issues
✅ Documentation: Complete

Issues: 0
Warnings: 0
```

### 9. Versioning & Updates

**Module Versioning:**
```json
{
  "id": "sentiment-analyzer",
  "version": "1.2.3",
  "api_version": "1.0",  // Breaking changes require new API version
  "changelog": [
    "1.2.3: Fixed batch processing bug",
    "1.2.2: Added sentiment confidence score",
    "1.2.1: Performance improvements"
  ]
}
```

**Breaking Changes:**
- New API version required
- Old version remains available
- Users must explicitly upgrade
- Platform validates new version before allowing upgrade

### 10. Developer Support

**Resources:**
- Developer documentation site
- API reference (OpenAPI/Swagger)
- Example modules (GitHub templates)
- Community forum
- Direct support for verified modules
- Code review for platform verification

**Support Tiers:**
- **Community**: Forum, docs, examples
- **Verified**: Code review, priority support
- **Platform**: Direct access to platform team

---

## 🎨 Visual Rule Builder

### UI Concept

```
Feed Assignment Rules

Posts are included if they match ANY of these rule groups:

┌─ Rule Group 1 ──────────────────────────┐
│ ALL conditions must be true:            │
│                                          │
│ [Text] [contains] [urbanism]            │
│ [Like Count] [>=] [100]                 │
│ [Post Age] [>=] [10] [hours]            │
│                                          │
│ [+] Add condition                        │
│ [Remove Group]                           │
└──────────────────────────────────────────┘

┌─ Rule Group 2 ──────────────────────────┐
│ ALL conditions must be true:            │
│                                          │
│ [Author DID] [in list] [VIP Users]      │
│ [Account Age] [>=] [365] [days]         │
│ [Sentiment] [==] [positive] 🔌          │
│   ↑ From "Sentiment Analyzer" module    │
│                                          │
│ [+] Add condition                        │
│ [Remove Group]                           │
└──────────────────────────────────────────┘

[+ Add Rule Group]

━━━ Preview ━━━
Logic: (Group 1) OR (Group 2)
Matching posts (last 24h): 234
[View Sample Posts]
```

### Field Types

**Native Fields:**
- Text content
- Like/repost/reply counts
- Post age (calculated)
- Author DID/handle
- Follower/following counts
- Account age (calculated)
- Has images/video/link
- Language
- Post type

**Module Fields:**
- Sentiment (from module)
- Toxicity (from module)
- Topic classification (from module)
- Image quality (from module)
- Custom ML outputs (from module)

**Operators:**
- Numbers: `==`, `!=`, `<`, `<=`, `>`, `>=`
- Text: `contains`, `not contains`, `matches regex`, `equals`
- Lists: `in list`, `not in list`
- Boolean: `is true`, `is false`

### Rule JSON Format

```json
{
  "logic": "OR",
  "groups": [
    {
      "logic": "AND",
      "conditions": [
        {
          "field": "text",
          "operator": "contains",
          "value": "urbanism"
        },
        {
          "field": "like_count",
          "operator": ">=",
          "value": 100
        },
        {
          "field": "post_age_hours",
          "operator": ">=",
          "value": 10
        }
      ]
    },
    {
      "logic": "AND",
      "conditions": [
        {
          "field": "author_did",
          "operator": "in_list",
          "value": "list_uuid"
        },
        {
          "field": "account_age_days",
          "operator": ">=",
          "value": 365
        },
        {
          "field": "module_sentiment",
          "operator": "==",
          "value": "positive"
        }
      ]
    }
  ]
}
```

---

## 📌 Special Features

### Pinned Posts
- Always show at top of feed
- Multiple pins (ordered by position)
- Optional expiration time
- Can pin external posts by URI

### Rotating Posts
- Cycle through a set of posts
- Weighted random selection
- Different strategies: random, round-robin, time-based, user-based
- Use cases: "Post of the day", featured content, educational carousels

### Manual Post Injection
- Add specific posts to feed by URI
- Bulk import from CSV
- Bypass all filtering logic
- Use case: Curated "Best of" feeds

### Ads (via Injection Modules)
- Injected at regular intervals (every N posts)
- Frequency capping (max X per user per day)
- Not affected by scoring modules
- Module handles all ad logic (targeting, billing, etc.)

---

## 💰 Monetization

### Deployment Tiers

**Tier 1: Fully Self-Hosted (Free)**
- Download source code
- Run on your VPS
- Connect to firehose directly
- Cost: $20/month (your VPS)

**Tier 2: Managed Ingestion ($5-10/month)**
- We run firehose parser
- You run API + database
- Saves bandwidth/CPU
- Cost: $10/month (VPS) + $5/month (us) = $15/month

**Tier 3: Fully Managed ($50/month)**
- We host everything
- You get a feed URL
- Zero technical knowledge needed

### Module Marketplace

**For module developers:**
- List module in marketplace
- Set pricing (free, subscription, per-request, revenue share)
- We handle payments (15% platform fee) or they handle directly
- Build entire ecosystems (ad networks, analytics dashboards, etc.)

**For feed creators:**
- Browse marketplace
- Install modules with one click
- Configure via auto-generated UI
- Pay module developer (or use free modules)

---

## 🚀 MVP Scope

### What We Build (Core Platform)

**v1.0 (~2000 lines of code):**
- [ ] Firehose ingestion (Aho-Corasick)
- [ ] Feed assignment (rule evaluation)
- [ ] Module execution framework
- [ ] Feed API (Bluesky AT Proto)
- [ ] Visual rule builder UI
- [ ] Pinned/rotating posts
- [ ] Manual post injection
- [ ] Docker Compose deployment

**v1.1 (+1000 lines):**
- [ ] Module marketplace
- [ ] Module developer tools
- [ ] Analytics dashboard
- [ ] User lists (private)

**v2.0 (+2000 lines):**
- [ ] Payment processing
- [ ] Advanced UI
- [ ] Multi-user support

### What Community Builds (Modules)

- Personalization
- Sentiment analysis
- Ad networks
- Access control (Patreon, Ko-fi, etc.)
- Alternative ingestion
- RSS importers
- Analytics
- Custom ML models
- Everything else!

---

## 🎯 Key Principles

1. **Simple core** - We build the minimum, modules do the rest
2. **Extensible** - Modules can do almost anything
3. **Visual** - Rule builder, not code
4. **Flexible** - Native ingestion is optional, can be replaced
5. **Community-driven** - Module marketplace is the ecosystem
6. **Cost-effective** - Shared ingestion, distributed storage

---

## 📚 Technical Stack

**Backend:**
- Language: Python or Go (TBD)
- Framework: FastAPI (Python) or Fiber (Go)
- Database: PostgreSQL 15+
- Cache: Redis 7+
- WebSocket: For firehose connection

**Deployment:**
- Docker + Docker Compose v2
- Single ingestion container (stateful)
- Multiple API containers (stateless)
- Postgres + Redis containers

**Frontend (Optional):**
- Framework: React or Svelte
- Styling: Tailwind CSS
- Rule builder: Custom drag-and-drop

---

## 🔮 Future Possibilities

- Multi-language support
- Feed mixing/combining
- Collaborative filtering
- Feed templates
- Export/backup tools
- Mobile apps
- Federation between instances
- Decentralized module registry

---

**Ready to build the simplest, most extensible feed platform!** 🚀


---

## 🎨 Visual Node Editor Design

### Node-Based Interface

**Core Concept:** Drag-and-drop nodes that connect like puzzle pieces

**Node Types:**
1. **Logic Nodes** (red) - OR, AND
2. **Condition Nodes** (blue) - Text, Likes, Age, Author, Media
3. **Module Nodes** (purple) - Sentiment, Toxicity, Topic (from modules)

**Connection Rules:**
- Nodes have input (left) and output (right) connection points
- Drag from output to input to connect
- When close, they snap together (puzzle piece style)
- When far apart, draw curved arrow lines

**Cluster Logic:**
- **Disconnected clusters = implicit OR** (any cluster passes → post included)
- **Connected clusters = explicit logic** (depends on parent node type)

**Example:**
```
Cluster 1: [AND] → [Text: urbanism] + [Likes >= 100]
Cluster 2: [AND] → [Author in VIP] + [Sentiment: positive]
Cluster 3: [Media: images]

Logic: Cluster 1 OR Cluster 2 OR Cluster 3
```

### Live Preview Panel

**Shows in real-time:**
- Matching posts count (last 24h)
- Estimated cost per day
- Sample posts that match
- Which modules are being used
- Performance warnings (slow queries)

### Module Integration

**Modules provide fields seamlessly:**
- Native fields: Text, Likes, Author, etc.
- Module fields: Sentiment 🔌, Toxicity 🔌, Topic 🔌
- Modules appear with badge in node list
- Auto-installed when used in rules

### Interactive Mockup

Location: `/root/feed-gen/legacy/visual-builder/index.html`

Features:
- Fully interactive drag-and-drop
- Connect nodes by clicking connection points
- Move nodes around canvas
- Delete nodes
- Export to JSON
- Live preview updates

---

## 📝 Continue Prompt

We're designing the Feedmaster platform - a modular Bluesky feed generator with:
- Simple core (~2000 lines)
- Plugin architecture (modules for everything)
- Visual node-based rule builder
- Multi-feed support with shared ingestion

Current focus: Refining the visual editor UX. We have a working HTML mockup showing node-based editing with drag-and-drop, puzzle piece connections, and live preview.

Key decisions made:
- No output node needed (disconnected clusters = OR logic)
- Modules extend the rule builder with custom fields
- Native filters (fast) vs Module filters (flexible)
- Three deployment tiers (self-hosted, managed ingestion, fully managed)

Next: Continue discussing visual editor improvements and UX details.
