#!/bin/bash
set -e

# Retention configuration
RETENTION_DAILY="${BACKUP_RETENTION_DAILY:-7}"
RETENTION_WEEKLY="${BACKUP_RETENTION_WEEKLY:-4}"
RETENTION_MONTHLY="${BACKUP_RETENTION_MONTHLY:-3}"

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

echo "Running cleanup with retention: daily=$RETENTION_DAILY, weekly=$RETENTION_WEEKLY, monthly=$RETENTION_MONTHLY"

# Cleanup daily backups (keep last N)
for DB in skymap ozone; do
    echo "Cleaning up daily backups for $DB..."
    gsutil ls "gs://${GCS_BUCKET}/backups/${DB}/daily/" | sort -r | tail -n +$((RETENTION_DAILY + 1)) | while read line; do
        if [ -n "$line" ]; then
            echo "Deleting old daily backup: $line"
            gsutil rm "$line"
        fi
    done
done

# Cleanup weekly backups (keep last N)
for DB in skymap ozone; do
    echo "Cleaning up weekly backups for $DB..."
    gsutil ls "gs://${GCS_BUCKET}/backups/${DB}/weekly/" | sort -r | tail -n +$((RETENTION_WEEKLY + 1)) | while read line; do
        if [ -n "$line" ]; then
            echo "Deleting old weekly backup: $line"
            gsutil rm "$line"
        fi
    done
done

# Cleanup monthly backups (keep last N)
for DB in skymap ozone; do
    echo "Cleaning up monthly backups for $DB..."
    gsutil ls "gs://${GCS_BUCKET}/backups/${DB}/monthly/" | sort -r | tail -n +$((RETENTION_MONTHLY + 1)) | while read line; do
        if [ -n "$line" ]; then
            echo "Deleting old monthly backup: $line"
            gsutil rm "$line"
        fi
    done
done

echo "Cleanup completed"
