import { Database } from './database.js';

export class RateLimiterService {
  constructor(private db: Database) {}

  private getLimits(subscriptionTier: string) {
    switch (subscriptionTier) {
      case 'premium': return { removals: 50000, apiCalls: 1000000 };
      case 'paid': return { removals: 10000, apiCalls: 500000 };
      case 'free':
      default: return { removals: 1000, apiCalls: 100000 };
    }
  }

  async checkRemovalLimit(userId: number): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const user = await this.db.getUserById(userId);
    if (!user) throw new Error('User not found');

    const limits = this.getLimits(user.subscription_tier);
    const today = new Date().toISOString().split('T')[0];

    const usage = await this.db.getPool().query(
      'SELECT removal_count FROM daily_usage WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    const currentCount = usage.rows[0]?.removal_count || 0;
    const remaining = Math.max(0, limits.removals - currentCount);

    return {
      allowed: currentCount < limits.removals,
      remaining,
      limit: limits.removals
    };
  }

  async checkApiLimit(userId: number): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const user = await this.db.getUserById(userId);
    if (!user) throw new Error('User not found');

    const limits = this.getLimits(user.subscription_tier);
    const today = new Date().toISOString().split('T')[0];

    const usage = await this.db.getPool().query(
      'SELECT api_call_count FROM daily_usage WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    const currentCount = usage.rows[0]?.api_call_count || 0;
    const remaining = Math.max(0, limits.apiCalls - currentCount);

    return {
      allowed: currentCount < limits.apiCalls,
      remaining,
      limit: limits.apiCalls
    };
  }

  async incrementRemovalCount(userId: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    await this.db.getPool().query(`
      INSERT INTO daily_usage (user_id, date, removal_count, api_call_count)
      VALUES ($1, $2, 1, 0)
      ON CONFLICT (user_id, date)
      DO UPDATE SET 
        removal_count = daily_usage.removal_count + 1,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, today]);
  }

  async incrementApiCount(userId: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    await this.db.getPool().query(`
      INSERT INTO daily_usage (user_id, date, removal_count, api_call_count)
      VALUES ($1, $2, 0, 1)
      ON CONFLICT (user_id, date)
      DO UPDATE SET 
        api_call_count = daily_usage.api_call_count + 1,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, today]);
  }

  async getDailyUsage(userId: number): Promise<{ removals: number; apiCalls: number; limits: any }> {
    const user = await this.db.getUserById(userId);
    if (!user) throw new Error('User not found');

    const limits = this.getLimits(user.subscription_tier);
    const today = new Date().toISOString().split('T')[0];

    const usage = await this.db.getPool().query(
      'SELECT removal_count, api_call_count FROM daily_usage WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    const current = usage.rows[0] || { removal_count: 0, api_call_count: 0 };

    return {
      removals: current.removal_count,
      apiCalls: current.api_call_count,
      limits
    };
  }
}