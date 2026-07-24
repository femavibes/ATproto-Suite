# Sign-in (AT Protocol OAuth)

The visual editor uses **Bluesky / AT Protocol OAuth** in the browser (`@atproto/oauth-client-browser`), then exchanges the OAuth access token for an **app session cookie** on this server.

## Deployment mode options

- **Shared host (default onboarding):** users sign in and build/publish on one hosted domain (for example `feeds.fema.monster`).
- **Self-hosted (advanced):** operators run this stack on their own domain/VPS (`PUBLIC_URL` points to their host).

See `DEPLOYMENT_MODES.md` for a short comparison.

## Required configuration (feed-api)

| Variable | Purpose |
|----------|---------|
| `PUBLIC_URL` | Preferred single public origin for self-hosted Docker (e.g. `https://feeds.example.com`). feed-api derives OAuth + did:web origin values from this by default. |
| `SESSION_SECRET` | Secret for signing the `feedgen_session` cookie (set a long random string in production). |
| `FORCE_SECURE_COOKIES` | `true` on HTTPS deployments; `false` for plain HTTP local dev so cookies work. |

Optional:

| Variable | Purpose |
|----------|---------|
| `APP_PUBLIC_ORIGIN` | Advanced override for OAuth metadata origin (`/oauth/client-metadata.json`). |
| `PUBLIC_BASE_URL` | Advanced override for did:web endpoint origin (`/.well-known/did.json`). |
| `CORS_ORIGINS` | Comma-separated allowed origins if the API is on a different host than the UI. If unset and `APP_PUBLIC_ORIGIN` is set, CORS uses that single origin. |

## Local development

**Full native stack on one VPS (no Docker at all):** see **`NATIVE_RUN.md`** — Postgres + workers + `feed-api` + Caddy on the host; Dockerfiles remain for CI/images.

Goal (hybrid / classic dev): **Postgres** → **migrations** → **feed-api on 8001** → **Vite on 3000** → open **`http://127.0.0.1:3000`** (not `localhost`; see OAuth loopback rules).

### 1. PostgreSQL

From the repo root, start only Postgres (loads `database/schema.sql` on first start):

```bash
docker compose up -d postgres
```

Default URL for tools on the host: `postgresql://feedgen:feedgen@127.0.0.1:5440/feedgen` (port **5440** is mapped in `docker-compose.yml`).

### 2. Migrations

Apply incremental migrations (`database/migrations/*.sql`) after the base schema exists:

```bash
./scripts/dev-migrate.sh
```

Or manually: `pip install -r database/requirements.txt` then `python database/migrate.py` (same `DATABASE_URL` default as in `database/migrate.py`).

**Without `pip` on the host:** with Postgres already running via Compose, apply migrations using a one-off container on the same Docker network (replace the network name if your Compose project name differs — check `docker network ls`):

```bash
docker run --rm --network feed-gen_feed-gen-network \
  -v "$(pwd)/database:/work/database:ro" \
  -e DATABASE_URL=postgresql://feedgen:feedgen@postgres:5432/feedgen \
  python:3.11-slim \
  bash -c "pip install -q asyncpg==0.29.0 && python /work/database/migrate.py"
```

### 3. feed-api (terminal 1)

Working directory: `services/feed-api`. Use **port 8001** so it matches the Vite proxy targets in `vite.config.js`.

```bash
cd services/feed-api
export DATABASE_URL="postgresql://feedgen:feedgen@127.0.0.1:5440/feedgen"
export APP_PUBLIC_ORIGIN="http://127.0.0.1:3000"
export SESSION_SECRET="dev-change-me"
export FORCE_SECURE_COOKIES="false"
export PORT="8001"
python main.py
```

(`python` / `python3` depending on your environment.)

### 4. Visual editor (terminal 2)

```bash
cd services/visual-editor
npm install   # first time only
npm run dev
```

Vite proxies `/api`, `/oauth`, `/.well-known`, and `/xrpc` to `http://localhost:8001` so the browser stays on one origin (cookies + OAuth `client_id` URL).

### 5. Use the app

Open **`http://127.0.0.1:3000`**, sign in with Bluesky, then create a project/feed and save graphs via the UI.

## API routes

- `GET /oauth/client-metadata.json` — OAuth client metadata (`client_id` must match this URL).
- `POST /api/auth/session` — body `{ "accessJwt", "tokenType" }`; sets session cookie.
- `GET /api/auth/me` — returns `{ "did" }` when logged in.
- `POST /api/auth/logout` — clears session cookie.
- `GET /api/setup/preflight` — preflight checks (public URL / db / session secret).
- `GET /setup` — simple setup status page (redirects to `/api/setup/page`).

All `/api/projects` and `/api/feeds/*` management routes require the session cookie and scope data by **logged-in DID** (`feed_projects.owner_did`).

## Limitations (current)

- Token verification uses the **bsky.social** AppView. Accounts on some other PDS setups may need additional work later.
