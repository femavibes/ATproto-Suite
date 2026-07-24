# Running feed-gen without Docker (single VPS)

Use this when **everything** (Postgres, API, workers, Caddy) runs on the host — e.g. you SSH into the VPS and edit the repo there. **Dockerfiles and `docker-compose.yml` stay in the repo** for CI and for anyone who prefers containers; you simply do not run Compose on this machine.

## What you need installed

- **PostgreSQL** (16+ recommended; match what you used in Docker if migrating data)
- **Python 3.11+** with `pip`
- **Node.js 20+** and `npm` (build the visual editor once, or after UI changes)
- **Caddy** (or nginx) on `:443` reverse-proxying to the API — same idea as today’s `Caddyfile` → `127.0.0.1:8001`

**Redis** was in Compose for forward compatibility; the current **feed-api** code path does not require a live Redis connection at startup. You can install `redis-server` later if you add features that need it.

## 1. Postgres user and database

Create a DB user and database (adjust password to match your `.env`):

```sql
CREATE USER feedgen WITH PASSWORD 'your-secure-password';
CREATE DATABASE feedgen OWNER feedgen;
```

Apply the base schema once (from repo root), then incremental migrations:

```bash
export DATABASE_URL="postgresql://feedgen:your-secure-password@127.0.0.1:5432/feedgen"
psql "$DATABASE_URL" -f database/schema.sql   # only on empty DB
./scripts/dev-migrate.sh
```

(`dev-migrate.sh` defaults to port **5440** for Docker-on-host; for native Postgres on the default port, **always set `DATABASE_URL`** as above.)

## 2. Moving data off Docker Postgres (optional)

If your live data is still inside the old Docker volume:

```bash
# While the old postgres container still runs:
docker compose exec -T postgres pg_dump -U feedgen feedgen > feedgen-backup.sql
# After native Postgres is up:
psql "$DATABASE_URL" -f feedgen-backup.sql
```

Then you can stop/remove Docker on that host if you want.

## 3. Build the visual editor (served by feed-api)

```bash
cd services/visual-editor
npm ci
npm run build
cd ../..
```

Point the API at that directory (absolute path is safest):

```bash
export UI_STATIC_ROOT="$(pwd)/services/visual-editor/dist"
```

## 4. Environment variables (feed-api)

Set at least:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://feedgen:…@127.0.0.1:5432/feedgen` |
| `PUBLIC_URL` | `https://feeds.fema.monster` |
| `SESSION_SECRET` | long random string |
| `FORCE_SECURE_COOKIES` | `true` behind HTTPS |
| `UI_STATIC_ROOT` | absolute path to `services/visual-editor/dist` |
| `PORT` | `8001` (matches typical Caddy → `127.0.0.1:8001`) |

Optional / same as Docker:

- `OWNER_HANDLE`, `ALLOWED_HANDLES`, `HOSTED_MODE`, `INGESTION_GRAPH_MATCH`, etc.

If you previously relied on Compose for `REDIS_URL`, either install Redis and set `REDIS_URL=redis://127.0.0.1:6379/0` or leave it unset only if your code paths tolerate it (today feed-api does not open Redis on import).

## 5. Run feed-api

```bash
cd services/feed-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql://..."
export PUBLIC_URL="https://feeds.fema.monster"
export UI_STATIC_ROOT="/absolute/path/to/feed-gen/services/visual-editor/dist"
export SESSION_SECRET="…"
export FORCE_SECURE_COOKIES="true"
export PORT="8001"
python main.py
```

`main.py` runs **uvicorn with reload** — Python changes restart the process; UI changes need a browser refresh after `npm run build` (or rebuild when you change the frontend).

## 6. Run workers (separate terminals or systemd)

**Assignment worker** (feeds engine pass):

```bash
cd services/feed-assignment-worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql://…@127.0.0.1:5432/feedgen"
python main.py
```

**Jetstream ingestion**:

```bash
cd services/jetstream-ingestion
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql://…@127.0.0.1:5432/feedgen"
export KEYWORDS_FILE="/absolute/path/to/feed-gen/keywords.txt"
# Optional, same as compose:
# export INGESTION_GRAPH_MATCH=true
python main.py
```

## 7. Caddy (TLS + reverse proxy)

Keep your repo `Caddyfile` (or equivalent) pointing at **`127.0.0.1:8001`**. Install Caddy from your distro or [caddyserver.com](https://caddyserver.com/docs/install), install the file to `/etc/caddy/Caddyfile` or include it, then `sudo systemctl reload caddy`.

## 8. After UI-only changes

```bash
cd services/visual-editor && npm run build && cd ../..
# reload browser; no API restart required unless you change Python
```

## CI / “Docker for git”

Unchanged: push triggers (or manual `docker build`) using `services/feed-api/Dockerfile` and the other Dockerfiles still produce images; that does not require Docker on this VPS.

## See also

- `AUTH.md` — OAuth notes and why `127.0.0.1` vs `localhost` matters for local dev.
- `docker-compose.yml` — reference for which env vars production used when you were on Compose.
