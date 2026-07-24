const express = require('express');
const { Pool } = require('pg');
const { AtpAgent } = require('@atproto/api');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const multer = require('multer');
const FormData = require('form-data');
const compression = require('compression');
const { notifyAlert, notifyNewUser, notifyError } = require('./routes/discord');


// Load environment variables from parent directory
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Resolve a user's PDS endpoint from their handle
async function resolvePDS(handle) {
  try {
    const resolveRes = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
    if (resolveRes.ok) {
      const { did } = await resolveRes.json();
      const plcRes = await fetch(`https://plc.directory/${did}`);
      if (plcRes.ok) {
        const doc = await plcRes.json();
        const pds = doc.service?.find(s => s.id === '#atproto_pds');
        if (pds?.serviceEndpoint) {
          console.log(`Resolved PDS for ${handle}: ${pds.serviceEndpoint}`);
          return pds.serviceEndpoint;
        }
      }
    }
  } catch (err) {
    console.error(`PDS resolution failed for ${handle}, falling back to bsky.social:`, err.message);
  }
  return 'https://bsky.social';
}

const app = express();
app.set('trust proxy', 1);
app.use(compression());
app.use(express.json());
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'skymap-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: true, 
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));
const agent = new AtpAgent({ service: 'https://bsky.social' });

// Authenticate agent on startup
let agentAuthenticated = false;
(async () => {
  try {
    await agent.login({
      identifier: process.env.BLUESKY_HANDLE,
      password: process.env.BLUESKY_PASSWORD
    });
    agentAuthenticated = true;
    console.log('Bluesky agent authenticated');
  } catch (error) {
    console.error('Failed to authenticate Bluesky agent:', error.message);
  }
})();

// --- OAuth ---

const { NodeOAuthClient } = require('@atproto/oauth-client-node');
const publicUrl = process.env.BASE_URL || 'https://atls.city';
const OAUTH_SCOPE = 'atproto repo:app.bsky.feed.post repo:city.atlas.actor.location blob:*/*';

const oauthStateStore = {
  async get(key) {
    const r = await pool.query('SELECT value FROM oauth_state WHERE key = $1', [key]);
    return r.rows[0] ? JSON.parse(r.rows[0].value) : undefined;
  },
  async set(key, value) {
    const json = JSON.stringify(value);
    await pool.query('INSERT INTO oauth_state (key, value, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2', [key, json]);
  },
  async del(key) { await pool.query('DELETE FROM oauth_state WHERE key = $1', [key]); },
};

const oauthSessionStore = {
  async get(sub) {
    const r = await pool.query('SELECT value FROM oauth_session WHERE key = $1', [sub]);
    return r.rows[0] ? JSON.parse(r.rows[0].value) : undefined;
  },
  async set(sub, value) {
    const json = JSON.stringify(value);
    await pool.query('INSERT INTO oauth_session (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()', [sub, json]);
  },
  async del(sub) { await pool.query('DELETE FROM oauth_session WHERE key = $1', [sub]); },
};

const oauthClient = new NodeOAuthClient({
  clientMetadata: {
    client_id: `${publicUrl}/oauth/oauth-client-metadata.json`,
    client_name: 'ATlas',
    client_uri: publicUrl,
    redirect_uris: [`${publicUrl}/oauth/callback`],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: OAUTH_SCOPE,
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true,
  },
  stateStore: oauthStateStore,
  sessionStore: oauthSessionStore,
});

app.get('/oauth/oauth-client-metadata.json', (_req, res) => res.json(oauthClient.clientMetadata));
app.get('/oauth/client-metadata.json', (_req, res) => res.redirect(301, '/oauth/oauth-client-metadata.json'));

app.get('/oauth/authorize', async (req, res) => {
  const handle = (req.query.handle || '').trim().toLowerCase().replace(/^@/, '');
  if (!handle) return res.status(400).send('Handle required');
  const returnTo = req.query.returnTo || '/';
  try {
    const url = await oauthClient.authorize(handle, { scope: OAUTH_SCOPE, state: returnTo });
    res.redirect(url.toString());
  } catch (err) {
    console.error('[oauth] authorize error:', err.message);
    res.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}oauthError=${encodeURIComponent('Could not start sign-in. Check your handle and try again.')}`);
  }
});

app.get('/oauth/callback', async (req, res) => {
  try {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    const { session: oauthSession, state: returnTo } = await oauthClient.callback(params);
    const did = oauthSession.did;
    let handle = did;
    try {
      const plcRes = await fetch(`https://plc.directory/${did}`);
      if (plcRes.ok) {
        const doc = await plcRes.json();
        const aka = doc.alsoKnownAs?.find(a => a.startsWith('at://'));
        if (aka) handle = aka.replace('at://', '');
      }
    } catch {}
    req.session.authenticatedDid = did;
    req.session.authenticatedHandle = handle;
    console.log(`[oauth] login: ${handle} (${did})`);
    // REMOVABLE: backfill PDS location record for users who already have labels.
    // Once all active users have been synced, this can be safely removed.
    const { syncLocationsToPds } = require('./routes/pds-location');
    syncLocationsToPds(oauthClient, did, pool).catch(e => console.error('[pds-location] login sync error:', e.message));
    const dest = (returnTo && returnTo !== 'null' && returnTo.startsWith('/')) ? returnTo : '/';
    req.session.save(() => res.redirect(dest));
  } catch (err) {
    console.error('[oauth] callback error:', err.message);
    res.redirect('/?oauthError=' + encodeURIComponent('Sign-in failed. Please try again.'));
  }
});

// Clean stale OAuth state every 10 minutes
setInterval(async () => {
  try { await pool.query("DELETE FROM oauth_state WHERE created_at < NOW() - INTERVAL '10 minutes'"); } catch {}
}, 10 * 60 * 1000);

// Serve manage page without .html extension
app.get('/manage', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});

// Serve feed settings page
app.get('/feed-settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'feed-settings.html'));
});

// Serve algorithm transparency page
app.get('/algo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'algo.html'));
});

// Serve feed builder page
app.get('/customnodebuilder', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'customnodebuilder.html'));
});

app.get('/feedbuilder', (req, res) => {
  res.redirect('/customnodebuilder');
});

// Serve my nodes page
app.get('/mynodes', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mynodes.html'));
});

// Serve members page for list viewing
app.get('/list/:locationKey', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'members.html'));
});

// Helper: Generate short code for URL shortening
function generateShortCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// API: Create short URL
app.post('/api/shorten', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Check if URL already exists
    const existing = await pool.query(
      'SELECT short_code FROM short_urls WHERE full_url = $1 LIMIT 1',
      [url]
    );
    
    if (existing.rows.length > 0) {
      return res.json({ shortCode: existing.rows[0].short_code });
    }
    
    // Generate unique short code
    let shortCode;
    let attempts = 0;
    do {
      shortCode = generateShortCode();
      const check = await pool.query(
        'SELECT id FROM short_urls WHERE short_code = $1',
        [shortCode]
      );
      if (check.rows.length === 0) break;
      attempts++;
      if (attempts > 10) {
        return res.status(500).json({ error: 'Failed to generate unique short code' });
      }
    } while (true);
    
    // Insert new short URL
    await pool.query(
      'INSERT INTO short_urls (short_code, full_url) VALUES ($1, $2)',
      [shortCode, url]
    );
    
    res.json({ shortCode });
  } catch (error) {
    console.error('Error creating short URL:', error);
    res.status(500).json({ error: 'Failed to create short URL' });
  }
});

// Redirect short URL (e/ for events, can add other prefixes for other types)
app.get('/e/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    const result = await pool.query(
      'SELECT full_url FROM short_urls WHERE short_code = $1',
      [shortCode]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).send('Short URL not found');
    }
    
    // Increment click count
    await pool.query(
      'UPDATE short_urls SET click_count = click_count + 1 WHERE short_code = $1',
      [shortCode]
    );
    
    res.redirect(result.rows[0].full_url);
  } catch (error) {
    console.error('Error redirecting short URL:', error);
    res.status(500).send('Error redirecting');
  }
});

// Redirect custom slug URL
app.get('/go/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await pool.query(
      'SELECT full_url FROM short_urls WHERE custom_slug = $1',
      [slug]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).send('Link not found');
    }
    
    await pool.query(
      'UPDATE short_urls SET click_count = click_count + 1 WHERE custom_slug = $1',
      [slug]
    );
    
    res.redirect(result.rows[0].full_url);
  } catch (error) {
    console.error('Error redirecting custom slug:', error);
    res.status(500).send('Error redirecting');
  }
});

// Settings toggle redirect (/s/ prefix)
app.get('/s/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await pool.query(
      "SELECT full_url FROM short_urls WHERE custom_slug = $1 AND link_type = 'setting'",
      [slug]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).send('Setting not found');
    }
    
    await pool.query(
      'UPDATE short_urls SET click_count = click_count + 1 WHERE custom_slug = $1',
      [slug]
    );
    
    // The full_url points to /api/feed-toggle?... which handles auth + toggle + redirect
    res.redirect(result.rows[0].full_url);
  } catch (error) {
    console.error('Error redirecting setting toggle:', error);
    res.status(500).send('Error redirecting');
  }
});

// Feed settings toggle action endpoint
app.get('/api/feed-toggle', async (req, res) => {
  const { feed, key, value } = req.query;
  
  if (!feed || !key || !value) {
    return res.status(400).send('Missing parameters');
  }
  
  if (!req.session.authenticatedDid) {
    req.session.pendingToggle = { feed, key, value };
    req.session.save(() => {
      return res.redirect(`/feed-settings?login=true&reason=toggle`);
    });
    return;
  }
  
  try {
    const did = req.session.authenticatedDid;

    // Ensure user_feed_settings row exists
    const settingsRow = await pool.query('SELECT * FROM user_feed_settings WHERE user_did = $1', [did]);
    if (settingsRow.rows.length === 0) {
      await pool.query('INSERT INTO user_feed_settings (user_did) VALUES ($1)', [did]);
    }

    // When switching media_mode away from custom, snapshot current media_types
    if (key === 'media_mode' && value !== 'custom') {
      const currentMode = await pool.query(
        "SELECT setting_value FROM user_feed_setting_overrides WHERE user_did = $1 AND feed_name = $2 AND setting_key = 'media_mode'",
        [did, feed]
      );
      // If currently on custom (or no override = using settings page values), save snapshot
      if (!currentMode.rows.length || currentMode.rows[0].setting_value === 'custom') {
        const row = settingsRow.rows[0];
        const currentTypes = row?.media_types || '0,1,2,3,4,5';
        await pool.query(
          'UPDATE user_feed_settings SET custom_media_types = $1 WHERE user_did = $2',
          [currentTypes, did]
        );
      }
    }

    // Upsert the override
    await pool.query(
      `INSERT INTO user_feed_setting_overrides (user_did, feed_name, setting_key, setting_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_did, feed_name, setting_key) DO UPDATE SET setting_value = $4`,
      [did, feed, key, value]
    );
    
    // Record settings change timestamp
    await pool.query('UPDATE user_feed_settings SET settings_changed_at = NOW() WHERE user_did = $1', [did]);
    
    const feedDid = process.env.LABELER_DID || 'did:plc:l37i5se642dgeb7kmrdwoqv4';
    const bskyFeedUrl = `https://bsky.app/profile/${feedDid}/feed/${feed}`;

    // Hide menu: show confirmation with restore instructions
    if (key === 'hide_menu') {
      res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Menu Hidden</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#e0f2e9;margin:0;}.card{background:white;padding:2rem;border-radius:12px;text-align:center;max-width:400px;box-shadow:0 2px 8px rgba(0,0,0,0.1);}.btn{display:inline-block;margin-top:1rem;padding:0.75rem 1.5rem;background:#171717;color:white;text-decoration:none;border-radius:8px;}</style></head><body><div class="card"><h2>Menu Hidden</h2><p>The in-feed settings menu is now hidden. You can restore it from <a href="/feed-settings">Feed Settings</a>.</p><a href="${bskyFeedUrl}" class="btn">Back to Feed</a></div></body></html>`);
      return;
    }
    
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Setting Updated</title><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#e0f2e9;margin:0;}.card{background:white;padding:2rem;border-radius:12px;text-align:center;max-width:400px;box-shadow:0 2px 8px rgba(0,0,0,0.1);}.btn{display:inline-block;margin-top:1rem;padding:0.75rem 1.5rem;background:#171717;color:white;text-decoration:none;border-radius:8px;}</style></head><body><div class="card"><h2>Setting Updated</h2><p>Pull down to refresh your feed to see the change.</p><a href="${bskyFeedUrl}" class="btn">Back to Feed</a></div></body></html>`);
  } catch (error) {
    console.error('Error toggling feed setting:', error);
    res.status(500).send('Failed to update setting');
  }
});

// Serve event detail page with server-side meta tags for link cards
app.get('/event/:eventId', async (req, res) => {
  const { eventId } = req.params;
  
  try {
    // Fetch event data for meta tags
    const eventResult = await pool.query(`
      SELECT 
        e.*, 
        l.name as city_name, 
        l.region_name,
        COALESCE((SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.event_id), 0) as rsvp_count
      FROM events e
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE e.event_id = $1 AND e.deleted_at IS NULL
    `, [eventId]);
    
    const htmlPath = path.join(__dirname, 'public', 'eventdetail.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    if (eventResult.rows.length > 0) {
      const event = eventResult.rows[0];
      const eventTitle = event.title || 'Event';
      
      // Build a better default description if none provided
      let eventDescription = event.description;
      if (!eventDescription || eventDescription.trim() === '') {
        const locationName = event.location_name || event.city_name || 'Location TBD';
        const startDate = new Date(event.start_time);
        const formattedDate = startDate.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
        eventDescription = `Join us in ${locationName} on ${formattedDate}. View event details and RSVP on SkyMap.`;
      }
      
      const eventImage = event.image_url || `${process.env.BASE_URL}/atlas_banner.webp`;
      const eventUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
      
      // Escape HTML entities properly
      const escapeHtml = (str) => {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };
      
      const safeTitle = escapeHtml(eventTitle);
      const safeDescription = escapeHtml(eventDescription).substring(0, 200);
      const safeImage = escapeHtml(eventImage);
      const safeUrl = escapeHtml(eventUrl);
      
      // Replace meta tags with actual event data (more flexible regex to match any content)
      html = html.replace(/<meta property="og:title"[^>]*>/g, 
        `<meta property="og:title" content="${safeTitle}" id="og-title">`);
      html = html.replace(/<meta property="og:description"[^>]*>/g, 
        `<meta property="og:description" content="${safeDescription}" id="og-description">`);
      html = html.replace(/<meta property="og:image"[^>]*>/g, 
        `<meta property="og:image" content="${safeImage}" id="og-image">`);
      html = html.replace(/<meta property="og:url"[^>]*>/g, 
        `<meta property="og:url" content="${safeUrl}" id="og-url">`);
      html = html.replace(/<meta name="twitter:title"[^>]*>/g, 
        `<meta name="twitter:title" content="${safeTitle}" id="twitter-title">`);
      html = html.replace(/<meta name="twitter:description"[^>]*>/g, 
        `<meta name="twitter:description" content="${safeDescription}" id="twitter-description">`);
      html = html.replace(/<meta name="twitter:image"[^>]*>/g, 
        `<meta name="twitter:image" content="${safeImage}" id="twitter-image">`);
      html = html.replace(/<title>Event - SkyMap<\/title>/g, 
        `<title>${safeTitle} - SkyMap</title>`);
    }
    
    res.send(html);
  } catch (error) {
    console.error('Error serving event page:', error);
    // Fallback to static file if there's an error
    res.sendFile(path.join(__dirname, 'public', 'eventdetail.html'));
  }
});

// Serve static files except index.html
app.use(express.static('public', { index: false }));

// Serve index.html at root with environment variables injected
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  // Inject BLUESKY_HANDLE into the HTML
  const blueskyHandle = process.env.BLUESKY_HANDLE || 'labeler.domain';
  console.log('Injecting BLUESKY_HANDLE:', blueskyHandle);
  html = html.replace('<script>', `<script>\n        window.BLUESKY_HANDLE = '${blueskyHandle}';`);
  
  res.send(html);
});

// Mount locations API routes
const locationsApiRoutes = require('./routes/locations-api')(pool, agent);
app.use('/api', locationsApiRoutes);

// OAuth: Initiate login with password
app.post('/api/auth/login', async (req, res) => {
  const { handle, password } = req.body;
  if (!handle || !password) {
    return res.status(400).json({ error: 'Handle and password required' });
  }
  
  try {
    // Create temporary agent to verify credentials
    const cleanHandle = handle.trim().replace('@', '').toLowerCase();
    const cleanPassword = password.trim();
    
    console.log('Login attempt for:', cleanHandle);
    
    const pdsEndpoint = await resolvePDS(cleanHandle);
    const tempAgent = new AtpAgent({ service: pdsEndpoint });
    
    await tempAgent.login({
      identifier: cleanHandle,
      password: cleanPassword
    });
    
    // Store authenticated session with tokens for posting
    req.session.authenticatedDid = tempAgent.session.did;
    req.session.authenticatedHandle = tempAgent.session.handle;
    req.session.atprotoAccessJwt = tempAgent.session.accessJwt;
    req.session.atprotoRefreshJwt = tempAgent.session.refreshJwt;
    
    // Graze login with user's credentials (we have them in app password flow)
    try {
      const grazeRes = await fetch('https://api.graze.social/app/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://www.graze.social', 'Referer': 'https://www.graze.social/login' },
        body: JSON.stringify({ username: cleanHandle, password: cleanPassword })
      });
      if (grazeRes.ok) {
        const setCookie = grazeRes.headers.get('set-cookie') || '';
        const match = setCookie.match(/session_cookie=([^;]+)/);
        if (match) req.session.grazeSessionCookie = match[1];
      }
    } catch {}
    
    // Force session save before responding
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      console.log('Login successful for:', tempAgent.session.handle, 'Session ID:', req.sessionID);
      res.json({ success: true, did: tempAgent.session.did, handle: tempAgent.session.handle });
    });
  } catch (error) {
    console.error('Auth error:', error.message || error);
    const errorMsg = error.message || 'Invalid credentials';
    res.status(401).json({ error: errorMsg });
  }
});

// OAuth: Get current session
app.get('/api/auth/session', (req, res) => {
  if (req.session.authenticatedDid) {
    res.json({ 
      authenticated: true, 
      did: req.session.authenticatedDid,
      handle: req.session.authenticatedHandle,
      grazeConnected: !!req.session.grazeSessionCookie
    });
  } else {
    res.json({ authenticated: false });
  }
});

// OAuth: Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Graze: Connect user's own Graze account (for custom node push)
app.post('/api/auth/connect-graze', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { handle, password } = req.body;
  if (!handle || !password) {
    return res.status(400).json({ error: 'Handle and app password required' });
  }
  try {
    const cleanHandle = handle.trim().replace('@', '').toLowerCase();
    const grazeRes = await fetch('https://api.graze.social/app/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://www.graze.social', 'Referer': 'https://www.graze.social/login' },
      body: JSON.stringify({ username: cleanHandle, password: password.trim() })
    });
    if (!grazeRes.ok) {
      return res.status(401).json({ error: 'Graze login failed. Check your credentials.' });
    }
    const setCookie = grazeRes.headers.get('set-cookie') || '';
    const match = setCookie.match(/session_cookie=([^;]+)/);
    if (!match) {
      return res.status(500).json({ error: 'Graze login succeeded but no session returned.' });
    }
    req.session.grazeSessionCookie = match[1];
    req.session.save(() => res.json({ success: true }));
  } catch (err) {
    res.status(500).json({ error: 'Failed to connect to Graze: ' + err.message });
  }
});

// API: Post to Bluesky on behalf of authenticated user
app.post('/api/post-to-bluesky', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { text, facets, embed } = req.body;
  
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }
  
  if (text.length > 300) {
    return res.status(400).json({ error: 'Text must be 300 characters or less' });
  }
  
  try {
    const did = req.session.authenticatedDid;
    const handle = req.session.authenticatedHandle;
    let oauthSession = null;

    // Try to restore OAuth session
    try { oauthSession = await oauthClient.restore(did); } catch {}

    if (oauthSession) {
      // OAuth path: use DPoP-authenticated fetch directly
      const record = { text, createdAt: new Date().toISOString() };
      if (facets && Array.isArray(facets)) record.facets = facets;

      if (embed) {
        if (embed.external && embed.external.thumb) {
          try {
            const thumbResponse = await fetch(embed.external.thumb);
            const thumbBlob = new Uint8Array(await thumbResponse.arrayBuffer());
            const uploadRes = await oauthSession.fetchHandler('/xrpc/com.atproto.repo.uploadBlob', {
              method: 'POST',
              headers: { 'Content-Type': 'image/jpeg' },
              body: thumbBlob
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              embed.external.thumb = uploadData.blob;
            } else {
              delete embed.external.thumb;
            }
          } catch (err) {
            console.error('Failed to upload thumb:', err);
            delete embed.external.thumb;
          }
        }
        record.embed = embed;
      }

      const createRes = await oauthSession.fetchHandler('/xrpc/com.atproto.repo.createRecord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: did,
          collection: 'app.bsky.feed.post',
          record
        })
      });

      if (!createRes.ok) {
        const errBody = await createRes.text();
        console.error('OAuth post failed:', createRes.status, errBody);
        return res.status(createRes.status).json({ error: 'Failed to post' });
      }

      const data = await createRes.json();
      return res.json({ success: true, uri: data.uri, cid: data.cid });
    }

    // App password fallback
    if (!req.session.atprotoAccessJwt) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const userPds = await resolvePDS(handle);
    const userAgent = new AtpAgent({ service: userPds });
    userAgent.session = {
      did, handle,
      accessJwt: req.session.atprotoAccessJwt,
      refreshJwt: req.session.atprotoRefreshJwt
    };
    
    const record = { text, createdAt: new Date().toISOString() };
    if (facets && Array.isArray(facets)) record.facets = facets;
    
    if (embed) {
      if (embed.external && embed.external.thumb) {
        try {
          const thumbResponse = await fetch(embed.external.thumb);
          const thumbBlob = await thumbResponse.arrayBuffer();
          const uploadResponse = await userAgent.uploadBlob(new Uint8Array(thumbBlob), { encoding: 'image/jpeg' });
          embed.external.thumb = uploadResponse.data.blob;
        } catch (err) {
          console.error('Failed to upload thumb:', err);
          delete embed.external.thumb;
        }
      }
      record.embed = embed;
    }
    
    const response = await userAgent.api.app.bsky.feed.post.create({ repo: did }, record);
    
    if (userAgent.session.accessJwt !== req.session.atprotoAccessJwt) {
      req.session.atprotoAccessJwt = userAgent.session.accessJwt;
      req.session.atprotoRefreshJwt = userAgent.session.refreshJwt;
      await new Promise((resolve, reject) => {
        req.session.save((err) => err ? reject(err) : resolve());
      });
    }
    
    res.json({ success: true, uri: response.uri, cid: response.cid });
  } catch (error) {
    console.error('Error posting to Bluesky:', error);
    if (error.message?.includes('ExpiredToken') || error.status === 401) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    res.status(500).json({ error: 'Failed to post to Bluesky' });
  }
});

// Mount labels routes (add, remove, set-primary, my-labels)
const labelsRoutes = require('./routes/labels')(pool, oauthClient);
app.use('/api', labelsRoutes);

// API: Get authenticated user's profile image
app.get('/api/my-profile-image', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const did = req.session.authenticatedDid;
  
  try {
    const result = await pool.query(`
      SELECT profile_card_image_url
      FROM user_labels
      WHERE did = $1
      LIMIT 1
    `, [did]);
    
    const profileCardImageUrl = result.rows.length > 0 ? result.rows[0].profile_card_image_url : null;
    res.json({ profileCardImageUrl });
  } catch (error) {
    console.error('Error fetching profile image:', error);
    res.status(500).json({ error: 'Failed to fetch profile image' });
  }
});

// API: Update authenticated user's profile image
app.post('/api/my-profile-image', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const did = req.session.authenticatedDid;
  const { profileCardImageUrl } = req.body;
  
  try {
    await pool.query(
      'UPDATE user_labels SET profile_card_image_url = $1 WHERE did = $2',
      [profileCardImageUrl || null, did]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating profile image:', error);
    res.status(500).json({ error: 'Failed to update profile image' });
  }
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'), false);
    }
  }
});

// API: Upload image to ImgBB
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check if user has image permissions (Tier 2+)
  try {
    const permResponse = await pool.query(
      'SELECT tier FROM user_permissions WHERE did = $1',
      [req.session.authenticatedDid]
    );
    
    const tier = permResponse.rows.length > 0 ? permResponse.rows[0].tier : 1;
    if (tier < 2) {
      return res.status(403).json({ error: 'Image permissions required (Tier 2+) to upload images' });
    }
  } catch (error) {
    console.error('Error checking permissions:', error);
    return res.status(500).json({ error: 'Failed to verify permissions' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  // Validate file size
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image too large (max 5MB)' });
  }

  // Check if ImgBB API key is configured
  if (!process.env.IMGBB_API_KEY) {
    console.error('ImgBB API key not configured');
    return res.status(500).json({ error: 'Image upload service not configured. Please set IMGBB_API_KEY environment variable.' });
  }

  try {
    // Upload to ImgBB using base64 encoding
    const base64Image = req.file.buffer.toString('base64');
    const formData = new URLSearchParams();
    formData.append('key', process.env.IMGBB_API_KEY);
    formData.append('image', base64Image);

    console.log('Uploading image to ImgBB, size:', req.file.size, 'bytes');

    const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!imgbbResponse.ok) {
      const errorText = await imgbbResponse.text();
      console.error('ImgBB API error:', imgbbResponse.status, errorText);
      return res.status(500).json({ error: `Image hosting service error: ${imgbbResponse.status}` });
    }

    const imgbbData = await imgbbResponse.json();

    if (!imgbbData.success || !imgbbData.data || !imgbbData.data.url) {
      console.error('ImgBB upload failed:', JSON.stringify(imgbbData, null, 2));
      const errorMsg = imgbbData.error?.message || 'Failed to upload image to image hosting service';
      return res.status(500).json({ error: errorMsg });
    }

    console.log('Image uploaded successfully:', imgbbData.data.url);

    // Return the URL to store in database
    res.json({
      imageUrl: imgbbData.data.url,
      deleteUrl: imgbbData.data.delete_url || null
    });
  } catch (error) {
    console.error('Error uploading image to ImgBB:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: `Failed to upload image: ${error.message}` });
  }
});

// API: Report an image
app.post('/api/report-image', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { imageUrl, imageType, relatedId, reason, details } = req.body;

  if (!imageUrl || !imageType || !reason) {
    return res.status(400).json({ error: 'Missing required fields: imageUrl, imageType, reason' });
  }

  const allowedTypes = ['profile', 'event', 'pin', 'avatar', 'card'];
  if (!allowedTypes.includes(imageType)) {
    return res.status(400).json({ error: 'Invalid imageType. Must be: profile, event, pin, avatar, or card' });
  }

  const allowedReasons = ['copyright', 'inappropriate', 'illegal', 'spam', 'other'];
  if (!allowedReasons.includes(reason)) {
    return res.status(400).json({ error: 'Invalid reason' });
  }

  try {
    // Check if this image has already been reported by this user
    const existingReport = await pool.query(
      'SELECT id FROM reported_images WHERE reporter_did = $1 AND image_url = $2 AND status = $3',
      [req.session.authenticatedDid, imageUrl, 'pending']
    );

    if (existingReport.rows.length > 0) {
      return res.json({ success: true, message: 'You have already reported this image' });
    }

    // Handle related_id - it can be integer (for cities, events) or null (for users/avatars)
    // For user reports (avatar, profile), relatedId might be a DID string, so we store null
    let relatedIdValue = null;
    if (relatedId) {
      // Try to parse as integer for city/event IDs
      const parsedId = parseInt(relatedId);
      if (!isNaN(parsedId) && String(parsedId) === String(relatedId)) {
        relatedIdValue = parsedId;
      }
      // If it's not a valid integer (e.g., a DID), leave it as null
    }

    // Insert report
    const result = await pool.query(
      `INSERT INTO reported_images (reporter_did, reporter_handle, image_url, image_type, related_id, reason, details, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id`,
      [
        req.session.authenticatedDid,
        req.session.authenticatedHandle || null,
        imageUrl,
        imageType,
        relatedIdValue,
        reason,
        details || null
      ]
    );

    res.json({ success: true, reportId: result.rows[0].id, message: 'Report submitted successfully' });
    notifyAlert('reported_image', { reporter: req.session.authenticatedHandle, type: imageType, reason, image_url: imageUrl });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Rate limit for anonymous label requests: 5 per IP per hour
const labelRequestIpCounts = new Map();
setInterval(() => labelRequestIpCounts.clear(), 60 * 60 * 1000);

// API: Submit a label request (auth optional, IP rate limited when anonymous)
app.post('/api/label-requests', async (req, res) => {
  const isAuthed = !!req.session.authenticatedDid;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;

  if (!isAuthed) {
    const count = labelRequestIpCounts.get(ip) || 0;
    if (count >= 5) {
      return res.status(429).json({ error: 'Too many requests. Please try again later or log in.' });
    }
    labelRequestIpCounts.set(ip, count + 1);
  }

  const { requestType, targetHandle, targetDid, locationKey, locationName, reason, submitterHandle } = req.body;
  if (!requestType || !targetHandle || !targetDid || !locationKey || !reason) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['add', 'remove'].includes(requestType)) {
    return res.status(400).json({ error: 'Invalid request type' });
  }
  try {
    const requesterDid = isAuthed ? req.session.authenticatedDid : `anon:${ip}`;
    const requesterHandle = isAuthed ? (req.session.authenticatedHandle || null) : (submitterHandle || null);

    const existing = await pool.query(
      'SELECT id FROM label_requests WHERE requester_did = $1 AND target_did = $2 AND location_key = $3 AND request_type = $4 AND status = $5',
      [requesterDid, targetDid, locationKey, requestType, 'pending']
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'A pending request for this already exists' });
    }
    const result = await pool.query(
      `INSERT INTO label_requests (requester_did, requester_handle, target_did, target_handle, location_key, location_name, request_type, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [requesterDid, requesterHandle, targetDid, targetHandle, locationKey, locationName || null, requestType, reason]
    );
    res.json({ success: true, requestId: result.rows[0].id });
    notifyAlert('label_request', { requester: requesterHandle || requesterDid, target: targetHandle, location: locationName || locationKey, type: requestType, reason });
  } catch (error) {
    console.error('Error submitting label request:', error);
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

// API: Get my label requests (auth required)
app.get('/api/label-requests', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM label_requests WHERE requester_did = $1 ORDER BY created_at DESC LIMIT 50',
      [req.session.authenticatedDid]
    );
    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Error loading label requests:', error);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

// Mount social routes (mutuals, explore-users, map-posts)
const socialRoutes = require('./routes/social')(pool, agent);
app.use('/api', socialRoutes);

// ============================================================================
// EVENTS API
// ============================================================================

// Generate short event ID (e.g., "EVT-ABC123")
function generateEventId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'EVT-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper: Validate URL format (basic check)
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  // Basic URL format check - must start with http:// or https://
  const urlPattern = /^https?:\/\/.+/i;
  return urlPattern.test(url.trim());
}

// Get city event limit based on population
function getCityEventLimit(population) {
  if (!population || population < 50000) return 2;
  if (population < 100000) return 5;
  if (population < 250000) return 10;
  if (population < 500000) return 15;
  if (population < 1000000) return 20;
  return 25; // 1M+
}

// Import event management module
const eventManagement = require('./routes/event-management');
const { calculateEventScore: calculateEventScoreNew, recalculateEventVisibility: recalculateEventVisibilityNew } = eventManagement;
const initInterestsRoutes = require('./routes/interests');

// Wrapper to provide pool to event management functions
async function calculateEventScore(eventId, startTime) {
  return calculateEventScoreNew(eventId, startTime, pool);
}

// Recalculate visibility wrapper
async function recalculateEventVisibility() {
  return recalculateEventVisibilityNew(pool, getCityEventLimit);
}

// Export getCityEventLimit for event-management module
module.exports.getCityEventLimit = getCityEventLimit;

// Mount event management routes (must come before other event routes)
const eventManagementRouter = eventManagement.router;
eventManagementRouter.pool = pool; // Attach pool to router for middleware
app.use(eventManagementRouter);

// Mount interests routes
const interestsRouter = initInterestsRoutes(pool);
app.use('/api/interests', interestsRouter);

// Mount user custom nodes routes
const userCustomNodesRouter = require('./routes/user-custom-nodes');
app.locals.pool = pool; // Make pool available to routes
app.use('/api/user/custom-nodes', userCustomNodesRouter);

// Test CORS route directly on app (for debugging)
app.get('/api/event-scoring-config-test', (req, res) => {
  const origin = req.headers.origin;
  console.log('[TEST ROUTE] Origin:', origin);
  if (origin && (
    origin === `https://${process.env.ADMIN_URL.replace('https://', '')}` ||
    origin === 'https://skymapadmin.fema.monster' ||
    origin.startsWith('http://localhost')
  )) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    console.log('[TEST ROUTE] CORS headers set');
  }
  res.json({ test: 'CORS test route', origin: origin });
});

// Run visibility recalculation every 5 minutes
setInterval(recalculateEventVisibility, 5 * 60 * 1000); // 5 minutes

// Initial recalculation on startup (after a short delay to let DB initialize)
setTimeout(recalculateEventVisibility, 30000); // 30 seconds

// Mount inline event API routes
const eventsApiRoutes = require('./routes/events-api')(pool, recalculateEventVisibility, generateEventId, isValidUrl, getCityEventLimit);
app.use('/api', eventsApiRoutes);

// Cleanup old cache entries periodically (every hour)
setInterval(async () => {
  try {
    await pool.query(
      'DELETE FROM mutuals_cache WHERE cached_at < NOW() - INTERVAL \'12 hours\''
    );
    await pool.query(
      'DELETE FROM explore_users_cache WHERE cached_at < NOW() - INTERVAL \'1 hour\''
    );
  } catch (error) {
    console.error('Error cleaning cache:', error);
  }
}, 60 * 60 * 1000);

// Re-warm explore users cache every 50 seconds (before 1 min expiry)
setInterval(async () => {
  try {
    const zoom = 4;
    const cacheKey = `explore_${zoom}_all`;
    const response = await fetch(`http://localhost:${PORT}/api/explore-users?zoom=${zoom}`);
    if (response.ok) {
      console.log('Explore users cache refreshed');
    }
  } catch (error) {
    console.error('Error refreshing explore cache:', error.message);
  }
}, 50 * 1000);

// Mount user settings routes (permissions, image requests, settings, feed settings)
const userSettingsRoutes = require('./routes/user-settings')(pool);
app.use('/api', userSettingsRoutes);

// 404 handler - must be last after all routes
app.use(function (req, res) {
  res.status(404).json({ error: '404 - Route not found' });
});

const PORT = process.env.PORT || 3008;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SkyMap Web Directory running on port ${PORT}`);
  
  // Pre-warm explore users cache on startup (after 10 seconds)
  setTimeout(async () => {
    try {
      console.log('Pre-warming explore users cache...');
      const zoom = 4; // Default zoom
      const cacheKey = `explore_${zoom}_all`;
      
      // Check if cache exists
      const cacheResult = await pool.query(
        'SELECT cached_at FROM explore_users_cache WHERE cache_key = $1',
        [cacheKey]
      );
      
      if (cacheResult.rows.length > 0) {
        const cacheAge = Date.now() - new Date(cacheResult.rows[0].cached_at).getTime();
        if (cacheAge < 60 * 1000) {
          console.log('Explore users cache already warm');
          return;
        }
      }
      
      // Warm the cache by making a request
      const response = await fetch(`http://localhost:${PORT}/api/explore-users?zoom=${zoom}`);
      if (response.ok) {
        console.log('Explore users cache pre-warmed successfully');
      }
    } catch (error) {
      console.error('Failed to pre-warm explore users cache:', error.message);
    }
  }, 10000);
});