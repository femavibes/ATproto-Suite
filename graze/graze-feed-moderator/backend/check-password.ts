import { Pool } from 'pg';

async function checkPassword() {
  const pool = new Pool({
    connectionString: 'postgresql://feedmod:feedmod_password@localhost:5433/feedmoderator'
  });

  try {
    const userResult = await pool.query(`
      SELECT handle, bsky_password, LENGTH(bsky_password) as password_length
      FROM users 
      WHERE handle LIKE '%fema.monster%'
    `);

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log(`User: ${user.handle}`);
      console.log(`Password length: ${user.password_length}`);
      console.log(`Password (first 20 chars): ${user.bsky_password?.substring(0, 20)}...`);
      console.log(`Looks encrypted: ${user.bsky_password?.length > 50 ? 'Yes' : 'No (might be plaintext)'}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkPassword();