#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  cp .env.example .env
fi
mkdir -p config/overlays data/label-watcher data/graze-remover data/autolabel
docker compose pull
docker compose up -d
port=$(grep -E '^CONFIG_UI_PORT=' .env 2>/dev/null | cut -d= -f2- || true)
port=${port:-8787}
echo "label·ops is up → http://localhost:${port}"
echo "Open the UI, set accounts, fetch labels, save — workers reload themselves."
