#!/usr/bin/env node
const { AtpAgent } = require('@atproto/api');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function updateLabelerPolicy() {
  const agent = new AtpAgent({ service: 'https://bsky.social' });
  
  console.log('Logging in as', process.env.BLUESKY_HANDLE);
  await agent.login({
    identifier: process.env.BLUESKY_HANDLE,
    password: process.env.BLUESKY_PASSWORD
  });

  // Get current record first
  const current = await agent.api.com.atproto.repo.getRecord({
    repo: agent.session.did,
    collection: 'app.bsky.labeler.service',
    rkey: 'self',
  });
  console.log('Current record:', JSON.stringify(current.data.value, null, 2));

  const response = await agent.api.com.atproto.repo.putRecord({
    repo: agent.session.did,
    collection: 'app.bsky.labeler.service',
    rkey: 'self',
    record: {
      $type: 'app.bsky.labeler.service',
      policies: {
        labelValues: ['atlas-user'],
        labelValueDefinitions: [{
          identifier: 'atlas-user',
          severity: 'inform',
          blurs: 'none',
          defaultSetting: 'ignore',
          adultOnly: false,
          locales: [{
            lang: 'en',
            name: 'ATlas User',
            description: 'This account is labeled on ATlas, a community directory for Bluesky.'
          }]
        }]
      },
      createdAt: current.data.value.createdAt || new Date().toISOString()
    }
  });

  console.log('Updated. New record:', JSON.stringify(response.data, null, 2));
}

updateLabelerPolicy().catch(console.error);
