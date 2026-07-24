# Bluesky Feed Platform

> A minimal, extensible Bluesky feed platform where the community builds most features as modules.

## 🎯 Status

**Current Phase:** Foundation Setup  
**Progress:** See [PROGRESS.md](./PROGRESS.md)

## 🏗️ Architecture

- **Simple core** (~2000 lines of code)
- **Plugin architecture** for everything else
- **Visual rule builder** for complex feed logic
- **Modules** can extend the rule builder with custom fields

See [PLATFORM_PLAN.md](./PLATFORM_PLAN.md) for complete architecture documentation.

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose v2
- Python 3.11+ (for local development)

### Setup

1. **Run installer (recommended):**
   ```bash
   ./install.sh
   ```

   The installer writes `.env`, starts Docker services, auto-configures `PUBLIC_URL` as `https://<public-ip>.sslip.io` (when public IP is detectable), and prints exact URLs to open for onboarding (`/setup`) so users do not need to guess host/IP.

2. **Or start services manually:**
   ```bash
   docker compose up -d
   ```

3. **Verify database:**
   ```bash
   docker compose exec postgres psql -U feedgen -d feedgen -c "\dt"
   ```

4. **Services will be added as we build them**

## 📁 Project Structure

```
feed-gen/
├── database/
│   └── schema.sql          # Database schema
├── services/               # Independent services
│   ├── jetstream-ingestion/
│   ├── feed-api/
│   ├── feed-assignment-worker/
│   └── ...
├── shared/                 # Shared utilities (if needed)
├── docker-compose.yml      # Service orchestration
├── PLATFORM_PLAN.md        # Complete architecture
└── PROGRESS.md             # Development progress
```

## 🔧 Technology Stack

- **Backend:** Python 3.11+ with FastAPI
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **Deployment:** Docker Compose v2

## 📚 Documentation

- [PLATFORM_PLAN.md](./PLATFORM_PLAN.md) - Complete architecture and design
- [PROGRESS.md](./PROGRESS.md) - Development progress and decisions
- [AUTH.md](./AUTH.md) - OAuth + local auth setup
- [PUBLISH_FEEDS.md](./PUBLISH_FEEDS.md) - Publishing checklist
- [legacy/](./legacy/) - Reference code (not used in production)

## 🎯 MVP Scope

**v1.0 (~2000 lines):**
- [ ] Firehose ingestion (Aho-Corasick)
- [ ] Feed assignment (rule evaluation)
- [ ] Module execution framework
- [ ] Feed API (Bluesky AT Proto)
- [ ] Visual rule builder UI
- [ ] Pinned/rotating posts
- [ ] Manual post injection
- [ ] Docker Compose deployment

## 🤝 Contributing

This is an AI-first development project. Code follows these principles:
- Modularity over efficiency
- Stability over performance
- Documentation-first
- AI-friendly code style

See [PLATFORM_PLAN.md](./PLATFORM_PLAN.md#-ai-first-development-philosophy) for details.

## 📄 License

TBD
