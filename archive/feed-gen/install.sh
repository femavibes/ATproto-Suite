#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "Feed Gen installer (beta)"
echo
read -rp "Public URL override (press Enter to auto-use https://<public-ip>.sslip.io): " PUBLIC_URL_INPUT
read -rp "Allowed Bluesky handle for this deployment (without @, optional): " OWNER_HANDLE_INPUT

LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
PUBLIC_IP="$(curl -fsS https://api.ipify.org 2>/dev/null || true)"

POSTGRES_PASSWORD="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(24))
PY
)"
SESSION_SECRET="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"

LOCAL_BETA_MODE=false

if [[ -z "${PUBLIC_URL_INPUT}" ]]; then
  if [[ -n "${PUBLIC_IP}" ]]; then
    PUBLIC_URL_INPUT="https://${PUBLIC_IP}.sslip.io"
  else
    PUBLIC_URL_INPUT="http://127.0.0.1:8001"
    LOCAL_BETA_MODE=true
  fi
fi

cat > .env <<EOF
PUBLIC_URL=${PUBLIC_URL_INPUT}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
ADMIN_EMAIL=
OWNER_HANDLE=${OWNER_HANDLE_INPUT}
ALLOWED_HANDLES=${OWNER_HANDLE_INPUT}
HOSTED_MODE=true
LOCAL_BETA_MODE=${LOCAL_BETA_MODE}
SESSION_SECRET=${SESSION_SECRET}
FORCE_SECURE_COOKIES=false
EOF

echo
echo "Wrote .env with generated secrets."
echo "Starting services..."
docker compose up -d --build
echo
echo "Done."
echo
echo "Open the app:"
echo "  - Local machine: http://127.0.0.1:8001"
if [[ -n "${LOCAL_IP}" ]]; then
  echo "  - Same network:  http://${LOCAL_IP}:8001"
fi
if [[ -n "${PUBLIC_IP}" ]]; then
  echo "  - Public IP:     http://${PUBLIC_IP}:8001"
fi
echo "  - Configured URL (PUBLIC_URL): ${PUBLIC_URL_INPUT}"
if [[ "${PUBLIC_URL_INPUT}" == *".sslip.io"* ]]; then
  echo "  - Auto DNS onboarding enabled via sslip.io"
fi
echo
echo "Onboarding / checks:"
echo "  - http://127.0.0.1:8001/setup"
if [[ -n "${LOCAL_IP}" ]]; then
  echo "  - http://${LOCAL_IP}:8001/setup"
fi
if [[ -n "${PUBLIC_IP}" ]]; then
  echo "  - http://${PUBLIC_IP}:8001/setup"
fi
echo "  - ${PUBLIC_URL_INPUT}/api/setup/preflight"
if [[ "${LOCAL_BETA_MODE}" == "true" ]]; then
  echo
  echo "Note: public IP detection failed, so LOCAL_BETA_MODE=true was enabled."
  echo "Set PUBLIC_URL manually later to publish publicly."
fi
