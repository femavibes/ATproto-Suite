import express from 'express';
import jwt from 'jsonwebtoken';
import { AtpAgent } from '@atproto/api';
import { Database } from '../services/database.js';
import { GrazeService } from '../services/graze.js';
import { AuthSecurity } from '../services/authSecurity.js';

// Helper function to resolve handle to DID
async function resolveHandleToDid(handle: string): Promise<string | null> {
  try {
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    const response = await agent.resolveHandle({ handle });
    return response.data.did;
  } catch (error) {
    console.error('Failed to resolve handle:', handle.replace(/[\r\n]/g, ''), 'Error:', error);
    return null;
  }
}

const router = express.Router();
const db = Database.getInstance();

// Origin validation middleware
function validateOrigin(req: any, res: any, next: any) {
  // Skip origin validation in development for auth routes
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  const origin = req.headers.origin;
  if (!origin) {
    return res.status(403).json({ error: 'Origin header required' });
  }
  
  const allowedOrigins = [
    'https://modmaster.fema.monster',
    'http://localhost:5173',
    'http://192.168.0.184:8081'
  ];
  
  if (!allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Invalid origin' });
  }
  
  next();
}

// CSRF protection for authenticated routes
function csrfProtection(req: any, res: any, next: any) {
  // Skip CSRF protection in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  const csrfToken = req.headers['x-csrf-token'] || req.body.csrfToken;
  if (!csrfToken || csrfToken !== req.user?.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

// Register new user
router.post('/register', validateOrigin, async (req, res) => {
  try {
    const { handle, bskyPassword, appPassword, zeroTrustMode, proxyUrl, proxyApiKey } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    console.log('Registration attempt:', {
      handle: handle?.replace(/[\r\n]/g, ''),
      hasBskyPassword: !!bskyPassword,
      hasAppPassword: !!appPassword,
      zeroTrustMode,
      hasProxyUrl: !!proxyUrl,
      hasProxyApiKey: !!proxyApiKey
    });
    
    if (!handle) {
      return res.status(400).json({ error: 'Handle required' });
    }
    
    if (!zeroTrustMode && !bskyPassword) {
      return res.status(400).json({ error: 'Bluesky password required' });
    }
    
    if (zeroTrustMode && !appPassword) {
      return res.status(400).json({ error: 'App password required for zero-trust mode' });
    }
    
    if (zeroTrustMode && (!proxyUrl || !proxyApiKey)) {
      return res.status(400).json({ error: 'Proxy URL and API key required for zero-trust mode' });
    }
    
    // Rate limiting
    if (!AuthSecurity.checkRateLimit(clientIP)) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }
    
    // Resolve handle to DID
    const did = await resolveHandleToDid(handle);
    if (!did) {
      return res.status(400).json({ error: 'Invalid Bluesky handle' });
    }
    
    // Check if user already exists with a real account (not just a profile)
    const existingUser = await db.getUserByDid(did);
    if (existingUser && existingUser.subscription_tier !== 'none') {
      return res.status(409).json({ error: 'User already registered' });
    }
    
    // Validate credentials based on mode
    if (zeroTrustMode) {
      // For zero-trust: verify through user's proxy
      try {
        const verifyResponse = await fetch(`${proxyUrl}/verify`, {
          method: 'POST',
          headers: { 
            'X-API-Key': proxyApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ handle })
        });
        
        if (!verifyResponse.ok) {
          const errorData = await verifyResponse.json().catch(() => ({}));
          return res.status(400).json({ error: errorData.error || 'Failed to verify through proxy - check configuration' });
        }
      } catch (proxyError) {
        return res.status(400).json({ error: 'Failed to connect to proxy - ensure it is running and accessible' });
      }
    } else {
      // For standard mode: verify directly with Bluesky
      const isValidCredentials = await AuthSecurity.validateBlueskyCredentials(handle, bskyPassword);
      if (!isValidCredentials) {
        return res.status(401).json({ error: 'Invalid Bluesky credentials - could not verify account ownership' });
      }
    }
    
    // Fetch profile data from Bluesky public API during registration
    let profileData = { avatar: null, displayName: null };
    try {
      const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`);
      const profile = await response.json();
      profileData = { avatar: profile.avatar, displayName: profile.displayName };
    } catch (error) {
      console.log('Could not fetch profile data during registration, will be empty');
    }
    
    // Create or update user profile with app subscription
    let user;
    if (existingUser && existingUser.subscription_tier === 'none') {
      // Upgrade existing profile to registered account
      await db.updateUserSubscription(existingUser.id, 'free');
      user = { ...existingUser, subscription_tier: 'free' };
    } else {
      // Create new user profile
      user = await db.createUserProfile(did, handle, 'free');
    }
    
    // Set sync defaults for new users (enable admin sync by default)
    await db.getPool().query(`
      UPDATE user_profiles 
      SET sync_global_post_thresholds = true, 
          sync_global_ban_thresholds = true,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [user.id]);
    
    // Apply admin defaults to new user's thresholds
    const { AdminThresholdSync } = await import('../services/adminThresholdSync.js');
    const syncService = AdminThresholdSync.getInstance();
    await syncService.applyAdminDefaultsToUser(user.id);
    
    // Update profile with Bluesky data
    if (profileData.avatar || profileData.displayName) {
      await db.getPool().query(
        'UPDATE user_profiles SET avatar_url = $1, display_name = $2 WHERE id = $3',
        [profileData.avatar, profileData.displayName, user.id]
      );
    }
    
    // Store appropriate password based on zero-trust mode
    if (zeroTrustMode) {
      // Store app password for login
      const encryptedAppPassword = await GrazeService.encryptPassword(appPassword!);
      await db.updateUserProfileCredentials(user.id, encryptedAppPassword);
      await db.getPool().query(
        'UPDATE user_profiles SET password_type = $1 WHERE id = $2',
        ['basic', user.id]
      );
    } else {
      // Store Bluesky password for login and operations
      const encryptedBskyPassword = await GrazeService.encryptPassword(bskyPassword);
      await db.updateUserProfileCredentials(user.id, encryptedBskyPassword);
      await db.getPool().query(
        'UPDATE user_profiles SET password_type = $1 WHERE id = $2',
        ['app', user.id]
      );
    }
    
    // Handle zero-trust mode
    if (zeroTrustMode) {
      // Store proxy configuration
      await db.getPool().query(
        'UPDATE user_profiles SET zero_trust_mode = true, zero_trust_status = $1, zero_trust_proxy_url = $2, zero_trust_api_key = $3 WHERE id = $4',
        ['active', proxyUrl, proxyApiKey, user.id]
      );
    }
    
    // Get profile data from user_profiles table
    const profileResult = await db.getPool().query(
      'SELECT avatar_url, display_name FROM user_profiles WHERE did = $1',
      [did]
    );
    const profile = profileResult.rows[0];
    
    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, did: user.did, handle: user.handle, type: 'access' },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );
    
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        did: user.did,
        handle: user.handle,
        subscription_tier: user.subscription_tier,
        is_admin: user.is_admin,
        avatar: profile?.avatar_url,
        display_name: profile?.display_name
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login existing user
router.post('/login', validateOrigin, async (req, res) => {
  try {
    const { handle, bskyPassword } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    console.log(`Login attempt for handle: ${AuthSecurity.sanitizeHandle(handle)}`);
    
    if (!handle || !bskyPassword) {
      return res.status(400).json({ error: 'Handle and password required' });
    }
    
    // Rate limiting
    if (!AuthSecurity.checkRateLimit(clientIP)) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }
    
    // Check for account lockout
    if (AuthSecurity.isAccountLocked(handle)) {
      return res.status(429).json({ error: 'Account temporarily locked due to failed attempts' });
    }
    
    // Resolve handle to DID
    const did = await resolveHandleToDid(handle);
    if (!did) {
      return res.status(400).json({ error: 'Invalid Bluesky handle' });
    }
    
    const user = await db.getUserProfileByDid(did);
    if (!user || user.subscription_tier === 'none') {
      return res.status(404).json({ error: 'User not found or not registered for app' });
    }
    
    // Get profile data from user_profiles table
    const profileResult = await db.getPool().query(
      'SELECT avatar_url, display_name FROM user_profiles WHERE did = $1',
      [did]
    );
    let profile = profileResult.rows[0] || {};
    
    // If no avatar, fetch from Bluesky public API
    console.log(`Profile check: avatar_url=${profile.avatar_url}, display_name=${profile.display_name}`);
    if (!profile.avatar_url) {
      console.log(`Fetching profile data for ${handle} during login...`);
      try {
        const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`);
        const bskyProfile = await response.json();
        
        console.log(`Got profile data: avatar=${bskyProfile.avatar}, displayName=${bskyProfile.displayName}`);
        
        await db.getPool().query(
          'UPDATE user_profiles SET avatar_url = $1, display_name = $2 WHERE did = $3',
          [bskyProfile.avatar, bskyProfile.displayName, did]
        );
        
        profile = {
          avatar_url: bskyProfile.avatar,
          display_name: bskyProfile.displayName
        };
      } catch (error: any) {
        console.log('Could not fetch profile data during login:', error.message);
      }
    }
    
    // Validate password against stored password
    const storedPassword = user.bsky_password;
    if (!storedPassword) {
      console.log('No stored password for user, attempting to validate and set password');
      
      // Check if it's an app password format
      const isAppPassword = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(bskyPassword);
      
      if (isAppPassword) {
        // Validate with Bluesky API
        const isValidCredentials = await AuthSecurity.validateBlueskyCredentials(handle, bskyPassword);
        
        if (isValidCredentials) {
          console.log('Valid app password provided, storing for future logins');
          // Store the validated app password
          const encryptedPassword = await GrazeService.encryptPassword(bskyPassword);
          await db.updateUserProfileCredentials(user.id, encryptedPassword);
          await db.getPool().query(
            'UPDATE user_profiles SET password_type = $1 WHERE id = $2',
            ['app', user.id]
          );
          // Continue with login flow below
        } else {
          AuthSecurity.recordFailedAttempt(handle);
          return res.status(401).json({ error: 'Invalid Bluesky credentials' });
        }
      } else {
        // Regular password - user must register first to set up zero-trust or store password
        return res.status(401).json({ 
          error: 'No password set for this account. Please register first or use a Bluesky app password.' 
        });
      }
    }
    
    if (storedPassword) {
      try {
        const decryptedPassword = await GrazeService.decryptPassword(storedPassword);
        const isMatch = decryptedPassword === bskyPassword;
        console.log(`Password validation: match=${isMatch}`);
        
        // Clear password from memory
        decryptedPassword.replace(/./g, '0');
        
        if (!isMatch) {
          // Check if it's an app password format
          const isAppPassword = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(bskyPassword);
          
          if (isAppPassword) {
            // Validate with Bluesky API
            const isValidCredentials = await AuthSecurity.validateBlueskyCredentials(handle, bskyPassword);
            
            if (isValidCredentials) {
              // Valid app password but different from stored one
              return res.status(409).json({ 
                error: 'Different app password detected',
                canUpdate: true,
                message: 'This is a valid app password but not your current one. Would you like to update your saved password?'
              });
            }
          }
          
          AuthSecurity.recordFailedAttempt(handle);
          return res.status(401).json({ error: 'Invalid password' });
        }
        AuthSecurity.clearFailedAttempts(handle);
      } catch (decryptError) {
        console.error('Password decryption error:', decryptError);
        return res.status(500).json({ error: 'Authentication error' });
      }
    }
    // If no stored password, we already validated and set it above
    AuthSecurity.clearFailedAttempts(handle);
    
    // Generate CSRF token
    const crypto = await import('crypto');
    const csrfToken = crypto.randomBytes(32).toString('hex');
    
    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, did: user.did, handle: user.handle, type: 'access', csrfToken },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );
    
    res.json({
      accessToken,
      refreshToken,
      csrfToken,
      user: {
        id: user.id,
        did: user.did,
        handle: user.handle,
        subscription_tier: user.subscription_tier,
        is_admin: user.is_admin,
        avatar: profile?.avatar_url,
        display_name: profile?.display_name
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh user profile from Bluesky
router.post('/refresh-profile', authenticateToken, csrfProtection, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Fetch profile from Bluesky
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    const profile = await agent.api.app.bsky.actor.getProfile({ actor: user.did });
    
    // Update user profile in database
    await db.getPool().query(`
      UPDATE user_profiles 
      SET avatar_url = $1, display_name = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [profile.data.avatar, profile.data.displayName, userId]);
    
    res.json({
      success: true,
      avatar: profile.data.avatar,
      display_name: profile.data.displayName
    });
    
  } catch (error) {
    console.error('Profile refresh error:', error);
    res.status(500).json({ error: 'Profile refresh failed' });
  }
});

// Verify account for password reset (step 1)
router.post('/verify-reset', validateOrigin, async (req, res) => {
  try {
    const { handle, newBskyPassword } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (!handle || !newBskyPassword) {
      return res.status(400).json({ error: 'Handle and password required' });
    }
    
    // Rate limiting
    if (!AuthSecurity.checkRateLimit(clientIP)) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }
    
    // Resolve handle to DID
    const did = await resolveHandleToDid(handle);
    if (!did) {
      return res.status(400).json({ error: 'Invalid Bluesky handle' });
    }
    
    const user = await db.getUserProfileByDid(did);
    if (!user || user.subscription_tier === 'none') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Validate with Bluesky API (only for verification, not saved)
    const isValidCredentials = await AuthSecurity.validateBlueskyCredentials(handle, newBskyPassword);
    if (!isValidCredentials) {
      return res.status(401).json({ error: 'Invalid Bluesky credentials - could not verify account' });
    }
    
    // Generate temporary token for password reset
    const resetToken = jwt.sign(
      { userId: user.id, did: user.did, type: 'reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );
    
    res.json({ success: true, token: resetToken });
    
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Complete password reset (step 2)
router.post('/complete-reset', validateOrigin, async (req, res) => {
  try {
    const { token, passwordType, password } = req.body;
    
    if (!token || !passwordType || !password) {
      return res.status(400).json({ error: 'Token, password type, and password required' });
    }
    
    // Verify reset token
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
      if (decoded.type !== 'reset') {
        return res.status(403).json({ error: 'Invalid token type' });
      }
    } catch (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Encrypt and store password
    const encryptedPassword = await GrazeService.encryptPassword(password);
    await db.updateUserProfileCredentials(decoded.userId, encryptedPassword);
    
    // Update password type
    await db.getPool().query(
      'UPDATE user_profiles SET password_type = $1 WHERE id = $2',
      [passwordType, decoded.userId]
    );
    
    res.json({ success: true, message: 'Password saved successfully' });
    
  } catch (error) {
    console.error('Password save error:', error);
    res.status(500).json({ error: 'Failed to save password' });
  }
});

// Update password during login (when different valid app password detected)
router.post('/update-login-password', validateOrigin, async (req, res) => {
  try {
    const { handle, newPassword } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (!handle || !newPassword) {
      return res.status(400).json({ error: 'Handle and password required' });
    }
    
    // Rate limiting
    if (!AuthSecurity.checkRateLimit(clientIP)) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }
    
    // Resolve handle to DID
    const did = await resolveHandleToDid(handle);
    if (!did) {
      return res.status(400).json({ error: 'Invalid Bluesky handle' });
    }
    
    const user = await db.getUserProfileByDid(did);
    if (!user || user.subscription_tier === 'none') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Validate with Bluesky API
    const isValidCredentials = await AuthSecurity.validateBlueskyCredentials(handle, newPassword);
    if (!isValidCredentials) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Encrypt and store new password
    const encryptedPassword = await GrazeService.encryptPassword(newPassword);
    await db.updateUserProfileCredentials(user.id, encryptedPassword);
    
    // Update password type
    const isAppPassword = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(newPassword);
    await db.getPool().query(
      'UPDATE user_profiles SET password_type = $1 WHERE id = $2',
      [isAppPassword ? 'app' : 'basic', user.id]
    );
    
    res.json({ success: true, message: 'Password updated successfully' });
    
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Password update failed' });
  }
});

// Update Bluesky password
router.post('/update-password', authenticateToken, csrfProtection, async (req: any, res) => {
  try {
    const { bskyPassword } = req.body;
    
    if (!bskyPassword) {
      return res.status(400).json({ error: 'Password required' });
    }
    
    // Detect if it's a Bluesky app password (format: xxxx-xxxx-xxxx-xxxx)
    const isAppPassword = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(bskyPassword);
    
    // Encrypt and store new password
    const encryptedPassword = await GrazeService.encryptPassword(bskyPassword);
    await db.updateUserProfileCredentials(req.user.userId, encryptedPassword);
    
    // Update password type
    await db.getPool().query(
      'UPDATE user_profiles SET password_type = $1 WHERE id = $2',
      [isAppPassword ? 'app' : 'basic', req.user.userId]
    );
    
    res.json({ success: true, message: 'Password updated successfully' });
    
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Password update failed' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }
  
  jwt.verify(refreshToken, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err || user.type !== 'refresh') {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }
    
    const accessToken = jwt.sign(
      { userId: user.userId, type: 'access' },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    
    res.json({ accessToken });
  });
});

// Middleware to verify JWT
export function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Token expired or invalid' });
    }
    if (user.type !== 'access') {
      return res.status(403).json({ error: 'Invalid token type' });
    }
    req.user = user;
    next();
  });
}



export default router;