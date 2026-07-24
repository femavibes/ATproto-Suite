#!/bin/bash
set -e

# Setup cron schedule
CRON_SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"

echo "Setting up backup schedule: $CRON_SCHEDULE"

# Create initial log file
touch /var/log/backups/cron.log

# Create cron job
echo "$CRON_SCHEDULE /scripts/backup.sh >> /var/log/backups/cron.log 2>&1" | crontab -

# Start cron
echo "Starting cron daemon..."
cron

echo "Backup service ready. Logs will appear here."

# Keep container running and tail logs
tail -f /var/log/backups/cron.log
