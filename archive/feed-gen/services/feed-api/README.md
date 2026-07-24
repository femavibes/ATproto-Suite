# Feed API Service

## Purpose

Serves feed requests to users via Bluesky AT Proto API.

## Dependencies

- PostgreSQL (read-only)
- Redis (optional, for caching)

## Failure Impact

Feeds unavailable (other services continue)

## Restart Behavior

Safe anytime (stateless, no data loss)

## Scaling

Can run multiple instances

## Authentication (OAuth + session cookie)

See repository root **`AUTH.md`**. Endpoints: `/oauth/client-metadata.json`, `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`. Project/feed APIs require a valid session.

## Publishing on Bluesky

See repository root **`PUBLISH_FEEDS.md`**: `PUBLIC_BASE_URL`, `/.well-known/did.json`, and `scripts/register_bluesky_feed.py`.

## Startup behavior (Docker-first)

- On startup, feed-api auto-runs SQL migrations from `database/migrations` (tracked in `schema_migrations`).
- Single URL default: set `PUBLIC_URL` and feed-api derives OAuth + did:web base values from it unless advanced overrides are provided.
- Setup checks: `GET /api/setup/preflight` and browser page at `/api/setup/page` (shortcut `/setup`).

## Visual editor on the same origin (optional)

If **`UI_STATIC_ROOT`** is set to a directory that contains **`index.html`** (for example the Vite production build under `services/visual-editor/dist`), the service serves that SPA at **`/`** and mounts **`/assets`** from `UI_STATIC_ROOT/assets`. When unset, **`GET /`** returns JSON service metadata instead.

The **Docker image** builds the visual editor and sets **`UI_STATIC_ROOT=/app/ui`**. Build context for Compose is the **repository root** (`docker-compose.yml` uses `context: .` and `dockerfile: services/feed-api/Dockerfile`). Prefer setting **`PUBLIC_URL`** for self-hosted installs; advanced users can still set `APP_PUBLIC_ORIGIN` and `PUBLIC_BASE_URL` explicitly.

## API Endpoints

- `GET /xrpc/app.bsky.feed.getFeedSkeleton` - Bluesky feed skeleton endpoint
- `GET /.well-known/did.json` - `did:web` document for the feed generator service (requires `PUBLIC_BASE_URL`)
- `GET /api/projects` - list feed projects
- `POST /api/projects` - create feed project
- `PUT /api/projects/{project_id}` - update project metadata
- `PUT /api/projects/{project_id}/draft` - save project-level draft graph
- `PUT /api/projects/{project_id}/publish` - promote project draft graph to live
- `GET /api/projects/{project_id}/feeds` - list feeds in a project
- `POST /api/projects/{project_id}/feeds` - create feed in a project
- `PUT /api/feeds/{feed_id}` - update feed metadata
- `PUT /api/feeds/{feed_id}/draft` - save draft graph JSON for a feed
- `PUT /api/feeds/{feed_id}/publish` - publish/unpublish feed (can promote draft logic to live)
