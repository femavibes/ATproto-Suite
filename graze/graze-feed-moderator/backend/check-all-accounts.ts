import { Pool } from 'pg';

async function checkAllAccounts() {
  const pool = new Pool({
    connectionString: 'postgresql://feedmod:feedmod_password@localhost:5433/feedmoderator'
  });

  try {
    console.log('🔍 Checking all accounts for autoblock monitoring...\n');

    // Check main accounts
    console.log('1. Main accounts with autoblock enabled:');
    const mainResult = await pool.query(`
      SELECT handle, did, autoblock_main_account, bsky_password IS NOT NULL as has_password
      FROM users 
      WHERE autoblock_main_account = true
    `);

    if (mainResult.rows.length === 0) {
      console.log('   No main accounts with autoblock enabled');
    } else {
      mainResult.rows.forEach((user: any) => {
        console.log(`   - ${user.handle} (${user.did}) - Password: ${user.has_password ? 'Yes' : 'No'}`);
      });
    }

    // Check alt accounts
    console.log('\n2. Alt accounts configured:');
    const altResult = await pool.query(`
      SELECT ua.handle, ua.did, ua.is_active, u.handle as owner_handle
      FROM user_accounts ua
      JOIN users u ON ua.user_id = u.id
      ORDER BY ua.created_at DESC
    `);

    if (altResult.rows.length === 0) {
      console.log('   No alt accounts configured');
    } else {
      altResult.rows.forEach((account: any) => {
        console.log(`   - ${account.handle} (${account.did}) - Owner: ${account.owner_handle} - Active: ${account.is_active}`);
      });
    }

    // Check block lists
    console.log('\n3. Configured block lists:');
    const listsResult = await pool.query(`
      SELECT bl.list_name, bl.list_uri, bl.is_global, u.handle as owner_handle
      FROM block_lists bl
      JOIN users u ON bl.user_id = u.id
      ORDER BY bl.created_at DESC
    `);

    if (listsResult.rows.length === 0) {
      console.log('   No block lists configured');
    } else {
      listsResult.rows.forEach((list: any) => {
        console.log(`   - ${list.list_name}: ${list.list_uri}`);
        console.log(`     Owner: ${list.owner_handle}, Global: ${list.is_global}`);
      });
    }

    console.log('\n🔧 DIAGNOSIS:');
    if (mainResult.rows.length === 0 && altResult.rows.length === 0) {
      console.log('❌ No accounts configured for monitoring');
    } else if (listsResult.rows.length === 0) {
      console.log('❌ No block lists configured - nowhere to add blocked users');
    } else {
      console.log('✅ Configuration looks complete');
      console.log('   Issue is likely with account authentication or DM processing');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAllAccounts();