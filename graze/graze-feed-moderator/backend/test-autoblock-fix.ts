import { Pool } from 'pg';
import { BlueskyService } from './src/services/bluesky.js';

async function testAutoblockFix() {
  const pool = new Pool({
    connectionString: 'postgresql://feedmod:feedmod_password@localhost:5433/feedmoderator'
  });

  try {
    console.log('🔍 Testing autoblock fix with BlueskyService...\n');

    // Get fema.monster user
    const userResult = await pool.query(`
      SELECT * FROM users WHERE handle = 'fema.monster'
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ fema.monster user not found');
      return;
    }

    const user = userResult.rows[0];
    console.log(`Testing with user: ${user.handle}`);

    // Test BlueskyService authentication
    const blueskyService = new BlueskyService();
    
    console.log('🔐 Testing BlueskyService authentication...');
    
    // Try to get ban lists (this will test authentication)
    const banLists = await blueskyService.getBanLists(user);
    console.log(`✅ Authentication successful! Found ${banLists.length} ban lists:`);
    
    banLists.forEach(list => {
      console.log(`  - ${list.name}: ${list.uri}`);
    });

    // Test adding debug.fema.monster to the autoblock list
    const targetList = 'at://did:plc:lptjvw6ut224kwrj7ub3sqbe/app.bsky.graph.list/3m5wsuarojx2i';
    
    console.log('\n🎯 Testing adding debug.fema.monster to autoblock list...');
    try {
      await blueskyService.banUser('debug.fema.monster', targetList, user);
      console.log('✅ Successfully added debug.fema.monster to autoblock list!');
    } catch (error: any) {
      console.error('❌ Failed to add to list:', error.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testAutoblockFix();