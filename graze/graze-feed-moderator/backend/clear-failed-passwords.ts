#!/usr/bin/env tsx

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function clearFailedPasswords() {
  console.log('🔧 Clearing failed password entries...\n');

  try {
    // Clear main account passwords that can't be decrypted
    const mainResult = await pool.query(`
      UPDATE user_profiles 
      SET bsky_password = NULL 
      WHERE bsky_password IS NOT NULL
    `);
    
    console.log(`✅ Cleared ${mainResult.rowCount} main account passwords`);

    // Clear monitored account passwords that can't be decrypted
    const monitoredResult = await pool.query(`
      UPDATE monitored_accounts 
      SET app_password = NULL 
      WHERE app_password IS NOT NULL
    `);
    
    console.log(`✅ Cleared ${monitoredResult.rowCount} monitored account passwords`);

    console.log('\n📝 Next steps:');
    console.log('1. Go to fema.monster and log in');
    console.log('2. Go to Profile Settings and re-enter your Bluesky app password');
    console.log('3. Go to Autoblock settings and re-enter app passwords for monitored accounts');
    console.log('4. Test the autoblock feature again');

  } catch (error) {
    console.error('Error clearing passwords:', error);
  } finally {
    await pool.end();
  }
}

clearFailedPasswords();