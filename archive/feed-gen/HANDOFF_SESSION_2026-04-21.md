# Session handoff — 2026-04-21

This document records **what was built and decided** across recent work so the next session can continue without re-deriving context. It complements **`PROGRESS.md`** (living checklist) and the focused guides **`AUTH.md`** and **`PUBLISH_FEEDS.md`**.

---

## 1. Product direction (stable)

- **Target deployment**: Self-hosted on a VPS (or similar), **not** a large multi-tenant SaaS. Operators run **Docker** (or similar) for people who build feeds; **ingestion does not have to run on the maintainer’s servers** (cost/risk control).
- **UX goal**: **Plug-and-play** after install: open the **web UI (React visual editor)**, **sign in with Bluesky (OAuth)**, manage **feed projects / feeds / graph logic** there—not only via CLI.
- **Auth model (now)**: **Single user per session**; **`feed_projects.owner_did`** scopes data. **Multi-user collaboration / roles** is explicitly **future (v2)**.
- **Bluesky ownership**: Feeds are **published under the Bluesky account that creates the `app.bsky.feed.generator` record**; the app helps with **service endpoint + DID document**, not impersonation.

---

## 2. Data model (database)

Migrations live under **`database/migrations/`** (apply in order; a simple runner exists as **`database/migrate.py`**—requires `asyncpg` in the environment).

| Migration / area | What it adds |
|------------------|----------------|
| **`001_feed_projects.sql`** | `feed_projects` table; `feeds.project_id`, `slug`, `avatar_url`, `is_published`, `assignment_rules_draft`, `assignment_rules_live`; backfill draft/live from legacy `assignment_rules`. |
| **`002_project_logic_columns.sql`** | `feed_projects.assignment_rules_draft` / `assignment_rules_live` for **project-level** graph snapshots (draft vs live). |
| **`003_feed_bluesky_uri.sql`** | Optional `feeds.bluesky_feed_uri` after registering the generator on Bluesky. |

**Authoritative graph JSON** remains **`{ nodes, edges, ... }`** as used by the visual editor and the Python worker.

---

## 3. Backend — `services/feed-api` (FastAPI)

### 3.1 Core responsibilities

- **Public AT Proto**: **`GET /xrpc/app.bsky.feed.getFeedSkeleton`** — reads **`feed_posts`** (+ pinned posts), returns post URIs; must stay **unauthenticated** for Bluesky clients.
- **DID document**: **`GET /.well-known/did.json`** (`well_known.py`) — **`did:web`** for the host derived from **`PUBLIC_BASE_URL`**. Required for Bluesky to resolve the **feed generator service** when using custom hosted feeds.
- **OAuth client metadata**: **`GET /oauth/client-metadata.json`** (`oauth_client.py`) — AT Proto OAuth **`client_id`** must equal the **full URL** of this JSON. Built from **`APP_PUBLIC_ORIGIN`** (must match the **exact browser origin** where the UI is served).
- **Session auth** (after browser OAuth):
  - **`POST /api/auth/session`** — body `{ accessJwt, tokenType? }`; verifies token (see below), sets **`feedgen_session`** HttpOnly cookie (JWT via **PyJWT** / **`SESSION_SECRET`**).
  - **`GET /api/auth/me`**, **`POST /api/auth/logout`**
- **Token verification** (`atproto_token.py`): Calls **bsky.social** `app.bsky.actor.getProfile` with **`Authorization: <scheme> <jwt>`**, trying schemes in order (**client `tokenType`**, **`DPoP`**, **`Bearer`**) because AT Proto OAuth often issues **DPoP**-bound access tokens, not classic Bearer-only sessions.

### 3.2 Protected CRUD — `projects.py`

All **`/api/projects`** and **`/api/feeds/...`** management routes require **`CurrentUser`** (`auth_deps.py` → cookie → DID).

- **Listing projects**: `WHERE owner_did = <session did>`.
- **Creating projects**: **`owner_did`** is taken **only** from the session (not trusted from client body).
- **Feeds**: Ownership enforced via **join** `feeds` → `feed_projects` → **`owner_did`**.

### 3.3 CORS & cookies (`main.py`)

- **`CORSMiddleware`**: `cors_allow_origins()` in **`config.py`** — if **`CORS_ORIGINS`** is set, use it; else if **`APP_PUBLIC_ORIGIN`** is set, allow that **single** origin; else **`*`** with **credentials disabled** (dev only).
- **`allow_credentials`** is **false** when origins are `*` (browser restriction).

### 3.4 Configuration reference (`config.py`)

| Variable | Role |
|----------|------|
| `DATABASE_URL` | PostgreSQL |
| `PUBLIC_BASE_URL` | Public **HTTPS** origin of **feed-api** for **`did.json`** (no path) |
| `APP_PUBLIC_ORIGIN` | Public **browser** origin for OAuth metadata (**must match** address bar / reverse proxy) |
| `SESSION_SECRET` | HMAC secret for `feedgen_session` |
| `SESSION_COOKIE_MAX_AGE` | Cookie lifetime (seconds) |
| `FORCE_SECURE_COOKIES` | `true` in production HTTPS; `false` for HTTP local dev |
| `CORS_ORIGINS` | Optional comma-separated list if UI and API differ |

### 3.5 Bluesky “publish feed” CLI (still relevant)

- **`services/feed-api/scripts/register_bluesky_feed.py`** — Creates **`app.bsky.feed.generator`** via **app password** env vars; rkey = **UUID without hyphens**; stores **`feeds.bluesky_feed_uri`** on success.
- **`PUBLISH_FEEDS.md`** — Operator steps: **`PUBLIC_BASE_URL`**, verify **`did.json`**, run script, populate **`feed_posts`**.

---

## 4. Assignment worker — `services/feed-assignment-worker`

- **`database.py`**: Reads **`COALESCE(assignment_rules_live, assignment_rules)`** so **live** logic wins when present.
- **`assignment_worker.py`**: Multi-END mapping, **`evaluate_graph_multi_end`**, upserts **`feed_posts`**.
- Engine: **`engine.py`**, **`condition_eval.py`** — parity target is the JS **`graphEvaluator` / `conditionEvaluator`**.

---

## 5. Frontend — `services/visual-editor` (React + Vite)

### 5.1 Auth flow

- **`src/contexts/AuthContext.jsx`** wraps the app (**`main.jsx`**).
- Uses **`@atproto/oauth-client-browser`**: **`BrowserOAuthClient.load({ clientId: `${origin}/oauth/client-metadata.json`, handleResolver: 'https://bsky.social' })`**, then **`init()`** to handle redirect return + restore sessions.
- After a session exists, **`session.getTokenSet(false)`** → **`POST /api/auth/session`** with **`access_token`** + **`token_type`**.
- **`src/api/feedBuilderApi.js`**: All API **`fetch`** calls use **`credentials: 'include'`**.

### 5.2 Dev proxy — `vite.config.js`

Proxies to **`http://localhost:8001`**:

- `/api`, `/oauth`, `/.well-known`, `/xrpc`, plus existing `/bsky-api`, `/debug`

**Why**: Single **origin** in the browser (cookies + OAuth **`client_id`** URL must match **`window.location.origin`**).

**Important**: For local OAuth loopback rules, prefer **`http://127.0.0.1:3000`** (not **`localhost`**) as documented in **`AUTH.md`**.

### 5.3 UI behavior

- **`App.jsx`**: Handle input + **“Sign in with Bluesky”**; shows DID + **Log out**; **Manage Feeds / Save / Update** disabled until **`did`** is set.
- **`Canvas.jsx`**: Loads **projects/feeds from API** only when **`authDid`** is present; clears project/feed state when logged out.
- **Feed catalog / END binding**, **Save vs Update** (draft vs live snapshots), **multi-END validation** — retained from earlier iterations (see **`PROGRESS.md`** and visual-editor code).

### 5.4 Documentation pointers

- **`AUTH.md`** — Auth env + local dev
- **`PUBLISH_FEEDS.md`** — Bluesky generator + skeleton path
- **`SOURCE_NODES.md`** — Modular source-node taxonomy (draft)

---

## 6. Docker — `docker-compose.yml`

`feed-api` service now includes env placeholders:

- `APP_PUBLIC_ORIGIN` (default `http://127.0.0.1:8001` — **override** when fronting with a real URL)
- `SESSION_SECRET`
- `FORCE_SECURE_COOKIES`
- `PUBLIC_BASE_URL`

**Not done yet**: One container or one compose stack that serves **built static UI + API on one HTTPS origin** without the operator manually aligning ports (see **Next session**).

---

## 7. What is **not** done / known gaps

1. **Single deployable “one URL” image** — UI static files + API behind one host (nginx sidecar, or FastAPI **`StaticFiles`**, or separate **`web`** service). Required for painless **plug-and-play**.
2. **Token verification** is **bsky.social AppView–centric** — self-hosted / other PDS may need **resource-server–aware** verification (future).
3. **Online-only editing** was discussed as preferable to offline/localStorage fallback for **authoritative** graph state; the UI may still use **localStorage** for drafts in some paths—**reconcile** explicitly if “server-only when online” is a hard rule.
4. **Register feed on Bluesky from UI** — still **CLI script** + env; could become an **authenticated** server action using **stored OAuth tokens** (careful: token storage, rotation, scopes).
5. **Parity tests** — Shared fixtures for JS engine vs Python worker (**`PROGRESS.md`** checklist).
6. **Module marketplace / ingestion** — Out of scope for this handoff; **`SOURCE_NODES.md`** is design draft only.

---

## 8. Suggested **next session** priorities (ordered)

1. **Production-style single origin**
   - Build Vite (`npm run build`), serve **`dist/`** from **`feed-api`** or reverse proxy; document **one** `APP_PUBLIC_ORIGIN` / `PUBLIC_BASE_URL` for both OAuth and **`did.json`**.
2. **Secrets & defaults**
   - Enforce non-default **`SESSION_SECRET`** in production; document **`.env.example`** at repo root for compose.
3. **End-to-end smoke script**
   - DB migrate → start API → open UI → OAuth → create project → create feed → save graph → Update → optional worker → **`getFeedSkeleton`** returns URIs.
4. **Optional: “Publish feed” from UI**
   - Server endpoint that uses **OAuth session** + **`com.atproto.repo.createRecord`** for **`app.bsky.feed.generator`** (replace app-password script for operators).
5. **PDS-flexible auth** (when needed)
   - Verify tokens against the user’s **resource server** / PDS instead of only bsky.social.

---

## 9. Quick file index (high signal)

| Area | Files |
|------|--------|
| API entry, CORS | `services/feed-api/main.py` |
| Config | `services/feed-api/config.py` |
| Session / deps | `services/feed-api/auth_deps.py`, `auth_routes.py`, `atproto_token.py` |
| OAuth metadata | `services/feed-api/oauth_client.py` |
| Projects & feeds API | `services/feed-api/projects.py` |
| Public skeleton + DID | `services/feed-api/feed.py`, `well_known.py` |
| Migrations | `database/migrations/*.sql`, `database/migrate.py` |
| Auth UI | `services/visual-editor/src/contexts/AuthContext.jsx`, `App.jsx`, `main.jsx` |
| API client | `services/visual-editor/src/api/feedBuilderApi.js` |
| Dev proxy | `services/visual-editor/vite.config.js` |
| Operator docs | `AUTH.md`, `PUBLISH_FEEDS.md` |
| Living progress | `PROGRESS.md` |

---

## 10. How to continue writing this doc

After each major milestone, append a dated section or bump **`PROGRESS.md`** and keep **`HANDOFF_SESSION_*.md`** as a **snapshot** of “where we stopped and what to do next.”
