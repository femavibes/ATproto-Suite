import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function debugAutoblock() {
  const pool = new Pool({
    connectionString: 'postgresql://feedmod:feedmod_password@localhost:5433/feedmoderator'
  });

  try {
    console.log('🔍 Debugging autoblock system...\n');

    // 1. Check if fema.monster user exists and has autoblock enabled
    console.log('1. Checking main account status...');
    const userResult = await pool.query(`
      SELECT id, handle, did, autoblock_main_account, bsky_password IS NOT NULL as has_password
      FROM users 
      WHERE handle = 'fema.monster'
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ fema.monster user not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`✓ User: ${user.handle} (${user.did})`);
    console.log(`  Autoblock enabled: ${user.autoblock_main_account}`);
    console.log(`  Has password: ${user.has_password}\n`);

    // 2. Check configured accounts
    console.log('2. Checking configured accounts...');
    const accountsResult = await pool.query(`
      SELECT id, handle, did, is_active, created_at
      FROM user_accounts 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [user.id]);
    
    console.log(`Found ${accountsResult.rows.length} configured accounts:`);
    accountsResult.rows.forEach((acc: any) => {
      console.log(`  - ${acc.handle} (${acc.did}) - ${acc.is_active ? 'Active' : 'Inactive'}`);
    });
    console.log();

    // 3. Check configured block lists
    console.log('3. Checking configured block lists...');
    const listsResult = await pool.query(`
      SELECT id, list_uri, list_name, is_global, target_account_id, created_at
      FROM block_lists 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [user.id]);
    
    console.log(`Found ${listsResult.rows.length} configured block lists:`);
    listsResult.rows.forEach((list: any) => {
      console.log(`  - ${list.list_name}: ${list.list_uri}`);
      console.log(`    Global: ${list.is_global}, Target Account: ${list.target_account_id}`);
    });
    console.log();

    // Check if the specific list is configured
    const targetList = listsResult.rows.find((list: any) => 
      list.list_uri.includes('3m5wsuarojx2i') || 
      list.list_uri.includes('fema.monster/lists/')
    );
    
    if (targetList) {
      console.log(`✓ Target list found: ${targetList.list_name}`);
    } else {
      console.log('❌ Target list (3m5wsuarojx2i) not found in configuration');
      console.log('   You need to add this list in the Block Lists tab');
    }
    console.log();

    // 4. Check recent processed blocks
    console.log('4. Checking recent processed blocks...');
    const processedResult = await pool.query(`
      SELECT pb.*, ua.handle
      FROM processed_blocks pb
      JOIN user_accounts ua ON pb.user_account_id = ua.id
      WHERE ua.user_id = $1
      ORDER BY pb.blocked_at DESC
      LIMIT 10
    `, [user.id]);
    
    console.log(`Found ${processedResult.rows.length} recent processed blocks:`);
    processedResult.rows.forEach((block: any) => {
      console.log(`  - Account: ${block.handle}, Blocker: ${block.blocker_did}, Time: ${block.blocked_at}`);
    });
    console.log();

    // 5. Check autoblock log
    console.log('5. Checking autoblock log...');
    const logResult = await pool.query(`
      SELECT al.*, bl.list_name
      FROM autoblock_log al
      LEFT JOIN block_lists bl ON al.list_id = bl.id
      WHERE al.user_id = $1
      ORDER BY al.created_at DESC
      LIMIT 10
    `, [user.id]);
    
    console.log(`Found ${logResult.rows.length} recent autoblock actions:`);
    logResult.rows.forEach((log: any) => {
      console.log(`  - ${log.blocker_handle} (${log.blocker_did}) -> ${log.list_name || 'Unknown List'}`);
      console.log(`    Action: ${log.action}, Time: ${log.created_at}`);
    });
    console.log();

    // 6. Look for debug.fema.monster specifically
    console.log('6. Searching for debug.fema.monster...');
    const debugResult = await pool.query(`
      SELECT * FROM autoblock_log 
      WHERE user_id = $1 
      AND (blocker_handle LIKE '%debug.fema.monster%' OR blocker_did LIKE '%debug%')
      ORDER BY created_at DESC
    `, [user.id]);
    
    if (debugResult.rows.length > 0) {
      console.log('✓ Found debug.fema.monster in autoblock log:');
      debugResult.rows.forEach((log: any) => {
        console.log(`  - Action: ${log.action}, Time: ${log.created_at}`);
      });
    } else {
      console.log('❌ debug.fema.monster not found in autoblock log');
      console.log('   This suggests the block was not detected by the system');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugAutoblock();