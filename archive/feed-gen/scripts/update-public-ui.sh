#!/usr/bin/env bash
# Build the visual editor and restart feed-api so feeds.fema.monster picks up UI changes
# without rebuilding the Docker image. Requires compose merge with docker-compose.live-ui.yml
# (see DEPLOYMENT_MODES.md).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Override with e.g. COMPOSE_EXTRA="-f docker-compose.prod.yml" if you use more merge files.
COMPOSE_CMD=(docker compose -f docker-compose.yml -f docker-compose.live-ui.yml ${COMPOSE_EXTRA:-})

if [[ ! -f "$ROOT/services/visual-editor/package.json" ]]; then
  echo "Expected repo layout: services/visual-editor/" >&2
  exit 1
fi

echo "Installing/building visual-editor..."
(
  cd "$ROOT/services/visual-editor"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
  npm run build
)

echo "Restarting feed-api (${COMPOSE_CMD[*]} restart feed-api)..."
"${COMPOSE_CMD[@]}" restart feed-api
echo "Done. Hard-refresh the browser (Ctrl+Shift+R) if assets look cached."
