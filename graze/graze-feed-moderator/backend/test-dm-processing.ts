import { Pool } from 'pg';
import { AtpAgent } from '@atproto/api';
import crypto from 'crypto';

const LISTIFICATIONS_DID = 'did:plc:yatb2t26fw7u3c7qcacq7rje';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'feed-moderator-autoblock-key-32';

function decrypt(encryptedText: string): string {
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // If decryption fails, the password might be stored in plaintext
    console.log('Decryption failed, trying as plaintext...');
    return encryptedText;
  }
}

async function testDMProcessing() {
  const pool = new Pool({
    connectionString: 'postgresql://feedmod:feedmod_password@localhost:5433/feedmoderator'
  });

  try {
    console.log('🔍 Testing DM processing for fema.monster accounts...\n');

    // Get main account info
    const userResult = await pool.query(`
      SELECT id, handle, did, bsky_password, autoblock_main_account
      FROM users 
      WHERE handle LIKE '%fema.monster%'
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ No fema.monster user found');
      return;
    }

    const user = userResult.rows[0];
    console.log(`Found user: ${user.handle} (${user.did})`);
    console.log(`Autoblock enabled: ${user.autoblock_main_account}`);
    console.log(`Has password: ${user.bsky_password ? 'Yes' : 'No'}\n`);

    if (!user.bsky_password) {
      console.log('❌ No app password configured for main account');
      return;
    }

    // Test authentication
    console.log('🔐 Testing authentication...');
    try {
      const decryptedPassword = decrypt(user.bsky_password);
      const agent = new AtpAgent({ service: 'https://bsky.social' });
      
      await agent.login({
        identifier: user.handle,
        password: decryptedPassword
      });
      
      console.log('✅ Authentication successful\n');

      // Check DMs
      console.log('📨 Checking DMs...');
      const response = await fetch('https://api.bsky.chat/xrpc/chat.bsky.convo.listConvos?limit=10', {
        headers: {
          'Authorization': `Bearer ${agent.session?.accessJwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`DM API failed: ${response.status}`);
      }

      const convos = await response.json();
      console.log(`Found ${convos.convos?.length || 0} conversations`);

      const listificationsConvo = convos.convos?.find(
        (convo: any) => convo.members.some((member: any) => 
          member.did === LISTIFICATIONS_DID || 
          member.handle?.includes('listifications')
        )
      );

      if (listificationsConvo) {
        console.log('✅ Found listifications conversation');
        
        const msgResponse = await fetch(
          `https://api.bsky.chat/xrpc/chat.bsky.convo.getMessages?convoId=${listificationsConvo.id}&limit=20`,
          {
            headers: {
              'Authorization': `Bearer ${agent.session?.accessJwt}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const messages = await msgResponse.json();
        console.log(`Found ${messages.messages?.length || 0} messages in conversation\n`);

        console.log('📋 Recent messages from listifications:');
        for (const message of messages.messages || []) {
          if (message.sender.did === LISTIFICATIONS_DID) {
            console.log(`  - ${message.sentAt}: "${message.text}"`);
            
            // Test parsing
            const blockPattern = /@([\\w.-]+)\\s+has blocked you/i;
            const modListPattern = /@([\\w.-]+)\\s+has added you to the \"[^\"]*\"\\s+moderation list/i;
            
            const blockMatch = message.text.match(blockPattern);
            const modListMatch = message.text.match(modListPattern);
            
            if (blockMatch) {
              console.log(`    → Detected BLOCK from: ${blockMatch[1]}`);
            } else if (modListMatch) {
              console.log(`    → Detected MOD LIST from: ${modListMatch[1]}`);
            } else {
              console.log(`    → No block/modlist pattern matched`);
            }
          }
        }

      } else {
        console.log('❌ No listifications conversation found');
        console.log('Available conversations:');
        convos.convos?.forEach((convo: any) => {
          const memberHandles = convo.members.map((m: any) => m.handle || m.did).join(', ');
          console.log(`  - ${memberHandles}`);
        });
      }

    } catch (authError) {
      console.error('❌ Authentication failed:', authError);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testDMProcessing();