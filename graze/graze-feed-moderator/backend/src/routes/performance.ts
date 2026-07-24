import express from 'express';
import { PerformanceMonitor } from '../services/performanceMonitor.js';

const router = express.Router();

// This will be set by the main app
let performanceMonitor: PerformanceMonitor;

export function setPerformanceMonitor(monitor: PerformanceMonitor) {
  performanceMonitor = monitor;
}

// Get performance statistics
router.get('/stats', (req, res) => {
  if (!performanceMonitor) {
    return res.status(503).json({ error: 'Performance monitoring not available' });
  }

  try {
    const stats = performanceMonitor.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting performance stats:', error);
    res.status(500).json({ error: 'Failed to get performance statistics' });
  }
});

// Reset performance statistics
router.post('/reset', (req, res) => {
  if (!performanceMonitor) {
    return res.status(503).json({ error: 'Performance monitoring not available' });
  }

  try {
    performanceMonitor.reset();
    res.json({ message: 'Performance statistics reset' });
  } catch (error) {
    console.error('Error resetting performance stats:', error);
    res.status(500).json({ error: 'Failed to reset performance statistics' });
  }
});

// Health check with detailed information
router.get('/health', async (req, res) => {
  try {
    const stats = performanceMonitor ? performanceMonitor.getStats() : null;
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
      },
      database: stats ? {
        totalQueries: stats.totalQueries,
        poolConnections: stats.poolStats
      } : null
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;