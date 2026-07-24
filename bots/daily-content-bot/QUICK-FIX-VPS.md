# Quick Fix for VPS Hashtag Issue

Your current docker-compose.yml is missing the environment variable declarations. 

## Replace your docker-compose.yml with this:

```yaml
services:
  daily-content-bot:
    image: ghcr.io/femavibes/daily-content-bot:latest
    ports:
      - "4000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
      - ./.env:/app/.env
    restart: unless-stopped
    user: root
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - QUOTE_TAG=${QUOTE_TAG:-#QuoteOfTheDay}
      - WORD_TAG=${WORD_TAG:-#WordOfTheDay}
      - BLUESKY_HANDLE=${BLUESKY_HANDLE}
      - BLUESKY_PASSWORD=${BLUESKY_PASSWORD}
      - TIMEZONE=${TIMEZONE:-America/New_York}
```

## Then restart:

```bash
docker compose down
docker compose up -d
```

This will properly pass your .env file variables to the container.