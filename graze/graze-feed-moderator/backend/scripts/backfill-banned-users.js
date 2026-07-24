import { AtpAgent } from '@atproto/api';
import { Database } from '../src/services/database.js';

const db = new Database();
const agent = new AtpAgent({ service: 'https://bsky.social' });

async function backfillBannedUsers() {
  console.log('Starting banned users backfill...');
  
  // Get banned users without profile data
  const result = await db.getPool().query(`
    SELECT DISTINCT banned_handle, banned_did 
    FROM banned_users 
    WHERE banned_user_id IS NULL 
    AND banned_did IS NOT NULL
  `);
  
  console.log(`Found ${result.rows.length} banned users to backfill`);
  
  for (const user of result.rows) {
    try {
      console.log(`Processing ${user.banned_handle}...`);
      
      // Check if profile already exists
      let profile = await db.getUserProfileByDid(user.banned_did);
      
      if (!profile) {
        // Fetch profile from Bluesky
        try {
          const profileData = await agent.api.app.bsky.actor.getProfile({ actor: user.banned_did });
          
          // Create user profile
          profile = await db.createUserProfile(
            user.banned_did, 
            user.banned_handle, 
            'none'
          );
          
          // Update with profile data
          await db.getPool().query(
            'UPDATE user_profiles SET display_name = $1, avatar_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            [profileData.data.displayName || null, profileData.data.avatar || null, profile.id]
          );
          
          console.log(`  Created profile for ${user.banned_handle}`);
        } catch (profileError) {
          // Create minimal profile if Bluesky fetch fails
          profile = await db.createUserProfile(user.banned_did, user.banned_handle, 'none');
          console.log(`  Created minimal profile for ${user.banned_handle} (fetch failed)`);
        }
      }
      
      // Update banned_users to link to profile
      await db.getPool().query(
        'UPDATE banned_users SET banned_user_id = $1 WHERE banned_did = $2 AND banned_user_id IS NULL',
        [profile.id, user.banned_did]
      );
      
      console.log(`  Linked ${user.banned_handle} to profile ID ${profile.id}`);
      
    } catch (error) {
      console.error(`Failed to process ${user.banned_handle}:`, error.message);
    }
  }
  
  console.log('Backfill complete!');
  process.exit(0);
}

backfillBannedUsers().catch(error => {
  console.error('Backfill failed:', error);
  process.exit(1);
});