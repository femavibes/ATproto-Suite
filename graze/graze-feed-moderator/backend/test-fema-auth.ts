import { Pool } from 'pg';
import { AtpAgent } from '@atproto/api';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'feed-moderator-autoblock-key-32';

function decrypt(encryptedText: string): string {
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.log('Decryption failed, trying as plaintext...');
    return encryptedText;
  }
}

async function testFemaAuth() {
  const pool = new Pool({
    connectionString: 'postgresql://feedmod:feedmod_password@localhost:5433/feedmoderator'
  });

  try {
    console.log('🔍 Testing fema.monster authentication...\n');

    // Get fema.monster account
    const userResult = await pool.query(`
      SELECT handle, did, bsky_password
      FROM users 
      WHERE handle = 'fema.monster'
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ fema.monster account not found');
      return;
    }

    const user = userResult.rows[0];
    console.log(`Testing: ${user.handle} (${user.did})`);

    try {
      const decryptedPassword = decrypt(user.bsky_password);
      const agent = new AtpAgent({ service: 'https://bsky.social' });
      
      console.log('🔐 Attempting authentication...');
      await agent.login({
        identifier: user.handle,
        password: decryptedPassword
      });
      
      console.log('✅ fema.monster authentication successful!');
      console.log(`Session DID: ${agent.session?.did}`);

      // Test if we can access the block list
      console.log('\n📋 Testing block list access...');
      const listUri = 'at://did:plc:lptjvw6ut224kwrj7ub3sqbe/app.bsky.graph.list/3m5wsuarojx2i';
      
      try {
        const list = await agent.api.app.bsky.graph.getList({
          list: listUri,
          limit: 10
        });
        
        console.log(`✅ Block list accessible: "${list.data.name}"`);
        console.log(`   Description: ${list.data.description || 'No description'}`);
        console.log(`   Items: ${list.data.items.length}`);
        
        // Check if debug.fema.monster is already in the list
        const debugInList = list.data.items.some((item: any) => 
          item.subject.handle === 'debug.fema.monster' || 
          item.subject.did === 'did:plc:3wh3o5qteklqxtz4d4iz3taq'
        );
        
        console.log(`   debug.fema.monster in list: ${debugInList ? 'YES' : 'NO'}`);
        
        if (!debugInList) {
          console.log('\n🔧 This explains why debug.fema.monster is not in the list!');
          console.log('   The autoblock system should have added them but didn\'t.');
        }
        
      } catch (listError: any) {
        console.error('❌ Cannot access block list:', listError.message);
      }

    } catch (authError: any) {
      console.error('❌ fema.monster authentication failed:', authError.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testFemaAuth();