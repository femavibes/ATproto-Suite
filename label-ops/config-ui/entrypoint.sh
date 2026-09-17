#!/bin/sh
set -e
# Ensure bind-mounted files exist (Docker creates a directory if the host path is missing).
mkdir -p /data/config/overlays /data/stack
if [ ! -f /data/stack/.env ]; then
  if [ -f /data/stack/.env.example ]; then
    cp /data/stack/.env.example /data/stack/.env
  else
    printf '%s\n' \
      '# Created by label·ops — set accounts in the web UI' \
      'CONFIG_UI_PORT=8787' \
      'LABEL_OPS_AUTO_RELOAD=1' \
      > /data/stack/.env
  fi
fi
exec "$@"
