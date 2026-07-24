import { Pool } from 'pg';

export class QueryOptimizer {
  constructor(private pool: Pool) {}

  // Batch multiple queries into a single transaction
  async batchQueries(queries: Array<{ query: string; params: any[] }>): Promise<any[]> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      
      for (const { query, params } of queries) {
        const result = await client.query(query, params);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Optimized feed loading with joins
  async getFeedsWithUserData(userId: number): Promise<any[]> {
    const query = `
      SELECT 
        f.*,
        up.global_communal_enabled,
        up.global_threshold_spam,
        up.global_threshold_sexual,
        up.global_threshold_harassment,
        up.global_threshold_illegal,
        up.global_cross_type_percentage,
        up.global_user_ban_threshold_spam,
        up.global_user_ban_threshold_sexual,
        up.global_user_ban_threshold_harassment,
        up.global_user_ban_threshold_illegal,
        up.global_user_ban_cross_type_percentage
      FROM feeds f
      JOIN user_profiles up ON f.user_id = up.id
      WHERE f.user_id = $1
      ORDER BY f.feed_name
    `;
    
    const result = await this.pool.query(query, [userId]);
    return result.rows;
  }

  // Optimized banned users with pagination
  async getBannedUsersOptimized(userId: number, limit: number = 100, offset: number = 0): Promise<any[]> {
    const query = `
      SELECT 
        bu.*,
        up.avatar_url,
        up.display_name,
        f.feed_name,
        COUNT(*) OVER() as total_count
      FROM banned_users bu
      LEFT JOIN user_profiles up ON bu.banned_user_id = up.id
      LEFT JOIN feeds f ON bu.list_identifier = f.feed_id AND bu.user_id = f.user_id
      WHERE bu.user_id = $1
      ORDER BY bu.banned_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  // Optimized trending data with single query
  async getTrendingData(timeframe: string = '1d', showHidden: boolean = false): Promise<any> {
    const timeCondition = this.getTimeCondition(timeframe);
    
    const query = `
      WITH trending_posts AS (
        SELECT 
          post_uri,
          COUNT(DISTINCT moderator_did) as remover_count,
          COUNT(*) as removal_count,
          MAX(created_at) as last_removal,
          MIN(created_at) as first_removal,
          EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 3600 as time_span_hours,
          CASE 
            WHEN EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) > 0 
            THEN COUNT(*) / (EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 3600)
            ELSE COUNT(*)
          END as velocity
        FROM moderation_history
        WHERE created_at >= ${timeCondition}
          AND action IN ('manual_removal', 'backfill_removal')
          ${showHidden ? '' : 'AND post_uri NOT IN (SELECT post_uri FROM hidden_trending_posts)'}
        GROUP BY post_uri
        HAVING COUNT(DISTINCT moderator_did) >= 2
      ),
      trending_users AS (
        SELECT 
          target_handle,
          COUNT(DISTINCT moderator_did) as banner_count,
          COUNT(*) as ban_count,
          MAX(created_at) as last_ban,
          MIN(created_at) as first_ban
        FROM moderation_log
        WHERE created_at >= ${timeCondition}
          AND action IN ('manual_ban', 'auto_ban')
          AND target_handle IS NOT NULL
          ${showHidden ? '' : 'AND target_handle NOT IN (SELECT banned_handle FROM hidden_trending_banned_users)'}
        GROUP BY target_handle
        HAVING COUNT(DISTINCT moderator_did) >= 2
      )
      SELECT 
        'post' as type,
        post_uri as identifier,
        remover_count,
        removal_count as count,
        velocity,
        time_span_hours,
        last_removal as last_action
      FROM trending_posts
      UNION ALL
      SELECT 
        'user' as type,
        target_handle as identifier,
        banner_count as remover_count,
        ban_count as count,
        0 as velocity,
        EXTRACT(EPOCH FROM (last_ban - first_ban)) / 3600 as time_span_hours,
        last_ban as last_action
      FROM trending_users
      ORDER BY count DESC, velocity DESC
      LIMIT 50
    `;
    
    const result = await this.pool.query(query);
    return result.rows;
  }

  private getTimeCondition(timeframe: string): string {
    switch (timeframe) {
      case '1h': return "NOW() - INTERVAL '1 hour'";
      case '6h': return "NOW() - INTERVAL '6 hours'";
      case '1d': return "NOW() - INTERVAL '1 day'";
      case '3d': return "NOW() - INTERVAL '3 days'";
      case '7d': return "NOW() - INTERVAL '7 days'";
      default: return "NOW() - INTERVAL '1 day'";
    }
  }

  // Optimized user activity with single query
  async getUserActivityOptimized(userId: number, limit: number = 50): Promise<any[]> {
    const query = `
      SELECT 
        mh.*,
        f.feed_name,
        pp.feed_id as protected_feed_id
      FROM moderation_history mh
      LEFT JOIN feeds f ON mh.feed_id = f.feed_id
      LEFT JOIN protected_posts pp ON mh.post_uri = pp.post_uri AND mh.feed_id = pp.feed_id
      WHERE mh.moderator_did = (
        SELECT did FROM user_profiles WHERE id = $1
      )
      ORDER BY mh.created_at DESC
      LIMIT $2
    `;
    
    const result = await this.pool.query(query, [userId, limit]);
    return result.rows;
  }
}