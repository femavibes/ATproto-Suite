# Daily Content Bot - Deployment Guide

## Overview

This bot supports two deployment modes:
- **Development**: Build locally, mount source code for live editing
- **Production**: Use pre-built GitHub Container Registry image

## Quick Start

1. **Clone and Setup**:
   ```bash
   git clone <your-repo>
   cd daily-content-bot
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Deploy**:
   ```bash
   ./deploy.sh
   ```

## Directory Structure

```
daily-content-bot/
├── data/                    # Persistent data (mounted as volume)
│   ├── quotes.json         # Your quotes
│   ├── words.json          # Your words
│   ├── used_quotes.json    # Usage tracking
│   └── used_words.json     # Usage tracking
├── uploads/                # Uploaded images (mounted as volume)
├── public/                 # Static web files
├── docker-compose.dev.yml  # Development deployment
├── docker-compose.prod.yml # Production deployment
└── deploy.sh              # Deployment script
```

## Development vs Production

### Development Mode
- Builds Docker image locally
- Mounts source code for live editing
- Uses `docker-compose.dev.yml`
- Good for: Making changes, testing, development

### Production Mode
- Uses pre-built image from GitHub Container Registry
- Only mounts data directories
- Uses `docker-compose.prod.yml`
- Good for: VPS deployment, stable releases

## Manual Deployment

### Development
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Production
```bash
# Update image name in docker-compose.prod.yml first
docker-compose -f docker-compose.prod.yml up -d
```

## Data Persistence

Your bot data is stored in:
- `./data/` - JSON files with quotes, words, usage tracking
- `./uploads/` - Uploaded images
- `.env` - Configuration

These directories are mounted as volumes, so your data persists across container restarts.

## Troubleshooting

### Image Upload Issues
```bash
# Fix permissions
chmod 755 uploads data
find uploads -type f -exec chmod 644 {} \;
```

### Container Won't Start
```bash
# Check logs
docker-compose logs daily-content-bot

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Data Not Persisting
- Ensure `data/` and `uploads/` directories exist
- Check volume mounts in docker-compose file
- Verify file permissions (should be readable by user 1000)

## GitHub Actions (Optional)

To automatically build and push images to GitHub Container Registry:

1. Enable GitHub Actions in your repo
2. Set up repository secrets for container registry
3. Push to main branch to trigger build

## Best Practices

1. **Always use the deployment script** for consistency
2. **Backup your data directory** regularly
3. **Use production mode on VPS** for stability
4. **Test changes in development mode** first
5. **Keep .env file secure** and never commit it