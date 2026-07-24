#!/usr/bin/env bash
# Run feed-api from source on the host (no Docker). Loads repo-root .env if present.
# Prerequisites: Postgres reachable via DATABASE_URL, visual-editor built (npm run build).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/feed-api"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env"
  set +a
fi

export PORT="${PORT:-8001}"
export UI_STATIC_ROOT="${UI_STATIC_ROOT:-$ROOT/services/visual-editor/dist}"

if [[ ! -f "$UI_STATIC_ROOT/index.html" ]]; then
  echo "Missing $UI_STATIC_ROOT/index.html — run: (cd $ROOT/services/visual-editor && npm ci && npm run build)" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL (e.g. postgresql://feedgen:pass@127.0.0.1:5432/feedgen) in the environment or repo-root .env" >&2
  exit 1
fi

if [[ ! -f .venv/bin/activate ]]; then
  rm -rf .venv
  python3 -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate
pip install -q -r requirements.txt

exec python main.py
