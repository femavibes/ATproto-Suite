# VPS Deployment Instructions

## Option 1: Build on VPS (Recommended)

1. Clone/pull the latest code on your VPS:
```bash
git pull origin main
```

2. Build and run the container:
```bash
docker compose down
docker compose up -d --build
```

## Option 2: Use Environment Variables in Docker Compose

Add this to your docker-compose.yml on the VPS:

```yaml
services:
  daily-content-bot:
    build: .
    ports:
      - "4000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
      - ./.env:/app/.env
    restart: unless-stopped
    user: root
    environment:
      - NODE_ENV=production
      - QUOTE_TAG=${QUOTE_TAG:-#QuoteOfTheDay}
      - WORD_TAG=${WORD_TAG:-#WordOfTheDay}
```

## Option 3: Set Environment Variables Directly

In your docker-compose.yml, set the hashtags directly:

```yaml
services:
  daily-content-bot:
    build: .
    ports:
      - "4000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
      - ./.env:/app/.env
    restart: unless-stopped
    user: root
    environment:
      - NODE_ENV=production
      - QUOTE_TAG=#Urbanism+DailyQuote
      - WORD_TAG=#Urbanism+DailyWord
```