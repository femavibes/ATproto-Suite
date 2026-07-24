const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  console.log('\n=== HASHTAG MAPPINGS ===');
  const mappings = await pool.query(`
    SELECT h.hashtag, l.name, l.region_name 
    FROM hashtag_mappings h 
    JOIN locations l ON h.location_id = l.id 
    ORDER BY l.name, h.hashtag
  `);
  console.log(mappings.rows);
  
  console.log('\n=== LOCATION POST STATS ===');
  const stats = await pool.query(`
    SELECT l.name, l.region_name, 
           s.post_count_1h, s.post_count_6h, s.post_count_24h, s.post_count_7d,
           s.last_post_at, s.last_updated
    FROM location_post_stats s
    JOIN locations l ON s.location_id = l.id
    WHERE s.post_count_7d > 0
    ORDER BY s.post_count_7d DESC
  `);
  console.log(stats.rows);
  
  await pool.end();
}

check();
