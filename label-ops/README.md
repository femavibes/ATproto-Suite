# label·ops

Shared config UI for three labeler workers:

1. **bsky-label-watcher** — labels → Bluesky lists  
2. **graze-post-remover** — labels → hide posts in Graze feeds  
3. **ozone-report-to-autolabel** — Ozone reports → apply labels  

## Quick start

```bash
cd label-ops
chmod +x up.sh && ./up.sh
# → http://localhost:8787
```

Or without the script:

```bash
cp .env.example .env   # only if .env is missing
docker compose up -d
```

Then in the UI: **Config → Accounts** → save → **Labels** → Fetch → set actions → Save.  
Workers are already running; saves recreate them so new settings apply. No `DOCKER_GID`, no host Docker binary mounts, no compose profiles.

## Images

| Service | Image |
|---|---|
| config-ui | `ghcr.io/femavibes/label-ops-config-ui:latest` |
| label-watcher | `ghcr.io/femavibes/bsky-label-watcher:latest` |
| graze-post-remover | `ghcr.io/femavibes/graze-post-remover:latest` |
| autolabel | `ghcr.io/femavibes/ozone-report-to-autolabel:latest` |

## Updating

```bash
docker compose pull && docker compose up -d
```

## Notes

- `.env` is created automatically (from `.env.example`) on first start; prefer editing secrets in the UI.
- Optional UI password: set `CONFIG_UI_PASSWORD` in `.env` or Config → Settings.
- You need an Ozone labeler already publishing labels; this stack configures the three consumers.
