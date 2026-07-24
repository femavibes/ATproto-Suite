# Cloud Backup Setup Guide

This bot now supports automatic cloud backups to Google Cloud Storage with versioning, retention policies, and restore functionality.

## Features

- **Scheduled Backups**: Automatic backups on configurable schedule (daily, weekly, monthly)
- **Versioning**: Timestamped backup files for easy identification
- **Retention Policy**: Automatic cleanup of old backups (configurable days)
- **Restore Functionality**: One-click restore from any backup via web interface
- **Manual Backups**: Create backups on-demand from the control panel

## Setup Instructions

### 1. Create Google Cloud Storage Bucket

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Cloud Storage API
4. Create a storage bucket:
   - Choose a unique bucket name (e.g., `my-bot-backups-12345`)
   - Select appropriate region
   - Choose "Standard" storage class
   - Set access control to "Uniform"

### 2. Create Service Account

1. Go to IAM & Admin > Service Accounts
2. Click "Create Service Account"
3. Give it a name (e.g., `bot-backup-service`)
4. Grant it the "Storage Object Admin" role
5. Create and download the JSON key file
6. Save the key file securely on your server (e.g., `/home/user/gcs-key.json`)

### 3. Configure Bot Settings

Open the bot's settings panel and configure:

- **Google Cloud Project ID**: Your GCP project ID
- **Service Account Key File Path**: Full path to your JSON key file
- **Storage Bucket Name**: Your bucket name
- **Backup Schedule**: Choose frequency (daily recommended)
- **Retention Days**: How long to keep backups (30 days recommended)
- **Enable Cloud Backup**: Check this box to activate

### 4. Test the Setup

1. Click "Create Backup Now" in the settings panel
2. Check that the backup appears in the backup list
3. Verify the backup file exists in your GCS bucket

## Backup Contents

Each backup ZIP file contains:
- `quotes.json` - All quotes
- `words.json` - All words  
- `used_quotes.json` - Usage history for quotes
- `used_words.json` - Usage history for words
- `weighting_settings.json` - Current weighting configuration

## Security Notes

- Keep your service account key file secure and readable only by the bot process
- Use least-privilege access (Storage Object Admin role only)
- Consider using IAM roles instead of key files if running on Google Cloud
- Regularly rotate service account keys

## Troubleshooting

**"Cloud backup not configured"**: Check that all three settings (Project ID, Key File, Bucket Name) are filled in correctly.

**"Failed to initialize Google Cloud Storage"**: Verify the key file path is correct and the file is readable by the bot process.

**"Failed to upload backup"**: Check that the service account has Storage Object Admin permissions on the bucket.

**Backups not appearing**: Ensure the bucket name is correct and the service account has list permissions.

## Cost Considerations

Google Cloud Storage costs are minimal for bot backups:
- Standard storage: ~$0.02/GB/month
- Typical bot backup: <1MB
- Monthly cost: <$0.01

Set appropriate retention days to control storage costs.