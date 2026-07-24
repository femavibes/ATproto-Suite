#!/bin/bash
set -e

BACKUP_FILE="$1"
DATABASE="$2"
TIMESTAMP="$3"

if [ -z "$BACKUP_FILE" ] || [ -z "$DATABASE" ] || [ -z "$TIMESTAMP" ]; then
    echo "Usage: $0 <backup-file> <database> <timestamp>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# GCS Configuration
GCS_BUCKET="${GCS_BUCKET_NAME}"

if [ -z "$GCS_BUCKET" ]; then
    echo "ERROR: GCS_BUCKET_NAME not set"
    exit 1
fi

# Authenticate with GCS
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    export GOOGLE_APPLICATION_CREDENTIALS
    gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS" 2>&1
fi

# Determine backup type (daily, weekly, monthly)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)

if [ "$DAY_OF_WEEK" = "7" ]; then
    BACKUP_TYPE="weekly"
    GCS_PATH="backups/${DATABASE}/weekly"
elif [ "$DAY_OF_MONTH" = "01" ]; then
    BACKUP_TYPE="monthly"
    GCS_PATH="backups/${DATABASE}/monthly"
else
    BACKUP_TYPE="daily"
    GCS_PATH="backups/${DATABASE}/daily"
fi

# Upload to GCS
GCS_URI="gs://${GCS_BUCKET}/${GCS_PATH}/$(basename $BACKUP_FILE)"

echo "Uploading to $GCS_URI..."
gsutil cp "$BACKUP_FILE" "$GCS_URI" 2>&1

if [ $? -eq 0 ]; then
    echo "Upload successful: $GCS_URI"
    
    # Store backup metadata (for admin interface)
    METADATA_FILE="/var/log/backups/metadata-${TIMESTAMP}.json"
    cat > "$METADATA_FILE" <<EOF
{
    "database": "$DATABASE",
    "timestamp": "$TIMESTAMP",
    "type": "$BACKUP_TYPE",
    "size": $(stat -c%s "$BACKUP_FILE"),
    "gcs_uri": "$GCS_URI",
    "created_at": "$(date -Iseconds)"
}
EOF
    exit 0
else
    echo "ERROR: Upload failed"
    exit 1
fi
