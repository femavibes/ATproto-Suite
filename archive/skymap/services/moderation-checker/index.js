const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BLUESKY_MODERATION_DID = 'did:plc:ar7c4by46qjdydhdevvrndac';
const NSFW_LABELS = ['porn', 'sexual', 'nudity', 'graphic-media'];
const BATCH_SIZE = 25;
const CHECK_INTERVAL = 15 * 1000; // 15 seconds

async function checkModerationLabels(postUris) {
  if (postUris.length === 0) return {};
  
  try {
    const params = new URLSearchParams();
    postUris.forEach(uri => params.append('uris', uri));
    
    const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    const results = {};
    
    // Mark all posts as not found initially (deleted)
    postUris.forEach(uri => results[uri] = { exists: false, isNsfw: false });
    
    if (data.posts) {
      data.posts.forEach(post => {
        const labels = post.labels || [];
        const hasNsfw = labels.some(label => NSFW_LABELS.includes(label.val));
        results[post.uri] = { exists: true, isNsfw: hasNsfw };
      });
    }
    
    return results;
  } catch (error) {
    console.error('Error checking moderation labels:', error);
    return {};
  }
}

// Determine if a post needs checking based on age and last check time
function shouldCheckPost(createdAt, lastChecked) {
  const now = new Date();
  const age = (now - createdAt) / 1000 / 60; // minutes
  
  if (!lastChecked) {
    // Never checked - check if it's old enough for first check
    return age >= 5; // First check at 5min
  }
  
  const timeSinceCheck = (now - lastChecked) / 1000 / 60; // minutes
  
  // Determine which stage the post is in based on age
  // First hour: 5, 15, 30, 45, 60 min
  if (age <= 60) {
    if (age >= 5 && age < 15 && timeSinceCheck >= 8) return true;  // 5min check (lenient: 8min window)
    if (age >= 15 && age < 30 && timeSinceCheck >= 8) return true; // 15min check
    if (age >= 30 && age < 45 && timeSinceCheck >= 12) return true; // 30min check
    if (age >= 45 && age < 60 && timeSinceCheck >= 12) return true; // 45min check
    if (age >= 60 && timeSinceCheck >= 12) return true; // 60min check
  }
  // Hours 2-6: every hour
  else if (age <= 360) {
    return timeSinceCheck >= 55; // Hourly (lenient: 55min)
  }
  // Hours 6-24: every 6 hours
  else if (age <= 1440) {
    return timeSinceCheck >= 350; // Every 6h (lenient: 350min)
  }
  
  return false;
}

async function processUncheckedPosts() {
  try {
    const result = await pool.query(`
      SELECT id, post_uri, created_at, moderation_checked_at
      FROM recent_posts 
      WHERE has_media = true
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 500
    `);
    
    // Filter posts that need checking based on schedule
    const postsToCheck = result.rows.filter(row => 
      shouldCheckPost(new Date(row.created_at), row.moderation_checked_at ? new Date(row.moderation_checked_at) : null)
    ).slice(0, BATCH_SIZE);
    
    if (postsToCheck.length === 0) {
      return;
    }
    
    console.log(`Checking ${postsToCheck.length} posts for NSFW labels...`);
    
    const postUris = postsToCheck.map(r => r.post_uri);
    const labels = await checkModerationLabels(postUris);
    
    let deletedCount = 0;
    for (const row of postsToCheck) {
      const result = labels[row.post_uri];
      if (!result) continue;
      
      if (!result.exists) {
        // Post was deleted on Bluesky, delete from our database
        await pool.query('DELETE FROM recent_posts WHERE id = $1', [row.id]);
        deletedCount++;
      } else {
        // Post exists, update moderation status
        await pool.query(`
          UPDATE recent_posts 
          SET is_nsfw = $1, moderation_checked_at = NOW() 
          WHERE id = $2
        `, [result.isNsfw, row.id]);
      }
    }
    
    const nsfwCount = Object.values(labels).filter(v => v.exists && v.isNsfw).length;
    console.log(`✓ Checked ${postsToCheck.length} posts (${nsfwCount} NSFW, ${deletedCount} deleted)`);
  } catch (error) {
    console.error('Error processing posts:', error);
  }
}

// No longer needed - schedule is handled in shouldCheckPost()

async function start() {
  console.log('🔍 Moderation Checker starting...');
  console.log('Schedule: 5min, 15min, 30min, 45min, 60min, then hourly, then every 6h');
  
  setInterval(processUncheckedPosts, CHECK_INTERVAL);
  
  processUncheckedPosts();
}

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing...');
  pool.end();
  process.exit(0);
});

start();
