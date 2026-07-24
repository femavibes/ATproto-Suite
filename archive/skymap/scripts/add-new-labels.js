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

  const current = await agent.api.com.atproto.repo.getRecord({
    repo: agent.session.did,
    collection: 'app.bsky.labeler.service',
    rkey: 'self',
  });
  console.log('Current labels:', current.data.value.policies.labelValueDefinitions.map(d => d.identifier));

  const response = await agent.api.com.atproto.repo.putRecord({
    repo: agent.session.did,
    collection: 'app.bsky.labeler.service',
    rkey: 'self',
    record: {
      $type: 'app.bsky.labeler.service',
      policies: {
        labelValues: ['atlas-user', 'hashtag-author', 'follow-graph', 'bio-location'],
        labelValueDefinitions: [
          {
            identifier: 'atlas-user',
            severity: 'inform',
            blurs: 'none',
            defaultSetting: 'warn',
            adultOnly: false,
            locales: [{
              lang: 'en',
              name: 'ATlas User',
              description: 'This account is a member of the ATlas community directory at atls.city. They have self-identified their city and appear in local feeds for that location.'
            }]
          },
          {
            identifier: 'hashtag-author',
            severity: 'inform',
            blurs: 'none',
            defaultSetting: 'warn',
            adultOnly: false,
            locales: [{
              lang: 'en',
              name: 'Hashtag Author',
              description: 'This account consistently uses location-specific hashtags (like #NYC, #Portland, etc.) and has been automatically placed in that city\'s local feed based on their posting pattern. City placement is based on a rolling 30-day window — accounts must maintain regular use of local hashtags to remain on the feed. They are not an ATlas member.'
            }]
          },
          {
            identifier: 'follow-graph',
            severity: 'inform',
            blurs: 'none',
            defaultSetting: 'warn',
            adultOnly: false,
            locales: [{
              lang: 'en',
              name: 'Follow Graph',
              description: 'This account has been automatically placed in a city\'s local feed based on their follower network. A significant concentration of their followers are ATlas users in one city, suggesting they are locally relevant to that community. They are not an ATlas member — their city placement is inferred from community connections.'
            }]
          },
          {
            identifier: 'bio-location',
            severity: 'inform',
            blurs: 'none',
            defaultSetting: 'warn',
            adultOnly: false,
            locales: [{
              lang: 'en',
              name: 'Bio Location',
              description: 'This account has been automatically placed in a city\'s local feed based on location text found in their profile bio. Their bio contains a recognizable city name, abbreviation, or local term. They are not an ATlas member — their city placement is inferred from their bio and may expire after 30 days if no longer confirmed.'
            }]
          }
        ]
      },
      createdAt: current.data.value.createdAt
    }
  });

  console.log('Updated successfully');
  
  // Verify
  const verify = await agent.api.com.atproto.repo.getRecord({
    repo: agent.session.did,
    collection: 'app.bsky.labeler.service',
    rkey: 'self',
  });
  console.log('New labels:', verify.data.value.policies.labelValueDefinitions.map(d => `${d.identifier} (default: ${d.defaultSetting})`));
}

updateLabelerPolicy().catch(console.error);
