import { Pool } from 'pg';
import { AtpAgent } from '@atproto/api';
import { GrazeService } from './src/services/graze.js';

async function forceRemoveDebugAll() {
  const pool = new Pool({
    connectionString: 'postgresql://feedmod:feedmod_password@localhost:5433/feedmoderator'
  });

  try {
    const userResult = await pool.query(`SELECT * FROM users WHERE handle = 'fema.monster'`);
    const user = userResult.rows[0];
    
    const decryptedPassword = await GrazeService.decryptPassword(user.bsky_password);
    const agent = new AtpAgent({ service: 'https://bsky.social' });
    await agent.login({ identifier: user.handle, password: decryptedPassword });

    const listUri = 'at://did:plc:lptjvw6ut224kwrj7ub3sqbe/app.bsky.graph.list/3m5wsuarojx2i';
    const debugDid = 'did:plc:3wh3o5qteklqxtz4d4iz3taq';

    // Get ALL list items with pagination
    let allItems: any[] = [];
    let cursor: string | undefined;
    
    do {
      const listItems = await agent.com.atproto.repo.listRecords({
        repo: user.did,
        collection: 'app.bsky.graph.listitem',
        cursor,
        limit: 100
      });
      
      allItems.push(...listItems.data.records);
      cursor = listItems.data.cursor;
    } while (cursor);

    console.log(`Found ${allItems.length} total list items across all lists`);

    // Find ALL debug.fema.monster entries in ANY list
    const debugItems = allItems.filter(record => {
      const value = record.value as any;
      return value.subject === debugDid;
    });

    console.log(`Found ${debugItems.length} debug.fema.monster entries total`);

    // Remove all instances
    for (const item of debugItems) {
      const rkey = item.uri.split('/').pop()!;
      const listInItem = (item.value as any).list;
      
      console.log(`Removing debug from list: ${listInItem}`);
      console.log(`  Item rkey: ${rkey}`);
      
      await agent.com.atproto.repo.deleteRecord({
        repo: user.did,
        collection: 'app.bsky.graph.listitem',
        rkey: rkey
      });
      
      console.log(`✅ Removed debug.fema.monster from ${listInItem}`);
    }

    if (debugItems.length === 0) {
      console.log('🤔 No debug.fema.monster entries found in any lists');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

forceRemoveDebugAll();