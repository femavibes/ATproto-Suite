#!/usr/bin/env tsx

import { Pool } from 'pg';
import { PasswordService } from './src/services/passwordService.js';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace('postgres:5432', 'localhost:5433'),
});

async function fixPasswordDecryption() {
  console.log('🔍 Checking password decryption issues...\n');

  try {
    // Check main accounts
    console.log('📋 Checking main accounts (user_profiles):');
    const mainAccounts = await pool.query(`
      SELECT id, handle, bsky_password 
      FROM user_profiles 
      WHERE bsky_password IS NOT NULL
    `);

    for (const account of mainAccounts.rows) {
      try {
        await PasswordService.decryptPassword(account.bsky_password);
        console.log(`✅ @${account.handle} - Password decryption OK`);
      } catch (error) {
        console.log(`❌ @${account.handle} - Password decryption FAILED: ${error.message}`);
        console.log(`   Account ID: ${account.id}`);
        console.log(`   Encrypted data length: ${account.bsky_password.length}`);
        console.log(`   Format: ${account.bsky_password.includes(':') ? 'New (with IV)' : 'Old (legacy)'}`);
      }
    }

    console.log('\n📋 Checking monitored accounts:');
    const monitoredAccounts = await pool.query(`
      SELECT id, handle, app_password, owner_user_id
      FROM monitored_accounts 
      WHERE app_password IS NOT NULL
    `);

    for (const account of monitoredAccounts.rows) {
      try {
        await PasswordService.decryptPassword(account.app_password);
        console.log(`✅ @${account.handle} - Password decryption OK`);
      } catch (error) {
        console.log(`❌ @${account.handle} - Password decryption FAILED: ${error.message}`);
        console.log(`   Account ID: ${account.id}, Owner: ${account.owner_user_id}`);
        console.log(`   Encrypted data length: ${account.app_password.length}`);
        console.log(`   Format: ${account.app_password.includes(':') ? 'New (with IV)' : 'Old (legacy)'}`);
      }
    }

    console.log('\n🔧 To fix failed accounts:');
    console.log('1. Go to fema.monster and log in');
    console.log('2. For main account: Go to Profile Settings and re-enter your Bluesky app password');
    console.log('3. For monitored accounts: Go to Autoblock settings and update the app password for failed accounts');
    console.log('4. Or use the "Test" button which should prompt you to re-enter passwords');

  } catch (error) {
    console.error('Error checking passwords:', error);
  } finally {
    await pool.end();
  }
}

fixPasswordDecryption();