import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function addBlockList() {
  const pool = new Pool({
    connectionString: 'postgresql://feedmod:feedmod_password@localhost:5433/feedmoderator'
  });

  try {
    // Get the user ID for debug.fema.monster
    const userResult = await pool.query(`
      SELECT id FROM users WHERE handle = 'debug.fema.monster'
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const userId = userResult.rows[0].id;
    
    // Add the block list
    const listUri = 'at://did:plc:3wh3o5qteklqxtz4d4iz3taq/app.bsky.graph.list/3m5wsuarojx2i';
    const listName = 'Auto Block List';
    
    const result = await pool.query(`
      INSERT INTO block_lists (user_id, list_uri, list_name, is_global, target_account_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, list_uri)
      DO UPDATE SET 
        list_name = EXCLUDED.list_name,
        is_global = EXCLUDED.is_global,
        target_account_id = EXCLUDED.target_account_id
      RETURNING *
    `, [userId, listUri, listName, true, null]);
    
    console.log('✅ Block list added successfully:');
    console.log(`   Name: ${result.rows[0].list_name}`);
    console.log(`   URI: ${result.rows[0].list_uri}`);
    console.log(`   Global: ${result.rows[0].is_global}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

addBlockList();