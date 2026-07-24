# Deployment Workflow Guide

## Standard Update Process

### 1. Develop on Local PC
```bash
cd /root/skymap

# Make your changes
# Test locally
docker compose up

# Commit changes
git add .
git commit -m "Description of changes"
git push
```

### 2. Deploy to VPS
```bash
# SSH into VPS
ssh user@vps-ip

# Navigate to project
cd /opt/skymap

# Pull latest changes
git pull

# Rebuild and restart services
docker compose down
docker compose build
docker compose up -d

# Check logs
docker compose logs -f
```

---

## Detailed Deployment Steps

### Quick Update (Code Changes Only)

**When to use**: Simple code changes, no database migrations, no new dependencies

```bash
# On VPS
cd /opt/skymap
git pull
docker compose restart
```

### Full Update (With Rebuilds)

**When to use**: New dependencies, Dockerfile changes, major updates

```bash
# On VPS
cd /opt/skymap

# Backup database first (safety)
docker compose exec postgres pg_dump -U dev skymap -F c -f /tmp/pre_update_backup.dump
docker compose cp postgres:/tmp/pre_update_backup.dump ./data/backups/pre_update_$(date +%Y%m%d_%H%M%S).dump

# Pull changes
git pull

# Rebuild containers
docker compose build

# Restart services
docker compose up -d

# Verify services are running
docker compose ps

# Check logs for errors
docker compose logs --tail=50
```

### Update with Database Migrations

**When to use**: Schema changes, new tables, data migrations

```bash
# On VPS
cd /opt/skymap

# 1. Backup database (CRITICAL!)
docker compose exec postgres pg_dump -U dev skymap -F c -f /tmp/pre_migration_backup.dump
docker compose cp postgres:/tmp/pre_migration_backup.dump ./data/backups/pre_migration_$(date +%Y%m%d_%H%M%S).dump

# 2. Pull changes
git pull

# 3. Run migrations (if you have a migration system)
# Check migrations/ directory for SQL files
docker compose exec postgres psql -U dev -d skymap -f /path/to/migration.sql

# OR if migrations are in init.sql or handled by app:
# (Some apps auto-run migrations on startup)

# 4. Rebuild and restart
docker compose build
docker compose up -d

# 5. Verify migration
docker compose exec postgres psql -U dev -d skymap -c "\d"  # List tables
```

---

## Automated Deployment Script

Create a deployment script for easier updates:

### `/opt/skymap/deploy.sh`
```bash
#!/bin/bash
set -e  # Exit on error

cd /opt/skymap

echo "🔄 Starting deployment..."

# Backup database
echo "📦 Backing up database..."
docker compose exec postgres pg_dump -U dev skymap -F c -f /tmp/pre_deploy_backup.dump
docker compose cp postgres:/tmp/pre_deploy_backup.dump ./data/backups/pre_deploy_$(date +%Y%m%d_%H%M%S).dump
echo "✅ Backup complete"

# Pull latest code
echo "📥 Pulling latest code..."
git pull
echo "✅ Code updated"

# Rebuild containers
echo "🔨 Rebuilding containers..."
docker compose build

# Restart services
echo "🚀 Restarting services..."
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Verify services
echo "✅ Checking service status..."
docker compose ps

echo "🎉 Deployment complete!"
echo ""
echo "Check logs with: docker compose logs -f"
```

**Make it executable:**
```bash
chmod +x /opt/skymap/deploy.sh
```

**Usage:**
```bash
./deploy.sh
```

---

## Environment Variables

### Important: `.env` file is NOT in git

When you update code, your `.env` file stays the same (it's not tracked by git).

**If you need to update environment variables:**

```bash
# On VPS
cd /opt/skymap

# Edit .env file
nano .env

# Restart services to pick up changes
docker compose restart
```

**Or add new variables:**
```bash
# Add to .env
echo "NEW_VAR=value" >> .env
docker compose restart
```

---

## Zero-Downtime Deployment (Advanced)

For production with minimal downtime:

### Option 1: Rolling Restart
```bash
# Restart services one at a time
docker compose restart web-directory
sleep 5
docker compose restart admin
sleep 5
docker compose restart command-bot
# etc.
```

### Option 2: Blue-Green (if using load balancer)
- Deploy new version to different ports
- Switch traffic
- Shut down old version

---

## Rollback Procedure

If something goes wrong:

### Quick Rollback (Code Only)
```bash
cd /opt/skymap

# Revert to previous commit
git log  # Find previous commit hash
git checkout <previous-commit-hash>

# Rebuild and restart
docker compose build
docker compose up -d
```

### Full Rollback (With Database)
```bash
cd /opt/skymap

# 1. Revert code
git checkout <previous-commit-hash>

# 2. Restore database
docker compose exec postgres pg_restore -U dev -d skymap -v -c ./data/backups/pre_deploy_YYYYMMDD_HHMMSS.dump

# 3. Rebuild and restart
docker compose build
docker compose up -d
```

---

## Best Practices

### 1. Always Backup Before Updates
```bash
# Make this a habit
docker compose exec postgres pg_dump -U dev skymap -F c -f /tmp/backup.dump
```

### 2. Test Locally First
- Test changes on your PC before pushing
- Use `docker compose up` to verify locally

### 3. Commit Often, Deploy When Ready
- Small, frequent deployments are safer
- Easier to rollback if needed

### 4. Monitor After Deployment
```bash
# Watch logs for first few minutes
docker compose logs -f

# Check service health
docker compose ps
curl http://localhost:3008/health  # If you have health endpoints
```

### 5. Keep Backups Organized
```bash
# Create backups directory
mkdir -p /opt/skymap/data/backups

# Backup naming: pre_deploy_YYYYMMDD_HHMMSS.dump
```

---

## Common Update Scenarios

### Scenario 1: Bug Fix
```bash
# On PC: Fix bug, commit, push
git commit -m "Fix: Description"
git push

# On VPS: Quick update
cd /opt/skymap && git pull && docker compose restart
```

### Scenario 2: New Feature
```bash
# On PC: Develop, test, commit, push
git commit -m "Feature: Description"
git push

# On VPS: Full rebuild (in case of new dependencies)
cd /opt/skymap
git pull
docker compose build
docker compose up -d
```

### Scenario 3: Database Schema Change
```bash
# On PC: Create migration, test, commit, push
# migrations/001_add_new_table.sql
git commit -m "Migration: Add new table"
git push

# On VPS: Backup, pull, migrate, restart
cd /opt/skymap
# Backup (see "Update with Database Migrations" above)
git pull
docker compose exec postgres psql -U dev -d skymap -f migrations/001_add_new_table.sql
docker compose restart
```

### Scenario 4: Environment Variable Change
```bash
# On VPS only (not in git)
cd /opt/skymap
nano .env  # Edit variables
docker compose restart
```

---

## Troubleshooting

### Services Won't Start
```bash
# Check logs
docker compose logs

# Check for port conflicts
sudo netstat -tulpn | grep -E '3008|3009|3010|5435'

# Check Docker
docker ps -a
```

### Database Connection Errors
```bash
# Verify PostgreSQL is running
docker compose ps postgres

# Check database exists
docker compose exec postgres psql -U dev -l

# Test connection
docker compose exec postgres psql -U dev -d skymap -c "SELECT 1;"
```

### Git Pull Conflicts
```bash
# If you have local changes on VPS (shouldn't happen, but...)
git stash
git pull
git stash pop
```

---

## Summary: Your Workflow

1. **Develop on PC** → Make changes, test locally
2. **Commit & Push** → `git add . && git commit -m "..." && git push`
3. **Deploy to VPS** → `ssh vps && cd /opt/skymap && git pull && docker compose build && docker compose up -d`
4. **Verify** → Check logs, test endpoints
5. **Monitor** → Watch for errors

That's it! Simple and effective. 🚀
