### Container flow semantics: IN/OUT labels + root entry pick (2026-04-22)

- **Clarified in UI:** Nodes inside a Group show **IN** / **OUT** (not START/END), with tooltips explaining they are subgraph entry/exit, not Jetstream or Bluesky feed outputs. Inner OUT hides the **Feed** bind button. Root START keeps Jetstream debug affordances.
- **Evaluator:** `pickFlowEntryNode` / `pick_flow_entry_node` now prefer flow sources with **no** `containerParent`, matching jetstream prefilter’s root-START-only contract.

### OUT node: no end-pipeline zoom (2026-04-22)

- **OUT (`containerout`)** no longer opens the sorting/injection/fixed/access pipeline on double-click (that UI is feed-level, canvas **END** only). If navigation state still pointed at an OUT pipeline view, a guard effect pops back to the parent or root.

### Distinct node types `containerin` / `containerout` (2026-04-22)

- **New types:** `containerin` and `containerout` (React components + `nodeTypes` registry) replace inner `start`/`end` inside groups. Root canvas still uses `start` / `end` only.
- **Migration:** Loading/importing graphs rewrites `start`+`containerParent` → `containerin`, `end`+`containerParent` → `containerout`. Legacy ids `start-*` / `end-*` for those nodes remain valid (import id-prefix rule).
- **New group mini-flow:** IDs `containerin-<groupId>`, `containerout-<groupId>`, wired to junction as before.
- **Evaluators:** `graphEvaluator.js`, `flowNodeTypes.js`, `connectionValidation.js`, `costOrderValidation.js`, `edges.js`, `edgeOrder.js`, debug/tree panels; **Python** `engine.py` (`FLOW_TERMINAL_TYPES`, `FLOW_ENTRY_CANDIDATE_TYPES`, anchors, `pick_flow_entry_node`). Jetstream image copies `engine.py` on build.

### Publish / multi-END: ignore inner Group END for feedId (2026-04-22)

- **Issue:** Publish failed with “missing feedId on `end-logicgroup-…`” even when feeds were bound on canvas-level ENDs. Group (logic group) templates include an inner END with `data.containerParent`; validation treated it as a second/third feed output.
- **Fix:** `validateEndFeedMappingBeforePersist` and `_extract_end_feed_map` (assignment worker) only require `feedId` on **top-level** ENDs (`!containerParent`), matching Manage Feeds / `endOutputs`. Aligned delete-feed filter and `isVideoFeedForFeed` with the same rule. Unit test: `test_inner_group_end_ignored_for_feed_mapping`.

### Hashtag / Tags node parity: Jetstream → DB → assignment & debug (2026-04-22)

- **Clarification:** Posts are still parsed from Jetstream with full ATProto `facets` / `tags`. Ingestion writes **`posts.facet_tags`** and **`posts.outline_tags`** (denormalized `TEXT[]`) from that record; assignment and debug often see a **DB row**, not the raw WebSocket payload.
- **Bug:** Hashtag conditions failed for indexed posts and for “Fetch & Test” debug because evaluators expect `facets` / `tags` on the post object, while those paths only forwarded a subset of columns and omitted tag arrays.
- **Fix:** `post_payload.canonical_post_payload` backfills `facets` / `tags` from `facet_tags` / `outline_tags`; `feed.py` Bluesky fallback returns those arrays; `Canvas.jsx` `normalizeDebugPost` maps them for the JS evaluator. Documented in **POST_METADATA.md** (internal subsection under Facets) and **INGESTION.md** (tag columns + graph gate bullet).

### Planned: Image/Video dimension and file-size filtering

- `embed.images[*].aspectRatio` — portrait vs landscape, exact W×H filtering
- `embed.images[*].image.size` — file size threshold filtering (bytes)
- `embed.video.size` — video file size threshold
- `embed.video.aspectRatio` — video orientation filter
- These fields are present in post metadata but no UI node exists yet.
- Defer until a user requests it; add as options on the existing Image / Video nodes rather than new nodes.

---

### Shared list resolver (Author + Mentions)

- Added DB-backed cache tables for external list memberships: `external_list_members` and refresh metadata in `external_list_refresh_state` (`database/migrations/007_external_list_members.sql`).
- Assignment worker now extracts `listUris` from `author` and `mentions` nodes, refreshes stale entries, and evaluates against cached member DIDs.
- Supported list URI types in resolver:
  - `at://.../app.bsky.graph.list/...` (fully resolved via `app.bsky.graph.getList` pagination)
  - `at://.../app.bsky.graph.starterpack/...` (best-effort: sampled users + expansion through embedded list ref when present)
- This enables real list-based matching for both nodes with one shared backend service path.

### Scoring edge-case decision (documented, reversible)

- Direction under discussion: remove per-condition `scoreModifier` from filter nodes and move scoring to dedicated scoring nodes on flow lines.
- Edge-case policy (current product decision): when paths branch/merge, a scoring node should contribute **once per scoring-node id per post**, not once per traversal path.
- Why: prevents accidental score inflation caused by graph topology rather than intent.
- This is explicitly reversible if future ranking design prefers multi-hit traversal scoring.

### Scoring nodes wired (live worker + debugger parity)

- `recency`, `customscore`, and `engagementscore` are now evaluated in worker/runtime scoring (not just UI presence).
- Added `posts` engagement counter columns (`like_count`, `reply_count`, `repost_count`, `quote_count`, `bookmark_count`) in `database/migrations/008_posts_engagement_counters.sql`.
- Current engagement-score behavior uses available counters (or 0 when unavailable) so scoring remains deterministic; enrichment/updater services can refresh these counters over time.

### Engagement counting moved to Jetstream events

- Replaced polling-based engagement refresh with event-driven updates from Jetstream.
- Jetstream now subscribes to `app.bsky.feed.post`, `app.bsky.feed.like`, and `app.bsky.feed.repost`.
- Added `post_engagement_events` table (`database/migrations/010_post_engagement_events.sql`) so delete events (unlike/unrepost/post delete) can safely decrement counters.
- Counter updates only affect posts currently present in `posts`; once purged, updates naturally stop applying.

### Debug panel scope decision

- Debug panel is post-centric: keep per-post snapshot fields (`Saved Engagement`, per-END pass/score/path).
- System-wide live telemetry (`/api/debug/engagement-stats`) is not shown in the post debug panel and is deferred to a separate future admin/status surface.

# Feed Platform Development Progress

> **Started:** 2025-02-25  
> **Status:** 🚧 In Progress  
> **Current Phase:** Core services + assignment engine

**Living sections:** Keep [Assignment engine (v1)](#assignment-engine-v1) updated as work lands (decisions, done, next).

**Session snapshot (2026-04-21):** See [HANDOFF_SESSION_2026-04-21.md](./HANDOFF_SESSION_2026-04-21.md) for detailed handoff (OAuth, feed publishing path, Docker env, next steps).

---

## Assignment engine (v1)

### Goal

One **authoritative** rule evaluator for **Stage 2 assignment** (“does this post belong in this feed?”): **nested containers**, flow + logic wires, junction / AND / OR / N-of, same semantics as the visual editor’s **`graphEvaluator` + `conditionEvaluator`**. Scoring, sorting, injection, and fixed-position modules are **out of scope for v1** (later stages).

### Principles (solid, understandable, hard to get wrong)

| Principle | What it means |
|-----------|----------------|
| **Single saved format** | Store **graph JSON** (`nodes` + `edges`) per feed. No hand-maintained second schema that can drift. |
| **Backend matches debug** | Python evaluator behavior must match the JS reference; **shared JSON fixtures** prove it (same input → same pass/fail and, where exposed, per-node reasons). |
| **Compile is optional** | Internally you may compile the graph to indexes or a normalized structure for speed; **semantics** stay defined by the graph + the shared tests. |
| **Prefilters are approximate** | Cheap checks only **narrow** which feeds get a full run. They must be **safe**: if unsure, include the feed (false positive), never drop a real match (no false negatives). Tuning the prefilter is allowed; **wrong** prefilter logic is not. |
| **Document edge cases** | Junction ports, N-of, exclude flags, container scope — when in doubt, match JS and add a fixture. |

### Prefilters vs full graph (clarification)

**This is not:** “Run a fixed hierarchy (language → keywords → …) and then run the *same* logic again as a second pass because the graph layout doesn’t matter.”

**It is:**

1. **Per feed (offline / on save):** Derive **cheap membership hints** from the graph — e.g. “this feed cares about language X,” “these keyword stems,” “these DIDs/lists,” etc. — whatever you can extract **without** executing the whole junction story. This is **index / summary** work, not a duplicate rules engine.

2. **Per post (hot path):** Use those hints to build a **small set of candidate feeds** that might care about this post (plus global cheap gates like language if you already compute them once).

3. **Per (post, candidate feed):** Run the **full graph evaluator once**. That is the only place that must implement arrows, junctions, N-of, and nested groups correctly.

So: **one** faithful pipeline for “does it match?” Prefilters only **cut down how many times** you invoke it, not replace it. If a post passes the cheap filter for a feed, you still run the **full** graph for that pair — you do **not** rely on a separate “first pass” ordering of conditions that could disagree with the drawn graph.

*Future optimization:* If you prove a prefilter is equivalent to a subgraph, you can document that — but v1 should stay **one semantic evaluator + optional safe narrowing**.

### Ingestion store vs feed membership (aligned product model)

This matches the **START → Junction → END** picture: conditions hang off the junction (and nested groups elsewhere), and you **inspect which condition types exist** when building ingestion shortcuts.

**Layer A — ingestion / DB candidate pool (cheap, ordered heuristics)**  
Examples: **language** first (cheap global gate), then **term / text match** via **Aho-Corasick** (or similar) over stems extracted from relevant nodes. Optionally more node types later.  
**Purpose:** control what you **persist** as worth keeping in the database for downstream work, and **shrink** how often you run the heavy evaluator. This is **not** a second copy of the graph semantics; it is a **practical funnel** derived from the presence/shape of certain nodes.

**Layer B — full graph eval (authoritative)**  
Same saved graph, full **junction / AND / OR / N-of / containers** semantics (parity with debug).  
**Purpose:** what actually **belongs on the feed**, what is **worth enriching**, and final pass/fail. **One** true outcome per `(post, feed)`.

**Retention:** Rows that **never** satisfy full feed logic for any subscribed feed (or whatever policy you choose) can be **discarded or GC’d** so the DB does not grow with useless blobs. Exact policy (TTL vs immediate delete vs “candidate” flag) is an implementation detail.

**Caveat (don’t starve OR branches):** If a feed’s graph has **multiple junction ports / OR paths** and only **some** ports mention keywords, a post might qualify via **another** branch without ever hitting your Aho-Corasick set. Ingestion filters must stay **conservative** for that feed (e.g. union of hints from **all** paths to END, or “if we can’t infer a safe keyword set, include posts more broadly for that feed”). Otherwise you risk **false negatives** at Layer A.

### Flow sources (START vs Manual Posts vs future modules)

- **`start`** — jetstream / firehose-shaped input. **Jetstream prefilters** (`extractJetstreamPrefilterHints` in `services/visual-editor/src/utils/ingestionPrefilterHints.js`) only walk from **root START**, never from Manual Posts, so manual URIs do not affect ingestion indexes.
- **`manualposts`** — curated URIs (`data.posts`). Same condition nodes and full eval; entry chosen with `pickFlowEntryNode` / `postMatchesManualPostsNode` in `graphEvaluator.js`. Does not participate in jetstream prefilter building.
- **Future import modules** — add to `FLOW_SOURCE_TYPES` when implemented; **exclude from jetstream prefilter** unless they represent global firehose input (same rule: don’t mix curated sources into Aho-Corasick scope).

`computeFeedScopedNodeIds` and debug/merge **union reachability** from all **root** flow sources so trees and scope stay correct when both START and Manual Posts exist.

### OR-safe prefilter (implemented in editor JS, port to Python)

`extractJetstreamPrefilterHints` returns **`unsafeToDropForKeywordGate`** / **`unsafeToDropForLanguageGate`**. When `true`, ingestion must **not** drop posts solely for failing keyword or language gates (OR branches or mixed condition types). Backend should mirror the same booleans.

### Parity & fixtures

- **Reference:** `services/visual-editor/src/utils/graphEvaluator.js`, `conditionEvaluator.js` (and related merge/debug helpers if they affect outcomes).
- **Shared fixtures (planned):** e.g. `fixtures/engine/` — `graph.json`, `post.json`, `expected.json` — consumed by **both** JS tests and Python tests.
- **Debug UI** should remain aligned with whatever the backend implements (same rules, same results).

### Checklist — assignment engine

**Done (design / frontend reference)**

- [x] Visual editor graph model + client-side evaluation for debug (`graphEvaluator`, conditions, feed scope for trees).
- [x] Architecture decisions recorded (this file): v1 scope, prefilter story, parity, nested containers in v1.
- [x] Multiple flow sources: START + Manual Posts entry selection; feed scope unions both; `ingestionPrefilterHints.js` OR-safe flags for jetstream.

**Todo — backend**

- [x] Python package/module scaffold for graph evaluation created at `services/feed-assignment-worker/` (initial engine + condition evaluator + fixture test scaffold).
- [ ] Port / reimplement evaluator to match JS semantics; unit tests against shared fixtures.
- [ ] Wire ingestion / worker: candidate selection (prefilters) → full eval per candidate feed; port `extractJetstreamPrefilterHints` semantics + `unsafeToDrop*` rules.
- [ ] Document any intentional differences (should be none unless called out).

**Todo — tests & tooling**

- [x] Create initial fixture set (minimal graphs: AND/OR/N-of baseline) at `fixtures/engine/` consumed by JS + Python tests.
- [x] Add local scripts/tests: `npm run test:engine` (visual-editor) and `python -m unittest discover -s tests -p "test_*.py"` (feed-assignment-worker).

**Deferred (not v1 assignment)**

- [ ] Scoring / sorting / injection / fixed-position evaluation in the same process as assignment (separate stage per `FEED_LOGIC_JSON_SCHEMA.md`).

### Open questions (resolve as implementation starts)

- Where compiled **prefilter indexes** live (DB column vs Redis vs rebuilt on deploy).
- Exact **worker** service boundary (jetstream consumer vs separate assignment worker).

---

## 📋 Development Phases

### Phase 1: Foundation Setup ✅
- [x] Review architecture and legacy code
- [x] Project structure setup
- [x] Docker Compose configuration
- [x] Database schema implementation
- [x] Basic project documentation
- [x] Service template structure (feed-api example)

### Phase 2: Core Services 🔄
- [x] Database connection utilities
- [x] Basic Feed API endpoint (test without ingestion) ✅
- [x] Jetstream ingestion service (built, ready to test) ✅
- [ ] **Assignment / rule evaluation engine (Python)** — see [Assignment engine (v1)](#assignment-engine-v1)

### Phase 3: Feed Management 🔲
- [ ] Feed CRUD operations
- [ ] Visual rule builder backend (persist/export graph JSON)
- [ ] Feed assignment worker (ingestion → eval → `feed_posts`)
- [ ] Pinned/rotating posts

### Phase 4: Module System 🔲
- [ ] Module execution framework
- [ ] Module API contracts
- [ ] Module registry

### Phase 5: Frontend 🔄
- [x] Visual rule builder UI (`services/visual-editor` — graph, debug, trees)
- [ ] Feed management UI
- [ ] Admin dashboard

### Phase 6: Authentication & Multi-user 🔲
- [ ] Bluesky OAuth integration
- [ ] User management
- [ ] Authorization system

---

## 📝 Implementation Log

### 2026-04-20 - Assignment engine v1 planning (progress doc)

- Added [Assignment engine (v1)](#assignment-engine-v1): scope, principles, prefilter vs full-graph clarification, parity/fixtures, checklist, open questions.
- Updated phases (visual-editor in progress; Python engine still todo) and **Current focus** to match.

### 2026-04-20 - Ingestion vs full eval (two layers)

- Documented [Ingestion store vs feed membership](#ingestion-store-vs-feed-membership-aligned-product-model): START/Junction/END, language + Aho-Corasick style funnel for **what to store**, full eval for **what lands on the feed** + enrichment; retention/GC; OR-branch caveat.

### 2026-04-20 - Flow sources + OR-safe prefilters (code)

- `graphEvaluator.js`: `FLOW_SOURCE_TYPES`, `pickFlowEntryNode`, `postMatchesManualPostsNode`, `findRootFlowSourceIds`; `computeFeedScopedNodeIds` accepts multiple seeds; evaluation enters via START or matching Manual Posts URI.
- `ingestionPrefilterHints.js`: `extractJetstreamPrefilterHints` (jetstream-only scope + `unsafeToDropForKeywordGate` / `unsafeToDropForLanguageGate`).
- Tree/debug/merge: feed scope unions root START + Manual Posts.
- `PROGRESS.md`: [Flow sources](#flow-sources-start-vs-manual-posts-vs-future-modules) + [OR-safe prefilter](#or-safe-prefilter-implemented-in-editor-js-port-to-python).

### 2026-04-21 - Assignment engine pass started (backend scaffold)

- Added `services/feed-assignment-worker/` with:
  - `engine.py`: Python graph evaluator scaffold with multi-END execution (`evaluate_graph_multi_end`) and container/junction logic.
  - `condition_eval.py`: condition evaluator coverage for current filter node types.
  - `tests/fixtures/multi_end_sample.json` + `tests/test_engine.py`: initial fixture-style test scaffold.
  - `main.py`: local sample runner for quick smoke checks.
- Added `assignment_worker.py` + `database.py` + `config.py`:
  - first polling loop that reads feeds with graph JSON, evaluates candidate posts, and upserts `feed_posts`.
- Extended engine output contract:
  - per-END `pipeline` payload exposing stage order and configured stage nodes (`sorting -> injection -> fixed -> access`).
- Expanded tests to cover:
  - multi-END results,
  - OR and N-OF branch semantics,
  - pipeline contract shape.
- Added strict END->feed mapping policy in worker:
  - single END can fallback to owning feed id,
  - multi-END requires `end.data.feedId` on every END (otherwise worker skips that feed to avoid ambiguous fanout).
- Current state: executable scaffold + first DB wiring in place; parity hardening and feed-ID mapping for explicit multi-END fanout still pending.

### 2026-04-21 - Feed project foundation (backend + docs)

- Added migration `database/migrations/001_feed_projects.sql`:
  - `feed_projects` table,
  - `feeds.project_id`, `slug`, `avatar_url`, `is_published`,
  - `feeds.assignment_rules_draft` and `feeds.assignment_rules_live`.
- Added feed/project management endpoints in `services/feed-api/projects.py`:
  - list/create projects,
  - list/create feeds under a project,
  - update feed metadata,
  - publish/unpublish with optional draft -> live promotion.
- Wired project router in `services/feed-api/main.py`.
- Updated assignment worker read path (`services/feed-assignment-worker/database.py`) to prefer `assignment_rules_live` and fallback to legacy `assignment_rules`.
- Added `SOURCE_NODES.md` to define source taxonomy, provenance requirements, modular source adapter contract, and "ads only via injection" rule.

### 2026-04-21 - AT Protocol OAuth + session-scoped API

- Browser: `@atproto/oauth-client-browser` + `AuthProvider` / `useAuth`; header sign-in (handle) and session sync to `POST /api/auth/session`.
- feed-api: `auth_routes`, `auth_deps` (JWT cookie `feedgen_session`), `oauth_client` metadata at `/oauth/client-metadata.json`, CORS helper from `APP_PUBLIC_ORIGIN` / `CORS_ORIGINS`.
- `projects` + feed routes require login; rows scoped by `feed_projects.owner_did`.
- Docs: `AUTH.md`; Vite dev proxy adds `/oauth`, `/.well-known`, `/xrpc`.
- docker-compose: `APP_PUBLIC_ORIGIN`, `SESSION_SECRET`, `FORCE_SECURE_COOKIES`, `PUBLIC_BASE_URL` env for feed-api.

### 2026-04-21 - Publish ownership modes clarified (simple vs advanced)

- Documented default publisher model: service-owned publisher account (recommended for simple onboarding, e.g. `@Branch`).
- Added advanced override model: publish with user's own account credentials when desired.
- Updated `register_bluesky_feed.py` env resolution to use `PUBLISH_*` defaults with `BSKY_*` overrides.

### 2026-04-21 - Beta test harness (readiness + smoke)

- Added `GET /api/setup/beta-readiness` (public endpoint checks + data readiness checks for feeds/feed_posts).
- Added `scripts/beta-smoke.sh` to run preflight, beta-readiness, and did.json checks in one command.
- Current VPS status: infra/public checks pass; data checks still fail until at least one feed exists and assignment inserts rows into `feed_posts`.

### 2026-04-21 - Onboarding mode documentation + admin roadmap

- Setup page now explains deployment choices (shared host vs self-hosted domain) alongside preflight checks.
- Added `DEPLOYMENT_MODES.md` to document default shared-host onboarding and advanced self-hosted path.
- Added `ADMIN_APP_ROADMAP.md` to capture planned operator control-plane work (module curation, rate limits, quotas, abuse controls).

### 2026-04-21 - Historical backfill strategy (planned)

- Captured product decision from testing parity with Skyfeed behavior:
  - We will **not** target "store all historical Bluesky posts forever" as the default architecture (storage/cost complexity too high for this project stage).
  - We will plan **query-time backfill** to approximate instant historical population when feed logic changes.
- Planned feature (next iterations):
  - Add a **backfill job** that uses search-based APIs to seed `posts` for a configurable lookback window (for example 7/30 days) using active keyword/topic hints.
  - Re-run assignment sweep after seeding so users see immediate feed population after publish.
- Rationale:
  - Keeps runtime/storage costs bounded.
  - Preserves simple self-host deployment model.
  - Delivers near-instant "new logic shows older matches" UX without full firehose history retention.

### 2026-04-21 - Docker-first onboarding hardening

- Added single-URL config path: `PUBLIC_URL` now derives OAuth (`APP_PUBLIC_ORIGIN`) and did:web (`PUBLIC_BASE_URL`) defaults, with advanced override support.
- Added startup auto-migrations in feed-api boot (`startup_migrations.py`) using `schema_migrations`; Docker image now includes `database/migrations`.
- Added preflight/setup checks: `GET /api/setup/preflight` and setup page at `/setup` (`/api/setup/page`) with pass/fail checks for public URL, DB connectivity, and session secret.
- Added `.env.example` minimal template and updated compose defaults (`PUBLIC_URL`, `POSTGRES_PASSWORD`).

### 2026-04-21 - Prefilter candidate narrowing (worker, first slice)

- Added Python prefilter port `services/feed-assignment-worker/prefilter_hints.py` mirroring editor contract: root `START` scope + `unsafeToDrop` semantics for keyword/language gates.
- Wired `assignment_worker.run_once` to apply safe per-feed candidate narrowing (`post_passes_prefilter`) before full graph eval; added `prefilter_dropped` stat.
- Added persisted prefilter index cache on `feeds.prefilter_hints` with graph digest invalidation (`database/migrations/004_feed_prefilter_hints.sql`, worker cache refresh + `prefilter_cache_updates` stat).
- Worker now uses SQL candidate narrowing per feed (`fetch_candidate_posts_for_feed`) using persisted hints: text stem `ILIKE ANY` and language prefix matching when gates are safe.
- Assignment worker now logs per-feed counters each sweep: `sql_candidates`, `prefilter_dropped`, `evaluated`, `assigned` for easier local tuning.
- Added tests `services/feed-assignment-worker/tests/test_prefilter_hints.py` and `tests/test_prefilter_cache_payload.py` for extraction/gating and cache payload roundtrip.

### 2026-04-21 - Extracted post metadata columns (for granular node/filter control)

- Added migration `database/migrations/006_posts_extracted_metadata.sql` to split commonly-used metadata into indexed columns while keeping `record_json` canonical.
- Ingestion now parses and stores additional fields on `posts`:
  - facets links/tags (`facet_link_uris`, `facet_tags`)
  - outline tags (`outline_tags`)
  - embed external card fields (`embed_external_uri/title/description`, thumb mime/size)
  - image/video alt + video media metadata (`embed_images_alt_texts`, `embed_video_*`)
  - quote-media fields (`embed_media_images_alt_texts`, `embed_media_external_*`)
  - bridged original text (`bridgy_original_text`)
- Kept ingestion prefilter scope intentionally conservative (text/language driven).

### 2026-04-21 - Text keyword boundary semantics (design decision)

- Added per-keyword boundary control for text nodes: each keyword can now set `wholeWord` true/false.
- **Authoritative matching:** full evaluator enforces boundary semantics exactly (word-boundary regex when `wholeWord=true`; substring when false).
- **Ingestion prefilter behavior:** remains conservative and uses raw keyword stems only (does not enforce whole-word boundaries), to avoid false negatives during candidate narrowing.
- Data shape update for text node keywords:
  - legacy: `["banana", "cat"]`
  - new: `[{"value":"banana","wholeWord":true},{"value":"cat","wholeWord":false}]`
  - both formats are accepted during transition.

### 2026-04-21 - Mentions node matching update

- Mentions matching now supports both:
  - mention DIDs from facets (`facets[*].features[*].did`)
  - mention handles when present in facet payload (`handle` / `displayHandle`)
- `listUris` for mentions are now explicitly treated as unimplemented (no fake-positive behavior).
- UI hint updated to clarify list URI matching is future work pending backend list resolution.

### 2026-04-21 - Shared fixture parity harness (JS + Python)

- Added shared fixtures in `fixtures/engine/`: `and_ports_pass.json`, `or_one_branch_pass.json`, `nof_fails_threshold.json`.
- Added JS runner `services/visual-editor/tests/engine-fixtures.test.js` + npm script `test:engine` to validate `graphEvaluator` against shared fixtures.
- Added Python parity test `services/feed-assignment-worker/tests/test_fixture_parity.py` against the same fixture files.

### 2026-04-21 - Local dev path (click-through + migrations)

- **`AUTH.md`**: expanded local steps — Postgres (Compose), migrations, feed-api env on port 8001, Vite on 3000; Docker one-liner for `migrate.py` when the host has no pip.
- **`database/requirements.txt`**: `asyncpg` for `database/migrate.py`.
- **`scripts/dev-migrate.sh`**: runs migrations with default `DATABASE_URL` matching host port 5440.

### 2026-04-21 - Single-origin UI in feed-api (Docker)

- **`UI_STATIC_ROOT`** in `config.py`: when set to a directory with `index.html`, `main.py` serves the built visual editor at `/` and `/assets`, with a catch-all for SPA deep links; otherwise `/` remains JSON metadata.
- **Multi-stage `services/feed-api/Dockerfile`**: Node builds `services/visual-editor`, Python stage copies `dist` to `/app/ui`.
- **`docker-compose`**: `feed-api` build `context: .`, `dockerfile: services/feed-api/Dockerfile`.
- **`.dockerignore`** at repo root to keep build context lean.

### 2026-04-21 - Bluesky feed publishing path

- `feed-api`: `GET /.well-known/did.json` (`well_known.py`) for `did:web` + `PUBLIC_BASE_URL`.
- `feed-api`: `getFeedSkeleton` resolves generator rkey as UUID, 32-hex undashed UUID, or `feeds.slug`.
- Migration `database/migrations/003_feed_bluesky_uri.sql`: optional `feeds.bluesky_feed_uri`.
- `services/feed-api/scripts/register_bluesky_feed.py`: creates `app.bsky.feed.generator` via app password; stores URI when successful.
- Docs: `PUBLISH_FEEDS.md`.

### 2025-02-25 - Project Initialization
- ✅ Reviewed PLATFORM_PLAN.md architecture
- ✅ Reviewed legacy ingestion-test code (learned Jetstream connection is credential-free)
- ✅ Reviewed legacy visual-builder (concepts only, not code)
- ✅ Created progress tracking document
- ✅ Created project directory structure (services, database, shared)
- ✅ Set up Docker Compose with PostgreSQL 16 and Redis 7
- ✅ Created complete database schema (15+ tables with indexes)
- ✅ Created service template structure (feed-api as example)
- ✅ Created README.md and project documentation
- ✅ Changed PostgreSQL port to 5440 (external) to avoid conflicts
- ✅ Changed Redis port to 6380 (external) to avoid conflicts
- ✅ Changed feed-api port to 8001 (external) to avoid conflicts
- ✅ Tested Docker setup - all services running, database schema loaded successfully
- ✅ Created FEED_API_EXPLANATION.md and RULE_EVALUATION_EXPLANATION.md
- ✅ Built feed API endpoint (`/xrpc/app.bsky.feed.getFeedSkeleton`)
- ✅ Implemented feed URI parsing, database queries, sorting by score
- ✅ Added pinned posts support
- ✅ Implemented cursor-based pagination
- ✅ Tested with test data - endpoint working correctly!
- ✅ Created keywords.txt placeholder file (80+ keywords)
- ✅ Built Jetstream ingestion service with Aho-Corasick filtering
- ✅ Implemented English-only language filtering (langdetect)
- ✅ Added cursor tracking for resuming after restart
- ✅ Implemented batch processing (100 posts per commit)

---

## 🎯 Current Focus

**Next steps (see checklist in [Assignment engine (v1)](#assignment-engine-v1)):**
1. Expand shared fixture coverage (junction edge-cases, nested containers, exclude variants).
2. Close remaining **Python evaluator** parity gaps against those fixtures.
3. **Prefilter/index** design per feed + ingestion path that calls full eval only for candidates.
4. Continue **Jetstream / ingestion** hardening as needed in parallel.

---

## 📊 Metrics

- **Lines of Code:** ~1000
- **Services Created:** 2/8 (feed-api ✅, jetstream-ingestion ✅)
- **Database Tables:** 15+ (schema complete)
- **API Endpoints:** 3 (root, health, feed_skeleton)
- **Test Data:** 1 feed, 3 posts
- **Keywords:** 80+ placeholder keywords in keywords.txt

---

## 🔍 Key Decisions

- **Language:** Python 3.11+ with FastAPI (confirmed)
- **Database:** PostgreSQL 16 (confirmed)
- **Deployment:** Docker Compose v2 (confirmed)
- **Jetstream:** No credentials needed - WebSocket URL only
- **Visual Builder:** `services/visual-editor` — graph JSON is source of truth; backend evaluator must match debug
- **Assignment v1:** Stage 2 only; nested containers in scope; prefilters narrow candidate feeds, **full graph runs once per (post, feed)** for correctness
- **Post field contract:** `POST_METADATA.md` is the canonical metadata reference for node/evaluator field design. Treat Graze-specific `hydrated_metadata.*` sections as out-of-scope unless explicitly implemented for this project. In alpha, evaluator/runtime now targets canonical ATProto-style fields (not legacy alias compatibility).

---

## ⚠️ Blockers & Notes

- None currently

---

## 📚 Reference

- Architecture: `PLATFORM_PLAN.md`
- Assignment engine notes: [Assignment engine (v1)](#assignment-engine-v1) (this file)
- Feed logic schema: `FEED_LOGIC_JSON_SCHEMA.md`
- Legacy code: `legacy/ingestion-test/` (for reference only)
- Visual builder concepts: `legacy/visual-builder/` (for reference only)
- Post metadata contract: `POST_METADATA.md` (canonical field names; ignore Graze hydrated sections unless explicitly scoped in)
