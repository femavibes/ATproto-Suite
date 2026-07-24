const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const FEED_URI = process.env.GRAZE_FEED_URI || 'at://did:plc:l37i5se642dgeb7kmrdwoqv4/app.bsky.feed.generator/FEEDY';
const WS_URL = `wss://api.graze.social/app/contrail?feed=${encodeURIComponent(FEED_URI)}`;

const messages = [];
const MAX_MESSAGES = 20;

console.log('Connecting to:', WS_URL);
console.log('Feed URI:', FEED_URI);
console.log(`Capturing ${MAX_MESSAGES} messages...\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Contrails WebSocket\n');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    messages.push(message);
    
    console.log(`📨 Captured message ${messages.length}/${MAX_MESSAGES}`);
    
    if (messages.length >= MAX_MESSAGES) {
      console.log('\n✅ Captured 20 messages. Saving to file...');
      
      const output = {
        feed_uri: FEED_URI,
        captured_at: new Date().toISOString(),
        message_count: messages.length,
        messages: messages
      };
      
      const filename = `websocket-messages-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(output, null, 2));
      
      console.log(`✅ Saved to ${filename}`);
      console.log('\nSample post structures:');
      
      // Show a few examples
      messages.slice(0, 3).forEach((msg, idx) => {
        const post = msg.commit?.record || msg.post || msg.record;
        if (post) {
          console.log(`\n--- Message ${idx + 1} ---`);
          console.log('Has text field:', !!post.text);
          console.log('Has bridgyOriginalText:', !!post.bridgyOriginalText);
          console.log('Has facets:', !!post.facets);
          if (post.facets) {
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
            console.log('Hashtags:', tags.length > 0 ? tags.join(', ') : 'none');
          }
          if (post.text) {
            console.log('Text preview:', post.text.substring(0, 100));
          }
        }
      });
      
      ws.close();
      process.exit(0);
    }
  } catch (error) {
    console.error('Error parsing message:', error.message);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`❌ WebSocket closed: ${code} ${reason}`);
  if (messages.length > 0) {
    console.log(`\nSaving ${messages.length} captured messages...`);
    const output = {
      feed_uri: FEED_URI,
      captured_at: new Date().toISOString(),
      message_count: messages.length,
      messages: messages
    };
    const filename = `websocket-messages-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(output, null, 2));
    console.log(`✅ Saved to ${filename}`);
  }
  process.exit(0);
});

// Timeout after 2 minutes
setTimeout(() => {
  console.log('\n⏱️  Timeout reached. Saving captured messages...');
  if (messages.length > 0) {
    const output = {
      feed_uri: FEED_URI,
      captured_at: new Date().toISOString(),
      message_count: messages.length,
      messages: messages
    };
    const filename = `websocket-messages-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(output, null, 2));
    console.log(`✅ Saved ${messages.length} messages to ${filename}`);
  } else {
    console.log('❌ No messages captured');
  }
  ws.close();
  process.exit(0);
}, 120000);

process.on('SIGINT', () => {
  console.log('\n👋 Interrupted. Saving captured messages...');
  if (messages.length > 0) {
    const output = {
      feed_uri: FEED_URI,
      captured_at: new Date().toISOString(),
      message_count: messages.length,
      messages: messages
    };
    const filename = `websocket-messages-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(output, null, 2));
    console.log(`✅ Saved ${messages.length} messages to ${filename}`);
  }
  ws.close();
  process.exit(0);
});
