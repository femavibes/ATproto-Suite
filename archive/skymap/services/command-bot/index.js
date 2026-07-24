import { AtpAgent } from '@atproto/api';
import pg from 'pg';
import WebSocket from 'ws';
const { Pool } = pg;

class SkyMapBot {
  constructor() {
    this.agent = new AtpAgent({ service: 'https://bsky.social' });
    this.ozoneUrl = process.env.OZONE_URL;
    this.ozoneAdminPassword = process.env.OZONE_ADMIN_PASSWORD;
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    this.labelerDid = process.env.LABELER_DID;
    this.handle = process.env.BLUESKY_HANDLE;
    this.password = process.env.BLUESKY_PASSWORD;
    this.lastCursor = null;
  }

  async getInterestByKey(key) {
    const result = await this.pool.query(
      'SELECT * FROM interests WHERE key = $1 AND active = true',
      [key]
    );
    return result.rows[0];
  }

  async getUserInterests(did) {
    const result = await this.pool.query(
      'SELECT i.key, i.name FROM user_interests ui JOIN interests i ON ui.interest_id = i.id WHERE ui.user_did = $1',
      [did]
    );
    return result.rows;
  }

  async addUserInterest(did, interestId, key) {
    const existing = await this.pool.query(
      'SELECT 1 FROM user_interests WHERE user_did = $1 AND interest_id = $2',
      [did, interestId]
    );
    
    if (existing.rows.length > 0) return;
    
    await this.pool.query(
      'INSERT INTO user_interests (user_did, interest_id) VALUES ($1, $2)',
      [did, interestId]
    );
    
    await this.pool.query(
      'UPDATE interests SET user_count = user_count + 1 WHERE id = $1',
      [interestId]
    );
    
    await this.addOzoneLabel(did, key);
  }

  async removeUserInterest(did, interestId, key) {
    await this.pool.query(
      'DELETE FROM user_interests WHERE user_did = $1 AND interest_id = $2',
      [did, interestId]
    );
    
    await this.pool.query(
      'UPDATE interests SET user_count = GREATEST(user_count - 1, 0) WHERE id = $1',
      [interestId]
    );
    
    await this.removeOzoneLabel(did, key);
  }

  async getLocationByKey(key) {
    console.log(`Looking for location with key: '${key}'`);
    const result = await this.pool.query(
      'SELECT * FROM locations WHERE UPPER(key) = UPPER($1)',
      [key]
    );
    console.log(`Found ${result.rows.length} locations for key '${key}'`);
    if (result.rows.length > 0) {
      console.log(`Location found: ${result.rows[0].name}`);
    }
    return result.rows[0];
  }

  async removeOzoneLabel(did, label) {
    try {
      if (!this.ozoneUrl || !this.ozoneAdminPassword) {
        console.log('Ozone disabled, skipping label removal');
        return;
      }
      
      const response = await fetch(`${this.ozoneUrl}/xrpc/tools.ozone.moderation.emitEvent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`admin:${this.ozoneAdminPassword}`).toString('base64')}`
        },
        body: JSON.stringify({
          event: {
            $type: 'tools.ozone.moderation.defs#modEventLabel',
            createLabelVals: [],
            negateLabelVals: [label],
            comment: 'Label removed via bot command'
          },
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did
          },
          createdBy: this.labelerDid
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ozone API error (${response.status}): ${errorText}`);
      }
      
      console.log(`Successfully removed label ${label} from ${did}`);
    } catch (error) {
      console.error('Error removing Ozone label (continuing anyway):', error.message);
    }
  }

  async addOzoneLabel(did, label) {
    try {
      if (!this.ozoneUrl || !this.ozoneAdminPassword) {
        console.log('Ozone disabled, skipping label addition');
        return;
      }
      
      const response = await fetch(`${this.ozoneUrl}/xrpc/tools.ozone.moderation.emitEvent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`admin:${this.ozoneAdminPassword}`).toString('base64')}`
        },
        body: JSON.stringify({
          event: {
            $type: 'tools.ozone.moderation.defs#modEventLabel',
            createLabelVals: [label],
            negateLabelVals: [],
            comment: 'Label added via bot command'
          },
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did
          },
          createdBy: this.labelerDid
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ozone API error (${response.status}): ${errorText}`);
      }
      
      console.log(`Successfully added label ${label} to ${did}`);
    } catch (error) {
      console.error('Error adding Ozone label (continuing anyway):', error.message);
    }
  }

  async getLabelsFromATProtocol(did) {
    try {
      if (!this.agent.session) {
        await this.agent.login({
          identifier: this.handle,
          password: this.password
        });
      }
      
      const response = await this.agent.com.atproto.label.queryLabels({
        uriPatterns: [did],
        sources: [this.labelerDid]
      });
      
      const labels = [];
      if (response.data.labels) {
        for (const label of response.data.labels) {
          labels.push(label.val);
        }
      }
      return labels;
    } catch (error) {
      console.error('Error fetching labels from AT Protocol:', error);
      return [];
    }
  }

  async syncUserLabels(did) {
    // Get current labels from AT Protocol (source of truth)
    const atProtocolLabels = await this.getLabelsFromATProtocol(did);
    
    // Get current labels from database
    const dbLabels = await this.getUserLabels(did);
    const dbLabelKeys = dbLabels.map(l => l.key);
    
    // Find labels to add (in AT Protocol but not in DB)
    const labelsToAdd = atProtocolLabels.filter(key => !dbLabelKeys.includes(key));
    
    // Find labels to remove (in DB but not in AT Protocol)
    const labelsToRemove = dbLabelKeys.filter(key => !atProtocolLabels.includes(key));
    
    // Sync database to match AT Protocol
    for (const key of labelsToAdd) {
      const location = await this.getLocationByKey(key);
      if (location) {
        const count = await this.pool.query(
          'SELECT COUNT(*) FROM user_labels WHERE did = $1 AND active = true', [did]
        );
        const isFirst = parseInt(count.rows[0].count) === 0;
        await this.pool.query(
          'INSERT INTO user_labels (did, location_id, active, is_primary) VALUES ($1, $2, true, $3) ON CONFLICT DO NOTHING',
          [did, location.id, isFirst]
        );
        if (isFirst && process.env.DISCORD_WEBHOOK_USERS) {
          fetch(process.env.DISCORD_WEBHOOK_USERS, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [{ title: 'New ATlas User', color: 0x22c55e, fields: [{ name: 'Handle', value: '@' + (handle || did), inline: true }, { name: 'Location', value: location.name || location.key, inline: true }], timestamp: new Date().toISOString() }] })
          }).catch(() => {});
        }
      }
    }
    
    for (const key of labelsToRemove) {
      const location = await this.getLocationByKey(key);
      if (location) {
        await this.pool.query(
          'UPDATE user_labels SET active = false WHERE did = $1 AND location_id = $2',
          [did, location.id]
        );
      }
    }
    
    return atProtocolLabels;
  }

  async addUserLabel(did, locationId, key) {
    console.log(`Adding label ${key} to user ${did}`);
    
    // Check if label already exists
    const existing = await this.pool.query(
      'SELECT id FROM user_labels WHERE did = $1 AND location_id = $2 AND active = true',
      [did, locationId]
    );
    
    if (existing.rows.length > 0) {
      console.log(`Label ${key} already exists for user ${did}, skipping`);
      return;
    }
    
    // Check if this is the user's first label (auto-primary)
    const count = await this.pool.query(
      'SELECT COUNT(*) FROM user_labels WHERE did = $1 AND active = true', [did]
    );
    const isFirst = parseInt(count.rows[0].count) === 0;
    
    await this.pool.query(
      'INSERT INTO user_labels (did, location_id, active, is_primary) VALUES ($1, $2, true, $3)',
      [did, locationId, isFirst]
    );
    console.log(`Database updated for ${did}`);
    
    // If first label, remove any lower-priority source labels and apply atlas-user
    if (isFirst) {
      const sourceLabels = ['bio-location', 'hashtag-author', 'follow-graph', 'crowdsource'];
      for (const label of sourceLabels) {
        await this.removeOzoneLabel(did, label);
      }
      await this.addOzoneLabel(did, 'atlas-user');
    }
    
    // Apply Ozone label via direct API
    console.log(`Applying Ozone label ${key} to ${did}`);
    await this.addOzoneLabel(did, key);
    console.log(`Ozone label applied: ${key} to ${did}`);
    console.log(`User ${did} now available in AT Protocol list at://did:web:lists.fema.monster/app.bsky.graph.list/${key}`);
  }

  async removeUserLabel(did, locationId, key) {
    // Check if we're removing the primary
    const wasPrimary = await this.pool.query(
      'SELECT is_primary FROM user_labels WHERE did = $1 AND location_id = $2 AND active = true',
      [did, locationId]
    );
    
    await this.pool.query(
      'UPDATE user_labels SET active = false, is_primary = false WHERE did = $1 AND location_id = $2',
      [did, locationId]
    );
    
    // Auto-promote next label if we removed the primary
    if (wasPrimary.rows[0]?.is_primary) {
      await this.pool.query(
        `UPDATE user_labels SET is_primary = true
         WHERE id = (SELECT id FROM user_labels WHERE did = $1 AND active = true ORDER BY created_at ASC LIMIT 1)`,
        [did]
      );
    }
    
    // Remove Ozone label via direct API
    try {
      await this.removeOzoneLabel(did, key);
      console.log(`Removed Ozone label ${key} for ${did}`);
    } catch (error) {
      console.error('Error removing Ozone label:', error);
    }
    
    console.log(`Removed label ${key} from user ${did}`);
    console.log(`User ${did} removed from AT Protocol list at://did:web:lists.fema.monster/app.bsky.graph.list/${key}`);
  }

  async getUserLabels(did) {
    const result = await this.pool.query(
      'SELECT l.key, l.name FROM user_labels ul JOIN locations l ON ul.location_id = l.id WHERE ul.did = $1 AND ul.active = true',
      [did]
    );
    return result.rows;
  }

  async handleSetCommand(post, locationKey) {
    const did = post.author.did;
    
    // Get current labels from Ozone (source of truth)
    const ozoneLabels = await this.getLabelsFromATProtocol(did);
    
    // Validate location exists
    const location = await this.getLocationByKey(locationKey);
    if (!location) {
      await post.reply({
        text: `Location "${locationKey}" not found. Use the web directory to find valid location keys.`
      });
      return;
    }

    // Check 3-location limit from Ozone
    if (ozoneLabels.length >= 3) {
      await post.reply({
        text: `You already have 3 locations (max limit). Remove one first with !remove [key]`
      });
      return;
    }

    // Check if already has this label in Ozone
    if (ozoneLabels.some(l => l.toLowerCase() === locationKey.toLowerCase())) {
      await post.reply({
        text: `You already have the "${location.name}" label.`
      });
      return;
    }

    // Parent-child redundancy check
    if (location.parent_id) {
      const parentResult = await this.pool.query(
        'SELECT key FROM locations WHERE id = $1',
        [location.parent_id]
      );
      
      if (parentResult.rows.length > 0) {
        const parentKey = parentResult.rows[0].key;
        const hasParentLabel = ozoneLabels.some(l => l.toLowerCase() === parentKey.toLowerCase());
        
        if (hasParentLabel) {
          // Remove parent label (state) when adding child (city)
          await this.removeUserLabel(did, location.parent_id, parentKey);
          await post.reply({
            text: `Removed "${parentKey}" label (redundant with more specific "${locationKey}").`
          });
        }
      }
    }

    // Add the label
    await this.addUserLabel(did, location.id, locationKey);
    try {
      console.log(`Sending reply to ${post.author.handle}...`);
      const replyText = `Added "${location.name}" (${locationKey}) to your profile.\n\nCheck out your feeds:\natls.city/go/near-you\natls.city/go/near-you-live\n\nSettings: nearyou.atls.city`;
      const encoder = new TextEncoder();
      const facets = [];
      const links = [
        { text: 'atls.city/go/near-you', uri: 'https://atls.city/go/near-you' },
        { text: 'atls.city/go/near-you-live', uri: 'https://atls.city/go/near-you-live' },
        { text: 'nearyou.atls.city', uri: 'https://nearyou.atls.city' },
      ];
      for (const link of links) {
        const idx = replyText.indexOf(link.text);
        if (idx !== -1) {
          const byteStart = encoder.encode(replyText.slice(0, idx)).byteLength;
          const byteEnd = byteStart + encoder.encode(link.text).byteLength;
          facets.push({
            index: { byteStart, byteEnd },
            features: [{ $type: 'app.bsky.richtext.facet#link', uri: link.uri }]
          });
        }
      }
      await post.reply({ text: replyText, facets });
      console.log(`Reply sent successfully`);
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  }

  async handleListCommand(post) {
    const did = post.author.did;
    
    const dbLabels = await this.getUserLabels(did);
    const interests = await this.getUserInterests(did);
    
    if (dbLabels.length === 0 && interests.length === 0) {
      await post.reply({
        text: 'You have no labels. Use !set [key] for locations or !interest add [key] for interests.'
      });
      return;
    }

    const parts = [];
    
    if (dbLabels.length > 0) {
      const labelList = [];
      for (const labelKey of dbLabels.map(l => l.key)) {
        const location = await this.getLocationByKey(labelKey);
        if (location) labelList.push(`${location.name} (${labelKey})`);
      }
      parts.push(`Locations (${dbLabels.length}/3):\n${labelList.join('\n')}`);
    }
    
    if (interests.length > 0) {
      const interestList = interests.map(i => `${i.name} (${i.key})`);
      parts.push(`Interests (${interests.length}/15):\n${interestList.join('\n')}`);
    }

    await post.reply({ text: parts.join('\n\n') });
  }

  async handlePrimaryCommand(post, locationKey) {
    const did = post.author.did;
    const location = await this.getLocationByKey(locationKey);
    if (!location) {
      await post.reply({ text: `Location "${locationKey}" not found.` });
      return;
    }
    
    const label = await this.pool.query(
      'SELECT id FROM user_labels WHERE did = $1 AND location_id = $2 AND active = true',
      [did, location.id]
    );
    if (label.rows.length === 0) {
      await post.reply({ text: `You don't have ${location.name} as a location. Add it first with !set ${locationKey}` });
      return;
    }
    
    await this.pool.query('UPDATE user_labels SET is_primary = false WHERE did = $1 AND active = true', [did]);
    await this.pool.query('UPDATE user_labels SET is_primary = true WHERE did = $1 AND location_id = $2 AND active = true', [did, location.id]);
    
    await post.reply({ text: `✓ ${location.name} is now your primary location.` });
  }

  async handleAttendCommand(post, eventId) {
    const did = post.author.did;
    const handle = post.author.handle;
    
    try {
      // Convert eventId to uppercase (event IDs are stored as uppercase in DB)
      const eventIdUpper = eventId.toUpperCase();
      
      // Check if event exists and hasn't ended
      const eventResult = await this.pool.query(
        'SELECT * FROM events WHERE event_id = $1 AND is_active = true AND is_ended = false AND end_time > NOW()',
        [eventIdUpper]
      );
      
      if (eventResult.rows.length === 0) {
        // Check if event exists but has ended
        const endedEventResult = await this.pool.query(
          'SELECT * FROM events WHERE event_id = $1',
          [eventIdUpper]
        );
        
        if (endedEventResult.rows.length > 0) {
          await post.reply({
            text: `Event "${eventIdUpper}" has ended.`
          });
        } else {
          await post.reply({
            text: `Event "${eventIdUpper}" not found.`
          });
        }
        return;
      }
      
      const event = eventResult.rows[0];
      
      // Check if event has started (for RSVP weight calculation)
      const eventStartTime = new Date(event.start_time);
      const now = new Date();
      const rsvpBeforeStart = now < eventStartTime;
      
      // Check if user already RSVP'd (one per user per event)
      const existingRSVP = await this.pool.query(
        'SELECT id FROM event_rsvps WHERE event_id = $1 AND user_did = $2',
        [eventIdUpper, did]
      );
      
      if (existingRSVP.rows.length > 0) {
        await post.reply({
          text: `You've already RSVP'd to "${event.title}". Thanks!`
        });
        return;
      }
      
      // Insert RSVP
      await this.pool.query(`
        INSERT INTO event_rsvps (event_id, user_did, user_handle, created_at, created_at_relative_to_start)
        VALUES ($1, $2, $3, NOW(), $4)
      `, [eventIdUpper, did, handle || null, rsvpBeforeStart ? eventStartTime : now]);
      
      await post.reply({
        text: `✅ RSVP'd to "${event.title}"! The event will appear on the map based on RSVP popularity.`
      });
      
      console.log(`RSVP recorded: ${handle} (${did}) RSVP'd to event ${eventIdUpper}`);
      
    } catch (error) {
      console.error('Error processing RSVP:', error);
      await post.reply({
        text: 'Sorry, there was an error processing your RSVP. Please try again.'
      });
    }
  }

  async handleRemoveCommand(post, locationKey) {
    const did = post.author.did;
    
    const location = await this.getLocationByKey(locationKey);
    if (!location) {
      await post.reply({
        text: `Location "${locationKey}" not found.`
      });
      return;
    }

    const currentLabels = await this.getUserLabels(did);
    const hasLabel = currentLabels.some(label => label.key.toLowerCase() === locationKey.toLowerCase());
    
    console.log(`User ${did} has labels:`, currentLabels.map(l => l.key));
    console.log(`Checking for label: ${locationKey}, hasLabel: ${hasLabel}`);
    
    if (!hasLabel) {
      const ozoneLabels = await this.getLabelsFromATProtocol(did);
      const hasInOzone = ozoneLabels.some(l => l.toLowerCase() === locationKey.toLowerCase());
      
      if (hasInOzone) {
        console.log(`Label ${locationKey} found in Ozone but not in DB, removing from Ozone`);
        try {
          await this.removeOzoneLabel(did, locationKey);
          console.log(`Successfully removed label ${locationKey}`);
        } catch (error) {
          console.error('Error removing label:', error);
        }
        await post.reply({
          text: `Removed "${location.name}" (${locationKey}) from your profile.`
        });
        return;
      }
      
      await post.reply({
        text: `You don't have the "${location.name}" label.`
      });
      return;
    }

    await this.removeUserLabel(did, location.id, locationKey);
    await post.reply({
      text: `Removed "${location.name}" (${locationKey}) from your profile.`
    });
  }

  async handleInterestAddCommand(post, interestKeys) {
    const did = post.author.did;
    const configResult = await this.pool.query("SELECT value FROM config WHERE key = 'max_interests_per_user'");
    const maxInterests = parseInt(configResult.rows[0]?.value || '15');
    
    const currentInterests = await this.getUserInterests(did);
    const added = [];
    const errors = [];
    
    for (const key of interestKeys) {
      if (currentInterests.length + added.length >= maxInterests) {
        errors.push(`Max ${maxInterests} interests reached`);
        break;
      }
      
      const interest = await this.getInterestByKey(key);
      if (!interest) {
        errors.push(`"${key}" not found`);
        continue;
      }
      
      if (currentInterests.some(i => i.key === key)) {
        errors.push(`Already have "${key}"`);
        continue;
      }
      
      await this.addUserInterest(did, interest.id, key);
      added.push(interest.name);
    }
    
    const parts = [];
    if (added.length > 0) parts.push(`Added: ${added.join(', ')}`);
    if (errors.length > 0) parts.push(`Errors: ${errors.join(', ')}`);
    
    await post.reply({ text: parts.join('\n') || 'No changes made.' });
  }

  async handleInterestRemoveCommand(post, interestKey) {
    const did = post.author.did;
    
    const interest = await this.getInterestByKey(interestKey);
    if (!interest) {
      await post.reply({ text: `Interest "${interestKey}" not found.` });
      return;
    }
    
    const currentInterests = await this.getUserInterests(did);
    if (!currentInterests.some(i => i.key === interestKey)) {
      await post.reply({ text: `You don't have the "${interest.name}" interest.` });
      return;
    }
    
    await this.removeUserInterest(did, interest.id, interestKey);
    await post.reply({ text: `Removed "${interest.name}" interest.` });
  }

  parseCommand(text) {
    const lowerText = text.trim().toLowerCase();
    const commandPrefix = `@${this.handle.toLowerCase()}`;
    
    if (!lowerText.includes(commandPrefix)) {
      return null;
    }

    const command = lowerText.substring(lowerText.indexOf(commandPrefix) + commandPrefix.length).trim();
    
    if (command.startsWith('!set ')) {
      return { type: 'set', locationKey: command.substring(5).trim() };
    }
    
    if (command.startsWith('!remove ')) {
      return { type: 'remove', locationKey: command.substring(8).trim() };
    }
    
    if (command === '!list') {
      return { type: 'list' };
    }
    
    if (command.startsWith('!primary ')) {
      return { type: 'primary', locationKey: command.substring(9).trim() };
    }
    
    if (command.startsWith('!attend ')) {
      const eventId = command.substring(8).trim();
      if (eventId && eventId.length <= 10) {
        return { type: 'attend', eventId };
      }
    }
    
    // Interest commands
    if (command.startsWith('!interest add ')) {
      const keys = command.substring(14).trim().split(/\s+/);
      return { type: 'interest_add', interestKeys: keys };
    }
    
    if (command.startsWith('!interest remove ')) {
      return { type: 'interest_remove', interestKey: command.substring(17).trim() };
    }
    
    return null;
  }

  async handleMention(post) {
    console.log('Received mention from:', post.author.handle, 'Text:', post.text);
    
    const command = this.parseCommand(post.text);
    
    if (!command) {
      console.log('No valid command found');
      await post.reply({
        text: 'Commands: !set US-OR-Portland, !remove US-OR-Portland, !list, !attend EVT-ABC123, !interest add photography, !interest remove photography'
      });
      return;
    }

    console.log('Processing command:', command);
    
    try {
      if (command.type === 'set') {
        await this.handleSetCommand(post, command.locationKey);
      } else if (command.type === 'remove') {
        await this.handleRemoveCommand(post, command.locationKey);
      } else if (command.type === 'list') {
        await this.handleListCommand(post);
      } else if (command.type === 'primary') {
        await this.handlePrimaryCommand(post, command.locationKey);
        await this.handleAttendCommand(post, command.eventId);
      } else if (command.type === 'interest_add') {
        await this.handleInterestAddCommand(post, command.interestKeys);
      } else if (command.type === 'interest_remove') {
        await this.handleInterestRemoveCommand(post, command.interestKey);
      }
    } catch (error) {
      console.error('Command error:', error);
      await post.reply({
        text: 'Sorry, there was an error processing your command.'
      });
    }
  }

  async processHistoricalMentions() {
    try {
      console.log('Fetching historical mentions...');
      
      if (!this.agent.session) {
        await this.agent.login({
          identifier: this.handle,
          password: this.password
        });
      }
      
      const response = await this.agent.api.app.bsky.notification.listNotifications({
        limit: 50
      });
      
      const mentions = response.data.notifications.filter(notif => 
        notif.reason === 'mention' && 
        notif.record?.text?.includes(`@${this.handle}`)
      );
      
      console.log(`Found ${mentions.length} historical mentions`);
      
      for (const mention of mentions) {
        try {
          const processed = await this.pool.query(
            'SELECT 1 FROM processed_mentions WHERE mention_uri = $1',
            [mention.uri]
          );
          
          if (processed.rows.length > 0) {
            console.log(`Skipping already processed mention: ${mention.uri}`);
            continue;
          }
          
          const post = {
            text: mention.record.text,
            author: {
              did: mention.author.did,
              handle: mention.author.handle
            },
            reply: async (replyData) => {
              await this.agent.api.app.bsky.feed.post.create(
                { repo: this.agent.session.did },
                {
                  text: replyData.text,
                  ...(replyData.facets && { facets: replyData.facets }),
                  reply: {
                    root: { uri: mention.uri, cid: mention.cid },
                    parent: { uri: mention.uri, cid: mention.cid }
                  },
                  createdAt: new Date().toISOString()
                }
              );
            }
          };
          
          console.log(`Processing historical mention from ${mention.author.handle}: ${mention.record.text}`);
          await this.handleMention(post);
          
          await this.pool.query(
            'INSERT INTO processed_mentions (mention_uri) VALUES ($1) ON CONFLICT DO NOTHING',
            [mention.uri]
          );
        } catch (error) {
          console.error('Error processing historical mention:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching historical mentions:', error);
    }
  }
  async handleLocationRecord(event) {
    const did = event.did;
    const operation = event.commit?.operation;
    const record = event.commit?.record;

    console.log(`[pds-ingest] ${operation} city.atlas.actor.location from ${did}`);

    if (operation === 'delete') {
      // User (or another app) deleted their location record — remove all labels
      const existing = await this.pool.query(
        'SELECT ul.id, l.key FROM user_labels ul JOIN locations l ON ul.location_id = l.id WHERE ul.did = $1 AND ul.active = true',
        [did]
      );
      for (const row of existing.rows) {
        await this.removeOzoneLabel(did, row.key);
      }
      await this.pool.query('UPDATE user_labels SET active = false, is_primary = false WHERE did = $1', [did]);
      await this.removeOzoneLabel(did, 'atlas-user');
      console.log(`[pds-ingest] Removed all labels for ${did} (record deleted)`);
      return;
    }

    if (!record?.locations || !Array.isArray(record.locations)) return;

    // Get current DB state
    const currentLabels = await this.pool.query(
      'SELECT ul.location_id, l.key, l.name FROM user_labels ul JOIN locations l ON ul.location_id = l.id WHERE ul.did = $1 AND ul.active = true',
      [did]
    );
    const currentKeys = new Set(currentLabels.rows.map(r => r.key.toLowerCase()));

    // Parse desired state from PDS record
    const desired = [];
    for (const entry of record.locations.slice(0, 3)) {
      const addr = entry.address;
      if (!addr) continue;

      let location = null;

      // Prefer osmId for universal matching
      if (entry.osmId) {
        const result = await this.pool.query(
          'SELECT * FROM locations WHERE osm_id = $1',
          [entry.osmId]
        );
        location = result.rows[0];
      }

      // Then try atlasKey for exact matching
      if (!location && entry.atlasKey) {
        const result = await this.pool.query(
          'SELECT * FROM locations WHERE UPPER(key) = UPPER($1) OR UPPER(display_key) = UPPER($1)',
          [entry.atlasKey]
        );
        location = result.rows[0];
      }

      // Fallback: match by country+region+locality
      if (!location && addr.locality && addr.region && addr.country) {
        const result = await this.pool.query(
          `SELECT * FROM locations WHERE UPPER(name) = UPPER($1) AND UPPER(region_name) = UPPER($2) AND UPPER(country_code) = UPPER($3) AND location_type = 'city' LIMIT 1`,
          [addr.locality, addr.region, addr.country]
        );
        location = result.rows[0];
      }

      // Last resort: match by locality name alone
      if (!location && addr.locality) {
        const result = await this.pool.query(
          `SELECT * FROM locations WHERE UPPER(name) = UPPER($1) AND location_type = 'city' LIMIT 1`,
          [addr.locality]
        );
        location = result.rows[0];
      }

      if (location) {
        desired.push({ location, isPrimary: !!entry.isPrimary });
      } else {
        console.log(`[pds-ingest] Could not match location: key=${entry.atlasKey || 'none'} locality=${addr.locality}, region=${addr.region}, country=${addr.country}`);
        // Save unmatched location for future resolution
        try {
          await this.pool.query(
            `INSERT INTO pending_pds_locations (did, country, region, locality, atlas_key, osm_id, osm_type, is_primary, raw_record)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT DO NOTHING`,
            [did, addr.country, addr.region, addr.locality, entry.atlasKey || null, entry.osmId || null, entry.osmType || null, !!entry.isPrimary, JSON.stringify(entry)]
          );
          console.log(`[pds-ingest] Saved pending location for ${did}: ${addr.locality}, ${addr.region}, ${addr.country}`);
        } catch (e) {
          console.error(`[pds-ingest] Failed to save pending location:`, e.message);
        }
      }
    }

    if (desired.length === 0) return;

    const desiredKeys = new Set(desired.map(d => d.location.key.toLowerCase()));

    // Skip if DB already matches (avoid redundant writes from our own sync)
    const currentPrimaryKey = currentLabels.rows.find(r => true)?.key; // simplified check
    if (currentKeys.size === desiredKeys.size && [...desiredKeys].every(k => currentKeys.has(k))) {
      console.log(`[pds-ingest] DB already matches PDS for ${did}, skipping`);
      return;
    }

    // Remove labels no longer in PDS record
    for (const row of currentLabels.rows) {
      if (!desiredKeys.has(row.key.toLowerCase())) {
        await this.removeUserLabel(did, row.location_id, row.key);
      }
    }

    // Add new labels from PDS record
    const isNewUser = currentKeys.size === 0;
    for (const { location, isPrimary } of desired) {
      if (!currentKeys.has(location.key.toLowerCase())) {
        await this.addUserLabel(did, location.id, location.key);
      }
    }

    // Set primary
    const primary = desired.find(d => d.isPrimary) || desired[0];
    if (primary) {
      await this.pool.query('UPDATE user_labels SET is_primary = false WHERE did = $1 AND active = true', [did]);
      await this.pool.query('UPDATE user_labels SET is_primary = true WHERE did = $1 AND location_id = $2 AND active = true', [did, primary.location.id]);
    }

    // Add atlas-user badge if new (addUserLabel already handles source label cleanup)
    if (isNewUser && desired.length > 0) {
      await this.addOzoneLabel(did, 'atlas-user');
    }

    console.log(`[pds-ingest] Synced ${desired.length} location(s) from PDS for ${did}`);
  }

  startJetstream() {
    const cursorParam = this.lastCursor ? `&cursor=${this.lastCursor}` : '';
    const wsUrl = `wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&wantedCollections=city.atlas.actor.location${cursorParam}`;
    console.log(`Connecting to Jetstream...${this.lastCursor ? ` (cursor=${this.lastCursor})` : ' (live)'}`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => console.log('Jetstream connected'));
    
    ws.on('message', async (data) => {
      try {
        const event = JSON.parse(data);
        // Track cursor for reconnection
        if (event.time_us) this.lastCursor = event.time_us;
        if (event.kind !== 'commit') return;

        // Handle location record changes from any user
        if (event.commit?.collection === 'city.atlas.actor.location') {
          await this.handleLocationRecord(event);
          return;
        }

        if (event.commit?.operation !== 'create') return;
        
        const record = event.commit?.record;
        if (!record?.facets) return;
        
        // Check if any facet mentions our DID
        const mentionsUs = record.facets.some(f =>
          f.features?.some(feat => feat.$type === 'app.bsky.richtext.facet#mention' && feat.did === this.labelerDid)
        );
        if (!mentionsUs) return;
        
        const uri = `at://${event.did}/${event.commit.collection}/${event.commit.rkey}`;
        
        // Dedup
        const processed = await this.pool.query(
          'SELECT 1 FROM processed_mentions WHERE mention_uri = $1', [uri]
        );
        if (processed.rows.length > 0) return;
        
        console.log(`Jetstream mention from ${event.did}: ${record.text}`);
        
        // Resolve handle
        let handle = event.did;
        try {
          const profile = await this.agent.getProfile({ actor: event.did });
          handle = profile.data.handle;
        } catch (e) { /* use DID as fallback */ }
        
        const post = {
          text: record.text,
          author: { did: event.did, handle },
          uri,
          reply: async (replyData) => {
            const parentCid = event.commit.cid;
            await this.agent.api.app.bsky.feed.post.create(
              { repo: this.agent.session.did },
              {
                text: replyData.text,
                ...(replyData.facets && { facets: replyData.facets }),
                reply: {
                  root: { uri, cid: parentCid },
                  parent: { uri, cid: parentCid }
                },
                createdAt: new Date().toISOString()
              }
            );
          }
        };
        
        await this.handleMention(post);
        await this.pool.query(
          'INSERT INTO processed_mentions (mention_uri) VALUES ($1) ON CONFLICT DO NOTHING', [uri]
        );
      } catch (error) {
        if (error.message !== 'Unexpected end of JSON input') {
          console.error('Jetstream message error:', error.message);
        }
      }
    });
    
    ws.on('close', () => {
      console.log('Jetstream disconnected, reconnecting in 5s...');
      setTimeout(() => this.startJetstream(), 5000);
    });
    
    ws.on('error', (error) => {
      console.error('Jetstream error:', error.message);
    });
  }

  async start() {
    await this.agent.login({
      identifier: this.handle,
      password: this.password
    });
    console.log('Agent logged in as:', this.handle);

    await this.processHistoricalMentions();
    
    this.startJetstream();
    
    console.log('SkyMap bot listening for mentions via Jetstream...');
    process.stdin.resume();
  }
}

const bot = new SkyMapBot();
bot.start().catch(console.error);