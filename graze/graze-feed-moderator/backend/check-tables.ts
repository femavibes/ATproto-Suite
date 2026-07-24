import { Pool } from 'pg';

async function checkTables() {
  const pool = new Pool({
    connectionString: 'postgresql://feedmod:feedmod_password@localhost:5433/feedmoderator'
  });

  try {
    console.log('🔍 Checking if autoblock tables exist...\n');

    const tables = ['user_accounts', 'block_lists', 'processed_blocks', 'autoblock_log'];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      const exists = result.rows[0].exists;
      console.log(`${exists ? '✅' : '❌'} Table ${table}: ${exists ? 'EXISTS' : 'MISSING'}`);
    }

    // Check if main account has autoblock_main_account column
    console.log('\n🔍 Checking users table structure...');
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY column_name;
    `);
    
    const columns = columnsResult.rows.map(row => row.column_name);
    const hasAutoblockColumn = columns.includes('autoblock_main_account');
    
    console.log(`${hasAutoblockColumn ? '✅' : '❌'} Column autoblock_main_account: ${hasAutoblockColumn ? 'EXISTS' : 'MISSING'}`);
    console.log('Available columns:', columns.join(', '));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTables();