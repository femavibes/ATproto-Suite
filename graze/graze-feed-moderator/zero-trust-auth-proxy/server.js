const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// API key middleware
app.use((req, res, next) => {
  if (req.path === '/health') return next(); // Allow health checks
  
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
});

// Persistent secret key (stored in Docker volume)
const fs = require('fs');
const keyFile = '/app/data/secret.key';

// Ensure data directory exists
if (!fs.existsSync('/app/data')) {
  fs.mkdirSync('/app/data', { recursive: true });
}

// Load existing key or generate new one
let USER_SECRET;
if (fs.existsSync(keyFile)) {
  USER_SECRET = fs.readFileSync(keyFile, 'utf8').trim();
  console.log('🔑 Using existing encryption key');
} else {
  USER_SECRET = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(keyFile, USER_SECRET);
  console.log('🔑 Generated new encryption key');
}

console.log('💡 To generate new key: docker run with -e RESET_KEY=true');

// Generate encryption key for this session
app.post('/get-key', (req, res) => {
  console.log('Key requested for encryption');
  
  // Generate a key from user's secret
  const key = crypto.scryptSync(USER_SECRET, 'user-salt', 32).toString('hex');
  
  res.json({ key });
});

// Decrypt data with user's key
app.post('/decrypt', (req, res) => {
  try {
    const { encrypted, reason, userHandle } = req.body;
    
    // Validate reason - only allow legitimate operations
    const validReasons = ['GRAZE_POST_REMOVAL', 'BLUESKY_LIST_MANAGEMENT', 'SESSION_REFRESH'];
    if (!reason || !validReasons.includes(reason)) {
      console.log(`🚨 SUSPICIOUS REQUEST: Invalid reason '${reason}' for ${userHandle}`);
      return res.status(400).json({ error: 'Invalid or missing reason' });
    }
    
    // Log every decryption request with timestamp
    const timestamp = new Date().toISOString();
    console.log(`🔓 DECRYPTION REQUEST [${timestamp}]`);
    console.log(`   User: ${userHandle}`);
    console.log(`   Reason: ${reason}`);
    console.log(`   IP: ${req.ip || req.connection.remoteAddress}`);
    
    // Decrypt with user's key
    const key = crypto.scryptSync(USER_SECRET, 'user-salt', 32);
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    console.log(`✅ Decryption successful for ${reason}`);
    res.json({ decrypted });
  } catch (error) {
    console.error('Decryption failed:', error.message);
    res.status(400).json({ error: 'Decryption failed' });
  }
});

// Zero-Trust Authentication Endpoints
// Multi-user support: credentials stored per user (by identifier - handle or DID)
const userCredentials = new Map(); // identifier -> { password, monitored, identifier }

// Load users from environment variables
// Format: USER_<number>_IDENTIFIER, USER_<number>_PASSWORD, USER_<number>_MONITORED
const userNumbers = new Set();
for (const key of Object.keys(process.env)) {
  const match = key.match(/^USER_(\d+)_/);
  if (match) {
    userNumbers.add(match[1]);
  }
}

for (const num of userNumbers) {
  const identifier = process.env[`USER_${num}_IDENTIFIER`];
  const password = process.env[`USER_${num}_PASSWORD`];
  const monitoredStr = process.env[`USER_${num}_MONITORED`];
  
  if (!identifier || !password) {
    console.error(`❌ USER_${num} missing IDENTIFIER or PASSWORD`);
    continue;
  }
  
  const monitored = new Map();
  
  // Parse monitored accounts (comma-separated identifier:password pairs)
  if (monitoredStr) {
    const pairs = monitoredStr.split(',');
    for (const pair of pairs) {
      const [monId, monPass] = pair.split(':');
      if (monId && monPass) {
        monitored.set(monId.trim().toLowerCase(), monPass.trim());
      }
    }
  }
  
  userCredentials.set(identifier.toLowerCase(), { password, monitored, identifier });
  console.log(`👤 Loaded user ${num}: ${identifier} (${monitored.size} monitored accounts)`);
}

// Session cache per user
const sessionCache = new Map(); // identifier -> { graze, grazeExpiry, bluesky, blueskyExpiry }

// Get Graze session
app.post('/auth/graze-session', async (req, res) => {
  try {
    const { reason, handle, identifier } = req.body;
    const userIdentifier = (identifier || handle).toLowerCase();
    console.log(`🔐 Graze session requested: ${userIdentifier} (${reason})`);
    
    const user = userCredentials.get(userIdentifier);
    if (!user) {
      return res.status(404).json({ error: 'User not configured' });
    }
    
    // Get or create session cache for user
    let cache = sessionCache.get(userIdentifier) || {};
    
    // Return cached session if valid
    if (cache.graze && cache.grazeExpiry && cache.grazeExpiry > Date.now()) {
      console.log('✅ Returning cached Graze session');
      return res.json({ sessionCookie: cache.graze });
    }
    
    // Authenticate with Graze (use original identifier for auth)
    const response = await fetch('https://api.graze.social/app/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.identifier,
        password: user.password,
        service_domain: ''
      })
    });
    
    if (!response.ok) {
      throw new Error(`Graze auth failed: ${response.status}`);
    }
    
    const setCookie = response.headers.get('set-cookie');
    const match = setCookie?.match(/session_cookie=([^;]+)/);
    if (!match) {
      throw new Error('No session cookie in response');
    }
    
    cache.graze = match[1];
    cache.grazeExpiry = Date.now() + 60 * 60 * 1000;
    sessionCache.set(userIdentifier, cache);
    
    console.log('✅ New Graze session created');
    res.json({ sessionCookie: cache.graze });
  } catch (error) {
    console.error('Graze session error:', error.message);
    res.status(500).json({ error: 'Failed to get Graze session' });
  }
});

// Get Bluesky tokens
app.post('/auth/bluesky-token', async (req, res) => {
  try {
    const { reason, handle, identifier } = req.body;
    const userIdentifier = (identifier || handle).toLowerCase();
    console.log(`🔐 Bluesky token requested: ${userIdentifier} (${reason})`);
    
    const user = userCredentials.get(userIdentifier);
    if (!user) {
      return res.status(404).json({ error: 'User not configured' });
    }
    
    // Get or create session cache for user
    let cache = sessionCache.get(userIdentifier) || {};
    
    // Return cached tokens if valid
    if (cache.bluesky && cache.blueskyExpiry && cache.blueskyExpiry > Date.now()) {
      console.log('✅ Returning cached Bluesky tokens');
      return res.json(cache.bluesky);
    }
    
    // Authenticate with Bluesky (use original identifier)
    const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: user.identifier,
        password: user.password
      })
    });
    
    if (!response.ok) {
      throw new Error(`Bluesky auth failed: ${response.status}`);
    }
    
    const data = await response.json();
    cache.bluesky = {
      accessToken: data.accessJwt,
      refreshToken: data.refreshJwt
    };
    cache.blueskyExpiry = Date.now() + 60 * 60 * 1000;
    sessionCache.set(userIdentifier, cache);
    
    console.log('✅ New Bluesky tokens created');
    res.json(cache.bluesky);
  } catch (error) {
    console.error('Bluesky token error:', error.message);
    res.status(500).json({ error: 'Failed to get Bluesky tokens' });
  }
});

// Get tokens for monitored account
app.post('/auth/monitored-account', async (req, res) => {
  try {
    const { accountHandle, accountDid, reason, masterHandle, masterIdentifier } = req.body;
    const masterKey = (masterIdentifier || masterHandle).toLowerCase();
    console.log(`🔐 Monitored account token requested: ${accountHandle || accountDid} for ${masterKey} (${reason})`);
    
    const user = userCredentials.get(masterKey);
    if (!user) {
      return res.status(404).json({ error: 'Master user not configured' });
    }
    
    // Try to find monitored account by handle first, then DID
    let password = null;
    let matchedIdentifier = null;
    
    if (accountHandle) {
      password = user.monitored.get(accountHandle.toLowerCase());
      if (password) matchedIdentifier = accountHandle;
    }
    
    if (!password && accountDid) {
      password = user.monitored.get(accountDid.toLowerCase());
      if (password) matchedIdentifier = accountDid;
    }
    
    if (!password) {
      console.error(`❌ No credentials for monitored account ${accountHandle || accountDid} under ${masterKey}`);
      return res.status(404).json({ error: 'Monitored account not configured' });
    }
    
    // Authenticate with Bluesky (use the matched identifier)
    const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: matchedIdentifier,
        password: password
      })
    });
    
    if (!response.ok) {
      throw new Error(`Bluesky auth failed for monitored account: ${response.status}`);
    }
    
    const data = await response.json();
    const tokens = {
      accessToken: data.accessJwt,
      refreshToken: data.refreshJwt
    };
    
    console.log(`✅ Monitored account tokens created for ${matchedIdentifier}`);
    res.json(tokens);
  } catch (error) {
    console.error('Monitored account token error:', error.message);
    res.status(500).json({ error: 'Failed to get monitored account tokens' });
  }
});

// Verify endpoint for registration
app.post('/verify', async (req, res) => {
  try {
    const { handle, identifier } = req.body;
    const userIdentifier = (identifier || handle).toLowerCase();
    console.log(`🔍 Verification requested for: ${userIdentifier}`);
    
    const user = userCredentials.get(userIdentifier);
    if (!user) {
      return res.status(404).json({ error: 'User not configured in proxy' });
    }
    
    res.json({ verified: true });
  } catch (error) {
    console.error('Verification error:', error.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Health status
app.get('/auth/status', (req, res) => {
  res.json({
    users_configured: userCredentials.size,
    healthy: userCredentials.size > 0
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Reset key if requested
if (process.env.RESET_KEY === 'true') {
  if (fs.existsSync(keyFile)) {
    fs.unlinkSync(keyFile);
    console.log('🔄 Key reset - restart container to generate new key');
    process.exit(0);
  }
}

// Generate API key on startup
const API_KEY = process.env.API_KEY || crypto.randomBytes(32).toString('hex');
process.env.API_KEY = API_KEY;

const PORT = process.env.PORT || 3550;



app.listen(PORT, '0.0.0.0', async () => {
  let publicIP = null;
  
  // Try to get public IP
  try {
    const response = await fetch('https://ifconfig.me/ip');
    publicIP = await response.text();
    publicIP = publicIP.trim();
  } catch (error) {
    // Ignore if can't get public IP
  }
  
  console.log(`🔐 Zero-Trust Authentication Proxy running on port ${PORT}`);
  console.log(`🌐 Your service URL: http://${publicIP || 'YOUR_IP'}:${PORT}`);
  console.log(`🔑 Your API key: ${API_KEY}`);
  console.log(`👥 Configured users: ${userCredentials.size}`);
  
  if (userCredentials.size === 0) {
    console.error('❌ No users configured!');
    console.error('   Set USER_<number>_IDENTIFIER and USER_<number>_PASSWORD');
    console.error('   Example:');
    console.error('     USER_1_IDENTIFIER=alice.bsky.social');
    console.error('     USER_1_PASSWORD=xxxx-xxxx-xxxx-xxxx');
    process.exit(1);
  }
  
  console.log('✅ Ready for zero-trust authentication!');
});