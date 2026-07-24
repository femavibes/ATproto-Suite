const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const initLocationDisplayRoutes = require('./routes/location-display');
const initAdminInterestsRoutes = require('./routes/admininterests');
const initAuthRoutes = require('./routes/auth');
const initIngestionRoutes = require('./routes/ingestion');
const initBackupRoutes = require('./routes/backups');
const initShortenerRoutes = require('./routes/shortener');
const initSettingsPostsRoutes = require('./routes/settings-posts-api');
const initImageRoutes = require('./routes/images');
const initUserRoutes = require('./routes/users');
const initGrazeRoutes = require('./routes/graze');
const initLocationRoutes = require('./routes/locations');
const initAccountTypeRoutes = require('./routes/account-types');

const app = express();
app.set('trust proxy', 1);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(express.json());
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'admin-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Auth middleware - supports master admin (HTTP Basic) and whitelisted users (session)
const requireAuth = async (req, res, next) => {
  // Check session first
  if (req.session.authenticatedHandle) {
    return next();
  }
  
  // Check HTTP Basic Auth for master admin
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const credentials = Buffer.from(auth.slice(6), 'base64').toString();
    const [username, password] = credentials.split(':');
    
    if (username === process.env.BLUESKY_HANDLE && password === process.env.BLUESKY_PASSWORD) {
      req.session.authenticatedHandle = username;
      req.session.isMasterAdmin = true;
      return next();
    }
  }
  
  // Redirect to login page instead of HTTP Basic Auth prompt
  return res.redirect('/login');
};

// Mount auth routes (login, logout, session, whitelist)
const authRoutes = initAuthRoutes(pool, requireAuth);
app.use('/api', authRoutes);

// Serve static files (CSS, JS, etc) without auth - MUST BE BEFORE ROUTES
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Explicitly serve graze-session.js (in case static middleware doesn't catch it)
app.get('/graze-session.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'graze-session.js'));
});

// Serve refactor static files explicitly
app.use('/refactor', express.static(path.join(__dirname, 'public/refactor'), { index: false }));

// Serve index.html at root
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve refactored version
app.get('/refactor', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/refactor', 'index.html'));
});

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve protected HTML pages
app.get('/lists.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'lists-standalone.html'));
});

app.get('/whitelist.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'whitelist.html'));
});

app.get('/feeds.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'feeds.html'));
});

app.get('/ingestion.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ingestion.html'));
});

app.get('/users.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'users.html'));
});

app.get('/location-display.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'location-display-standalone.html'));
});

app.get('/eventmanager.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'eventmanager.html'));
});

app.get('/interests.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'interests.html'));
});

// Handle favicon
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Apply auth to all API routes



// Mount location display routes
const locationDisplayRoutes = initLocationDisplayRoutes(pool);
app.use('/api/location-display', requireAuth, locationDisplayRoutes);

// Mount admin interests routes
const adminInterestsRoutes = initAdminInterestsRoutes(pool);
app.use('/api/admin', requireAuth, adminInterestsRoutes);

// Mount ingestion routes
const ingestionRoutes = initIngestionRoutes(pool);
app.use('/api/ingestion', requireAuth, ingestionRoutes);

// Get all locations with hashtags and lists
// Mount location routes (locations, hashtags, config, parsers, lists, regions, stats)
const locationRoutes = initLocationRoutes(pool, requireAuth);
app.use('/api', requireAuth, locationRoutes);

// Mount graze routes
const grazeRoutes = initGrazeRoutes(pool);
app.use('/api', requireAuth, grazeRoutes);

// User management API endpoints
// Mount user management routes
const userRoutes = initUserRoutes(pool, requireAuth);
app.use('/api', userRoutes);

// Mount image routes
const imageRoutes = initImageRoutes(pool, requireAuth);
app.use('/api', imageRoutes);

// Backup management API endpoints
// Mount backup routes
const backupRoutes = initBackupRoutes(pool);
app.use('/api/backups', requireAuth, backupRoutes);

// Mount shortener routes
const shortenerRoutes = initShortenerRoutes(pool, requireAuth);
app.use('/api/links', shortenerRoutes);

// Mount settings posts routes
const settingsPostsRoutes = initSettingsPostsRoutes(pool, requireAuth);
app.use('/api/settings-posts', settingsPostsRoutes);

// Serve backups page
app.get('/backups.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'backups.html'));
});

app.get('/links.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'links.html'));
});

// Proxy endpoint for web-directory API (bypasses CORS issues with Cloudflare)
// This allows admin to proxy requests to web-directory
// Since it's server-to-server, there are no CORS restrictions
app.all('/api/proxy/web-directory/*', requireAuth, async (req, res) => {
  try {
    const targetPath = req.path.replace('/api/proxy/web-directory', '');
    const baseUrl = process.env.BASE_URL || 'https://atls.city';
    const targetUrl = `${baseUrl}${targetPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
    
    console.log(`[Proxy] ${req.method} ${targetPath} -> ${targetUrl}`);
    
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.body && Object.keys(req.body).length > 0 ? {} : {})
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' && req.body ? JSON.stringify(req.body) : undefined
    });
    
    const data = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';
    
    res.setHeader('Content-Type', contentType);
    res.status(response.status).send(data);
  } catch (error) {
    console.error('[Proxy] Error proxying request:', error);
    res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
});

// Mount account type routes
const accountTypeRoutes = initAccountTypeRoutes(pool);
app.use('/api', requireAuth, accountTypeRoutes);

const PORT = process.env.PORT || 3009;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ATlas Admin running on port ${PORT}`);
  // Auto-login to Graze after server starts
  setTimeout(initGrazeRoutes.autoLoginToGraze, 1000);
});