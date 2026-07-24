# SkyMap Cloudflare Deployment

This directory contains Cloudflare Workers configuration for hosting SkyMap admin and web directory services.

## Setup

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Install dependencies:
```bash
npm install
```

## Deployment

Deploy both services:
```bash
npm run deploy
```

Or deploy individually:
```bash
npm run deploy-admin
npm run deploy-web
```

## Services

- **Admin**: https://admin.ozoneskymap.fema.monster
  - Admin dashboard for managing locations, hashtags, and Graze integration
  - Proxies API calls to local admin service (port 3009)

- **Web Directory**: https://directory.ozoneskymap.fema.monster  
  - Public directory for searching locations
  - Proxies API calls to local web service (port 3008)

## Configuration

Update the wrangler configuration files to match your domain and backend services:
- `wrangler-admin.toml` - Admin service configuration
- `wrangler-web.toml` - Web directory configuration

## Local Development

The Workers proxy requests to your local services, so ensure they're running:
```bash
cd /root/skymap
docker-compose up
```