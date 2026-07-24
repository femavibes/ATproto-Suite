#!/usr/bin/env bash
# Run feed-assignment-worker from source (no Docker). Loads repo-root .env if present.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/feed-assignment-worker"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL in the environment or repo-root .env" >&2
  exit 1
fi

if [[ ! -f .venv/bin/activate ]]; then
  rm -rf .venv
  python3 -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate
pip install -q -r requirements.txt

exec python assignment_worker.py
