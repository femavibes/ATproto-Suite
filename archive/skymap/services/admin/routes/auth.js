const express = require('express');
const { AtpAgent } = require('@atproto/api');

module.exports = (pool, requireAuth) => {
  const router = express.Router();

  // Login endpoint for whitelisted users AND master admin
  router.post('/auth/login', async (req, res) => {
    const handle = (req.body.handle || '').trim().toLowerCase();
    const password = (req.body.password || '').trim();
    if (!handle || !password) {
      return res.status(400).json({ error: 'Handle and password required' });
    }
    
    try {
      // Check if master admin
      const envHandle = (process.env.BLUESKY_HANDLE || '').trim().toLowerCase();
      const envPassword = (process.env.BLUESKY_PASSWORD || '').trim();
      const handleMatch = handle === envHandle;
      const passMatch = password === envPassword;
      const isMasterAdmin = handleMatch && passMatch;
      console.log('Login debug:', {
        inputHandle: handle,
        inputPassLength: password.length,
        inputPassFirst4: password.slice(0, 4),
        inputPassLast4: password.slice(-4),
        envHandle,
        envPassLength: envPassword.length,
        envPassFirst4: envPassword.slice(0, 4),
        envPassLast4: envPassword.slice(-4),
        handleMatch,
        passMatch,
        isMasterAdmin
      });
      
      if (!isMasterAdmin) {
        // Check whitelist for regular users
        const whitelistResult = await pool.query(
          'SELECT * FROM admin_users WHERE handle = $1 AND active = true',
          [handle]
        );
        
        if (whitelistResult.rows.length === 0) {
          console.error(`Login attempt by non-whitelisted user: ${handle}`);
          return res.status(403).json({ error: 'Not authorized. Your handle is not on the admin whitelist.' });
        }
        
        // If handle matches env handle, accept env password without hitting Bluesky
        let blueskyVerified = false;
        if (handleMatch && passMatch) {
          console.log(`Whitelisted env-handle login for ${handle} - skipping Bluesky API`);
          blueskyVerified = true;
        }

        // Otherwise verify credentials with user's PDS (with retry for rate limits)
        if (!blueskyVerified) {
          // Resolve the user's PDS endpoint
          let pdsEndpoint = 'https://bsky.social';
          try {
            const resolveRes = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
            if (resolveRes.ok) {
              const { did } = await resolveRes.json();
              const plcRes = await fetch(`https://plc.directory/${did}`);
              if (plcRes.ok) {
                const doc = await plcRes.json();
                const pds = doc.service?.find(s => s.id === '#atproto_pds');
                if (pds?.serviceEndpoint) {
                  pdsEndpoint = pds.serviceEndpoint;
                }
              }
            }
            console.log(`Resolved PDS for ${handle}: ${pdsEndpoint}`);
          } catch (resolveErr) {
            console.error(`PDS resolution failed for ${handle}, falling back to bsky.social:`, resolveErr.message);
          }

          let retries = 3;
          let lastError = null;
          
          while (retries > 0 && !blueskyVerified) {
            try {
              const agent = new AtpAgent({ service: pdsEndpoint });
              await agent.login({ identifier: handle, password });
              blueskyVerified = true;
            } catch (blueskyError) {
              lastError = blueskyError;
              console.error(`Bluesky login error (${4 - retries}/3):`, {
                handle,
                error: blueskyError.message,
                status: blueskyError.status,
                statusCode: blueskyError.statusCode
              });
              
              // If rate limited, wait and retry
              if ((blueskyError.message?.includes('rate limit') || 
                   blueskyError.message?.includes('Rate Limit') ||
                   blueskyError.statusCode === 429) && retries > 1) {
                const waitTime = (4 - retries) * 2000; // 2s, 4s, 6s
                console.log(`Rate limited, waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                retries--;
                continue;
              }
              
              // If not rate limit or out of retries, break and return error
              break;
            }
          }
          
          if (!blueskyVerified) {
            if (lastError?.message?.includes('Invalid identifier or password') || 
                lastError?.message?.includes('Authentication required') ||
                lastError?.statusCode === 401) {
              return res.status(401).json({ error: 'Invalid Bluesky credentials. Please check your handle and app password.' });
            } else if (lastError?.message?.includes('rate limit') || 
                       lastError?.message?.includes('Rate Limit') ||
                       lastError?.statusCode === 429) {
              return res.status(429).json({ error: 'Bluesky API rate limited. Please wait a few minutes and try again.' });
            } else {
              return res.status(401).json({ 
                error: `Bluesky authentication failed: ${lastError?.message || 'Unknown error'}` 
              });
            }
          }
        }
      } else {
        // Master admin: skip Bluesky verification since we've already verified the password
        console.log('Master admin login - skipping Bluesky API verification');
      }
      
      // Create session
      req.session.authenticatedHandle = handle;
      req.session.isMasterAdmin = isMasterAdmin;
      
      console.log(`Successful login: ${handle} (${isMasterAdmin ? 'master admin' : 'whitelisted user'})`);
      res.json({ success: true, handle });
    } catch (error) {
      console.error('Login error:', {
        handle,
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: `Login failed: ${error.message}` });
    }
  });

  // Get current session
  router.get('/auth/session', (req, res) => {
    if (req.session.authenticatedHandle) {
      res.json({ 
        authenticated: true, 
        handle: req.session.authenticatedHandle,
        isMasterAdmin: req.session.isMasterAdmin || false
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Logout
  router.post('/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
  });

  // Whitelist management - add user (master admin only)
  router.post('/whitelist/add', requireAuth, async (req, res) => {
    const { handle } = req.body;
    
    if (!handle) {
      return res.status(400).json({ error: 'Handle required' });
    }
    
    try {
      await pool.query(
        'INSERT INTO admin_users (handle) VALUES ($1) ON CONFLICT (handle) DO UPDATE SET active = true',
        [handle]
      );
      res.json({ success: true, message: `Added ${handle} to whitelist` });
    } catch (error) {
      console.error('Error adding to whitelist:', error);
      res.status(500).json({ error: 'Failed to add user' });
    }
  });

  // Whitelist management - remove user (master admin only)
  router.post('/whitelist/remove', requireAuth, async (req, res) => {
    const { handle } = req.body;
    
    if (!handle) {
      return res.status(400).json({ error: 'Handle required' });
    }
    
    try {
      await pool.query(
        'UPDATE admin_users SET active = false WHERE handle = $1',
        [handle]
      );
      res.json({ success: true, message: `Removed ${handle} from whitelist` });
    } catch (error) {
      console.error('Error removing from whitelist:', error);
      res.status(500).json({ error: 'Failed to remove user' });
    }
  });

  // List whitelisted users
  router.get('/whitelist', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT handle, created_at, active FROM admin_users ORDER BY created_at DESC'
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching whitelist:', error);
      res.status(500).json({ error: 'Failed to fetch whitelist' });
    }
  });

  return router;
};
