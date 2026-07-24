import { Pool } from 'pg';

async function disableAutoblock() {
  const pool = new Pool({
    connectionString: 'postgresql://feedmod:feedmod_password@localhost:5433/feedmoderator'
  });

  try {
    // Disable autoblock for fema.monster temporarily
    await pool.query(`
      UPDATE users 
      SET autoblock_main_account = false 
      WHERE handle = 'fema.monster'
    `);
    
    console.log('✅ Autoblock disabled for fema.monster');
    console.log('You can now remove debug.fema.monster from the list without it being re-added');
    console.log('Run enable-autoblock.ts to re-enable when ready');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

disableAutoblock();