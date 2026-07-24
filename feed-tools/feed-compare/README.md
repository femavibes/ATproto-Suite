# feed-compare

A/B comparison tool for Bluesky feed generators. Compare two feeds to see which posts are shared, unique, how rankings differ, and track changes over time via snapshots.

Part of [ATproto-Suite](https://github.com/femavibes/ATproto-Suite).  
Lives at `/root/ATproto-Suite/feed-tools/feed-compare` on CT 180.  
Running at `http://192.168.0.180:3500`.

---

## File Map

```
feed-compare/
  server.js               — startup only, mounts route files
  package.json            — dependencies: express, fast-xml-parser
  routes/
    compare.js            — feed fetching, parsing, comparison logic, profiles, settings routes
    snapshots.js          — snapshot save/load/delete, auto-snapshot sessions, timer management
  public/
    index.html            — main compare page (shell HTML)
    snapshots.html        — snapshot browser + timeline page (shell HTML)
    utils.js              — shared: api(), escHtml(), esc(), bskyPostUrl(), authorBits()
    app.js                — main compare page logic
    snapshots.js          — snapshot browser + timeline logic
    style.css             — all styles, shared across both pages
  data/                   — gitignored, created at runtime
    profiles.json         — saved feed profiles
    settings.json         — app settings
    sessions.json         — auto-snapshot sessions
    snapshots/            — one .json file per snapshot
```

---

## Routes (`routes/compare.js`)

**Feed input formats accepted:**
- `https://bsky.app/profile/<did-or-handle>/feed/<slug>`
- `at://did:plc:.../app.bsky.feed.generator/<slug>`
- RSS / Atom / JSON Feed URLs (fallback)

**Key functions:**
- `toFeedAtUri(input)` — normalizes any input to `at://` URI, resolves handles to DIDs
- `fetchFeedMeta(atUri)` — calls `app.bsky.feed.getFeedGenerator`, returns displayName, description, creator
- `fetchBskyFeed(atUri, limit)` — paginates in batches of 100 (API max), de-dupes by URI
- `compareFeeds(a, b)` — matches by post URI, annotates with `matched`, `positionDelta`
- `normalizeXmlFeed(raw)` — RSS/Atom/JSON Feed fallback parser

**API routes:**
- `POST /api/compare` — `{ feedA, feedB, limit }` — returns annotated posts, stats, feed metadata
- `GET /api/profiles` — list saved profiles
- `POST /api/profiles` — create profile
- `DELETE /api/profiles/:id` — delete profile
- `GET /api/settings` — read settings
- `POST /api/settings` — write settings

---

## Routes (`routes/snapshots.js`)

Snapshots store the full compare result (all post data) at a point in time.  
Sessions are named auto-snapshot runs that fire on a timer and stop at a max count.

**API routes:**
- `GET /api/snapshots` — list all snapshot summaries (no full result data)
- `GET /api/snapshots/:id` — load a full snapshot
- `POST /api/snapshots` — `{ profileId, feedA, feedB, limit, label }` — take a manual snapshot
- `DELETE /api/snapshots/:id` — delete snapshot, remove from any session
- `GET /api/sessions` — list sessions
- `POST /api/sessions` — `{ profileId, name, feedA, feedB, limit, intervalMs, maxSnapshots }` — create session
- `DELETE /api/sessions/:id` — delete session (snapshots kept)
- `POST /api/sessions/:id/start` — start auto-snapshot timer
- `POST /api/sessions/:id/stop` — stop timer
- `GET /api/sessions/running` — list currently running session IDs

**Timer behavior:** uses recursive `setTimeout` (not `setInterval`) — re-reads snapshot count from disk before each shot, stops exactly at `maxSnapshots`.

---

## Frontend

### `public/utils.js` — shared by both pages
- `api(method, path, body)` — fetch wrapper
- `escHtml(s)` / `esc(s)` — XSS helpers
- `bskyPostUrl(item)` — converts `at://` URI to bsky.app URL
- `window._authorBits(author, highlightFn)` — renders author as bsky.app link + `[highlight]` span

### `public/app.js` — main compare page
**State:** `fullData`, `viewMode`, `highlightedAuthor`, `lastProfileId`

**Key functions:**
- `runCompare()` — fetches and renders a fresh compare
- `runRefresh()` — re-runs with same feeds, updates view
- `saveSnapshot()` — saves current result as a manual snapshot
- `startAutoSession()` — prompts for name, creates + starts a session, redirects to snapshots page
- `renderResults()` — builds feed headers, stats bar, legend, post view
- `postCard(item, cls, showDelta)` — single post card; `showDelta=false` in By Author view
- `renderSideBySide(a, b)` — row-paired grid so A/B cards at same index share height
- `renderMerged(a, b)` — matches first (newest first), then A-only, then B-only
- `renderAuthorGrouped(a, b)` — grouped by author: shared first (most posts desc), then A-only, B-only

### `public/snapshots.js` — snapshot browser page
**State:** `allSnaps`, `allSessions`, `allProfiles`, `runningSessions`, `selectedIds`

**Key functions:**
- `refresh()` — reloads all data, re-renders everything; called on init and every 5s when sessions are running
- `renderSessions()` — lists sessions with running/complete/stopped status, profile name, progress
- `createSession()` — creates and immediately starts a session
- `renderSnapList()` — filterable by profile, selectable for timeline comparison
- `compareSelected()` — loads 2+ selected snapshots into timeline view
- `loadSession(id)` — loads all snapshots from a session into timeline view
- `renderTimeline(snaps, title)` — stats-over-time table + top position movers table

---

## Features

- Accepts bsky.app URLs, `at://` URIs, or handles — resolves automatically
- Fetches 100 posts per API call (max), paginates with cursor, de-dupes within each feed
- Matches posts by URI, computes % diff using Feed A as base
- Position delta on matched posts (how many spots a post moved between feeds)
- **Side by Side** — served order, row-paired so cards always align
- **Merged** — single list, matches first then unique, newest first
- **By Author** — grouped by author, shared authors first sorted by post count
- Feed name, description, creator shown above each column
- Click post to open on bsky.app; click author to highlight across all cards
- Avg likes per feed in stats bar
- Saved profiles with confirm-on-delete
- **Snapshots** — save any compare result with a label, attached to a profile
- **Auto-snapshot sessions** — named runs, configurable interval and max count, auto-stop
- **Timeline view** — select 2+ snapshots, see stats over time + top position movers

---

## Running

```bash
# start (detached)
nohup node /root/ATproto-Suite/feed-tools/feed-compare/server.js > /tmp/feed-compare.log 2>&1 &

# logs
cat /tmp/feed-compare.log

# stop
kill $(ss -tlnp | grep 3500 | grep -oP 'pid=\K[0-9]+')
```
