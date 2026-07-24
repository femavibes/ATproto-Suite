#!/bin/bash
set -e

# Configuration
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
BACKUP_DIR="/backups"
LOG_FILE="/var/log/backups/backup-${TIMESTAMP}.log"

# Database configurations
SKYMAP_HOST="${SKYMAP_HOST:-localhost}"
SKYMAP_PORT="${SKYMAP_PORT:-5435}"
SKYMAP_DB="${SKYMAP_DB:-skymap}"
SKYMAP_USER="${SKYMAP_USER:-dev}"
SKYMAP_PASSWORD="${SKYMAP_PASSWORD:-devpass}"

OZONE_HOST="${OZONE_HOST:-localhost}"
OZONE_PORT="${OZONE_PORT:-5432}"
OZONE_DB="${OZONE_DB:-ozone}"
OZONE_USER="${OZONE_USER:-postgres}"
OZONE_PASSWORD="${OZONE_PASSWORD}"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting backup process..."

# Backup Skymap database
log "Backing up Skymap database..."
SKYMAP_BACKUP="${BACKUP_DIR}/skymap-${TIMESTAMP}.sql"
export PGPASSWORD="$SKYMAP_PASSWORD"
pg_dump -h "$SKYMAP_HOST" -p "$SKYMAP_PORT" -U "$SKYMAP_USER" -d "$SKYMAP_DB" > "$SKYMAP_BACKUP" 2>>"$LOG_FILE"

if [ $? -eq 0 ]; then
    log "Skymap backup created: $(du -h "$SKYMAP_BACKUP" | cut -f1)"
    
    # Compress
    gzip "$SKYMAP_BACKUP"
    SKYMAP_BACKUP_GZ="${SKYMAP_BACKUP}.gz"
    log "Skymap backup compressed: $(du -h "$SKYMAP_BACKUP_GZ" | cut -f1)"
    
    # Upload to GCS
    /scripts/upload-to-gcs.sh "$SKYMAP_BACKUP_GZ" "skymap" "$TIMESTAMP"
    SKYMAP_UPLOAD_STATUS=$?
    
    if [ $SKYMAP_UPLOAD_STATUS -eq 0 ]; then
        log "Skymap backup uploaded successfully"
        rm -f "$SKYMAP_BACKUP_GZ"
    else
        log "ERROR: Skymap backup upload failed"
        exit 1
    fi
else
    log "ERROR: Skymap backup failed"
    exit 1
fi

# Backup Ozone database
log "Backing up Ozone database..."
OZONE_BACKUP="${BACKUP_DIR}/ozone-${TIMESTAMP}.sql"
export PGPASSWORD="$OZONE_PASSWORD"
pg_dump -h "$OZONE_HOST" -p "$OZONE_PORT" -U "$OZONE_USER" -d "$OZONE_DB" > "$OZONE_BACKUP" 2>>"$LOG_FILE"

if [ $? -eq 0 ]; then
    log "Ozone backup created: $(du -h "$OZONE_BACKUP" | cut -f1)"
    
    # Compress
    gzip "$OZONE_BACKUP"
    OZONE_BACKUP_GZ="${OZONE_BACKUP}.gz"
    log "Ozone backup compressed: $(du -h "$OZONE_BACKUP_GZ" | cut -f1)"
    
    # Upload to GCS
    /scripts/upload-to-gcs.sh "$OZONE_BACKUP_GZ" "ozone" "$TIMESTAMP"
    OZONE_UPLOAD_STATUS=$?
    
    if [ $OZONE_UPLOAD_STATUS -eq 0 ]; then
        log "Ozone backup uploaded successfully"
        rm -f "$OZONE_BACKUP_GZ"
    else
        log "ERROR: Ozone backup upload failed"
        exit 1
    fi
else
    log "ERROR: Ozone backup failed"
    exit 1
fi

# Run cleanup
/scripts/cleanup.sh

log "Backup process completed successfully"
