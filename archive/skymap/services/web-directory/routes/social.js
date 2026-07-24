const express = require('express');
const { randomizeLocation } = require('./geo-helpers');
const { getLocationGeo, needsRefresh, refreshGeometryCache } = require('./geometry-cache');

const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours
const REFRESH_COOLDOWN = 15 * 60 * 1000; // 15 minutes
const NEAR_YOU_URL = process.env.NEAR_YOU_URL || 'http://localhost:4000';

module.exports = (pool, agent) => {
  const router = express.Router();

  // Ensure geometry cache is warm
  refreshGeometryCache(pool);
  setInterval(() => refreshGeometryCache(pool), 10 * 60 * 1000);

  function randomizeWithGeoCache(user) {
    const geo = getLocationGeo(user.location_id);
    if (geo) {
      const { lat, lng } = randomizeLocation(geo);
      return { lat, lng };
    }
    // Fallback to bbox stored on user, or center offset
    return randomizeLocation(user);
  }

// API: Get mutuals with locations
router.get('/mutuals', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const did = req.session.authenticatedDid;
  const forceRefresh = req.query.refresh === 'true';
  
  try {
    const cacheKey = did;
    
    // Check database cache
    const cacheResult = await pool.query(
      'SELECT cache_data, cached_at FROM mutuals_cache WHERE user_did = $1',
      [cacheKey]
    );
    
    if (!forceRefresh && cacheResult.rows.length > 0) {
      const cached = cacheResult.rows[0];
      const cacheAge = Date.now() - new Date(cached.cached_at).getTime();
      
      if (cacheAge < CACHE_DURATION) {
        // Re-randomize positions on every serve using geometry cache
        const refreshed = cached.cache_data.map(u => {
          const { lat, lng } = randomizeWithGeoCache(u);
          const { bbox_south, bbox_north, bbox_west, bbox_east, ...rest } = u;
          return { ...rest, latitude: lat, longitude: lng };
        });
        return res.json({ mutuals: refreshed, lastUpdated: cached.cached_at });
      }
    }
    
    // Check refresh cooldown
    if (forceRefresh && cacheResult.rows.length > 0) {
      const cached = cacheResult.rows[0];
      const cacheAge = Date.now() - new Date(cached.cached_at).getTime();
      
      if (cacheAge < REFRESH_COOLDOWN) {
        return res.status(429).json({ error: 'Please wait before refreshing again' });
      }
    }
    
    // Use the main authenticated agent (no login needed)
    if (!agent.session) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    
    // Fetch followers and following
    const [followersData, followingData] = await Promise.all([
      fetchAllFollowers(agent, did),
      fetchAllFollowing(agent, did)
    ]);
    
    // Compute mutuals (intersection)
    const followersSet = new Set(followersData.map(f => f.did));
    const followingSet = new Set(followingData.map(f => f.did));
    const mutuals = followingData.filter(f => followersSet.has(f.did));
    
    console.log(`Found ${mutuals.length} total mutuals for ${did}`);
    
    // Save follow relationships to user_follows table
    // Only save relationships where the other person is also an ATlas user
    try {
      const atlasUsers = await pool.query('SELECT DISTINCT did FROM user_labels WHERE active = true');
      const atlasDids = new Set(atlasUsers.rows.map(r => r.did));
      
      // Clear old follows for this user
      await pool.query('DELETE FROM user_follows WHERE follower_did = $1', [did]);
      
      // Insert follows where the followed person is an ATlas user
      const followRows = followingData
        .filter(f => atlasDids.has(f.did))
        .map(f => ({
          follower: did,
          followed: f.did,
          isMutual: followersSet.has(f.did)
        }));
      
      for (const row of followRows) {
        await pool.query(
          'INSERT INTO user_follows (follower_did, followed_did, is_mutual, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (follower_did, followed_did) DO UPDATE SET is_mutual = $3, updated_at = NOW()',
          [row.follower, row.followed, row.isMutual]
        );
      }
      
      // Also save reverse direction for people who follow this user (if they're ATlas users)
      const followerRows = followersData
        .filter(f => atlasDids.has(f.did))
        .map(f => ({
          follower: f.did,
          followed: did,
          isMutual: followingSet.has(f.did)
        }));
      
      for (const row of followerRows) {
        await pool.query(
          'INSERT INTO user_follows (follower_did, followed_did, is_mutual, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (follower_did, followed_did) DO UPDATE SET is_mutual = $3, updated_at = NOW()',
          [row.follower, row.followed, row.isMutual]
        );
      }
      
      console.log(`Saved ${followRows.length} follows + ${followerRows.length} reverse follows for ${did}`);
    } catch (followErr) {
      console.error('Error saving follow graph:', followErr.message);
    }
    
    // Get DIDs that have location labels
    const mutualDids = mutuals.map(m => m.did);
    
    if (mutualDids.length === 0) {
      const result = { mutuals: [], lastUpdated: new Date().toISOString() };
      await pool.query(
        'INSERT INTO mutuals_cache (user_did, cache_data) VALUES ($1, $2) ON CONFLICT (user_did) DO UPDATE SET cache_data = $2, cached_at = NOW()',
        [cacheKey, JSON.stringify([])]
      );
      return res.json(result);
    }
    
    // Query database for mutuals with locations
    const placeholders = mutualDids.map((_, i) => `$${i + 1}`).join(',');
    const dbResult = await pool.query(`
      SELECT ul.did, ul.profile_card_image_url, l.latitude, l.longitude, 
             l.bbox_south, l.bbox_west, l.bbox_north, l.bbox_east,
             l.id as location_id,
             l.name as location_name, l.region_name,
             COALESCE(
               json_agg(
                 json_build_object('id', i.id, 'key', i.key, 'name', i.name)
                 ORDER BY ui.created_at
               ) FILTER (WHERE i.id IS NOT NULL), '[]'
             ) as interests
      FROM user_labels ul
      JOIN locations l ON ul.location_id = l.id
      LEFT JOIN user_interests ui ON ul.did = ui.user_did
      LEFT JOIN interests i ON ui.interest_id = i.id
      WHERE ul.did IN (${placeholders}) AND ul.active = true AND ul.is_primary = true AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
      GROUP BY ul.did, ul.profile_card_image_url, l.latitude, l.longitude, l.bbox_south, l.bbox_west, l.bbox_north, l.bbox_east, l.id, l.name, l.region_name
    `, mutualDids);
    
    console.log(`Found ${dbResult.rows.length} mutuals with locations`);
    
    const mutualsWithLocations = dbResult.rows.map(row => {
      const profile = mutuals.find(m => m.did === row.did) || { handle: 'unknown', displayName: 'Unknown', avatar: null, description: null };
      
      return {
        did: row.did,
        handle: profile?.handle || 'unknown',
        displayName: profile?.displayName || profile?.handle || 'Unknown',
        avatar: profile?.avatar || null,
        description: profile?.description || null,
        profileCardImage: row.profile_card_image_url || null,
        interests: row.interests || [],
        // Store location ref + bbox for re-randomization (geometry looked up from cache)
        location_id: row.location_id,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        bbox_south: row.bbox_south,
        bbox_north: row.bbox_north,
        bbox_west: row.bbox_west,
        bbox_east: row.bbox_east,
        locationName: `${row.location_name}, ${row.region_name}`
      };
    });
    
    // Cache raw data (with bbox/geometry for re-randomization)
    const timestamp = new Date();
    await pool.query(
      'INSERT INTO mutuals_cache (user_did, cache_data) VALUES ($1, $2) ON CONFLICT (user_did) DO UPDATE SET cache_data = $2, cached_at = NOW()',
      [cacheKey, JSON.stringify(mutualsWithLocations)]
    );
    
    // Randomize positions using geometry cache (strip geo data from response)
    const randomized = mutualsWithLocations.map(u => {
      const { lat, lng } = randomizeWithGeoCache(u);
      const { bbox_south, bbox_north, bbox_west, bbox_east, location_id, ...rest } = u;
      return { ...rest, latitude: lat, longitude: lng };
    });
    
    res.json({ mutuals: randomized, lastUpdated: timestamp.toISOString() });
  } catch (error) {
    console.error('Error fetching mutuals:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch mutuals' });
  }
});

// API: Get explore users (random users with geographic distribution)

router.get('/explore-users', async (req, res) => {
  try {
    const excludeDids = req.query.exclude ? req.query.exclude.split(',') : [];
    const zoom = parseInt(req.query.zoom) || 4;
    const interestKey = req.query.interest || null;
    
    // Check cache (1 minute TTL for explore users)
    const cacheKey = `explore_${zoom}_${interestKey || 'all'}`;
    const cacheResult = await pool.query(
      'SELECT cache_data, cached_at FROM explore_users_cache WHERE cache_key = $1',
      [cacheKey]
    );
    
    if (cacheResult.rows.length > 0) {
      const cached = cacheResult.rows[0];
      const cacheAge = Date.now() - new Date(cached.cached_at).getTime();
      
      // 1 minute cache
      if (cacheAge < 60 * 1000) {
        // Filter out excluded DIDs
        const users = cached.cache_data.filter(u => !excludeDids.includes(u.did));
        return res.json({ users });
      }
    }



    
    // Calculate max users per city based on population
    // Major cities (500K+) can show up to 50 at high zoom
    // Smaller cities scale proportionally
    function getMaxUsersForCity(population, zoom) {
      const pop = parseInt(population) || 0;
      
      // Base max users based on population
      let cityMax = 1;
      if (pop >= 500000) cityMax = 50;
      else if (pop >= 250000) cityMax = 40;
      else if (pop >= 100000) cityMax = 25;
      else if (pop >= 50000) cityMax = 15;
      else if (pop >= 25000) cityMax = 10;
      else if (pop >= 10000) cityMax = 5;
      else cityMax = 2;
      
      // Scale by zoom level (progressive reveal)
      let zoomMultiplier = 0.1; // Start at 10% for low zoom
      if (zoom <= 6) zoomMultiplier = 0.1;      // 10% of city max
      else if (zoom <= 9) zoomMultiplier = 0.25; // 25% of city max
      else if (zoom <= 12) zoomMultiplier = 0.5; // 50% of city max
      else zoomMultiplier = 1.0;                 // 100% of city max
      
      return Math.max(1, Math.round(cityMax * zoomMultiplier));
    }
    
    // Get all users with locations, grouped by location for distribution
    let query = `
      SELECT ul.did, ul.profile_card_image_url, l.latitude, l.longitude, 
             l.bbox_south, l.bbox_west, l.bbox_north, l.bbox_east,
             l.geometry,
             l.name as location_name, l.region_name, l.id as location_id,
             COALESCE(l.population, 0) as population,
             COALESCE(
               json_agg(
                 json_build_object('id', i.id, 'key', i.key, 'name', i.name)
                 ORDER BY ui.created_at
               ) FILTER (WHERE i.id IS NOT NULL), '[]'
             ) as interests
      FROM user_labels ul
      JOIN locations l ON ul.location_id = l.id
      LEFT JOIN user_interests ui ON ul.did = ui.user_did
      LEFT JOIN interests i ON ui.interest_id = i.id
      WHERE ul.active = true AND ul.is_primary = true
        AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
    `;
    
    const params = [];
    
    // Filter by interest if provided
    if (interestKey) {
      query += ` AND EXISTS (
        SELECT 1 FROM user_interests ui
        JOIN interests i ON ui.interest_id = i.id
        WHERE ui.user_did = ul.did AND i.key = $${params.length + 1}
      )`;
      params.push(interestKey);
    }
    
    if (excludeDids.length > 0) {
      const placeholders = excludeDids.map((_, i) => `$${params.length + i + 1}`).join(',');
      query += ` AND ul.did NOT IN (${placeholders})`;
      params.push(...excludeDids);
    }
    
    query += ` GROUP BY ul.did, ul.profile_card_image_url, l.latitude, l.longitude, l.bbox_south, l.bbox_west, l.bbox_north, l.bbox_east, l.geometry, l.name, l.region_name, l.id, l.population`;
    
    const dbResult = await pool.query(query, params);
    
    if (dbResult.rows.length === 0) {
      return res.json({ users: [] });
    }
    
    // Group by location for geographic distribution
    const locationGroups = {};
    dbResult.rows.forEach(row => {
      if (!locationGroups[row.location_id]) {
        locationGroups[row.location_id] = [];
      }
      locationGroups[row.location_id].push(row);
    });
    
    // Show users from ALL cities (every city with users gets at least some users)
    const selectedUsers = [];
    const locationIds = Object.keys(locationGroups);
    
    // Process each city and show users based on zoom and population
    for (const locationId of locationIds) {
      const users = locationGroups[locationId];
      if (users.length === 0) continue;
      
      // Get population from first user in group (all same city)
      const population = parseInt(users[0].population) || 0;
      
      // Calculate max users for this city at current zoom
      const maxUsers = getMaxUsersForCity(population, zoom);
      
      // Pick up to maxUsers from this city
      const pickCount = Math.min(maxUsers, users.length);
      
      // Shuffle users in this location for randomness
      const shuffled = [...users];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      selectedUsers.push(...shuffled.slice(0, pickCount));
    }
    
    // Get DIDs for profile lookup
    const dids = selectedUsers.map(u => u.did);
    
    // Fetch profiles from Bluesky (in batches to avoid rate limits)
    const profiles = {};
    try {
      const batchSize = 25;
      for (let i = 0; i < dids.length; i += batchSize) {
        const batch = dids.slice(i, i + batchSize);
        try {
          let response;
          if (agent.session) {
            response = await agent.api.app.bsky.actor.getProfiles({ actors: batch });
          } else {
            // Fallback to public API
            const publicResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?actors=${batch.join('&actors=')}`);
            response = { data: await publicResponse.json() };
          }
          response.data.profiles.forEach(profile => {
            profiles[profile.did] = {
              handle: profile.handle,
              displayName: profile.displayName || profile.handle,
              avatar: profile.avatar || null,
              description: profile.description || null
            };
          });
        } catch (batchError) {
          console.error(`Error fetching profile batch:`, batchError.message);
        }
      }
    } catch (error) {
      console.error('Error fetching profiles:', error.message);
    }
    
    // Merge profile data with location data
    const users = selectedUsers.map(row => {
      const profile = profiles[row.did] || { handle: 'unknown', displayName: 'Unknown', avatar: null };
      const { lat, lng } = randomizeLocation(row);
      
      return {
        did: row.did,
        handle: profile.handle,
        displayName: profile.displayName,
        avatar: profile.avatar,
        description: profile.description || null,
        profileCardImage: row.profile_card_image_url || null,
        interests: row.interests || [],
        latitude: lat,
        longitude: lng,
        locationName: `${row.location_name}, ${row.region_name}`
      };
    });
    
    // Cache result
    await pool.query(
      'INSERT INTO explore_users_cache (cache_key, cache_data) VALUES ($1, $2) ON CONFLICT (cache_key) DO UPDATE SET cache_data = $2, cached_at = NOW()',
      [cacheKey, JSON.stringify(users)]
    );
    
    res.json({ users });
  } catch (error) {
    console.error('Error fetching explore users:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
});

// Helper: Fetch all followers with pagination
async function fetchAllFollowers(agent, did) {
  const followers = [];
  let cursor = undefined;
  
  try {
    do {
      const response = await agent.api.app.bsky.graph.getFollowers({ actor: did, limit: 100, cursor });
      followers.push(...response.data.followers);
      cursor = response.data.cursor;
    } while (cursor);
  } catch (error) {
    console.error('Error fetching followers:', error.message);
  }
  
  return followers;
}

// Helper: Fetch all following with pagination
async function fetchAllFollowing(agent, did) {
  const following = [];
  let cursor = undefined;
  
  try {
    do {
      const response = await agent.api.app.bsky.graph.getFollows({ actor: did, limit: 100, cursor });
      following.push(...response.data.follows);
      cursor = response.data.cursor;
    } while (cursor);
  } catch (error) {
    console.error('Error fetching following:', error.message);
  }
  
  return following;
}

// API: Get recent posts feed (sidebar - filtered by map bounds) — powered by Near You
router.get('/map-posts/feed', async (req, res) => {
  const { north, south, east, west, limit = 50 } = req.query;
  
  try {
    // Get all city IDs within the map bounds
    let locQuery = `
      SELECT id FROM locations
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        AND location_type = 'city'
    `;
    const params = [];
    if (north && south && east && west) {
      locQuery += ` AND latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4`;
      params.push(parseFloat(south), parseFloat(north), parseFloat(west), parseFloat(east));
    }
    const locResult = await pool.query(locQuery, params);
    const cityIds = locResult.rows.map(r => r.id);

    if (cityIds.length === 0) {
      return res.json({ posts: [] });
    }

    // Fetch posts from all visible cities in parallel (limit per city, then merge)
    const perCity = Math.max(3, Math.ceil(parseInt(limit) / cityIds.length));
    const fetches = cityIds.map(id =>
      fetch(`${NEAR_YOU_URL}/api/city-feed/${id}?limit=${perCity}&sort=recent`)
        .then(r => r.json())
        .then(d => (d.posts || []).map(p => ({ ...p, location_id: id })))
        .catch(() => [])
    );
    const results = await Promise.all(fetches);
    let allPosts = results.flat();

    // Sort by time, deduplicate, limit
    allPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const seen = new Set();
    const unique = [];
    for (const p of allPosts) {
      if (seen.has(p.post_uri)) continue;
      seen.add(p.post_uri);
      unique.push(p);
      if (unique.length >= parseInt(limit)) break;
    }

    // Transform to match frontend expectations
    const posts = unique.map(p => ({
      id: p.post_uri,
      post_uri: p.post_uri,
      author_did: p.author_did,
      author_handle: p.author_handle,
      author_display_name: p.author_display_name,
      author_avatar: p.author_avatar,
      post_text: p.post_text || '',
      embed_data: p.embed_data,
      like_count: p.like_count || 0,
      reply_count: p.reply_count || 0,
      repost_count: p.repost_count || 0,
      has_media: p.media_type > 0,
      created_at: p.created_at,
    }));

    res.json({ posts });
  } catch (error) {
    console.error('Error fetching posts feed:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// API: Get recent posts for a specific location (city popup) — powered by Near You
router.get('/map-posts/:locationId', async (req, res) => {
  const { locationId } = req.params;
  const { sort = 'realtime', limit = 25 } = req.query;
  
  try {
    const nySort = sort === 'popular' ? 'popular' : sort === 'engagement' ? 'engagement' : sort === 'scored' ? 'scored' : 'recent';
    const resp = await fetch(`${NEAR_YOU_URL}/api/city-feed/${locationId}?sort=${nySort}&limit=${limit}`);
    const data = await resp.json();

    // Transform to match the shape the frontend expects
    const posts = (data.posts || []).map(p => ({
      post_uri: p.post_uri,
      author_did: p.author_did,
      author_handle: p.author_handle,
      author_display_name: p.author_display_name,
      author_avatar: p.author_avatar,
      post_text: p.post_text || '',
      embed_data: p.embed_data,
      like_count: p.like_count || 0,
      reply_count: p.reply_count || 0,
      repost_count: p.repost_count || 0,
      has_media: p.media_type > 0,
      created_at: p.created_at,
    }));

    res.json({ posts });
  } catch (error) {
    console.error('Error fetching location posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

  return router;
};
