const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://feedmod:feedmod_password@localhost:5432/feedmoderator'
});

// Old encryption method (weak)
function decryptOld(encryptedText) {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'feed-moderator-autoblock-key-32';
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// New encryption method (secure)
function encryptNew(password) {
  const key = process.env.ENCRYPTION_KEY || 'feed-moderator-key-32-chars-long!';
  const keyBuffer = crypto.scryptSync(key, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function migratePasswords() {
  try {
    console.log('Starting password migration...');
    
    // Add migration column
    await pool.query('ALTER TABLE monitored_accounts ADD COLUMN IF NOT EXISTS password_migrated BOOLEAN DEFAULT FALSE');
    
    // Get accounts that need migration
    const result = await pool.query(`
      SELECT id, app_password 
      FROM monitored_accounts 
      WHERE password_migrated = FALSE OR password_migrated IS NULL
    `);
    
    console.log(`Found ${result.rows.length} accounts to migrate`);
    
    for (const account of result.rows) {
      try {
        // Skip if already in new format (contains ':')
        if (account.app_password.includes(':')) {
          console.log(`Account ${account.id} already in new format, marking as migrated`);
          await pool.query('UPDATE monitored_accounts SET password_migrated = TRUE WHERE id = $1', [account.id]);
          continue;
        }
        
        // Decrypt with old method
        const plainPassword = decryptOld(account.app_password);
        
        // Re-encrypt with new method
        const newEncrypted = encryptNew(plainPassword);
        
        // Update database
        await pool.query(`
          UPDATE monitored_accounts 
          SET app_password = $1, password_migrated = TRUE 
          WHERE id = $2
        `, [newEncrypted, account.id]);
        
        console.log(`✓ Migrated account ${account.id}`);
        
      } catch (error) {
        console.error(`✗ Failed to migrate account ${account.id}:`, error.message);
      }
    }
    
    // Clean up migration column
    await pool.query('ALTER TABLE monitored_accounts DROP COLUMN IF EXISTS password_migrated');
    
    console.log('Password migration completed!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migratePasswords();