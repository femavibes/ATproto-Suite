# label·ops

Shared config UI for three labeler workers (lists, Graze remover, Ozone autolabel).

Images live on **GHCR** (`ghcr.io/femavibes/...`). The install script only downloads the compose files from GitHub, then `docker compose pull` fetches the four images.

## Deploy (paste on a webpage)

**One line** (needs Docker + Compose):

```bash
curl -fsSL https://raw.githubusercontent.com/femavibes/ATproto-Suite/main/label-ops/install.sh | bash
```

That creates `~/label-ops`, pulls the images, starts everything → **http://localhost:8787**

Then in the UI: **Config → Accounts** → save → **Labels** → Fetch → set actions → Save.

Custom install dir:

```bash
LABEL_OPS_DIR=/opt/label-ops bash <(curl -fsSL https://raw.githubusercontent.com/femavibes/ATproto-Suite/main/label-ops/install.sh)
```

## Already have this folder (monorepo)

```bash
cd label-ops && ./up.sh
```

## Images

| Service | Image |
|---|---|
| config-ui | `ghcr.io/femavibes/label-ops-config-ui:latest` |
| label-watcher | `ghcr.io/femavibes/bsky-label-watcher:latest` |
| graze-post-remover | `ghcr.io/femavibes/graze-post-remover:latest` |
| autolabel | `ghcr.io/femavibes/ozone-report-to-autolabel:latest` |

## Updating

```bash
cd ~/label-ops   # or your install dir
docker compose pull && docker compose up -d
```

## Notes

- `.env` is created from `.env.example` on first start; set secrets in the UI.
- Optional UI password: `CONFIG_UI_PASSWORD` in `.env`.
- You need an Ozone labeler already publishing labels; this stack runs the three consumers.
- Local image builds (dev): `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`
