const WebSocket = require('ws');

const FEED_URI = 'at://did:plc:hikdgxc7fic2hjekzn2ebrk3/app.bsky.feed.generator/skymap-tags';
const WS_URL = `wss://api.graze.social/app/contrail?feed=${encodeURIComponent(FEED_URI)}`;

console.log('Connecting to Contrails WebSocket...');
console.log('URL:', WS_URL);
console.log('');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Contrails!');
  console.log('Waiting for messages...');
  console.log('');
});

ws.on('message', (data) => {
  console.log('📨 Message received:');
  console.log('Raw data:', data.toString());
  console.log('');
  
  try {
    const parsed = JSON.parse(data.toString());
    console.log('Parsed JSON:');
    console.log(JSON.stringify(parsed, null, 2));
    console.log('');
    console.log('---');
    console.log('');
  } catch (e) {
    console.log('Not JSON, raw text:', data.toString());
    console.log('');
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`Connection closed. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
});

// Keep alive for 5 minutes then close
setTimeout(() => {
  console.log('Test complete. Closing connection...');
  ws.close();
}, 5 * 60 * 1000);

console.log('Test script running. Will capture messages for 5 minutes.');
console.log('Press Ctrl+C to stop early.');
