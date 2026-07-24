# Feedmaster Deep Dive: Architecture & Economics

## 1. Monolith vs Microservices Explained

### Microservices (Original Plan)
```
┌─────────────┐
│ Container 1 │  Ingestion Worker (Python)
│  - Connects │  - Runs 24/7
│  - Filters  │  - Writes to DB
│  - Scores   │
└─────────────┘

┌─────────────┐
│ Container 2 │  API Server (Node/Python)
│  - REST API │  - Handles user requests
│  - Ranking  │  - Reads from DB
│  - Caching  │  - Can restart without dropping firehose
└─────────────┘

┌─────────────┐
│ Container 3 │  Postgres
└─────────────┘

┌─────────────┐
│ Container 4 │  Redis
└─────────────┘
```

**Pros:**
- Restart API without losing firehose connection
- Scale API separately (10 API containers, 1 ingestion)
- Different languages per service
- Clear boundaries

**Cons:**
- 4+ containers to manage
- Network overhead between services
- More complex Docker Compose
- Harder for non-technical self-hosters

### Monolith Alternative
```
┌─────────────────────────┐
│   Single Container      │
│                         │
│  Main Process:          │
│  ├─ HTTP Server (API)   │
│  ├─ Background Thread 1 │──▶ Firehose listener
│  ├─ Background Thread 2 │──▶ Score calculator
│  └─ Background Thread 3 │──▶ Cleanup jobs
│                         │
└─────────────────────────┘
         │
         ▼
┌─────────────┐
│  Postgres   │
└─────────────┘
```

**Pros:**
- One container (+ DB)
- Simpler deployment
- Shared memory (no network calls)
- Easier debugging

**Cons:**
- Restart = drop firehose connection
- Can't scale API independently
- All in one language

### My Recommendation: **Hybrid Approach**

```
┌──────────────────────┐
│  Ingestion Service   │  ← Stateful, runs 24/7
│  (Separate container)│  ← Never restart
└──────────────────────┘
           │
           ▼
      ┌─────────┐
      │Postgres │
      └─────────┘
           ▲
           │
┌──────────────────────┐
│   API Service        │  ← Stateless, can scale
│ (Can be multiple)    │  ← Restart anytime
└──────────────────────┘
```

**Why this works:**
- Ingestion is isolated (never goes down)
- API can scale horizontally
- Only 2 application containers
- Simple enough for self-hosting

---

## 2. Cost Analysis & Filtering Strategy

### Bluesky Firehose Reality Check

**Current stats (estimated):**
- ~50,000 posts/minute during peak
- ~25,000 posts/minute average
- ~36 million posts/day
- Each post ~1-2KB JSON

**Bandwidth:**
- 25k posts/min × 1.5KB = 37.5 MB/min
- = 2.25 GB/hour
- = **54 GB/day**

**Cost if we stored everything:**
- 36M posts/day × 365 days = 13 billion posts/year
- At 2KB each = **26 TB/year**
- Postgres on AWS RDS: ~$2,600/month for 10TB
- **This is insane. We MUST filter.**

### Filtering Strategy: Multi-Stage Pipeline

#### Stage 1: Jetstream Pre-Filter (Free!)
Jetstream lets you subscribe to specific collections:
```javascript
// Only get posts, not likes/follows/blocks
ws://jetstream.atproto.tools/subscribe?wantedCollections=app.bsky.feed.post
```

This cuts traffic by ~60% immediately (no likes, follows, etc.)

#### Stage 2: Fast Reject (Aho-Corasick)
```
Incoming: 25,000 posts/min
         │
         ▼
    [Aho-Corasick]  ← 0.1ms per post
         │
         ├─ No match (99%) ──▶ DROP
         │
         └─ Match (1%) ──▶ 250 posts/min
                           │
                           ▼
                      [Save to DB]
```

**Cost of parsing WebSocket:**
- CPU: Minimal (JSON parsing is fast)
- A $20/month VPS can handle 25k posts/min easily
- Memory: ~100MB for Aho-Corasick trie with 10k keywords

**After filtering:**
- 250 posts/min × 1440 min/day = **360k posts/day**
- At 2KB each = 720 MB/day = **21 GB/month**
- Postgres: ~$50/month for 100GB storage
- **This is affordable!**

#### Stage 3: Refinement (Optional ML)
```
250 posts/min from Stage 2
         │
         ▼
    [ML Classifier]  ← 10-50ms per post
         │
         ├─ Low confidence (50%) ──▶ DROP or "maybe" table
         │
         └─ High confidence (50%) ──▶ 125 posts/min
                                      │
                                      ▼
                                 [Premium feed]
```

**When to use ML:**
- Not for initial filter (too slow/expensive)
- For refinement after keyword match
- For sentiment ("I hate urbanism" → negative)
- For image analysis (if post has images)

### Cost Optimization Ideas

#### Option A: Tiered Storage
```
Aho-Corasick (score ≥ 50) ──▶ Postgres "candidates" table
                              │
                              ├─ Score ≥ 100 ──▶ "gold" table (keep 30 days)
                              │
                              └─ Score 50-99 ──▶ "silver" table (keep 7 days)
```

**Why:** Storage is cheap, re-ingesting is impossible. Be generous.

#### Option B: Bloom Filter Cache
```
Before checking Aho-Corasick:
1. Check Bloom filter: "Have we seen this author before?"
2. If author never matched keywords, skip post
3. Update Bloom filter when author first matches
```

**Savings:** If 90% of posts are from "boring" accounts, skip them instantly.

#### Option C: Shared Ingestion Pool
```
        Bluesky Firehose
               │
               ▼
        [Master Listener]  ← One WebSocket for everyone
               │
               ├──▶ Feed A (Urbanism keywords)
               ├──▶ Feed B (Gaming keywords)
               ├──▶ Feed C (Art keywords)
               └──▶ Feed D (Tech keywords)
```

**Economics:**
- One $20 VPS handles firehose
- 100 feeds share the cost = $0.20/feed
- Each feed only stores their matches
- **This is the P2P idea!**

---

## 3. The 100-Point Threshold

### Current Proposal
```
Score < 100 ──▶ DROP (lost forever)
Score ≥ 100 ──▶ SAVE
```

### Problem: Tuning is Hard
```
Day 1: "urbanism" = 50 points
       "walkable" = 40 points
       Post: "urbanism walkable" = 90 points ──▶ DROPPED

Day 2: You realize 90 should pass
       But those posts are gone forever
```

### Solution: Fuzzy Threshold
```
Score < 50  ──▶ DROP (definitely not relevant)
Score 50-99 ──▶ SAVE to "maybe" table (7 days)
Score ≥ 100 ──▶ SAVE to "gold" table (30 days)
```

**Benefits:**
- Can retroactively promote "maybe" posts
- Tune thresholds without re-ingesting
- Only costs 2x storage (still cheap)

### Alternative: Percentile-Based
```
Every hour:
1. Calculate median score of matched posts
2. Keep top 50% above median
3. Drop bottom 50%
```

**Benefits:**
- Automatically adapts to post volume
- No magic numbers
- Prevents storage bloat

**Drawbacks:**
- Less predictable
- Might drop good posts during busy hours

### My Recommendation: **Fuzzy Threshold**
- 50 points = minimum bar (fast reject)
- 100 points = auto-include
- 50-99 = human review or ML refinement

---

## 4. Personalization & "Already Seen" Posts

### The "Already Seen" Problem

**Scenario:**
```
User scrolls feed:
- Sees post A (score: 500)
- Sees post B (score: 450)
- Closes app

Next day:
- Post A now has 1000 likes (score: 800)
- Post B has 100 likes (score: 500)
- User sees Post A AGAIN at top
```

**This is annoying!**

### Solution 1: Client-Side Tracking
```javascript
// Store in browser localStorage
const seenPosts = new Set(['cid1', 'cid2', 'cid3']);

// When fetching feed:
fetch('/api/feed?exclude=' + Array.from(seenPosts).join(','))
```

**Pros:**
- Simple
- No server state
- Works offline

**Cons:**
- Limited to 5-10MB localStorage
- Doesn't sync across devices
- User can clear it

### Solution 2: Server-Side "Seen" Table
```sql
CREATE TABLE user_seen_posts (
  user_id TEXT,
  post_cid TEXT,
  seen_at TIMESTAMP,
  PRIMARY KEY (user_id, post_cid)
);

-- When fetching feed:
SELECT * FROM posts
WHERE cid NOT IN (
  SELECT post_cid FROM user_seen_posts WHERE user_id = $1
)
ORDER BY score DESC;
```

**Pros:**
- Syncs across devices
- Persistent
- Can track engagement (did they click?)

**Cons:**
- Requires user accounts
- Storage grows (1M users × 1000 seen posts = 1B rows)
- Privacy concerns

### Solution 3: Time-Based Decay + Deduplication Window
```
When user requests feed:
1. Get their last_fetch_time from session
2. Only show posts created AFTER last_fetch_time
3. OR posts created before but with significant score change

Example:
- Last fetch: 2 hours ago
- Show: All posts from last 2 hours
- Plus: Posts older than 2 hours that gained 500+ points
```

**Pros:**
- No storage needed
- Simple logic
- Feels like "new content"

**Cons:**
- Misses posts if user is offline for days
- Doesn't work for non-chronological feeds

### Solution 4: Bloom Filter for "Seen"
```
Each user has a Bloom filter (1KB):
- Add post CID when shown
- Check filter before showing
- Reset every 7 days

Store in Redis:
SET user:123:seen_bloom <binary_data>
EXPIRE user:123:seen_bloom 604800
```

**Pros:**
- Tiny storage (1KB per user)
- Fast lookups (O(1))
- Syncs across devices

**Cons:**
- False positives (might hide 1% of posts)
- Requires Redis
- Doesn't track engagement

### My Recommendation: **Hybrid Approach**

```
1. Client-side tracking (last 100 posts)
2. Server-side Bloom filter (last 7 days)
3. Time-based decay (don't re-show posts >24h old)
```

**For personalization:**
```
Score = 
  Base Score (keywords)
  + Social Bonus (mutuals/followers)
  - Seen Penalty (if in Bloom filter: -1000)
  - Age Penalty (older = lower)
```

---

## 5. Multi-Feed Architecture

### Database Design

#### Option A: Shared Posts Table
```sql
CREATE TABLE posts (
  cid TEXT PRIMARY KEY,
  text TEXT,
  author_did TEXT,
  created_at TIMESTAMP,
  -- Multi-feed support
  feeds TEXT[], -- ['urbanism', 'gaming', 'art']
  feed_scores JSONB -- {'urbanism': 150, 'gaming': 80}
);

CREATE INDEX idx_feeds ON posts USING GIN(feeds);
```

**Query:**
```sql
SELECT * FROM posts
WHERE 'urbanism' = ANY(feeds)
ORDER BY (feed_scores->>'urbanism')::int DESC;
```

**Pros:**
- One post can be in multiple feeds
- Efficient storage (no duplication)
- Easy to add feeds

**Cons:**
- Complex queries
- Harder to tune per-feed

#### Option B: Separate Tables Per Feed
```sql
CREATE TABLE posts_urbanism (...);
CREATE TABLE posts_gaming (...);
CREATE TABLE posts_art (...);
```

**Pros:**
- Simple queries
- Independent tuning
- Easy to delete a feed

**Cons:**
- Post duplication (if in multiple feeds)
- Schema management nightmare
- Doesn't scale to 1000s of feeds

#### Option C: Feed Membership Table
```sql
CREATE TABLE posts (
  cid TEXT PRIMARY KEY,
  text TEXT,
  author_did TEXT,
  created_at TIMESTAMP
);

CREATE TABLE feed_posts (
  feed_id TEXT,
  post_cid TEXT,
  score INTEGER,
  PRIMARY KEY (feed_id, post_cid)
);

CREATE INDEX idx_feed_score ON feed_posts(feed_id, score DESC);
```

**Query:**
```sql
SELECT p.* FROM posts p
JOIN feed_posts fp ON p.cid = fp.post_cid
WHERE fp.feed_id = 'urbanism'
ORDER BY fp.score DESC;
```

**Pros:**
- Clean separation
- Easy to add/remove feeds
- Per-feed scoring
- Scales to 1000s of feeds

**Cons:**
- Extra JOIN (slightly slower)
- More storage (but not much)

### My Recommendation: **Option C (Feed Membership Table)**

This is the most flexible and scales best.

---

## 6. P2P / Decentralized Architecture 🚀

### The Vision: Federated Feed Network

```
        Bluesky Firehose
               │
               ▼
    ┌──────────────────────┐
    │   Seed Nodes (3-5)   │  ← Run by you or community
    │  - Full firehose     │  ← High bandwidth
    │  - All keywords      │  ← Expensive servers
    └──────────────────────┘
               │
               ├─────────┬─────────┬─────────┐
               ▼         ▼         ▼         ▼
         ┌─────────┐ ┌─────────┐ ┌─────────┐
         │ Peer A  │ │ Peer B  │ │ Peer C  │
         │Urbanism │ │ Gaming  │ │   Art   │
         └─────────┘ └─────────┘ └─────────┘
               │         │         │
               └─────────┴─────────┘
                       │
                  ┌─────────┐
                  │ Peer D  │  ← Subscribes to A+B
                  │Urban+Game│
                  └─────────┘
```

### How It Works

#### 1. Seed Nodes (Centralized Ingestion)
```
Role: Connect to Bluesky firehose
- Run Aho-Corasick with ALL keywords from all feeds
- Broadcast matched posts to subscribers
- Charge for access ($5-10/month per feed)

Protocol:
- WebSocket or gRPC
- Publish matched posts in real-time
- Include metadata: matched_keywords, score, etc.
```

#### 2. Peer Nodes (Individual Feeds)
```
Role: Subscribe to seed node, store locally
- Receive filtered posts from seed
- Apply own ranking logic
- Serve feed to users
- Can share with other peers

Cost: $5/month (seed subscription) + $10/month (VPS) = $15/month
```

#### 3. Hybrid Nodes (Power Users)
```
Role: Connect directly to firehose + share with others
- Don't pay seed nodes
- Run own filtering
- Become a mini-seed for friends

Cost: $20/month (VPS with bandwidth)
```

### P2P Protocol Design

#### Option 1: ActivityPub-Style Federation
```
Each node has:
- Inbox: Receives posts from other nodes
- Outbox: Sends posts to subscribers
- Following: List of nodes to subscribe to

Example:
Node A (Urbanism) follows Node B (Transit)
Node B publishes post → Node A receives it
Node A can re-rank and show to users
```

#### Option 2: BitTorrent-Style Swarm
```
Posts are content-addressed (by CID)
Nodes announce: "I have posts matching 'urbanism'"
Other nodes request: "Give me posts from last 24h"
DHT for discovery
```

#### Option 3: Nostr-Style Relays
```
Relays (seed nodes) are dumb pipes
Clients (peer nodes) do all filtering
Relays just store and forward
Pay relays for storage/bandwidth
```

### My Recommendation: **Hybrid Model**

```
Tier 1: Seed Nodes (Centralized)
- You run 3-5 seed nodes
- Full firehose ingestion
- Broadcast to subscribers
- Charge $5-10/month per feed

Tier 2: Peer Nodes (Federated)
- Users run their own nodes
- Subscribe to seed OR other peers
- Can share with friends for free
- Economies of scale

Tier 3: Fully Managed (SaaS)
- You host everything
- User just gets a URL
- $50/month
```

### Economics of P2P

**Seed Node Costs:**
- VPS: $100/month (high bandwidth)
- Serves: 100 feeds
- Revenue: 100 × $5 = $500/month
- Profit: $400/month per seed node

**Peer Node Costs:**
- VPS: $10/month (low bandwidth)
- Seed subscription: $5/month
- Total: $15/month
- Can serve unlimited users (just API calls)

**Cost Sharing:**
```
10 friends want urbanism feed:
- One person runs peer node ($15/month)
- Others pay $2/month each
- Total: $15 collected, $15 spent
- Everyone saves money vs. managed hosting
```

---

## Concrete Next Steps

### Phase 1: Proof of Concept (1-2 weeks)
1. Connect to Jetstream
2. Implement Aho-Corasick filtering
3. Save to Postgres (single feed)
4. Basic API endpoint
5. Measure: posts/min, storage, CPU

### Phase 2: Multi-Feed Support (1 week)
1. Implement feed membership table
2. Config system for multiple keyword sets
3. Per-feed scoring
4. Test with 3 feeds (Urbanism, Gaming, Art)

### Phase 3: P2P Protocol (2-3 weeks)
1. Design relay protocol (WebSocket or gRPC)
2. Implement seed node (broadcaster)
3. Implement peer node (subscriber)
4. Test federation between 2 nodes

### Phase 4: Personalization (1-2 weeks)
1. Social graph caching
2. "Already seen" tracking (Bloom filter)
3. Ranking algorithm
4. Cursor pagination

### Phase 5: Polish & Deploy (1 week)
1. Docker Compose setup
2. Documentation
3. Admin UI for keyword management
4. Monitoring/logging

**Total: 6-9 weeks to MVP**

---

## Open Questions

1. **Language choice:** Python (ML-friendly) or Go (performance)?
2. **Seed node protocol:** WebSocket, gRPC, or HTTP SSE?
3. **Keyword management:** Git repo, database, or UI?
4. **User accounts:** Required or optional?
5. **Monetization:** Charge for seed access, managed hosting, or both?
6. **Moderation:** How do we handle spam/abuse in P2P network?

**What do you want to tackle first?**
