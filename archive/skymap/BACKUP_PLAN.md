# PostgreSQL Backup Plan - Google Cloud Storage

## Overview
Automated backup system for two PostgreSQL databases (Skymap/Atlas and Ozone) with uploads to Google Cloud Storage.

## Database Details
- **Skymap Database**: Port 5435, database: `skymap`, user: `dev`
- **Ozone Database**: Port 5432, database: `ozone`, user: `postgres`
- **Current Sizes**: Skymap ~115 MB, Ozone ~11 MB (total ~126 MB)

## Google Cloud Storage Free Tier
- **Storage**: 5 GB per month (always free)
- **Class A Operations**: 5,000 uploads per month (free)
- **Class B Operations**: 50,000 downloads per month (free)

## Backup Strategy

### Backup Frequency
- **Daily Backups**: Both databases backed up once per day (default: 2:00 AM UTC)
- **Configurable**: Schedule can be changed via admin interface

### Backup Retention
- **Daily Backups**: Last 7 days
- **Weekly Backups**: Last 4 weeks (taken on Sundays)
- **Monthly Backups**: Last 3 months (taken on 1st of month)

### Backup Process
1. **pg_dump**: Create SQL dumps of both databases
2. **Compression**: Gzip compression (typically reduces size by 60-80%)
3. **Upload**: Upload to Google Cloud Storage bucket
4. **Cleanup**: Remove old backups based on retention policy
5. **Verification**: Verify backup integrity after upload

### Storage Estimation
- **Compressed Backup Size**: ~20-50 MB per backup (both databases)
- **Daily (7 days)**: ~350 MB
- **Weekly (4 weeks)**: ~200 MB
- **Monthly (3 months)**: ~150 MB
- **Total Estimated**: ~700 MB (well within 5 GB free tier)

## Implementation Components

### 1. Backup Service (Docker Container)
- **Image**: Custom image with `postgres-client`, `google-cloud-sdk`, and `cron`
- **Schedule**: Cron-based scheduling (configurable)
- **Location**: `/services/backup-service/`
- **Scripts**:
  - `backup.sh`: Main backup script
  - `upload-to-gcs.sh`: GCS upload script
  - `cleanup.sh`: Retention policy cleanup

### 2. Admin Interface
- **Route**: `/admin/backups.html`
- **Features**:
  - View backup history and status
  - Download backups
  - Configure backup schedule
  - Trigger manual backups
  - View backup logs
  - Monitor backup health

### 3. API Endpoints
- `GET /api/backups` - List all backups
- `GET /api/backups/:id/download` - Download backup
- `POST /api/backups/trigger` - Trigger manual backup
- `GET /api/backups/schedule` - Get current schedule
- `POST /api/backups/schedule` - Update schedule
- `GET /api/backups/status` - Get backup service status
- `GET /api/backups/logs` - Get backup logs

### 4. Environment Variables
Required `.env` variables:
```bash
# Google Cloud Storage (REQUIRED)
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=/root/skymap/gcs-credentials.json

# Ozone Database Password (REQUIRED if different from default)
OZONE_POSTGRES_PASSWORD=your-ozone-password

# Backup Configuration (optional, with defaults)
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM UTC (cron format)
BACKUP_RETENTION_DAILY=7   # Keep last 7 daily backups
BACKUP_RETENTION_WEEKLY=4  # Keep last 4 weekly backups
BACKUP_RETENTION_MONTHLY=3 # Keep last 3 monthly backups
```

**Note**: The `gcs-credentials.json` file should be placed in `/root/skymap/` and added to `.gitignore` for security.

## Quick Setup Guide

### 1. Google Cloud Setup

#### Create GCS Bucket
```bash
gsutil mb -p YOUR_PROJECT_ID -l us-central1 gs://your-bucket-name
```

#### Create Service Account
1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Create new service account with "Storage Object Admin" role
3. Create JSON key and download
4. Save as `/root/skymap/gcs-credentials.json`

### 2. Configure Environment Variables

Add to your `.env` file:
```bash
# Google Cloud Storage (REQUIRED)
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=/root/skymap/gcs-credentials.json

# Ozone Database Password (if different from default)
OZONE_POSTGRES_PASSWORD=your-ozone-password

# Backup Configuration (optional)
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM UTC
BACKUP_RETENTION_DAILY=7
BACKUP_RETENTION_WEEKLY=4
BACKUP_RETENTION_MONTHLY=3
```

### 3. Start Backup Service

```bash
docker-compose up -d backup-service
```

### 4. Access Admin Interface

Navigate to: `http://your-admin-url/admin/backups.html`

### 5. Verify Setup

1. Check service status in admin interface
2. Trigger a manual backup to test
3. Verify backup appears in GCS bucket
4. Check logs for any errors

## Backup File Naming
- Format: `{database}-{timestamp}.sql.gz`
- Examples:
  - `skymap-2024-01-15-020000.sql.gz`
  - `ozone-2024-01-15-020000.sql.gz`

## Monitoring & Alerts

### Health Checks
- Verify backup file exists after upload
- Check backup file size (should be > 0)
- Verify GCS upload success
- Log all backup operations

### Failure Handling
- Retry failed uploads (up to 3 attempts)
- Log errors to backup service logs
- Alert via admin interface if backups fail

## Restoration Process

### Manual Restoration
1. Download backup from admin interface
2. Extract: `gunzip backup-file.sql.gz`
3. Restore: `psql -U user -d database < backup-file.sql`

### Automated Restoration (Future)
- Admin interface option to restore from backup
- Verification before restoration
- Point-in-time recovery support

## Security Considerations
- Service account credentials stored securely
- Backups encrypted at rest in GCS
- Admin interface requires authentication
- Backup files contain sensitive data - handle with care

## Cost Analysis
- **Storage**: Free (within 5 GB limit)
- **Operations**: Free (within 5,000 uploads/month)
- **Estimated Monthly Cost**: $0 (stays within free tier)

## Future Enhancements
- [ ] Point-in-time recovery (WAL archiving)
- [ ] Backup encryption before upload
- [ ] Automated restoration via admin interface
- [ ] Email/Slack notifications on backup failures
- [ ] Backup verification (test restore in isolated environment)
- [ ] Cross-region backup replication
- [ ] Backup compression optimization (bzip2, xz)

## Maintenance
- Monitor backup service logs regularly
- Review backup sizes monthly
- Test restoration process quarterly
- Update retention policies as needed
- Rotate service account keys annually
