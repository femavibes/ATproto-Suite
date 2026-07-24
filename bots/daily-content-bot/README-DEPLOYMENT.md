# Deployment Instructions

## For VPS/Production Deployment (Using Pre-built Image)

1. Create your `.env` file with your settings:
```bash
BLUESKY_HANDLE=your-handle.bsky.social
BLUESKY_PASSWORD=your-app-password
QUOTE_TAG=#YourCustomQuoteTag
WORD_TAG=#YourCustomWordTag
TIMEZONE=America/New_York
```

2. Use the production docker-compose file:
```bash
docker compose -f docker-compose.prod.yml up -d
```

This will pull the latest pre-built image and properly load your environment variables.

## For Development (Building Locally)

Use the regular docker-compose file:
```bash
docker compose up -d --build
```

## Updating

To update to the latest version:
```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```