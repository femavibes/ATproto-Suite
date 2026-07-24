import { RateLimiterService } from '../services/rateLimiter.js';

interface DatabaseLike {
  getPool(): any;
  getUserById(userId: number): Promise<any>;
}

let rateLimiterService: RateLimiterService | null = null;

function initRateLimiter(pool: any): RateLimiterService {
  if (!rateLimiterService) {
    const dbWrapper: DatabaseLike = {
      getPool: () => pool,
      getUserById: async (userId: number) => {
        try {
          const result = await pool.query('SELECT * FROM user_profiles WHERE id = $1', [userId]);
          return result.rows[0] || null;
        } catch (error) {
          console.error('Database query failed in getUserById:', error);
          return null;
        }
      }
    };
    rateLimiterService = new RateLimiterService(dbWrapper as any);
  }
  return rateLimiterService;
}

export async function checkApiRateLimit(req: any, res: any, next: any) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rateLimiter = initRateLimiter(req.app.get('db'));
    const limit = await rateLimiter.checkApiLimit(req.user.userId);
    
    if (!limit.allowed) {
      return res.status(429).json({ 
        error: 'API rate limit exceeded',
        limit: limit.limit,
        remaining: 0,
        resetTime: 'midnight UTC'
      });
    }

    await rateLimiter.incrementApiCount(req.user.userId);

    res.set({
      'X-RateLimit-Limit': limit.limit.toString(),
      'X-RateLimit-Remaining': (limit.remaining - 1).toString(),
      'X-RateLimit-Reset': 'midnight UTC'
    });

    next();
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return res.status(500).json({ error: 'Rate limit check failed' });
  }
}

export async function checkRemovalRateLimit(req: any, res: any, next: any) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rateLimiter = initRateLimiter(req.app.get('db'));
    const limit = await rateLimiter.checkRemovalLimit(req.user.userId);
    
    if (!limit.allowed) {
      return res.status(429).json({ 
        error: 'Daily removal limit exceeded',
        limit: limit.limit,
        remaining: 0,
        resetTime: 'midnight UTC'
      });
    }

    req.rateLimitInfo = limit;
    next();
  } catch (error) {
    console.error('Removal rate limit check failed:', error);
    return res.status(500).json({ error: 'Rate limit check failed' });
  }
}