# Scaling Considerations

## Database Connection Pool Issues

### Current Problem
- PostgreSQL connection limit reached (error 53300) during complex queries
- Current pool configuration: max 10 connections per backend instance
- Complex aggregation queries (trending banned users with array_agg) consume multiple connections

### Immediate Solutions
1. **Increase PostgreSQL max_connections**
   ```sql
   ALTER SYSTEM SET max_connections = 200;
   SELECT pg_reload_conf();
   ```

2. **Optimize Connection Pool Settings** (database.ts)
   ```javascript
   this.pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 20,                    // Increase from 10
     idleTimeoutMillis: 10000,   // Reduce from 30000
     connectionTimeoutMillis: 5000, // Increase from 2000
     acquireTimeoutMillis: 60000    // Add timeout for acquiring connections
   });
   ```

### Long-term Scaling Requirements

#### Database Optimizations
- **Read Replicas**: Separate read-only queries (trending data, reports) from write operations
- **Connection Pooling**: Use PgBouncer for connection pooling at database level
- **Query Optimization**: 
  - Add indexes on frequently queried columns (banned_at, banned_handle, banned_by_did)
  - Consider materialized views for trending calculations
  - Cache trending results with Redis

#### Application Architecture
- **Horizontal Scaling**: Multiple backend instances behind load balancer
- **Caching Layer**: Redis for trending data, user sessions, frequently accessed data
- **Background Jobs**: Move heavy calculations (trending analysis) to background workers
- **Rate Limiting**: Implement per-user rate limiting to prevent abuse

#### Monitoring & Alerts
- Database connection count monitoring
- Query performance tracking
- Connection pool utilization metrics
- Alert on connection pool exhaustion

### Estimated Capacity
- Current setup: ~50-100 concurrent users
- With optimizations: ~500-1000 concurrent users
- For larger scale: Requires architectural changes (microservices, caching, read replicas)

### Priority Actions
1. Increase PostgreSQL max_connections (immediate)
2. Optimize connection pool settings (immediate)
3. Add database indexes (short-term)
4. Implement Redis caching (medium-term)
5. Add read replicas (long-term)