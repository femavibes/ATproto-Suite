#!/usr/bin/env node
const { AtpAgent } = require('@atproto/api');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function updateLabelerEndpoint() {
  const agent = new AtpAgent({ service: 'https://bsky.social' });
  
  console.log('Logging in as', process.env.BLUESKY_HANDLE);
  await agent.login({
    identifier: process.env.BLUESKY_HANDLE,
    password: process.env.BLUESKY_PASSWORD
  });
  
  console.log('Updating labeler service endpoint...');
  
  try {
    const response = await agent.api.com.atproto.repo.putRecord({
      repo: agent.session.did,
      collection: 'app.bsky.labeler.service',
      rkey: 'self',
      record: {
        $type: 'app.bsky.labeler.service',
        policies: {
          labelValues: [],
          labelValueDefinitions: []
        },
        createdAt: new Date().toISOString()
      }
    });
    
    console.log('✓ Labeler service record updated');
    console.log('Response:', JSON.stringify(response, null, 2));
    
    // Now check DID document
    console.log('\nFetching updated DID document...');
    const didDoc = await fetch(`https://plc.directory/${agent.session.did}`);
    const didData = await didDoc.json();
    console.log('Current labeler endpoint:', didData.service.find(s => s.id === '#atproto_labeler')?.serviceEndpoint);
    
    console.log('\nNote: The DID document endpoint is managed by your PDS.');
    console.log('If it still shows the old URL, contact Bluesky support or migrate to a self-hosted PDS.');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.status === 400) {
      console.log('\nThis account may not have labeler permissions.');
      console.log('You need to set up the labeler service through Ozone first.');
    }
  }
}

updateLabelerEndpoint().catch(console.error);
