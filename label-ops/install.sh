#!/usr/bin/env bash
# Install + start label·ops from GHCR. Safe to paste on a docs page:
#
#   curl -fsSL https://raw.githubusercontent.com/femavibes/ATproto-Suite/main/label-ops/install.sh | bash
#
set -euo pipefail

RAW_BASE="${LABEL_OPS_RAW:-https://raw.githubusercontent.com/femavibes/ATproto-Suite/main/label-ops}"
DIR="${LABEL_OPS_DIR:-$HOME/label-ops}"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Need '$1' installed and on PATH." >&2
    exit 1
  }
}

need curl
need docker
docker compose version >/dev/null 2>&1 || {
  echo "Need Docker Compose v2 (docker compose)." >&2
  exit 1
}

mkdir -p "$DIR"
cd "$DIR"

echo "→ Installing label·ops into $DIR"
curl -fsSL "$RAW_BASE/docker-compose.yml" -o docker-compose.yml
curl -fsSL "$RAW_BASE/.env.example" -o .env.example
curl -fsSL "$RAW_BASE/up.sh" -o up.sh
chmod +x up.sh

if [ ! -f .env ]; then
  cp .env.example .env
fi
mkdir -p config/overlays data/label-watcher data/graze-remover data/autolabel

echo "→ Pulling images from ghcr.io (GitHub Container Registry)"
docker compose pull

echo "→ Starting stack"
docker compose up -d

port=$(grep -E '^CONFIG_UI_PORT=' .env 2>/dev/null | cut -d= -f2- || true)
port=${port:-8787}
echo
echo "label·ops is up → http://localhost:${port}"
echo "Configure accounts + labels in the web UI. Workers reload on save."
echo "Data lives in: $DIR"
