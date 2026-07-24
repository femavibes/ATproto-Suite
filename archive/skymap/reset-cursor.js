const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function resetCursor() {
  try {
    // Set cursor to 1 minute ago (in microseconds) - very recent to catch new posts
    const nowUs = Date.now() * 1000;
    const oneMinAgo = nowUs - (1 * 60 * 1000 * 1000);
    
    await pool.query(
      'UPDATE contrails_cursor SET last_time_us = $1, last_post_uri = NULL, last_post_created_at = NULL WHERE id = 1',
      [oneMinAgo.toString()]
    );
    
    console.log('✅ Cursor set to 1 minute ago - listener will process new posts');
    console.log('   Cursor time_us:', oneMinAgo.toString());
    console.log('   Current time_us:', nowUs.toString());
  } catch (error) {
    console.error('Error resetting cursor:', error);
  } finally {
    await pool.end();
  }
}

resetCursor();
