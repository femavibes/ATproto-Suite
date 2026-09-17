# label-ops

Shared config UI for three modular labeler apps:

1. **bsky-label-watcher** — labels → Bluesky lists  
2. **graze-post-remover** — labels → hide posts in Graze feeds  
3. **ozone-report-to-autolabel** — Ozone reports → apply labels  

Each worker is its own image (update independently). This folder is the umbrella: Docker Compose + a small web UI that syncs the label catalog and writes env overlays.

## Images (all GHCR)

| Service | Image |
|---|---|
| config-ui | `ghcr.io/femavibes/label-ops-config-ui:latest` |
| label-watcher | `ghcr.io/femavibes/bsky-label-watcher:latest` |
| graze-post-remover | `ghcr.io/femavibes/graze-post-remover:latest` |
| autolabel | `ghcr.io/femavibes/ozone-report-to-autolabel:latest` |

Deployers who only want to **pull** need this `label-ops/` directory (compose + `.env.example` + empty `config/overlays`). Compose lists GHCR images for all four services.

`config-ui` and `autolabel` also have a `build:` fallback for developing inside the ATproto-Suite checkout. Pure pull hosts can delete those `build:` lines (or never run `--build`).

## Quick start

```bash
# from this directory (label-ops/)
cp .env.example .env
# optional: set CONFIG_UI_PASSWORD, DOCKER_GID (see below)

docker compose pull
docker compose up -d config-ui
# open http://localhost:8787

# In the UI: Config → Accounts → save → Labels → Fetch labels → set actions → Save
# then start workers
docker compose --profile workers up -d
```

Saving in the UI recreates **already running** workers so overlays apply (`LABEL_OPS_AUTO_RELOAD=1`). Workers that are not running are left alone — start them once with `--profile workers`.

## Prerequisites

- Docker + Compose
- An Ozone labeler already publishing labels (`LABELER_SOCKET_URL` / `OZONE_URL`)
- For live UI reloads: mount docker.sock (already in compose) and set `DOCKER_GID` to your host docker group GID if permission denied (`ls -ln /var/run/docker.sock`)

## Labels: discovery vs actions

**Discovery** (Fetch now / auto-sync) pulls your published labeler service record. That gives ids/names/descriptions — it does not configure actions.

Per label in the UI you still set:

- list sync (`off` / `curate` / `mod`) + Refresh lists for open/copy links
- Graze feeds (`off` / `all` / selected published feeds)
- comment commands (on by default; uncheck to opt out)
- report-reason auto-apply
- optional autoban threshold

Secrets are edited in the UI and written to `.env`.

## Layout

```
label-ops/
  docker-compose.yml
  .env.example
  config/
    labels.json              # shared state (UI; created at runtime)
    overlays/                # generated *.env for workers
  config-ui/                 # Flask app (source; image published to GHCR)
  data/                      # per-worker persistent cursors/logs
```

## Updating

```bash
docker compose pull
docker compose up -d config-ui
docker compose --profile workers up -d
```

Or one worker:

```bash
docker compose pull label-watcher
docker compose --profile workers up -d label-watcher
```

## Local builds (optional)

In `docker-compose.yml`, uncomment the `build:` lines under `config-ui` / `autolabel` to develop against suite sources instead of GHCR.
