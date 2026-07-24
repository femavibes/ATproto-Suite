import { Pool } from 'pg';
import { AtpAgent } from '@atproto/api';
import { GrazeService } from './src/services/graze.js';

async function forceRemoveDebug() {
  const pool = new Pool({
    connectionString: 'postgresql://feedmod:feedmod_password@localhost:5433/feedmoderator'
  });

  try {
    // Get fema.monster user
    const userResult = await pool.query(`
      SELECT * FROM users WHERE handle = 'fema.monster'
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ fema.monster user not found');
      return;
    }

    const user = userResult.rows[0];
    console.log(`Found user: ${user.handle}`);

    // Authenticate
    const decryptedPassword = await GrazeService.decryptPassword(user.bsky_password);
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    await agent.login({
      identifier: user.handle,
      password: decryptedPassword
    });

    console.log('✅ Authenticated successfully');

    const listUri = 'at://did:plc:lptjvw6ut224kwrj7ub3sqbe/app.bsky.graph.list/3m5wsuarojx2i';
    const debugDid = 'did:plc:3wh3o5qteklqxtz4d4iz3taq';

    // Get all list items
    const listItems = await agent.com.atproto.repo.listRecords({
      repo: user.did,
      collection: 'app.bsky.graph.listitem'
    });

    console.log(`Found ${listItems.data.records.length} total list items`);

    // Find debug.fema.monster in the list
    const debugItems = listItems.data.records.filter(record => 
      (record.value as any).subject === debugDid && (record.value as any).list === listUri
    );

    console.log(`Found ${debugItems.length} debug.fema.monster entries in the list`);

    // Remove all instances
    for (const item of debugItems) {
      const rkey = item.uri.split('/').pop()!;
      console.log(`Removing item with rkey: ${rkey}`);
      
      await agent.com.atproto.repo.deleteRecord({
        repo: user.did,
        collection: 'app.bsky.graph.listitem',
        rkey: rkey
      });
      
      console.log(`✅ Removed debug.fema.monster from list`);
    }

    if (debugItems.length === 0) {
      console.log('🤔 debug.fema.monster not found in list - might already be removed');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

forceRemoveDebug();