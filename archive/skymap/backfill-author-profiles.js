const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Fetch author profile from Bluesky public API
async function fetchAuthorProfile(authorDid) {
  try {
    const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(authorDid)}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return {
      handle: data.handle || null,
      displayName: data.displayName || null,
      avatar: data.avatar || null
    };
  } catch (error) {
    console.error(`Error fetching profile for ${authorDid}:`, error.message);
    return null;
  }
}

async function backfillAuthorProfiles() {
  try {
    // Get unique authors with missing info
    const authorsResult = await pool.query(`
      SELECT DISTINCT author_did
      FROM recent_posts
      WHERE (author_handle IS NULL OR author_avatar IS NULL OR author_display_name IS NULL)
        AND author_did IS NOT NULL
        AND created_at > NOW() - INTERVAL '7 days'
      LIMIT 200
    `);
    
    console.log(`Found ${authorsResult.rows.length} authors with missing info`);
    
    let updatedAuthors = 0;
    let updatedPosts = 0;
    let failed = 0;
    
    for (const row of authorsResult.rows) {
      const { author_did } = row;
      
      console.log(`Fetching profile for ${author_did}...`);
      const profile = await fetchAuthorProfile(author_did);
      
      if (profile) {
        // Update ALL posts for this author
        const updateResult = await pool.query(`
          UPDATE recent_posts
          SET 
            author_handle = COALESCE(author_handle, $1),
            author_avatar = COALESCE(author_avatar, $2),
            author_display_name = COALESCE(author_display_name, $3)
          WHERE author_did = $4
            AND (author_handle IS NULL OR author_avatar IS NULL OR author_display_name IS NULL)
        `, [profile.handle, profile.avatar, profile.displayName, author_did]);
        
        updatedAuthors++;
        updatedPosts += updateResult.rowCount;
        console.log(`  ✅ Updated ${updateResult.rowCount} posts for @${profile.handle || 'unknown'}`);
      } else {
        failed++;
        console.log(`  ❌ Failed to fetch profile`);
      }
      
      // Rate limit: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n✅ Backfill complete:`);
    console.log(`  Authors updated: ${updatedAuthors}`);
    console.log(`  Posts updated: ${updatedPosts}`);
    console.log(`  Failed: ${failed}`);
    
  } catch (error) {
    console.error('Error in backfill:', error);
  } finally {
    await pool.end();
  }
}

backfillAuthorProfiles();
