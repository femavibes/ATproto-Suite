const express = require('express');

module.exports = (pool, recalculateEventVisibility, generateEventId, isValidUrl, getCityEventLimit) => {
  const router = express.Router();

// GET /api/events/active - Get active/upcoming events for custom node builder
router.get('/events/active', async (req, res) => {
  const { userDid } = req.query;
  
  try {
    const result = await pool.query(`
      SELECT event_id, title, creator_did, show_rsvp_list, start_time,
             (SELECT COUNT(*) FROM event_rsvps WHERE event_id = events.event_id) as rsvp_count
      FROM events
      WHERE is_active = true 
        AND is_ended = false 
        AND deleted_at IS NULL
        AND end_time > NOW()
        AND (show_rsvp_list = true OR creator_did = $1)
      ORDER BY 
        CASE WHEN creator_did = $1 THEN 0 ELSE 1 END,
        start_time ASC
      LIMIT 100
    `, [userDid || '']);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching active events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/map - Get visible events for map display
router.get('/events/map', async (req, res) => {
  const { north, south, east, west } = req.query;
  
  if (!north || !south || !east || !west) {
    return res.status(400).json({ error: 'Map bounds required (north, south, east, west)' });
  }
  
  try {
    const result = await pool.query(`
      SELECT 
        e.id, e.event_id, e.title, e.description, e.start_time, e.end_time,
        e.latitude, e.longitude, e.location_name,
        e.creator_did, e.creator_handle,
        e.image_url, e.pin_image_url,
        e.event_type, e.join_url, e.website_url, e.links,
        COUNT(er.id) as rsvp_count,
        l.name as city_name, l.region_name
      FROM events e
      LEFT JOIN locations l ON e.location_id = l.id
      LEFT JOIN event_rsvps er ON e.event_id = er.event_id
      WHERE e.is_visible = true
        AND e.is_active = true
        AND e.deleted_at IS NULL
        AND e.end_time > NOW()
        AND e.is_ended = false
        AND e.latitude IS NOT NULL
        AND e.longitude IS NOT NULL
        AND e.latitude BETWEEN $1 AND $2
        AND e.longitude BETWEEN $3 AND $4
        AND e.event_type != 'digital'
      GROUP BY e.id, e.event_id, e.title, e.description, e.start_time, e.end_time,
               e.latitude, e.longitude, e.location_name, e.creator_did, e.creator_handle,
               e.image_url, e.pin_image_url, e.event_type, e.join_url, e.website_url, e.links,
               l.name, l.region_name
      ORDER BY e.start_time ASC
    `, [south, north, west, east]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching events for map:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/my-events - Get user's events (authenticated)
// NOTE: This must come BEFORE /api/events/:eventId to avoid route conflicts
router.get('/events/my-events', async (req, res) => {
  // Allow checking other users' events via DID parameter
  const targetDid = req.query.did || req.session.authenticatedDid;
  
  if (!targetDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const result = await pool.query(`
      SELECT 
        e.*,
        l.name as city_name, l.region_name,
        COUNT(er.id) as rsvp_count
      FROM events e
      LEFT JOIN locations l ON e.location_id = l.id
      LEFT JOIN event_rsvps er ON e.event_id = er.event_id
      WHERE e.creator_did = $1 AND e.deleted_at IS NULL
      GROUP BY e.id, l.name, l.region_name
      ORDER BY e.start_time DESC
    `, [targetDid]);
    
    res.json({ events: result.rows });
  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/categories - Get all unique event categories with counts
router.get('/events/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT LOWER(event_category) as category, COUNT(*) as count
      FROM events
      WHERE event_category IS NOT NULL 
        AND event_category != '' 
        AND deleted_at IS NULL
      GROUP BY LOWER(event_category)
      ORDER BY count DESC, LOWER(event_category) ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching event categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/events/list - Get all events for listing page (sorted by RSVP count, filterable by city)
router.get('/events/list', async (req, res) => {
  const { city, status, sort, eventType, category, showNsfw } = req.query; 
  // status: 'upcoming', 'live', 'past', or 'all'
  // sort: 'default', 'rsvp', 'start_time', 'end_time'
  // eventType: 'physical', 'digital', 'hybrid', or 'all'
  // category: filter by event category
  // showNsfw: boolean (default: false)
  
  try {
    let query = `
      SELECT 
        e.id, e.event_id, e.title, e.description, e.start_time, e.end_time,
        e.latitude, e.longitude, e.location_name,
        e.creator_did, e.creator_handle,
        e.image_url, e.pin_image_url,
        e.event_type, e.join_url, e.website_url, e.links,
        e.is_active, e.is_visible, e.is_ended,
        e.is_nsfw, e.content_rating, e.event_category,
        l.id as location_id, l.name as city_name, l.region_name, l.key as location_key,
        COUNT(er.id) as rsvp_count,
        EXTRACT(EPOCH FROM (e.start_time - NOW())) / 86400.0 as days_until_start
      FROM events e
      LEFT JOIN locations l ON e.location_id = l.id
      LEFT JOIN event_rsvps er ON e.event_id = er.event_id
      WHERE e.deleted_at IS NULL
    `;
    
    const params = [];
    let paramCount = 0;
    
    // Filter by event type
    if (eventType && eventType !== 'all') {
      paramCount++;
      query += ` AND e.event_type = $${paramCount}`;
      params.push(eventType);
    }
    
    // Filter by category
    if (category) {
      paramCount++;
      query += ` AND LOWER(e.event_category) = LOWER($${paramCount})`;
      params.push(category);
    }
    
    // Filter by NSFW
    const showNsfwValue = showNsfw === 'true' || showNsfw === true;
    if (!showNsfwValue) {
      query += ` AND (e.is_nsfw = false OR e.is_nsfw IS NULL)`;
    }
    
    // Filter by city if provided
    if (city) {
      paramCount++;
      query += ` AND l.key = $${paramCount}`;
      params.push(city);
    }
    
    // Filter by status
    const now = new Date();
    if (status === 'upcoming') {
      // Upcoming: show active events that haven't started yet
      query += ` AND e.is_active = true AND e.start_time > $${++paramCount}`;
      params.push(now);
    } else if (status === 'live') {
      // Live: show active events currently happening
      query += ` AND e.is_active = true AND e.start_time <= $${++paramCount} AND e.end_time > $${++paramCount}`;
      params.push(now, now);
    } else if (status === 'past') {
      // Past: show all events that have ended (including inactive ones)
      query += ` AND e.end_time <= $${++paramCount}`;
      params.push(now);
    } else {
      // 'all' or no status filter: show all non-deleted events (active upcoming/live + past)
      // No additional filter needed - we already filter deleted_at
    }
    
    query += `
      GROUP BY e.id, e.event_id, e.title, e.description, e.start_time, e.end_time,
               e.latitude, e.longitude, e.location_name, e.creator_did, e.creator_handle,
               e.image_url, e.pin_image_url, e.event_type, e.join_url, e.website_url, e.links,
               e.is_active, e.is_visible, e.is_ended, e.is_nsfw, e.content_rating, e.event_category,
               l.id, l.name, l.region_name, l.key
    `;
    
    // Determine sort order
    const sortMode = sort || 'default';
    
    if (sortMode === 'rsvp') {
      // Sort by RSVP count DESC, then start_time ASC
      query += ` ORDER BY COUNT(er.id) DESC, e.start_time ASC`;
    } else if (sortMode === 'start_time') {
      // Sort by start_time ASC
      query += ` ORDER BY e.start_time ASC`;
    } else if (sortMode === 'end_time') {
      // Sort by end_time DESC (most recent first)
      query += ` ORDER BY e.end_time DESC`;
      } else {
        // Default: smart sorting per filter
        if (!status || status === 'all') {
          // All events: Live first (RSVP DESC), then upcoming (hybrid score), then past (end_time DESC)
          query += `
            ORDER BY 
              CASE 
                WHEN e.start_time <= $${++paramCount} AND e.end_time > $${++paramCount} THEN 1
                WHEN e.start_time > $${++paramCount} THEN 2
                ELSE 3
              END,
              CASE 
                WHEN e.start_time <= $${++paramCount} AND e.end_time > $${++paramCount} THEN 999999999 - COUNT(er.id)
                WHEN e.start_time > $${++paramCount} THEN 999999999 - (COUNT(er.id)::numeric / (1.0 + GREATEST(0, EXTRACT(EPOCH FROM (e.start_time - NOW())) / 86400.0)))
                ELSE 999999999999999 - EXTRACT(EPOCH FROM e.end_time)
              END,
              CASE 
                WHEN e.start_time <= $${++paramCount} AND e.end_time > $${++paramCount} THEN e.start_time
                WHEN e.start_time > $${++paramCount} THEN e.start_time
                ELSE NULL
              END ASC NULLS LAST
          `;
          params.push(now, now, now, now, now, now, now, now, now);
        } else if (status === 'live') {
          // Live: RSVP DESC
          query += ` ORDER BY COUNT(er.id) DESC, e.start_time ASC`;
        } else if (status === 'upcoming') {
          // Upcoming: Hybrid score (RSVP / (1 + days_until_start)) DESC
          query += ` ORDER BY (COUNT(er.id)::numeric / (1.0 + GREATEST(0, EXTRACT(EPOCH FROM (e.start_time - NOW())) / 86400.0))) DESC, e.start_time ASC`;
        } else if (status === 'past') {
          // Past: end_time DESC (most recently ended first)
          query += ` ORDER BY e.end_time DESC`;
        }
      }
    
    const result = await pool.query(query, params);
    res.json({ events: result.rows });
  } catch (error) {
    console.error('Error fetching events list:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Query (first 1000 chars):', query.substring(0, 1000));
    console.error('Params:', params);
    
    // Check if it's a column doesn't exist error
    if (error.code === '42703' || error.message.includes('does not exist')) {
      return res.status(500).json({ 
        error: 'Database schema mismatch',
        details: error.message,
        hint: 'Please run the database migration: migrations/020_event_types_system.sql',
        migrationFile: 'migrations/020_event_types_system.sql'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch events',
      details: error.message,
      code: error.code
    });
  }
});

// GET /api/events/:eventId - Get event details
router.get('/events/:eventId', async (req, res) => {
  const { eventId } = req.params;
  
  try {
    const eventResult = await pool.query(`
      SELECT 
        e.*, 
        l.name as city_name, 
        l.region_name,
        COALESCE((SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.event_id), 0) as rsvp_count
      FROM events e
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE e.event_id = $1 AND e.deleted_at IS NULL
    `, [eventId]);
    
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const event = eventResult.rows[0];
    
    // Parse JSON fields
    if (event.links && typeof event.links === 'string') {
      try {
        event.links = JSON.parse(event.links);
      } catch (e) {
        event.links = null;
      }
    }
    if (event.hybrid_visibility_config && typeof event.hybrid_visibility_config === 'string') {
      try {
        event.hybrid_visibility_config = JSON.parse(event.hybrid_visibility_config);
      } catch (e) {
        event.hybrid_visibility_config = { competeInPhysical: true, competeInDigital: true };
      }
    }
    
    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    console.error('Event ID:', eventId);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// POST /api/events - Create event (authenticated)
router.post('/events', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { 
    title, description, startTime, endTime, 
    locationId, latitude, longitude, 
    imageUrl, pinImageUrl,
    eventType, joinUrl, websiteUrl, links,
    isNsfw, contentRating, tags,
    showRsvpList, hybridVisibilityConfig
  } = req.body;
  
  // Default event type to 'physical' if not specified
  const eventTypeValue = eventType || 'physical';
  
  // Validation: Basic required fields
  if (!title || !startTime || !endTime) {
    return res.status(400).json({ error: 'Missing required fields: title, startTime, endTime' });
  }
  
  if (title.length > 200) {
    return res.status(400).json({ error: 'Title must be 200 characters or less' });
  }
  
  // Validate event type
  if (!['physical', 'digital', 'hybrid'].includes(eventTypeValue)) {
    return res.status(400).json({ error: 'Invalid event type. Must be physical, digital, or hybrid' });
  }
  
  // Validate based on event type
  if (eventTypeValue === 'digital') {
    // Digital: location optional, coordinates must be null, joinUrl required
    if (latitude !== null && latitude !== undefined) {
      return res.status(400).json({ error: 'Digital events cannot have coordinates' });
    }
    if (longitude !== null && longitude !== undefined) {
      return res.status(400).json({ error: 'Digital events cannot have coordinates' });
    }
    if (!joinUrl) {
      return res.status(400).json({ error: 'Digital events require a join URL' });
    }
  } else if (eventTypeValue === 'physical') {
    // Physical: location required, coordinates required, joinUrl optional
    if (!locationId) {
      return res.status(400).json({ error: 'Physical events require a location' });
    }
    if (latitude === undefined || latitude === null) {
      return res.status(400).json({ error: 'Physical events require coordinates' });
    }
    if (longitude === undefined || longitude === null) {
      return res.status(400).json({ error: 'Physical events require coordinates' });
    }
  } else if (eventTypeValue === 'hybrid') {
    // Hybrid: location required, coordinates required, joinUrl required
    if (!locationId) {
      return res.status(400).json({ error: 'Hybrid events require a location' });
    }
    if (latitude === undefined || latitude === null) {
      return res.status(400).json({ error: 'Hybrid events require coordinates' });
    }
    if (longitude === undefined || longitude === null) {
      return res.status(400).json({ error: 'Hybrid events require coordinates' });
    }
    if (!joinUrl) {
      return res.status(400).json({ error: 'Hybrid events require a join URL' });
    }
  }
  
  // Validate URLs if provided
  if (joinUrl && !isValidUrl(joinUrl)) {
    return res.status(400).json({ error: 'Invalid join URL format. Must start with http:// or https://' });
  }
  if (websiteUrl && !isValidUrl(websiteUrl)) {
    return res.status(400).json({ error: 'Invalid website URL format. Must start with http:// or https://' });
  }
  
  // Validate links JSON if provided
  let linksJson = null;
  if (links) {
    try {
      if (typeof links === 'string') {
        linksJson = JSON.parse(links);
      } else {
        linksJson = links;
      }
      // Validate all links in the JSON object
      for (const [key, value] of Object.entries(linksJson)) {
        if (value && typeof value === 'string' && !isValidUrl(value)) {
          return res.status(400).json({ error: `Invalid URL in links.${key}. Must start with http:// or https://` });
        }
      }
      // Truncate to max 500 chars per URL
      const maxUrlLength = 500;
      for (const [key, value] of Object.entries(linksJson)) {
        if (value && typeof value === 'string' && value.length > maxUrlLength) {
          linksJson[key] = value.substring(0, maxUrlLength);
        }
      }
    } catch (error) {
      return res.status(400).json({ error: 'Invalid links JSON format' });
    }
  }
  
  // Validate NSFW/content rating
  const isNsfwValue = isNsfw === true || isNsfw === 'true';
  const contentRatingValue = contentRating || 'general';
  if (!['general', 'mature', 'nsfw', '18+'].includes(contentRatingValue)) {
    return res.status(400).json({ error: 'Invalid content rating. Must be general, mature, nsfw, or 18+' });
  }
  if (isNsfwValue && !['nsfw', '18+'].includes(contentRatingValue)) {
    return res.status(400).json({ error: 'NSFW events must have content rating of nsfw or 18+' });
  }
  
  // Validate hybrid visibility config
  let hybridConfig = null;
  if (eventTypeValue === 'hybrid') {
    if (hybridVisibilityConfig) {
      try {
        hybridConfig = typeof hybridVisibilityConfig === 'string' 
          ? JSON.parse(hybridVisibilityConfig) 
          : hybridVisibilityConfig;
        if (typeof hybridConfig !== 'object' || hybridConfig === null) {
          return res.status(400).json({ error: 'Invalid hybrid_visibility_config format' });
        }
        // Set defaults if not provided
        if (hybridConfig.competeInPhysical === undefined) hybridConfig.competeInPhysical = true;
        if (hybridConfig.competeInDigital === undefined) hybridConfig.competeInDigital = true;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid hybrid_visibility_config JSON format' });
      }
    } else {
      // Default: compete in both
      hybridConfig = { competeInPhysical: true, competeInDigital: true };
    }
  }
  
  // Validate showRsvpList
  const showRsvpListValue = showRsvpList !== undefined ? (showRsvpList === true || showRsvpList === 'true') : true;
  
  try {
    // Parse times
    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();
    
    // Validate: max 2 months in advance
    const twoMonthsFromNow = new Date(now);
    twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
    if (start > twoMonthsFromNow) {
      return res.status(400).json({ error: 'Events can only be created up to 2 months in advance' });
    }
    
    // Validate: max 24 hour duration
    const durationHours = (end - start) / (1000 * 60 * 60);
    if (durationHours > 24) {
      return res.status(400).json({ error: 'Events cannot exceed 24 hours' });
    }
    
    // Validate: start must be before end
    if (start >= end) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }
    
    // Get location info (if locationId provided)
    let locationName = null;
    if (locationId) {
      const locationResult = await pool.query(
        'SELECT name, region_name FROM locations WHERE id = $1',
        [locationId]
      );
      
      if (locationResult.rows.length === 0) {
        return res.status(404).json({ error: 'Location not found' });
      }
      
      const location = locationResult.rows[0];
      locationName = `${location.name}, ${location.region_name}`;
    } else if (eventTypeValue === 'digital') {
      // Digital events without location get "Virtual" as location name
      locationName = 'Virtual';
    }
    
    // Generate unique event ID
    let eventId;
    let attempts = 0;
    do {
      eventId = generateEventId();
      const existing = await pool.query('SELECT id FROM events WHERE event_id = $1', [eventId]);
      if (existing.rows.length === 0) break;
      attempts++;
      if (attempts > 10) {
        return res.status(500).json({ error: 'Failed to generate unique event ID' });
      }
    } while (true);
    
    // Check if user has image permissions (tier 2+) before allowing images
    if (imageUrl || pinImageUrl) {
      const permResult = await pool.query(
        'SELECT tier FROM user_permissions WHERE did = $1',
        [req.session.authenticatedDid]
      );
      const tier = permResult.rows.length > 0 ? permResult.rows[0].tier : 1;
      if (tier < 2) {
        return res.status(403).json({ error: 'Image permissions required (Tier 2+) to add event images or marker images' });
      }
    }
    
    // Validate and truncate image URLs if too long (max 500 chars)
    const maxUrlLength = 500;
    const finalImageUrl = imageUrl && imageUrl.length > maxUrlLength ? imageUrl.substring(0, maxUrlLength) : (imageUrl || null);
    const finalPinImageUrl = pinImageUrl && pinImageUrl.length > maxUrlLength ? pinImageUrl.substring(0, maxUrlLength) : (pinImageUrl || null);
    
    // Truncate URLs if too long
    const finalJoinUrl = joinUrl && joinUrl.length > maxUrlLength ? joinUrl.substring(0, maxUrlLength) : (joinUrl || null);
    const finalWebsiteUrl = websiteUrl && websiteUrl.length > maxUrlLength ? websiteUrl.substring(0, maxUrlLength) : (websiteUrl || null);
    
    // Extract event category from first tag (for backward compatibility)
    const finalEventCategory = tags && Array.isArray(tags) && tags.length > 0 && tags[0].name 
      ? tags[0].name.toLowerCase().trim().substring(0, 50) 
      : null;
    
    // Insert event
    const result = await pool.query(`
      INSERT INTO events (
        event_id, creator_did, creator_handle, title, description,
        start_time, end_time, location_id, latitude, longitude, location_name, 
        image_url, pin_image_url,
        event_type, join_url, website_url, links,
        is_nsfw, content_rating, event_category,
        show_rsvp_list, hybrid_visibility_config
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `, [
      eventId,
      req.session.authenticatedDid,
      req.session.authenticatedHandle,
      title,
      description || null,
      start,
      end,
      locationId || null,
      latitude || null,
      longitude || null,
      locationName,
      finalImageUrl,
      finalPinImageUrl,
      eventTypeValue,
      finalJoinUrl,
      finalWebsiteUrl,
      linksJson ? JSON.stringify(linksJson) : null,
      isNsfwValue,
      contentRatingValue,
      finalEventCategory,
      showRsvpListValue,
      hybridConfig ? JSON.stringify(hybridConfig) : null
    ]);
    
    // Save tags to event_tags table
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const maxTags = 5;
      const tagsToSave = tags.slice(0, maxTags);
      
      for (const tag of tagsToSave) {
        if (tag.interestId) {
          // Predefined interest
          await pool.query(
            'INSERT INTO event_tags (event_id, interest_id) VALUES ($1, $2)',
            [eventId, tag.interestId]
          );
        } else if (tag.name && tag.isCustom) {
          // Custom tag
          await pool.query(
            'INSERT INTO event_tags (event_id, custom_tag) VALUES ($1, $2)',
            [eventId, tag.name.toLowerCase().trim()]
          );
        }
      }
    }
    
    // Trigger visibility recalculation (async, don't wait)
    recalculateEventVisibility().catch(console.error);
    
    res.json({ event: result.rows[0], eventId });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /api/events/:eventId - Update event (creator only, before start)
router.put('/events/:eventId', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { eventId } = req.params;
  const { 
    title, description, startTime, endTime, latitude, longitude, 
    imageUrl, pinImageUrl,
    joinUrl, websiteUrl, links,
    isNsfw, contentRating, tags,
    showRsvpList, hybridVisibilityConfig
  } = req.body;
  
  try {
    // Get event
    const eventResult = await pool.query(
      'SELECT * FROM events WHERE event_id = $1 AND deleted_at IS NULL',
      [eventId]
    );
    
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const event = eventResult.rows[0];
    
    // Check creator
    if (event.creator_did !== req.session.authenticatedDid) {
      return res.status(403).json({ error: 'Only the creator can edit this event' });
    }
    
    // Check if event has started
    if (new Date(event.start_time) <= new Date()) {
      return res.status(400).json({ error: 'Cannot edit event after it has started' });
    }
    
    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      if (title.length > 200) {
        return res.status(400).json({ error: 'Title must be 200 characters or less' });
      }
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    
    if (startTime !== undefined) {
      const start = new Date(startTime);
      updates.push(`start_time = $${paramCount++}`);
      values.push(start);
    }
    
    if (endTime !== undefined) {
      const end = new Date(endTime);
      updates.push(`end_time = $${paramCount++}`);
      values.push(end);
    }
    
    if (latitude !== undefined && longitude !== undefined) {
      updates.push(`latitude = $${paramCount++}, longitude = $${paramCount++}`);
      values.push(latitude, longitude);
    }
    
    // Validate and update URLs
    if (joinUrl !== undefined) {
      if (joinUrl && !isValidUrl(joinUrl)) {
        return res.status(400).json({ error: 'Invalid join URL format. Must start with http:// or https://' });
      }
      const finalJoinUrl = joinUrl && joinUrl.length > 500 ? joinUrl.substring(0, 500) : (joinUrl || null);
      updates.push(`join_url = $${paramCount++}`);
      values.push(finalJoinUrl);
    }
    
    if (websiteUrl !== undefined) {
      if (websiteUrl && !isValidUrl(websiteUrl)) {
        return res.status(400).json({ error: 'Invalid website URL format. Must start with http:// or https://' });
      }
      const finalWebsiteUrl = websiteUrl && websiteUrl.length > 500 ? websiteUrl.substring(0, 500) : (websiteUrl || null);
      updates.push(`website_url = $${paramCount++}`);
      values.push(finalWebsiteUrl);
    }
    
    // Validate and update links JSON
    if (links !== undefined) {
      let linksJson = null;
      if (links) {
        try {
          if (typeof links === 'string') {
            linksJson = JSON.parse(links);
          } else {
            linksJson = links;
          }
          // Validate all links in the JSON object
          for (const [key, value] of Object.entries(linksJson)) {
            if (value && typeof value === 'string' && !isValidUrl(value)) {
              return res.status(400).json({ error: `Invalid URL in links.${key}. Must start with http:// or https://` });
            }
          }
          // Truncate to max 500 chars per URL
          const maxUrlLength = 500;
          for (const [key, value] of Object.entries(linksJson)) {
            if (value && typeof value === 'string' && value.length > maxUrlLength) {
              linksJson[key] = value.substring(0, maxUrlLength);
            }
          }
        } catch (error) {
          return res.status(400).json({ error: 'Invalid links JSON format' });
        }
      }
      updates.push(`links = $${paramCount++}`);
      values.push(linksJson ? JSON.stringify(linksJson) : null);
    }
    
    // Validate and update NSFW/content rating
    if (isNsfw !== undefined) {
      const isNsfwValue = isNsfw === true || isNsfw === 'true';
      updates.push(`is_nsfw = $${paramCount++}`);
      values.push(isNsfwValue);
      
      // If setting NSFW, ensure content rating is appropriate
      if (isNsfwValue && event.content_rating && !['nsfw', '18+'].includes(event.content_rating)) {
        // Auto-update content rating if needed
        updates.push(`content_rating = $${paramCount++}`);
        values.push('nsfw');
      }
    }
    
    if (contentRating !== undefined) {
      if (!['general', 'mature', 'nsfw', '18+'].includes(contentRating)) {
        return res.status(400).json({ error: 'Invalid content rating. Must be general, mature, nsfw, or 18+' });
      }
      const isNsfwValue = event.is_nsfw || (isNsfw === true || isNsfw === 'true');
      if (isNsfwValue && !['nsfw', '18+'].includes(contentRating)) {
        return res.status(400).json({ error: 'NSFW events must have content rating of nsfw or 18+' });
      }
      updates.push(`content_rating = $${paramCount++}`);
      values.push(contentRating);
    }
    
    // Update event category
    if (tags !== undefined) {
      const finalEventCategory = tags ? tags.toLowerCase().trim().substring(0, 50) : null;
      updates.push(`event_category = $${paramCount++}`);
      values.push(finalEventCategory);
    }
    
    // Update RSVP list privacy
    if (showRsvpList !== undefined) {
      const showRsvpListValue = showRsvpList === true || showRsvpList === 'true';
      updates.push(`show_rsvp_list = $${paramCount++}`);
      values.push(showRsvpListValue);
    }
    
    // Update hybrid visibility config
    if (hybridVisibilityConfig !== undefined && event.event_type === 'hybrid') {
      try {
        let hybridConfig = typeof hybridVisibilityConfig === 'string' 
          ? JSON.parse(hybridVisibilityConfig) 
          : hybridVisibilityConfig;
        if (typeof hybridConfig !== 'object' || hybridConfig === null) {
          return res.status(400).json({ error: 'Invalid hybrid_visibility_config format' });
        }
        // Set defaults if not provided
        if (hybridConfig.competeInPhysical === undefined) hybridConfig.competeInPhysical = true;
        if (hybridConfig.competeInDigital === undefined) hybridConfig.competeInDigital = true;
        updates.push(`hybrid_visibility_config = $${paramCount++}`);
        values.push(JSON.stringify(hybridConfig));
      } catch (error) {
        return res.status(400).json({ error: 'Invalid hybrid_visibility_config JSON format' });
      }
    }
    
    // Check if user has image permissions (tier 2+) before allowing images
    if (imageUrl !== undefined || pinImageUrl !== undefined) {
      const permResult = await pool.query(
        'SELECT tier FROM user_permissions WHERE did = $1',
        [req.session.authenticatedDid]
      );
      const tier = permResult.rows.length > 0 ? permResult.rows[0].tier : 1;
      if (tier < 2) {
        return res.status(403).json({ error: 'Image permissions required (Tier 2+) to add event images or marker images' });
      }
    }
    
    // Validate and truncate image URLs if too long (max 500 chars)
    const maxUrlLength = 500;
    if (imageUrl !== undefined) {
      const finalImageUrl = imageUrl && imageUrl.length > maxUrlLength ? imageUrl.substring(0, maxUrlLength) : (imageUrl || null);
      updates.push(`image_url = $${paramCount++}`);
      values.push(finalImageUrl);
    }
    
    if (pinImageUrl !== undefined) {
      const finalPinImageUrl = pinImageUrl && pinImageUrl.length > maxUrlLength ? pinImageUrl.substring(0, maxUrlLength) : (pinImageUrl || null);
      updates.push(`pin_image_url = $${paramCount++}`);
      values.push(finalPinImageUrl);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Add updated_at
    updates.push(`updated_at = NOW()`);
    
    values.push(eventId);
    
    await pool.query(
      `UPDATE events SET ${updates.join(', ')} WHERE event_id = $${paramCount}`,
      values
    );
    
    // Trigger visibility recalculation
    recalculateEventVisibility().catch(console.error);
    
    // Get updated event
    const updatedResult = await pool.query(
      'SELECT * FROM events WHERE event_id = $1',
      [eventId]
    );
    
    res.json({ event: updatedResult.rows[0] });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/events/:eventId - Delete event (creator only)
router.delete('/events/:eventId', async (req, res) => {
  if (!req.session.authenticatedDid) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { eventId } = req.params;
  
  try {
    // Get event
    const eventResult = await pool.query(
      'SELECT * FROM events WHERE event_id = $1 AND deleted_at IS NULL',
      [eventId]
    );
    
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const event = eventResult.rows[0];
    
    // Check creator
    if (event.creator_did !== req.session.authenticatedDid) {
      return res.status(403).json({ error: 'Only the creator can delete this event' });
    }
    
    // Soft delete
    await pool.query(
      'UPDATE events SET deleted_at = NOW(), is_active = false, is_visible = false WHERE event_id = $1',
      [eventId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// GET /api/events/:eventId/rsvps - Get RSVP list with privacy controls
router.get('/events/:eventId/rsvps', async (req, res) => {
  const { eventId } = req.params;
  const { page = 1, perPage = 20 } = req.query;
  const pageNum = parseInt(page) || 1;
  const perPageNum = Math.min(parseInt(perPage) || 20, 100); // Max 100 per page
  const offset = (pageNum - 1) * perPageNum;
  
  try {
    // Get event to check privacy and creator
    const eventResult = await pool.query(
      'SELECT creator_did, show_rsvp_list FROM events WHERE event_id = $1 AND deleted_at IS NULL',
      [eventId]
    );
    
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const event = eventResult.rows[0];
    const isCreator = req.session.authenticatedDid === event.creator_did;
    const canView = event.show_rsvp_list || isCreator;
    
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM event_rsvps WHERE event_id = $1',
      [eventId]
    );
    const totalCount = parseInt(countResult.rows[0].total) || 0;
    
    // Get RSVPs if user can view
    let rsvps = [];
    if (canView) {
      const rsvpResult = await pool.query(`
        SELECT 
          user_did, user_handle, created_at, created_at_relative_to_start
        FROM event_rsvps
        WHERE event_id = $1
        ORDER BY created_at ASC
        LIMIT $2 OFFSET $3
      `, [eventId, perPageNum, offset]);
      
      // Fetch user profiles from Bluesky public API for avatars and display names
      rsvps = await Promise.all(rsvpResult.rows.map(async (rsvp) => {
        let userDisplayName = null;
        let userAvatar = null;
        
        if (rsvp.user_did) {
          try {
            const profileResponse = await fetch(
              `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(rsvp.user_did)}`
            );
            if (profileResponse.ok) {
              const profileData = await profileResponse.json();
              userDisplayName = profileData.displayName || null;
              userAvatar = profileData.avatar || null;
            }
          } catch (error) {
            // Profile not found or error - continue without avatar/display name
            // Silently fail - not critical
          }
        }
        
        return {
          user_did: rsvp.user_did,
          user_handle: rsvp.user_handle,
          user_display_name: userDisplayName,
          user_avatar: userAvatar,
          created_at: rsvp.created_at,
          created_at_relative_to_start: rsvp.created_at_relative_to_start
        };
      }));
    }
    
    res.json({
      rsvps,
      count: totalCount,
      isPrivate: !event.show_rsvp_list,
      canView,
      isCreator,
      hasMore: offset + perPageNum < totalCount,
      page: pageNum,
      perPage: perPageNum,
      message: !canView ? 'RSVP list is private. Only the event creator can view attendees.' : null
    });
  } catch (error) {
    console.error('Error fetching RSVPs:', error);
    res.status(500).json({ error: 'Failed to fetch RSVPs' });
  }
});

  return router;
};
