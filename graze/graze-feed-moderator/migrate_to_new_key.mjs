import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://feedmod:feedmod_password@postgres:5432/feedmoderator'
});

// Old key (current)
const OLD_KEY = 'feed-moderator-key-32-chars-long!';

// New key (secure)
const NEW_KEY = '9e225c1e148a30bf3c6f20c8aaf69a2336dee209d8ce19b549953c5ee34f0cb5';

// Decrypt with old key (legacy format)
function decryptOld(encrypted) {
  const parts = encrypted.split(':');
  
  if (parts.length === 2) {
    // New format with IV - use scrypt
    const keyBuffer = crypto.scryptSync(OLD_KEY, 'salt', 32);
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } else {
    // Old format - use createDecipher
    const decipher = crypto.createDecipher('aes256', OLD_KEY);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// Encrypt with new key (secure format)
function encryptNew(text, saltSuffix = 'salt') {
  const keyBuffer = crypto.scryptSync(NEW_KEY, saltSuffix, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function migrateToNewKey() {
  try {
    console.log('Starting migration to new encryption key...');
    
    // 1. Migrate user passwords
    console.log('Migrating user passwords...');
    const users = await pool.query('SELECT id, bsky_password FROM users WHERE bsky_password IS NOT NULL');
    
    for (const user of users.rows) {
      try {
        const decrypted = decryptOld(user.bsky_password);
        const newEncrypted = encryptNew(decrypted);
        
        await pool.query('UPDATE users SET bsky_password = $1 WHERE id = $2', [newEncrypted, user.id]);
        console.log(`✓ Migrated user ${user.id} password`);
      } catch (error) {
        console.error(`✗ Failed to migrate user ${user.id}:`, error.message);
      }
    }
    
    // 2. Migrate monitored account passwords  
    console.log('Migrating monitored account passwords...');
    const monitored = await pool.query('SELECT id, app_password FROM monitored_accounts WHERE app_password IS NOT NULL');
    
    for (const account of monitored.rows) {
      try {
        const decrypted = decryptOld(account.app_password);
        const newEncrypted = encryptNew(decrypted);
        
        await pool.query('UPDATE monitored_accounts SET app_password = $1 WHERE id = $2', [newEncrypted, account.id]);
        console.log(`✓ Migrated monitored account ${account.id} password`);
      } catch (error) {
        console.error(`✗ Failed to migrate monitored account ${account.id}:`, error.message);
      }
    }
    
    // 3. Clear all session tokens (they'll be recreated with new key)
    console.log('Clearing session tokens (will be recreated)...');
    await pool.query('UPDATE users SET access_jwt = NULL, refresh_jwt = NULL, session_expires_at = NULL');
    await pool.query('UPDATE monitored_accounts SET access_jwt = NULL, refresh_jwt = NULL, session_expires_at = NULL');
    
    console.log('✅ Migration completed successfully!');
    console.log('You can now update ENCRYPTION_KEY to the new secure key.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migrateToNewKey();