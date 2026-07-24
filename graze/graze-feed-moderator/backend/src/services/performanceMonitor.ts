import { Pool } from 'pg';

export class PerformanceMonitor {
  private queryStats: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();
  private slowQueryThreshold = 1000; // 1 second

  constructor(private pool: Pool) {
    this.setupMonitoring();
  }

  private setupMonitoring() {
    // Monitor pool events
    this.pool.on('connect', () => {
      console.log('Database connection established');
    });

    this.pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });

    this.pool.on('acquire', () => {
      // Connection acquired from pool
    });

    this.pool.on('release', () => {
      // Connection released back to pool
    });
  }

  async executeQuery(query: string, params: any[] = []): Promise<any> {
    const startTime = Date.now();
    const queryKey = this.getQueryKey(query);

    try {
      const result = await this.pool.query(query, params);
      const executionTime = Date.now() - startTime;

      this.recordQueryStats(queryKey, executionTime);

      if (executionTime > this.slowQueryThreshold) {
        console.warn(`Slow query detected (${executionTime}ms):`, queryKey);
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`Query failed after ${executionTime}ms:`, queryKey, error);
      throw error;
    }
  }

  private getQueryKey(query: string): string {
    // Normalize query for statistics (remove specific values)
    return query
      .replace(/\$\d+/g, '$?') // Replace parameter placeholders
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 100); // Limit length
  }

  private recordQueryStats(queryKey: string, executionTime: number) {
    const stats = this.queryStats.get(queryKey) || { count: 0, totalTime: 0, avgTime: 0 };
    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;
    this.queryStats.set(queryKey, stats);
  }

  getStats() {
    const stats = Array.from(this.queryStats.entries())
      .map(([query, stats]) => ({ query, ...stats }))
      .sort((a, b) => b.avgTime - a.avgTime);

    return {
      totalQueries: Array.from(this.queryStats.values()).reduce((sum, s) => sum + s.count, 0),
      slowestQueries: stats.slice(0, 10),
      poolStats: {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      }
    };
  }

  reset() {
    this.queryStats.clear();
  }
}