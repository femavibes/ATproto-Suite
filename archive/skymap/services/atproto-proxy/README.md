# AT Protocol Proxy Service

Lightweight AT Protocol server that serves SkyMap location lists from the database.

## Purpose

Bypasses Bluesky's 3000-member list limit by serving lists directly from our PostgreSQL database via AT Protocol.

## DID

`did:web:lists.fema.monster`

## Endpoints

### DID Document
- **GET** `/.well-known/did.json`
- Returns DID document pointing to this service

### Get List
- **GET** `/xrpc/app.bsky.graph.getList?list=at://did:web:lists.fema.monster/app.bsky.graph.list/{location_key}`
- Returns list members from database
- Supports pagination via `cursor` and `limit` parameters

### Get Record
- **GET** `/xrpc/com.atproto.repo.getRecord?repo={did}&collection=app.bsky.graph.list&rkey={location_key}`
- Returns list metadata

### Health Check
- **GET** `/health`
- Returns service status

## List URI Format

```
at://did:web:lists.fema.monster/app.bsky.graph.list/{location_key}
```

Examples:
- `at://did:web:lists.fema.monster/app.bsky.graph.list/US-OR-Portland`
- `at://did:web:lists.fema.monster/app.bsky.graph.list/US-WA-Seattle`

## Usage in Graze

1. In Graze editor, add a "member of list" node
2. Enter the list URI (e.g., `at://did:web:lists.fema.monster/app.bsky.graph.list/US-OR-Portland`)
3. Graze will query this service and cache results for 3 hours
4. When users are added/removed from the database, Graze will pick up changes on next cache refresh

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 3010)

## Running

```bash
# Development
npm install
npm run dev

# Production (via Docker)
docker-compose up atproto-proxy
```

## Testing

```bash
# Test DID document
curl http://localhost:3010/.well-known/did.json

# Test list query
curl "http://localhost:3010/xrpc/app.bsky.graph.getList?list=at://did:web:lists.fema.monster/app.bsky.graph.list/US-OR-Portland"

# Test health
curl http://localhost:3010/health
```

## Benefits

- ✅ No 3000-member limit
- ✅ Auto-updates in Graze (3-hour cache)
- ✅ No Bluesky account bans
- ✅ Single source of truth (database)
- ✅ Works with standard Graze nodes
