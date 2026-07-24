# Deployment Modes

**Running without Docker on your own server:** see **`NATIVE_RUN.md`** (Postgres + Python services + Caddy on the host; Compose/Dockerfiles optional for CI).

This project now targets a Docker-first onboarding flow:

1) install/run Docker
2) login
3) build feeds

The sections below describe how that maps to runtime and publish paths.

## 1) Self-host runtime (default)

- Every user runs this stack on their own machine/VPS.
- Data and compute stay on their own system (their own Postgres, CPU, memory).
- Onboarding should open from a direct URL shown by installer output (for example `http://<ip>:8001/setup`).

### Why this is the default

- No shared hosting liability for core feed processing.
- No requirement that users understand reverse proxies before first login.

## 2) Public publish address options

Publishing to Bluesky still needs a public HTTPS hostname for resolver calls, but users should not need manual DNS work for basic onboarding.

- **Zero-config hostname (recommended):** use auto DNS hostnames such as `sslip.io`/`nip.io`.
- **Custom domain (advanced):** user-managed DNS/domain if they want branded URLs.

## 3) Hosted gateway/directory idea (documented for later)

Proposed operator convenience layer:

- Shared entrypoint like `https://feeds.fema.monster`.
- Path pattern such as `/did:plc:...` resolves to a user deployment URL.
- Gateway redirects user to their self-hosted instance (for UI and onboarding).

Required platform pieces for this:

- DID -> deployment URL registry.
- Ownership verification flow (user proves DID control before registration).
- Conflict policy for multiple deployments per DID (active flag, recency, or explicit environment labels).
- Health checks and stale mapping cleanup.

This keeps runtime self-hosted while giving a single memorable URL in onboarding copy ("visit `feeds.fema.monster`").

---

## Product direction

- Keep self-host runtime as the core model.
- Keep onboarding dead simple with explicit "open this URL" output after install.
- Treat gateway/directory as an optional control-plane feature, not a requirement for publish.

---

## Live visual editor on a public host (no feed-api image rebuild)

If Caddy (or similar) reverse-proxies your domain to **`127.0.0.1:8001`** and `feed-api` runs from this repo’s `docker-compose.yml`, the UI is normally **baked into the image**. Rebuilding the image on every UI change is slow and unnecessary.

**Postgres and all other services stay as they are** (same containers and volumes). Only `feed-api` gains a **read-only bind mount** over `/app/ui` so it serves files from **`services/visual-editor/dist`** on the host.

### One-time setup (on the server)

From the repo root:

```bash
docker compose -f docker-compose.yml -f docker-compose.live-ui.yml up -d
```

That recreates `feed-api` with the volume mount. Your existing `postgres_data` volume is untouched.

### After each pull / UI change

```bash
./scripts/update-public-ui.sh
```

That runs `npm ci` (or `npm install`), `npm run build` in `services/visual-editor`, then **`docker compose … restart feed-api`** (no `docker compose build`). Hard-refresh the browser if assets look cached.

### Optional: custom compose files

If you already use extra `-f` files, set **`COMPOSE_EXTRA`** before the script, for example:

```bash
export COMPOSE_EXTRA="-f docker-compose.prod.yml"
./scripts/update-public-ui.sh
```

Adjust the script’s `COMPOSE_CMD` array in `scripts/update-public-ui.sh` if your merge list is fixed on that host.
