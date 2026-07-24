const { AtpAgent } = require('@atproto/api');
const crypto = require('crypto');

const FEED_DID = process.env.LABELER_DID || 'did:plc:l37i5se642dgeb7kmrdwoqv4';
const FEEDS = {
  'near-you': { name: 'Personalized', rkey: 'near-you' },
  'near-you-live': { name: 'Live', rkey: 'near-you-live' },
  'near-you-video': { name: 'Video', rkey: 'near-you-video' },
  'near-you-test-a': { name: 'Test A', rkey: 'near-you-test-a' },
  'near-you-test-b': { name: 'Test B', rkey: 'near-you-test-b' },
};

function getSettingsHash(feedName, settingValues) {
  const str = feedName + ':' + Object.entries(settingValues).sort().map(([k, v]) => `${k}=${v}`).join(',');
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 16);
}

function generateCombinations(toggles) {
  if (toggles.length === 0) return [{}];
  const [first, ...rest] = toggles;
  const restCombos = generateCombinations(rest);
  const result = [];
  for (const option of first.options) {
    for (const combo of restCombos) {
      result.push({ ...combo, [first.setting_key]: option });
    }
  }
  return result;
}

// Line 1: Near You — Quick Settings (plain text, not a link)
// Line 2: [All Settings] · [Hide Menu]
// Line 3: [📍 Primary] [+Nearby] | [All] · Images · Custom
function buildPostText(feedName, toggles, currentValues) {
  const feed = FEEDS[feedName];
  const title = 'Near You: ' + (feed ? feed.name : feedName);
  const line1 = title + '\n\n[All Settings] | [Hide Menu]';

  const line2Parts = [];

  const cityToggle = toggles.find(t => t.setting_key === 'city_scope');
  if (cityToggle) {
    const idx = cityToggle.options.indexOf(currentValues.city_scope);
    const label = cityToggle.labels[idx] || currentValues.city_scope;
    line2Parts.push('[📍 ' + label + ']');
  }

  const nearbyToggle = toggles.find(t => t.setting_key === 'include_nearby');
  if (nearbyToggle) {
    const idx = nearbyToggle.options.indexOf(currentValues.include_nearby);
    const label = nearbyToggle.labels[idx] || currentValues.include_nearby;
    line2Parts.push('[' + label + ']');
  }

  const mediaToggle = toggles.find(t => t.setting_key === 'media_mode');
  if (mediaToggle) {
    const mediaParts = [];
    for (let i = 0; i < mediaToggle.options.length; i++) {
      const opt = mediaToggle.options[i];
      const label = mediaToggle.labels[i] || opt;
      if (opt === currentValues.media_mode) {
        mediaParts.push('[' + label + ']');
      } else {
        mediaParts.push(label);
      }
    }
    line2Parts.push(mediaParts.join(' | '));
  }

  // city + nearby joined by space, then | then media
  const cityNearby = line2Parts.slice(0, 2).join(' ');
  const media = line2Parts[2] || '';
  return line1 + '\n' + cityNearby + ' | ' + media;
}

function buildFacets(text, feedName, toggles, currentValues, baseUrl) {
  const facets = [];
  const encoder = new TextEncoder();

  function findByteRange(searchStr, startFromChar) {
    const charIdx = text.indexOf(searchStr, startFromChar || 0);
    if (charIdx === -1) return null;
    const byteStart = encoder.encode(text.substring(0, charIdx)).length;
    const byteEnd = byteStart + encoder.encode(searchStr).length;
    return { byteStart, byteEnd };
  }

  // Line 1 facets
  const allSettingsRange = findByteRange('[All Settings]');
  if (allSettingsRange) {
    facets.push({
      index: allSettingsRange,
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: `${baseUrl}/feed-settings` }],
    });
  }

  const hideRange = findByteRange('[Hide Menu]');
  if (hideRange) {
    facets.push({
      index: hideRange,
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: `${baseUrl}/s/${feedName}-hide_menu-true` }],
    });
  }

  // Line 2 facets — search starting after the newline
  const line2Start = text.indexOf('\n') + 1;

  const cityToggle = toggles.find(t => t.setting_key === 'city_scope');
  if (cityToggle) {
    const idx = cityToggle.options.indexOf(currentValues.city_scope);
    const label = cityToggle.labels[idx] || currentValues.city_scope;
    const range = findByteRange('[📍 ' + label + ']', line2Start);
    if (range) {
      const nextIdx = (idx + 1) % cityToggle.options.length;
      facets.push({
        index: range,
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: `${baseUrl}/s/${feedName}-city_scope-${cityToggle.options[nextIdx]}` }],
      });
    }
  }

  const nearbyToggle = toggles.find(t => t.setting_key === 'include_nearby');
  if (nearbyToggle) {
    const idx = nearbyToggle.options.indexOf(currentValues.include_nearby);
    const label = nearbyToggle.labels[idx] || currentValues.include_nearby;
    const range = findByteRange('[' + label + ']', line2Start);
    if (range) {
      const nextIdx = (idx + 1) % nearbyToggle.options.length;
      facets.push({
        index: range,
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: `${baseUrl}/s/${feedName}-include_nearby-${nearbyToggle.options[nextIdx]}` }],
      });
    }
  }

  // Media mode: search after the | on line 2
  const mediaToggle = toggles.find(t => t.setting_key === 'media_mode');
  if (mediaToggle) {
    const pipeIdx = text.indexOf('|', line2Start);
    const mediaStart = pipeIdx !== -1 ? pipeIdx + 2 : line2Start;

    for (let i = 0; i < mediaToggle.options.length; i++) {
      const opt = mediaToggle.options[i];
      const label = mediaToggle.labels[i] || opt;
      if (opt === currentValues.media_mode) continue; // active, no link

      const charIdx = text.indexOf(label, mediaStart);
      if (charIdx !== -1) {
        const byteStart = encoder.encode(text.substring(0, charIdx)).length;
        const byteEnd = byteStart + encoder.encode(label).length;
        facets.push({
          index: { byteStart, byteEnd },
          features: [{ $type: 'app.bsky.richtext.facet#link', uri: `${baseUrl}/s/${feedName}-media_mode-${opt}` }],
        });
      }
    }
  }

  return facets;
}

async function generateSettingsPosts(pool, feedName, dryRun = false) {
  const baseUrl = process.env.BASE_URL || 'https://atls.city';

  const configResult = await pool.query(
    'SELECT * FROM feed_toggle_config WHERE feed_name = $1 AND active = true ORDER BY sort_order',
    [feedName]
  );
  const toggles = configResult.rows.map(r => ({
    ...r,
    options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options,
    labels: typeof r.labels === 'string' ? JSON.parse(r.labels) : r.labels,
  }));

  if (toggles.length === 0) {
    console.log(`No toggles configured for ${feedName}`);
    return [];
  }

  const combinations = generateCombinations(toggles);
  console.log(`${feedName}: ${combinations.length} combinations from ${toggles.length} toggles`);

  const results = [];
  let agent = null;
  if (!dryRun) {
    agent = new AtpAgent({ service: 'https://bsky.social' });
    await agent.login({
      identifier: process.env.BLUESKY_HANDLE,
      password: process.env.BLUESKY_PASSWORD,
    });
  }

  for (const combo of combinations) {
    const hash = getSettingsHash(feedName, combo);

    const existing = await pool.query(
      'SELECT post_uri FROM feed_settings_posts WHERE feed_name = $1 AND settings_hash = $2',
      [feedName, hash]
    );
    if (existing.rows.length > 0) {
      console.log(`  ${hash} already exists: ${existing.rows[0].post_uri}`);
      results.push({ hash, combo, uri: existing.rows[0].post_uri, existed: true });
      continue;
    }

    const text = buildPostText(feedName, toggles, combo);
    const facets = buildFacets(text, feedName, toggles, combo, baseUrl);

    if (dryRun) {
      console.log(`  [DRY RUN] ${hash}:`, JSON.stringify(combo));
      console.log(`    Text: ${text.replace(/\n/g, '\\n')}`);
      console.log(`    Facets: ${facets.length}`);
      results.push({ hash, combo, text, facets: facets.length, dryRun: true });
      continue;
    }

    // Ensure toggle slugs exist
    for (const t of toggles) {
      if (t.setting_key === 'media_mode') {
        for (const opt of t.options) {
          await ensureSlug(pool, feedName, t.setting_key, opt, baseUrl);
        }
      } else {
        const idx = t.options.indexOf(combo[t.setting_key]);
        const nextIdx = (idx + 1) % t.options.length;
        await ensureSlug(pool, feedName, t.setting_key, t.options[nextIdx], baseUrl);
      }
    }
    await ensureSlug(pool, feedName, 'hide_menu', 'true', baseUrl);

    try {
      const response = await agent.api.app.bsky.feed.post.create(
        { repo: agent.session.did },
        { text, facets, createdAt: new Date().toISOString() }
      );

      console.log(`  Posted ${hash}: ${response.uri}`);
      await pool.query(
        'INSERT INTO feed_settings_posts (feed_name, settings_hash, post_uri, post_text, enabled) VALUES ($1, $2, $3, $4, false) ON CONFLICT (feed_name, settings_hash) DO UPDATE SET post_uri = $3, post_text = $4',
        [feedName, hash, response.uri, text]
      );
      results.push({ hash, combo, uri: response.uri });
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`  Error posting ${hash}:`, err.message);
      results.push({ hash, combo, error: err.message });
    }
  }

  return results;
}

async function ensureSlug(pool, feedName, settingKey, value, baseUrl) {
  const slug = `${feedName}-${settingKey}-${value}`;
  const exists = await pool.query('SELECT id FROM short_urls WHERE custom_slug = $1', [slug]);
  if (exists.rows.length > 0) return;

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let shortCode = '';
  for (let i = 0; i < 6; i++) shortCode += chars.charAt(Math.floor(Math.random() * chars.length));

  await pool.query(
    "INSERT INTO short_urls (short_code, full_url, custom_slug, link_type, description) VALUES ($1, $2, $3, 'setting', $4)",
    [shortCode, `${baseUrl}/api/feed-toggle?feed=${feedName}&key=${settingKey}&value=${value}`, slug, `Toggle ${feedName} ${settingKey} to ${value}`]
  );
  console.log(`  Created slug: /s/${slug}`);
}

async function enableFeedSettingsPosts(pool, feedName, enabled) {
  await pool.query('UPDATE feed_settings_posts SET enabled = $1 WHERE feed_name = $2', [enabled, feedName]);
  console.log(`${feedName} settings posts ${enabled ? 'enabled' : 'disabled'}`);
}

async function deleteAllSettingsPosts(pool, feedName) {
  const result = await pool.query('DELETE FROM feed_settings_posts WHERE feed_name = $1 RETURNING post_uri', [feedName]);
  console.log(`Deleted ${result.rows.length} settings posts for ${feedName}`);
  return result.rows.length;
}

module.exports = {
  generateSettingsPosts,
  enableFeedSettingsPosts,
  deleteAllSettingsPosts,
  getSettingsHash,
  FEEDS,
};
