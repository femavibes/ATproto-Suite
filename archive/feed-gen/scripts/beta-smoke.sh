#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://feeds.fema.monster}"

echo "== Feed Beta Smoke =="
echo "BASE_URL: ${BASE_URL}"
echo

echo "-- preflight --"
curl -fsS "${BASE_URL}/api/setup/preflight"
echo
echo

echo "-- beta-readiness --"
curl -fsS "${BASE_URL}/api/setup/beta-readiness"
echo
echo

echo "-- did.json --"
curl -fsS "${BASE_URL}/.well-known/did.json"
echo
echo

echo "Done."
