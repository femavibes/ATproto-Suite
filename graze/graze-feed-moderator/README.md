# Feed Moderator Service

Moderation-as-a-Service for Bluesky feed creators. Provides automated post removal, communal moderation, and cross-feed intelligence without requiring complex infrastructure setup.

## Features

- **Multi-tenant moderation** - Single service supporting multiple feed creators
- **Report-based removal** - Use Bluesky's native report system with enhanced commands
- **Communal intelligence** - Shared spam/harassment detection across participating feeds
- **Threshold-based removal** - Auto-remove posts after X reports from different users
- **Web dashboard** - Easy feed management and configuration
- **Real-time processing** - Instant post removal via WebSocket label monitoring
- **Zero-trust authentication** - Optional mode where your Bluesky credentials never leave your infrastructure

## Authentication Modes

### Traditional Mode (Default)
- Provide Bluesky app password during registration
- Password encrypted and stored securely
- Simple, works immediately
- **Recommended for most users**

### Zero-Trust Mode (Advanced)
- Deploy your own authentication proxy
- Your Bluesky credentials never leave your infrastructure
- Complete control over access
- Full audit trail of all operations
- **For security-conscious users**

See [Zero-Trust Setup Guide](ZERO_TRUST_SETUP_GUIDE.md) for details.

## Quick Start

1. **Clone and configure:**
```bash
git clone <repo>
cd feed-moderator
cp .env.example .env
# Edit .env with your labeler credentials
```

2. **Start services:**
```bash
docker compose up -d
```

3. **Access dashboard:**
- Frontend: http://localhost:8080
- API: http://localhost:3000

## Architecture

- **Backend:** Node.js/Express API with PostgreSQL
- **Frontend:** Vue.js dashboard for feed management
- **Ozone Integration:** Multi-tenant report processing
- **Label Monitoring:** Real-time WebSocket subscription
- **Graze Integration:** Automated post removal

## Service Tiers

### Free Tier
- 1 feed per user
- Basic removal commands
- Communal moderation participation

### Paid Tier
- Unlimited feeds
- Advanced analytics
- Custom threshold settings
- Priority support

## Report Commands

### Standard Reports (Communal + Feed-Specific)
- **Spam** - Cross-feed removal + your feeds
- **Misleading** - Cross-feed removal + your feeds  
- **Harassment** - Cross-feed removal + your feeds
- **Sexual Content** - Cross-feed removal + your feeds
- **Illegal Content** - Cross-feed removal + your feeds

### Custom Commands (Feed-Specific Only)
Use "Other" report type with commands:
- `remove feedname` - Remove from specific feed
- `remove all` - Remove from all your feeds

## Development

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend  
```bash
cd frontend
npm install
npm run dev
```

### Database
```bash
# Access PostgreSQL
docker compose exec postgres psql -U feedmod -d feedmoderator
```

## License

MIT