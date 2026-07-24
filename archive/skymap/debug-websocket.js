const WebSocket = require('ws');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const FEED_URI = process.env.GRAZE_FEED_URI || 'at://did:plc:l37i5se642dgeb7kmrdwoqv4/app.bsky.feed.generator/FEEDY';
const WS_URL = `wss://api.graze.social/app/contrail?feed=${encodeURIComponent(FEED_URI)}`;

console.log('Connecting to:', WS_URL);
console.log('Feed URI:', FEED_URI);
console.log('---\n');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Contrails WebSocket\n');
});

let messageCount = 0;

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    messageCount++;
    
    // Extract post
    let post = null;
    if (message.commit && message.commit.record) {
      post = message.commit.record;
    } else if (message.post) {
      post = message.post;
    } else if (message.record) {
      post = message.record;
    }
    
    // Show first few messages with full structure
    if (messageCount <= 3) {
      console.log('\n📨 RAW MESSAGE #' + messageCount + ':');
      console.log(JSON.stringify(message, null, 2));
      console.log('\n---\n');
    }
    
    // Extract post text
    let postText = '';
    if (post) {
      postText = post.text || '';
    }
    
    // Extract hashtags
    const hashtags = [];
    if (post && post.facets) {
      post.facets.forEach(facet => {
        if (facet.features) {
          facet.features.forEach(feature => {
            if (feature.$type === 'app.bsky.richtext.facet#tag') {
              hashtags.push(feature.tag.toLowerCase());
            }
          });
        }
      });
    }
    if (postText && hashtags.length === 0) {
      const hashtagRegex = /#(\w+)/g;
      let match;
      while ((match = hashtagRegex.exec(postText)) !== null) {
        hashtags.push(match[1].toLowerCase());
      }
    }
    
    // Show relevant info for posts with text or hashtags
    if (postText || hashtags.length > 0) {
      const authorDid = message.did;
      const collection = message.commit?.collection;
      const rkey = message.commit?.rkey;
      const postUri = (authorDid && collection && rkey) ? `at://${authorDid}/${collection}/${rkey}` : null;
      
      console.log('📨 Post #' + messageCount + ':');
      console.log('  URI:', postUri || 'N/A');
      console.log('  Author:', authorDid || 'N/A');
      console.log('  Hashtags:', hashtags.length > 0 ? hashtags.map(h => '#' + h).join(', ') : 'none');
      console.log('  Text:', postText ? postText.substring(0, 150) + (postText.length > 150 ? '...' : '') : 'N/A');
      console.log('  Created:', post?.createdAt || 'N/A');
      
      // Show post structure for first few
      if (messageCount <= 5 && post) {
        console.log('  Post keys:', Object.keys(post));
        if (post.facets) {
          console.log('  Facets:', JSON.stringify(post.facets, null, 2));
        }
      }
      console.log('---\n');
    } else if (messageCount <= 10) {
      console.log('⏭️  Message #' + messageCount + ' - No post text or hashtags');
      console.log('  Message keys:', Object.keys(message));
      if (post) {
        console.log('  Post keys:', Object.keys(post));
      }
      console.log('---\n');
    }
  } catch (error) {
    console.error('Error parsing message:', error.message);
    console.error('Raw data:', data.toString().substring(0, 200));
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`❌ WebSocket closed: ${code} ${reason}`);
  console.log('Reconnecting in 5 seconds...');
  setTimeout(() => {
    console.log('Reconnecting...');
    // Restart script
    process.exit(1);
  }, 5000);
});

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n👋 Closing connection...');
  ws.close();
  process.exit(0);
});
