# Feed Ingestion & Graph Evaluation System

## Overview

Posts arrive from the Bluesky firehose via [Jetstream](https://github.com/bluesky-social/jetstream). Before being stored, each post is evaluated against the live feed graphs. Only posts that could match at least one feed are indexed. The assignment worker then re-evaluates all indexed posts continuously against each feed graph to determine final placement and scoring.

```
Bluesky Jetstream
      │
      ▼
jetstream-ingestion  ──► [graph gate]  ──► posts table
                                               │
                                               ▼
                                    feed-assignment-worker  ──► feed_posts table
                                               │
                                               ▼
                                         feed-api (served to Bluesky)
```

---

## Jetstream Ingestion Service

### Entry point
`services/jetstream-ingestion/worker.py` — connects to the Jetstream WebSocket, receives every `app.bsky.feed.post`, `like`, and `repost` event.

### Post processing pipeline

When `INGESTION_GRAPH_MATCH=true` (recommended):

```
1. Receive post from Jetstream WebSocket
2. Skip empty posts (no text)
3. Normalize langs field  (_normalize_atproto_langs)
      Jetstream delivers langs in inconsistent shapes (string, list, dict).
      Always normalized to List[str].
4. Run graph gate  (post_matches_any_graph)
      Evaluate post against all live feed graphs.
      If no graph matches → discard. Post never enters the DB.
      If any graph matches → continue.
5. Augment langs with langdetect fallback  (augment_post_row_for_graph_eval)
      Many Jetstream records omit langs entirely.
      If langs is empty, run langdetect on the post text (~0.5–2ms).
      Result stored on both post_data.langs and record_json.langs.
6. Save to posts table (see **Tag columns** below)
7. Batch commit (every 50 posts or on flush timer)
```

### Tag columns on `posts` (Jetstream record → denormalized storage)

Jetstream still delivers the full `app.bsky.feed.post` record. Ingestion does **not** rely on the DB row alone during the live WebSocket receive path; it parses `facets` and `tags` from that record and persists:

- **`facet_tags`** — hashtag strings from facet tag features (no `#`)
- **`outline_tags`** — strings from `record.tags`

Later stages (assignment worker, `/debug/post` for an indexed post) read **`SELECT * FROM posts`**. The evaluator expects ATProto-shaped `facets` and `tags` on the dict passed into the engine, so **`post_payload.canonical_post_payload`** (assignment) and the visual editor’s **`normalizeDebugPost`** (debug) **rebuild** `facets` / `tags` from those two arrays when a full `record_json` is not present. Fixes that mention the “database” mean this **stored row shape**, not that hashtags were invented server-side.

When `INGESTION_GRAPH_MATCH=false` (legacy mode):

```
1. Receive post
2. Skip empty posts
3. Aho-Corasick keyword prefilter  (global keywords.txt)
4. Language check  (must contain "en" in langs)
5. Save to posts table
```

> **Why graph mode skips keyword/language prefilters:** A feed that uses only a regex node (no text/language nodes) would never index any posts if the global keyword filter ran first — it would reject everything before the graph ever sees it.

---

## Graph Gate (`graph_match.py`)

### Feed graph cache

Graphs are loaded from the database every `INGESTION_FEED_GRAPH_CACHE_SECONDS` (default: 60s). Each refresh:

1. Fetches `assignment_rules_live`, `assignment_rules_draft`, `assignment_rules` for all feeds
2. Picks the first parseable visual graph per feed (live → draft → legacy)
3. Collects all `listUris` referenced in `author` and `mentions` nodes
4. Loads resolved list members from `external_list_members` (no API calls — reads local DB)
5. Stores graphs + resolved members in `FeedGraphCache`

```python
# Log output on each refresh:
ingestion graph gate: loaded 2 feed graph(s), 3 list(s) resolved (847 total members)
```

### Evaluation

`post_matches_any_graph(post_row, graphs, resolved_members)`:

- Builds a canonical ATProto-shaped post dict from `record_json` when present, otherwise from DB columns including **`facet_tags` / `outline_tags`** merged into `facets` / `tags` via `canonical_post_payload`
- Injects resolved list members into `__resolved_list_members`
- Strips nodes that are meaningless at ingest time (`engagement`, `engagementscore`)
  — engagement metrics are always 0 on fresh posts; leaving them in would silently block every post
- Calls `evaluate_graph_multi_end` on each feed graph
- Returns `True` if the post passes **any** END on **any** graph

### Multi-END / branching

A graph can have multiple paths from START to different END nodes. The post passes if it reaches **any** END. Paths are evaluated independently — failing one branch does not affect other branches.

```
START ──► Junction A ──► END 1    (lang=en AND keyword=banana)
     └──► Junction B ──► END 2    (author in allowlist)
```
A post matching either path gets indexed.

---

## Graph Evaluation Engine (`engine.py` / `graphEvaluator.js`)

The same engine runs in three places:
- `feed-assignment-worker/engine.py` — assignment (Python, authoritative)
- `jetstream-ingestion/assign_mirror/engine.py` — ingest gate (copy of above)
- `visual-editor/src/utils/graphEvaluator.js` — visual debugger (JavaScript mirror)

### Evaluation order (cost tiers)

Within each junction, child conditions are sorted by cost before evaluation:

| Tier | Nodes | Rationale |
|------|-------|-----------|
| **0** | `customscore`, `recency`, `engagementscore` | Always pass; purely score modifiers |
| **1** | `language`, `posttype`, `poststructure`, `dateage`, `image`, `video`, `media` | Single field reads or boolean checks |
| **2** | `text`, `hashtag`, `mentions`, `links`, `labels`, `author`, `engagement` | Array iteration / facet walks |
| **3** | `regex` | Regex engine — most expensive |

**This reordering is automatic.** The engine sorts junction children by tier before evaluating, regardless of visual node placement. Users do not need to manually order conditions within a junction.

### Short-circuit

- **AND junction**: stops evaluating remaining conditions as soon as one **fails**
- **OR junction**: stops evaluating remaining conditions as soon as one **passes**
- **N-of-M junction**: stops as soon as N have passed or enough have failed to make N impossible
- **Flow spine** (junction-to-junction): evaluated in visual order; the UI cost-order banner warns when an expensive junction appears before a cheap one

### Edge format compatibility

The engine accepts logic edges in both formats:
- Visual editor export: `{type: "logic", logic: "or"}`
- Database format: `{logicType: "or", sourceHandle: "logic-bottom", targetHandle: "logic-top"}`

Both `logic` and `logicType` keys are read when determining AND/OR mode.

### Condition-to-condition logic (e.g. `regex OR text`)

A condition can wire its output into another condition via a logic edge before that condition connects to a junction. Example:

```
regex-1 ──[OR]──► text-1 ──[AND]──► junction-main
```

`evaluate_condition_with_incoming_edges` handles this: it evaluates the target condition (`text-1`) then combines with all upstream logic edges using their AND/OR mode. Cheaper upstream conditions are evaluated first (cost-ordered).

---

## Condition Nodes — What They Evaluate

All condition nodes share an **include/exclude** toggle. When set to exclude, a match causes failure and a non-match causes pass.

### Field path resolution

Both `text` and `regex` nodes can search any combination of these fields:

| Field path | Content |
|------------|---------|
| `text` | Post text |
| `embed.images[*].alt` | Alt text from all images |
| `embed.alt` | Video alt text |
| `embed.media.images[*].alt` | Alt text from images in quote-with-media |
| `embed.external.uri` | Link card URL |
| `embed.external.title` | Link card title |
| `embed.external.description` | Link card description |
| `embed.media.external.uri/title/description` | Link fields in quote-with-media |
| `facets[*].features[*].uri` | URLs in facets |
| `facets[*].features[*].tag` | Hashtags in facets |
| `tags[*]` | Bluesky outline tags / bridged platform tags |
| `bridgyOriginalText` | Original text from bridged platforms |

The `[*]` wildcard extracts values from all items in an array, including nested arrays (`facets[*].features[*].tag` walks every facet and every feature within it).

### `recordWithMedia` handling

Quote posts with attached images/video use `embed.media.images` / `embed.media.video` / `embed.media.$type` rather than `embed.images` / `embed.video` / `embed.$type`. All image, video, and media nodes check both paths.

### Node-by-node status at ingest

| Node | Tier | Works at ingest | Notes |
|------|------|-----------------|-------|
| `language` | 1 | ✅ | `langdetect` fallback when `langs` missing |
| `posttype` | 1 | ✅ | reply/quote/post from reply block + embed type |
| `poststructure` | 1 | ✅ | is_reply, is_quote, has_quote |
| `dateage` | 1 | ✅ | `createdAt` always present on record |
| `image` | 1 | ✅ | `embed.images` + `embed.media.images` |
| `video` | 1 | ✅ | `embed.video` + `embed.media.video` |
| `media` | 1 | ✅ | Detects images/video/link/quote; checks `embed.media.*` for quote-with-media |
| `text` | 2 | ✅ | Substring search across configured fields |
| `hashtag` | 2 | ✅ | Set intersection on `tags` + facets |
| `mentions` | 2 | ✅ (DIDs only) | Walks facets. List members resolved from DB. Handle strings in node config not yet auto-resolved to DIDs. |
| `links` | 2 | ✅ | Facet URIs + `embed.external.uri` |
| `labels` | 2 | ⚠️ | Wired; labels rarely present at ingest (applied later by labelers) |
| `author` | 2 | ✅ (DIDs + lists) | Direct DIDs always work. List members resolved from `external_list_members` DB table. |
| `engagement` | 2 | ❌ stripped | Metrics are 0 at ingest. Stripped from ingest graph to prevent silent blocking. Works normally in assignment worker. |
| `regex` | 3 | ✅ | Full regex engine across configured fields |
| `customscore` | 0 | ✅ (always pass) | Score modifier only; ignored at ingest |
| `recency` | 0 | ✅ (always pass) | Score modifier only; ignored at ingest |
| `engagementscore` | 0 | ✅ (always pass) | Score modifier only; stripped at ingest alongside `engagement` |

---

## List & Author Resolution

### How lists are kept fresh

The **assignment worker** is responsible for syncing list membership from the Bluesky API. On each sweep:

1. Scans all graph nodes for `listUris` in `author` and `mentions` nodes
2. For each list URI, checks if the cache is stale (`external_list_refresh_state`)
3. If stale: calls `app.bsky.graph.getList` (paginated), stores result in `external_list_members`
4. Also supports starter packs (`app.bsky.graph.starterpack`)

The **ingest gate** reads from `external_list_members` at every graph cache refresh (every 60s by default). It never calls the Bluesky API directly — all list data is read from the local DB.

### Database tables

```sql
-- One row per (list, member). Source of truth for all list evaluations.
external_list_members (
    list_uri    TEXT,
    member_did  TEXT,
    member_handle TEXT,   -- stored for reference; evaluation uses DIDs only
    source_type TEXT,     -- "list", "starterpack", or "error"
    refreshed_at TIMESTAMPTZ
    PRIMARY KEY (list_uri, member_did)
)

-- One row per tracked list. Tracks sync status.
external_list_refresh_state (
    list_uri          TEXT PRIMARY KEY,
    last_refreshed_at TIMESTAMPTZ,
    last_error        TEXT,
    updated_at        TIMESTAMPTZ
)

-- Internal user-created lists (separate from Bluesky external lists)
user_lists (
    id          UUID PRIMARY KEY,
    owner_did   TEXT,
    name        TEXT,
    members     TEXT[]   -- DIDs
)
```

### Update latency

List changes on Bluesky side are not instant. A user added to a list will appear in feed results within one assignment worker sweep cycle. This is intentional — immediate consistency would require API calls on the hot path.

---

## Assignment Worker

The assignment worker continuously re-evaluates indexed posts against all feed graphs and updates `feed_posts`.

- Runs a sweep every cycle over a batch of recent posts (`ASSIGNMENT_BATCH_SIZE`)
- Clears and rebuilds `feed_posts` each sweep (prevents stale assignments from old graph versions)
- Resolves list members (with TTL-based refresh from Bluesky API)
- Evaluates using the same engine as the ingest gate
- Writes `base_score` (sum of all scoring node modifiers: `customscore`, `recency`, `engagementscore`) to `feed_posts`
- Posts are sorted by `base_score DESC, assigned_at DESC` in the feed API

Because the feed is continuously rebuilt, graph changes take effect on the next sweep without any manual action. Posts that no longer match are removed. New posts that now match are added.

---

## Feed API Pagination

The feed API (`/xrpc/app.bsky.feed.getFeedSkeleton`) uses a cursor-based pagination scheme:

```
cursor format: "{base_score}:{ISO-timestamp}:{post_cid}"
example:       "100:2026-04-22T01:29:40.277000:bafyreia..."
```

The timestamp component contains colons (ISO format), so the cursor is parsed by splitting on the **first** colon (score) and **last** colon (cid), with everything in between as the timestamp.

---

## Configuration

| Environment variable | Default | Effect |
|---------------------|---------|--------|
| `INGESTION_GRAPH_MATCH` | `false` | Enable graph gate (recommended: `true`) |
| `INGESTION_FEED_GRAPH_CACHE_SECONDS` | `60` | How often to reload graphs + list members from DB |

Set in the repo root `.env` file. Docker Compose passes them through to the `jetstream-ingestion` container.

---

## UI Cost-Order Warning

The visual editor shows a red banner on nodes (and a red outline) when a more expensive condition appears **before** a cheaper one along the flow spine.

**What it checks:** traces each flow path from START to every END. At each step, compares the cost tier of the current junction's conditions against the previous junction's conditions. Flags any junction that is cheaper than a predecessor.

**What it does NOT check:** condition ordering *within* a junction — the engine reorders those automatically.

**The banner does not block saving.** It is advisory. A graph with cost-order warnings still works correctly; the warning just indicates a performance improvement opportunity (moving cheaper filters earlier means more posts are rejected before expensive work runs).
