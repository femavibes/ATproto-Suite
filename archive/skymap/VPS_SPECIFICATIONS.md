# VPS Specifications Guide for SkyMap

## System Overview

SkyMap runs **6+ Node.js services** plus **PostgreSQL**:
- PostgreSQL (database)
- Admin service (port 3009)
- Web-directory (port 3008) 
- Command-bot (Bluesky mention listener)
- Contrails-listener (real-time feed listener)
- Atproto-proxy (port 3010)
- List-manager (Bluesky API integration)
- Data-parser (periodic processing)

## Recommended Specifications

### 🟢 **Starter/Development (Low Traffic)**
**Use case**: < 100 concurrent users, testing, development

**Minimum Specs:**
- **CPU**: 2 vCPU cores
- **RAM**: 2-4 GB
- **Storage**: 20-40 GB SSD
- **Bandwidth**: 1-2 TB/month
- **Estimated Cost**: $5-10/month (DigitalOcean Droplet, Linode, Vultr)

**Rationale:**
- PostgreSQL needs ~1-2GB RAM for comfortable operation
- Node.js services are lightweight but you have 6+ of them
- Database will be small initially (805 cities + user data)
- Low concurrent load

---

### 🟡 **Production (Moderate Traffic)**
**Use case**: 100-1,000 concurrent users, steady growth

**Recommended Specs:**
- **CPU**: 4 vCPU cores
- **RAM**: 4-8 GB
- **Storage**: 40-80 GB SSD
- **Bandwidth**: 2-4 TB/month
- **Estimated Cost**: $20-40/month

**Why these specs:**
- **4GB RAM minimum**: PostgreSQL (~2GB) + Node services (~1-2GB) + OS buffer
- **4 vCPU cores**: Handle multiple concurrent Bluesky API calls, web requests, and database queries
- **Storage**: Database growth (user_labels, processed_mentions can grow large over time)
- **Bandwidth**: Bluesky API calls, web traffic, potential image/media serving

**Recommended Providers:**
- **DigitalOcean**: $24/month (4GB RAM, 2 vCPU, 80GB SSD)
- **Linode**: $24/month (4GB RAM, 2 vCPU, 80GB SSD)
- **Vultr**: $24/month (4GB RAM, 2 vCPU, 160GB SSD)
- **Hetzner**: €10.70/month (4GB RAM, 2 vCPU, 80GB SSD) - *best value in EU*

---

### 🔴 **High Traffic (Scaling)**
**Use case**: 1,000+ concurrent users, multiple locations, heavy Bluesky API usage

**Recommended Specs:**
- **CPU**: 8 vCPU cores
- **RAM**: 8-16 GB
- **Storage**: 80-160 GB SSD
- **Bandwidth**: 4-8 TB/month
- **Estimated Cost**: $40-80/month

**Optimization Considerations:**
- Consider separating PostgreSQL to its own instance (managed DB)
- Add Redis for caching (rate limits, frequent lookups)
- Load balancer if needed for multiple web instances

---

## Critical Resource Considerations

### 1. **RAM is Your Bottleneck**
- PostgreSQL shared_buffers should be ~25% of RAM
- Node.js services are relatively memory-efficient
- **Minimum**: 2GB for dev, 4GB for production
- **Watch**: Database connection pooling to prevent memory leaks

### 2. **Database Storage Growth**
Storage needs will grow based on:
- **User labels**: ~1KB per user per location (3 max per user)
- **Processed mentions**: ~500 bytes per mention (prevents duplicates)
- **Bluesky lists**: Small metadata per list bucket
- **Location post stats**: Minimal (aggregated data)

**Example growth:**
- 10,000 users with 3 labels each: ~30 MB
- 100,000 processed mentions: ~50 MB
- 1,000 lists: ~1 MB
- **Initial database**: ~100-200 MB
- **After 1 year moderate use**: ~2-5 GB

### 3. **Network/API Rate Limits**
- Bluesky API calls from multiple services simultaneously
- Real-time feed listening (contrails-listener) is continuous
- Web directory searches may hit database frequently
- **Bandwidth**: Estimate 10-50 GB/month for API traffic at moderate scale

### 4. **CPU for Concurrent Operations**
- Multiple Node.js processes running simultaneously
- Database queries (mostly indexed, should be fast)
- Bluesky API HTTP requests
- **2 vCPU**: Okay for dev/light production
- **4+ vCPU**: Recommended for production with concurrent users

---

## OVH VPS Options (Recommended for SkyMap)

OVH offers excellent value with daily backups included. Here's how their tiers map to SkyMap needs:

### 🎯 **VPS-1 - Perfect Starting Point** ⭐ **RECOMMENDED**
- **Specs**: 4 vCores, **8 GB RAM**, 75 GB SSD
- **Price**: **$4.20/month**
- **Why it's perfect**: 
  - Exceeds our RAM recommendation (8GB > 4-8GB requirement)
  - 4 vCores matches our production recommendation
  - 75GB storage is plenty for initial deployment (you'll have room for 3-5 years of growth)
  - Daily backups included (great for production)
  - Unlimited traffic means no bandwidth worries
  - **Best price/performance ratio for your stack**

**Verdict**: Start here. This handles 1,000-2,000 users comfortably.

---

### 🟡 **VPS-2 - Extra Headroom**
- **Specs**: 6 vCores, **12 GB RAM**, 100 GB SSD NVMe
- **Price**: **$6.75/month**
- **Why upgrade**: 
  - NVMe SSD (faster database operations)
  - More RAM headroom for future features (Redis, caching)
  - Extra vCores if you plan heavy Bluesky API usage
  - Still excellent value at ~60% more cost for 50% more resources

**Verdict**: Choose if you want breathing room or plan aggressive growth in first year.

---

### 🔴 **VPS-3+ - Future Scaling** (Overkill for initial launch)
- **VPS-3**: 8 vCores, 24 GB RAM, 200 GB NVMe - **$12.75/month**
- **VPS-4**: 12 vCores, 48 GB RAM, 300 GB NVMe - **$22.08/month**

**When to consider**: Only if you expect 5,000+ concurrent users or want to separate services across multiple instances.

---

### OVH Advantages for SkyMap
✅ **Daily backups included** (backups can cost extra elsewhere)  
✅ **Unlimited traffic** (great for Bluesky API polling)  
✅ **400+ Mbps bandwidth** (more than sufficient)  
✅ **No installation fees**  
✅ **Excellent price/performance** (VPS-1 beats $24/month competitors)

---

## Cost-Optimized Recommendations by Region

### **Best Value - OVH** ⭐
- **OVH VPS-1**: $4.20/month (8GB RAM, 4 vCPU, 75GB SSD) - *exceptional value with backups*
- **OVH VPS-2**: $6.75/month (12GB RAM, 6 vCPU, 100GB NVMe) - *premium tier value*

### **Alternative Options (EU)**
- **Hetzner Cloud**: €10.70/month (4GB RAM, 2 vCPU, 80GB SSD)
- **Hetzner**: €18.89/month (8GB RAM, 4 vCPU, 160GB SSD)

### **US-Based (Good Performance)**
- **DigitalOcean**: $24/month (4GB RAM, 2 vCPU, 80GB SSD)
- **Linode**: $24/month (similar specs)
- **Vultr**: $24/month (similar, more storage)

### **Budget Options**
- **Contabo**: €8.99/month (4GB RAM, 4 vCPU, 200GB SSD) - *check performance*
- **SSDNodes**: Various budget options - *research reliability*

---

## Starting Recommendation

**For initial production deployment, start with:**

✅ **4 vCPU cores**  
✅ **4-8 GB RAM** (8GB preferred for comfort)  
✅ **75-80 GB SSD**  
✅ **Ubuntu 22.04 LTS**

This gives you:
- Headroom for growth (2x user base)
- Comfortable PostgreSQL operation
- Multiple concurrent services without contention
- Room for database growth (3-5 years)
- Ability to optimize before needing to upgrade

### **Recommended Choice: OVH VPS-1**
**Monthly Cost**: **$4.20/month** (OVH VPS-1)
- 4 vCPU ✅
- 8 GB RAM ✅ (exceeds requirement)
- 75 GB SSD ✅ (sufficient)
- Daily backups included ✅
- Unlimited traffic ✅

**Alternative**: OVH VPS-2 at $6.75/month if you want NVMe and extra headroom.

---

## Monitoring & Scaling Triggers

**Watch these metrics to know when to upgrade:**

1. **RAM Usage > 80%**: Upgrade to 8GB
2. **CPU Load Average > 4.0** (on 4 vCPU): Upgrade to 8 vCPU
3. **Disk Usage > 70%**: Increase storage or clean up old data
4. **Database connection errors**: Increase RAM or optimize queries
5. **Slow API responses**: Check CPU/RAM, consider caching (Redis)

---

## Database-Specific Considerations

Since PostgreSQL is the backbone:

- **PostgreSQL 15** (your docker-compose uses this) runs well on 2GB+ RAM
- Consider **managed PostgreSQL** (DigitalOcean Managed DB, AWS RDS) if you scale beyond 16GB RAM
- **Connection pooling** is critical (pgBouncer recommended for 4GB+ instances)
- Regular **VACUUM** operations to manage database bloat

---

## Optional Optimizations

### **Add Redis** (can run on same VPS initially)
- Cache location lookups
- Rate limiting storage
- Session storage
- **Adds ~200-500MB RAM requirement**

### **CDN for Static Assets**
- If serving images/custom assets
- Reduces bandwidth usage
- **Cloudflare** (free tier) works great

### **Separate Database Instance** (advanced)
- Only needed at 1000+ concurrent users
- Separates compute from storage concerns
- Costs extra but improves scalability

---

## Quick Decision Matrix

| Scenario | RAM | vCPU | Storage | Monthly Cost | OVH Option |
|----------|-----|------|---------|--------------|------------|
| Development/Testing | 2-4 GB | 2 | 40 GB | $5-10 | - |
| **Initial Production** | **8 GB** | **4** | **75 GB** | **$4.20** | **VPS-1** ⭐ |
| Production+ Headroom | 12 GB | 6 | 100 GB NVMe | $6.75 | VPS-2 |
| Growing (500+ users) | 8-12 GB | 4-6 | 100-200 GB | $6.75 | VPS-2 |
| High Traffic | 24 GB | 8+ | 200+ GB | $12.75+ | VPS-3+ |

**Recommendation**: Start with **OVH VPS-1** ($4.20/month). It has 8GB RAM which exceeds the 4-8GB requirement, and you can always upgrade to VPS-2 ($6.75/month) later if needed. This gives you comfortable headroom for the first 1,000-2,000 users at a fraction of competitor pricing.
