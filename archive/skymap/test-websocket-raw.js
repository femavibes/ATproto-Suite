const WebSocket = require('ws');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

// Get the same feed URI the listener uses
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function start() {
  // Get feed URI from database (same as listener)
  const configResult = await pool.query("SELECT value FROM config WHERE key = 'graze_feed_uri'");
  const FEED_URI = configResult.rows[0]?.value || process.env.GRAZE_FEED_URI || 'at://did:plc:l37i5se642dgeb7kmrdwoqv4/app.bsky.feed.generator/FEEDY';
  
  const WS_URL = `wss://api.graze.social/app/contrail?feed=${encodeURIComponent(FEED_URI)}`;
  
  console.log('='.repeat(80));
  console.log('WebSocket Raw Message Tester');
  console.log('='.repeat(80));
  console.log('Feed URI:', FEED_URI);
  console.log('WebSocket URL:', WS_URL);
  console.log('='.repeat(80));
  console.log('\nWaiting for messages...\n');
  
  const ws = new WebSocket(WS_URL);
  let messageCount = 0;
  
  ws.on('open', () => {
    console.log('✅ Connected to WebSocket\n');
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      messageCount++;
      
      console.log('\n' + '='.repeat(80));
      console.log(`MESSAGE #${messageCount}`);
      console.log('='.repeat(80));
      
      // Show the full raw message
      console.log('\n📦 FULL RAW MESSAGE:');
      console.log(JSON.stringify(message, null, 2));
      
      // Extract post if it exists
      let post = null;
      if (message.commit && message.commit.record) {
        post = message.commit.record;
      } else if (message.post) {
        post = message.post;
      } else if (message.record) {
        post = message.record;
      }
      
      if (post) {
        console.log('\n📝 POST OBJECT:');
        console.log('  Keys:', Object.keys(post));
        console.log('  Has "text" key:', 'text' in post);
        console.log('  Has "bridgyOriginalText" key:', 'bridgyOriginalText' in post);
        
        if (post.text !== undefined) {
          console.log('  "text" value:', post.text === null ? 'null' : post.text === '' ? '(empty string)' : `"${post.text.substring(0, 100)}${post.text.length > 100 ? '...' : ''}"`);
        }
        
        if (post.bridgyOriginalText) {
          console.log('  "bridgyOriginalText" preview:', post.bridgyOriginalText.substring(0, 100) + '...');
        }
        
        if (post.facets) {
          console.log('  Has facets:', true);
          const tags = [];
          post.facets.forEach(f => {
            if (f.features) {
              f.features.forEach(feat => {
                if (feat.$type === 'app.bsky.richtext.facet#tag') {
                  tags.push(feat.tag);
                }
              });
            }
          });
          if (tags.length > 0) {
            console.log('  Hashtags:', tags.join(', '));
          }
        }
        
        console.log('\n📋 FULL POST OBJECT:');
        console.log(JSON.stringify(post, null, 2));
      } else {
        console.log('\n⚠️  No post object found in message');
      }
      
      console.log('\n' + '='.repeat(80) + '\n');
      
      // Stop after 10 messages
      if (messageCount >= 10) {
        console.log('\n✅ Captured 10 messages. Stopping...');
        ws.close();
        pool.end();
        process.exit(0);
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error.message);
      console.error('Raw data:', data.toString().substring(0, 200));
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`\n❌ WebSocket closed: ${code} ${reason}`);
    pool.end();
    process.exit(0);
  });
  
  // Timeout after 2 minutes
  setTimeout(() => {
    console.log('\n⏱️  Timeout reached. Stopping...');
    ws.close();
    pool.end();
    process.exit(0);
  }, 120000);
}

start().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
