# feed-compare

A/B comparison tool for Bluesky feed generators. Compare two feeds side by side to see which posts are shared, unique, and how rankings differ.

Lives at `/root/feed-compare`, sibling to `/root/fema-feeds`.
Running on CT 180 at `http://192.168.0.180:3500`.

---

## File Map

```
/root/feed-compare/
  server.js           — Express server: feed fetching, parsing, comparison logic, all API routes
  package.json        — dependencies: express, fast-xml-parser
  data/
    profiles.json     — saved feed profiles (name, feedA, feedB, limit)
    settings.json     — app settings (defaultLimit)
  public/
    index.html        — shell HTML, links to style.css and app.js
    style.css         — all styles, CSS variables, component layout
    app.js            — all frontend logic: rendering, API calls, state
```

---

## Server (`server.js`)

**Feed input formats accepted:**
- `https://bsky.app/profile/<did-or-handle>/feed/<slug>`
- `at://did:plc:.../app.bsky.feed.generator/<slug>`
- RSS / Atom / JSON Feed URLs (fallback)

**Key functions:**
- `toFeedAtUri(input)` — normalizes any input format to an `at://` URI, resolves handles to DIDs if needed
- `fetchFeedMeta(atUri)` — calls `app.bsky.feed.getFeedGenerator`, returns displayName, description, creator
- `fetchBskyFeed(atUri, limit)` — paginates in batches of 100 (API max), de-dupes by URI within each feed
- `compareFeeds(a, b)` — matches by post URI, annotates each post with `matched`, `positionDelta`
- `normalizeXmlFeed(raw)` — RSS/Atom/JSON Feed fallback parser

**API routes:**
- `POST /api/compare` — body: `{ feedA, feedB, limit }` — returns annotated posts + stats + feed metadata
- `GET/POST /api/profiles` — list or create saved profiles
- `DELETE /api/profiles/:id` — delete a profile
- `GET/POST /api/settings` — read or write settings

---

## Frontend (`public/app.js`)

**State:**
- `fullData` — last compare result from the API
- `viewMode` — `'sidebyside'`, `'merged'`, or `'byauthor'`
- `highlightedAuthor` — handle string or null, highlights that author across all cards

**Key functions:**
- `runCompare()` — reads inputs, calls `/api/compare`, stores result, calls `renderResults()`
- `runRefresh()` — re-runs compare with same feeds, appears after first compare
- `renderResults()` — builds feed headers, stats bar, post view, author overlap section
- `postCard(item, cls)` — renders a single post card with position, delta badge, author bits
- `authorBits(author)` — renders author as highlight-only span + separate `[profile]` link
- `renderSideBySide(a, b)` — two-column layout, posts in served order
- `renderMerged(a, b)` — single list: matches first (newest first), then A-only, then B-only
- `renderAuthorGrouped(a, b)` — groups posts by author: shared authors first (most posts desc, newest tiebreaker), then A-only authors, then B-only authors

---

## Features

- Accepts bsky.app URLs or `at://` URIs, resolves handles automatically
- Fetches in 100-post batches with cursor pagination, de-dupes within each feed
- Matches posts by URI (exact), computes % difference using Feed A as base
- Position delta on matched posts: how many positions a post moved between feeds
- Three view modes: Side by Side (served order), Merged (matches first, newest first), By Author (grouped by author, shared authors first sorted by post count)
- Feed name, description, creator shown above each column
- Click any author to highlight them across all visible cards
- Click any post card to open it on bsky.app
- Saved profiles (name, feedA, feedB, limit) stored in `data/profiles.json`
- Settings (default display count) stored in `data/settings.json`

---

## Running

```bash
# start (detached)
nohup node /root/feed-compare/server.js > /tmp/feed-compare.log 2>&1 &

# logs
cat /tmp/feed-compare.log

# stop
kill $(ss -tlnp | grep 3500 | grep -oP 'pid=\K[0-9]+')
```
