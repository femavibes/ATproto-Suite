#!/usr/bin/env bash
# Apply SQL migrations in database/migrations/ (requires asyncpg).
# Default DATABASE_URL matches docker-compose Postgres (host port 5440).

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export DATABASE_URL="${DATABASE_URL:-postgresql://feedgen:feedgen@127.0.0.1:5440/feedgen}"

if ! python3 -c "import asyncpg" 2>/dev/null; then
  if python3 -m pip --version >/dev/null 2>&1; then
    python3 -m pip install -q -r database/requirements.txt
  else
    echo "asyncpg is required. Either install pip (e.g. python3 -m ensurepip) and run:" >&2
    echo "  python3 -m pip install -r database/requirements.txt" >&2
    echo "Or run migrations in Docker — see AUTH.md (Local development)." >&2
    exit 1
  fi
fi
exec python3 database/migrate.py
