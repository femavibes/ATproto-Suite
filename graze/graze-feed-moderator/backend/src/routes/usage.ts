import express from 'express';
import { RateLimiterService } from '../services/rateLimiter.js';
import { Database } from '../services/database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
const db = Database.getInstance();
const rateLimiter = new RateLimiterService(db);

// Get current usage stats
router.get('/stats', authenticateToken, async (req: any, res) => {
  try {
    const usage = await rateLimiter.getDailyUsage(req.user.userId);
    res.json(usage);
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
});

export default router;