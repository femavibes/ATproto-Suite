import { Pool } from 'pg';
import { SessionManager } from './backend/src/services/sessionManager.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixExpiredTokens() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://feedmod:feedmod_password@localhost:5433/feedmoderator'
  });

  const sessionManager = new SessionManager(pool);

  try {
    console.log('🔧 Fixing expired tokens for autoblock system...\n');

    // Get all users with autoblock enabled
    const usersResult = await pool.query(`
      SELECT id, handle, did FROM user_profiles 
      WHERE autoblock_main_account = true AND bsky_password IS NOT NULL
    `);

    console.log(`Found ${usersResult.rows.length} users with autoblock enabled:`);

    for (const user of usersResult.rows) {
      try {
        console.log(`\n🔄 Refreshing session for main account: ${user.handle}`);
        
        // Clear existing session to force refresh
        await sessionManager.clearMainAccountSession(user.id);
        
        // Get fresh session
        const agent = await sessionManager.getMainAccountAgent(user.id);
        
        if (agent.session?.accessJwt) {
          console.log(`✅ Successfully refreshed token for ${user.handle}`);
          
          // Test DM access
          const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos?limit=1', {
            headers: {
              'Authorization': `Bearer ${agent.session.accessJwt}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            console.log(`✅ DM access confirmed for ${user.handle}`);
          } else {
            console.log(`⚠️  DM access test failed for ${user.handle}: ${response.status}`);
          }
        } else {
          console.log(`❌ Failed to get session for ${user.handle}`);
        }
      } catch (error: any) {
        console.log(`❌ Error refreshing ${user.handle}: ${error.message}`);
      }
    }

    // Get monitored accounts
    const monitoredResult = await pool.query(`
      SELECT ma.id, ma.handle, ma.did, ma.owner_user_id 
      FROM monitored_accounts ma
      WHERE ma.is_active = true
    `);

    console.log(`\nFound ${monitoredResult.rows.length} active monitored accounts:`);

    for (const account of monitoredResult.rows) {
      try {
        console.log(`\n🔄 Refreshing session for monitored account: ${account.handle}`);
        
        // Clear existing session to force refresh
        await sessionManager.clearMonitoredAccountSession(account.id);
        
        // Get fresh session
        const agent = await sessionManager.getMonitoredAccountAgent(account.id);
        
        if (agent.session?.accessJwt) {
          console.log(`✅ Successfully refreshed token for ${account.handle}`);
          
          // Test DM access
          const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos?limit=1', {
            headers: {
              'Authorization': `Bearer ${agent.session.accessJwt}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            console.log(`✅ DM access confirmed for ${account.handle}`);
          } else {
            console.log(`⚠️  DM access test failed for ${account.handle}: ${response.status}`);
          }
        } else {
          console.log(`❌ Failed to get session for ${account.handle}`);
        }
      } catch (error: any) {
        console.log(`❌ Error refreshing ${account.handle}: ${error.message}`);
      }
    }

    console.log('\n✅ Token refresh complete. The autoblock system should now be able to process DMs.');
    console.log('💡 The system will automatically detect the missed message from asperasbompar on the next check cycle (within 30 seconds).');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixExpiredTokens();