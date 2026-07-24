import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import helmet from 'helmet';
import NodeCache from 'node-cache';
import { Database } from './services/database.js';
import { OzoneService } from './services/ozone.js';
import { ModMasterService } from './services/modMasterService.js';
import { LabelWatcher } from './services/labelWatcher.js';
import { GrazeService } from './services/graze.js';
import { SyncScheduler } from './services/syncScheduler.js';
import { CommunalWorker } from './services/communalWorker.js';
import { PeriodicSyncManager } from './services/periodicSyncManager.js';
import authRoutes from './routes/auth.js';
import feedRoutes from './routes/feeds.js';
import adminRoutes from './routes/admin.js';
import testRoutes from './routes/test.js';
import moderationRoutes from './routes/moderation.js';
import communalRoutes from './routes/communal.js';
import whitelistRoutes from './routes/whitelist.js';
import usageRoutes from './routes/usage.js';
import userRoutes from './routes/user.js';
import autoblockRoutes from './routes/autoblock.js';
import emergencyRoutes from './routes/emergency.js';
import reportTypesRoutes from './routes/reportTypes.js';
import feedGroupsRoutes from './routes/feedGroups.js';
import modmasterRoutes from './routes/modmaster.js';
import customLabelerRoutes from './routes/customLabeler.js';
import performanceRoutes, { setPerformanceMonitor } from './routes/performance.js';
import apiKeysRoutes from './routes/apiKeys.js';
import extensionRoutes from './routes/extension.js';
import blueskyRoutes from './routes/bluesky.js';
import linkPreviewRoutes from './routes/linkPreview.js';
import { AutoBlockMonitor } from './services/autoBlockMonitor.js';
import { PerformanceMonitor } from './services/performanceMonitor.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting and IP detection (trust first proxy only)
app.set('trust proxy', 1);

// Initialize cache (TTL: 5 minutes, check period: 10 minutes)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow embedding for iframe support
  contentSecurityPolicy: false // Disable CSP for API
}));

// Compression middleware
app.use(compression());

// Rate limiting with monitoring
const rateLimitStore = new Map();
const requestTracker = new Map();

// Custom handler to track all requests and rate limit hits
const trackRateLimit = (type: string) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const windowMs = type === 'auth' ? 15 * 60 * 1000 : 1 * 60 * 1000;
    const limit = type === 'auth' ? 10 : 300;
    
    // Extract user info from JWT token if available
    let userInfo = null;
    const authHeader = req.headers.authorization;
    console.log('Rate limiting check - Auth header present:', !!authHeader);
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        if (decoded) {
          userInfo = {
            handle: decoded.handle || decoded.user_handle || decoded.username || null,
            userId: decoded.user_id || decoded.userId || decoded.id || null
          };
          console.log('JWT verified for rate limiting:', { handle: userInfo.handle, userId: userInfo.userId, decodedKeys: Object.keys(decoded) });
        }
      } catch (error: unknown) {
        console.log('JWT verification failed, trying decode:', error instanceof Error ? error.message : 'Unknown error');
        // Try decode without verification as fallback
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.decode(token) as any;
          if (decoded) {
            userInfo = {
              handle: decoded.handle || decoded.user_handle || decoded.username || null,
              userId: decoded.user_id || decoded.userId || decoded.id || null
            };
            console.log('JWT decoded (fallback) for rate limiting:', { handle: userInfo.handle, userId: userInfo.userId, decodedKeys: Object.keys(decoded) });
          }
        } catch (fallbackError: unknown) {
          console.log('JWT decode fallback also failed:', fallbackError instanceof Error ? fallbackError.message : 'Unknown error');
        }
      }
    }
    
    // Get real IP from X-Forwarded-For header if available
    const realIp = req.headers['x-forwarded-for'] ? 
      (req.headers['x-forwarded-for'] as string).split(',')[0].trim() : 
      req.ip || 'unknown';
    
    // Track all requests (not just hits) - use real IP for better tracking
    const requestKey = `${type}_${realIp}`;
    const existing = requestTracker.get(requestKey) || { requests: [], type, limit, window: windowMs };
    
    // Clean old requests outside the window
    existing.requests = existing.requests.filter((timestamp: number) => now - timestamp < windowMs);
    
    // Add current request
    existing.requests.push(now);
    existing.lastRequest = now;
    existing.count = existing.requests.length;
    existing.userInfo = userInfo; // Store latest user info
    if (userInfo?.handle) {
      console.log('Rate limiting tracking user:', userInfo.handle, 'for IP:', realIp);
    }
    
    requestTracker.set(requestKey, existing);
    
    const originalSend = res.send;
    res.send = function(body: any) {
      if (res.statusCode === 429) {
        const hitKey = `hit_${type}_${realIp}`;
        const existingHit = rateLimitStore.get(hitKey) || { count: 0, firstHit: now, lastHit: now };
        rateLimitStore.set(hitKey, {
          ...existingHit,
          count: existingHit.count + 1,
          lastHit: now,
          type,
          limit,
          window: windowMs,
          userInfo
        });
      }
      return originalSend.call(this, body);
    };
    next();
  };
};

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // Limit each IP to 300 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(trackRateLimit('general'));
app.use(limiter);

// More strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
});

// CORS configuration for production domain and browser extensions
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    const allowedOrigins = [
      'http://localhost:8081',
      'http://localhost:3000', 
      'https://modmaster.fema.monster',
      'http://modmaster.fema.monster',
      'https://bsky.app'
    ];
    
    // Allow requests with no origin (like mobile apps, curl, Postman) or from browser extensions
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cache middleware for GET requests
const cacheMiddleware = (duration: number = 300) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    const key = req.originalUrl;
    const cachedResponse = cache.get(key);
    
    if (cachedResponse) {
      return res.json(cachedResponse);
    }
    
    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(body: any) {
      cache.set(key, body, duration);
      return originalJson.call(this, body);
    };
    
    next();
  };
};

// Initialize services
const db = Database.getInstance();
const performanceMonitor = new PerformanceMonitor(db.pool);
setPerformanceMonitor(performanceMonitor);
const grazeService = new GrazeService();
const ozoneService = new OzoneService(db, grazeService);
const modMasterService = new ModMasterService(db, grazeService);
const labelWatcher = new LabelWatcher(db, ozoneService);
const syncScheduler = new SyncScheduler();
const communalWorker = CommunalWorker.getInstance();
const periodicSyncManager = new PeriodicSyncManager();
let autoBlockMonitor: AutoBlockMonitor | null = null;

// Routes
// Make database available to routes
app.set('db', db.pool);

app.use('/api/auth', trackRateLimit('auth'), authLimiter, authRoutes);
// Apply caching to read-heavy endpoints
app.use('/api/feeds', feedRoutes); // Remove caching for feeds to avoid auth issues
app.use('/api/admin', adminRoutes);
app.use('/api/test', testRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/communal', communalRoutes);
app.use('/api/whitelist', whitelistRoutes);
app.use('/api/usage', cacheMiddleware(300), usageRoutes); // Cache for 5 minutes
app.use('/api/user', cacheMiddleware(30), userRoutes); // Cache for 30 seconds
app.use('/api/autoblock', cacheMiddleware(10), autoblockRoutes); // Cache for 10 seconds
app.use('/api/emergency', emergencyRoutes);
app.use('/api/report-types', cacheMiddleware(600), reportTypesRoutes); // Cache for 10 minutes
app.use('/api/feed-groups', cacheMiddleware(60), feedGroupsRoutes); // Cache for 1 minute
app.use('/api/modmaster', modmasterRoutes);
app.use('/api/custom-labeler', customLabelerRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/keys', apiKeysRoutes);
app.use('/api/extension', extensionRoutes);
app.use('/api/bluesky', blueskyRoutes);
app.use('/api', linkPreviewRoutes);

// Debug endpoint to check JWT token structure
app.get('/api/admin/debug-token', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ error: 'No token provided' });
  }
  
  try {
    const token = authHeader.substring(7);
    // jwt is already imported at the top
    const decoded = jwt.decode(token);
    res.json({ 
      decoded,
      ip: req.ip,
      realIp: req.headers['x-forwarded-for'] ? 
        (req.headers['x-forwarded-for'] as string).split(',')[0].trim() : 
        req.ip,
      headers: {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip']
      }
    });
  } catch (error) {
    res.json({ error: 'Invalid token', details: error instanceof Error ? error.message : String(error) });
  }
});

// Rate limiting monitoring endpoint
app.get('/api/admin/rate-limits', (req, res) => {
  const now = Date.now();
  
  // Clean old request data
  for (const [key, data] of requestTracker.entries()) {
    const windowMs = data.window;
    data.requests = data.requests.filter((timestamp: number) => now - timestamp < windowMs);
    data.count = data.requests.length;
    if (data.requests.length === 0 && (!data.lastRequest || now - data.lastRequest > windowMs)) {
      requestTracker.delete(key);
    }
  }
  
  // Get current request usage
  const currentUsage = Array.from(requestTracker.entries())
    .map(([key, data]) => {
      const [type, ...ipParts] = key.split('_');
      const ip = ipParts.join('_');
      const percentage = Math.round((data.count / data.limit) * 100);
      return {
        key,
        ip,
        type,
        count: data.count,
        limit: data.limit,
        window: data.window,
        percentage,
        lastRequest: data.lastRequest ? new Date(data.lastRequest).toISOString() : null,
        minutesAgo: data.lastRequest ? Math.round((now - data.lastRequest) / 60000) : null,
        status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'normal',
        userHandle: data.userInfo?.handle || null,
        userId: data.userInfo?.userId || null
      };
    })
    .filter(item => item.count > 0)
    .sort((a, b) => b.percentage - a.percentage);
  
  // Get rate limit hits (429 responses)
  const hitStats = Array.from(rateLimitStore.entries())
    .map(([key, data]) => {
      const [, type, ...ipParts] = key.split('_');
      const ip = ipParts.join('_');
      return {
        key,
        ip,
        type: data.type,
        count: data.count,
        limit: data.limit,
        window: data.window,
        firstHit: new Date(data.firstHit).toISOString(),
        lastHit: new Date(data.lastHit).toISOString(),
        minutesAgo: Math.round((now - data.lastHit) / 60000),
        userHandle: data.userInfo?.handle || null,
        userId: data.userInfo?.userId || null
      };
    })
    .filter(item => item.minutesAgo < 60)
    .sort((a, b) => b.count - a.count);
    
  res.json({
    // Current usage stats
    activeIPs: new Set(currentUsage.map(u => u.ip)).size,
    totalRequests: currentUsage.reduce((sum, u) => sum + u.count, 0),
    authRequests: currentUsage.filter(u => u.type === 'auth').reduce((sum, u) => sum + u.count, 0),
    generalRequests: currentUsage.filter(u => u.type === 'general').reduce((sum, u) => sum + u.count, 0),
    warningIPs: currentUsage.filter(u => u.status === 'warning').length,
    exceededIPs: currentUsage.filter(u => u.status === 'exceeded').length,
    currentUsage,
    
    // Rate limit hits (429s)
    totalHitIPs: new Set(hitStats.map(s => s.ip)).size,
    totalHits: hitStats.reduce((sum, s) => sum + s.count, 0),
    authHits: hitStats.filter(s => s.type === 'auth').reduce((sum, s) => sum + s.count, 0),
    generalHits: hitStats.filter(s => s.type === 'general').reduce((sum, s) => sum + s.count, 0),
    recentHits: hitStats
  });
});

// Basic health check (detailed one is in /api/performance/health)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  try {
    await db.connect();
    console.log('Database connected');
    
    await ozoneService.initialize();
    console.log('Ozone service initialized');
    
    await modMasterService.initialize();
    console.log('ModMaster service initialized');
    
    // Start ModMaster monitoring in background
    modMasterService.startMonitoring().catch(error => {
      console.error('ModMaster monitoring error:', error);
    });
    
    try {
      labelWatcher.start();
      console.log('Label watcher started successfully');
    } catch (error) {
      console.error('Failed to start label watcher:', error);
      throw error;
    }
    
    // Use enhanced periodic sync instead of old sync scheduler
    periodicSyncManager.start(6); // Sync every 6 hours
    console.log('Enhanced periodic ban list sync started (6 hour intervals)');
    
    communalWorker.start(30000); // Process communal moderation every 30 seconds
    console.log('Communal moderation worker started');
    
    // Start auto-block monitor
    autoBlockMonitor = new AutoBlockMonitor(db.pool);
    autoBlockMonitor.start();
    console.log('Auto-block monitor started');
    
    // Note: OzoneService.startMonitoring() is NOT called here
    // ModMaster has replaced the old Ozone monitoring system
    
    app.listen(PORT, () => {
      console.log(`Feed Moderator API running on port ${PORT}`);
    });
  } catch (error: unknown) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
function gracefulShutdown(signal: string) {
  const sanitizedSignal = signal.replace(/[\r\n]/g, '');
  console.log(`Received ${sanitizedSignal}, shutting down gracefully...`);
  try {
    if (autoBlockMonitor) {
      autoBlockMonitor.stop();
      console.log('Auto-block monitor stopped');
    }
    periodicSyncManager.stop();
    console.log('Periodic sync manager stopped');
    // Note: labelWatcher, syncScheduler, and communalWorker don't have stop methods
    // They will be cleaned up when the process exits
  } catch (error: unknown) {
    console.error('Error during shutdown:', error);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();