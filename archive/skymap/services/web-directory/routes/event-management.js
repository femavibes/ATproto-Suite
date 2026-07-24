const express = require('express');
const router = express.Router();

// CORS middleware for admin panel
router.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Log for debugging event-scoring-config requests
  if (req.path && req.path.includes('event-scoring-config')) {
    console.log('[CORS Middleware] Path:', req.path, 'Method:', req.method, 'Origin:', origin);
  }
  
  // Allow requests from admin panel - check both exact match and domain match
  const allowedDomains = [
    process.env.ADMIN_URL ? process.env.ADMIN_URL.replace('https://', '').replace('http://', '') : 'admin.atls.city',
    'skymapadmin.fema.monster',
    'localhost'
  ];
  
  let isAllowed = false;
  
  if (origin) {
    // Check exact match
    const adminUrl = process.env.ADMIN_URL || 'https://admin.atls.city';
    if (origin === adminUrl || 
        origin === 'https://skymapadmin.fema.monster' ||
        origin.startsWith('http://localhost')) {
      isAllowed = true;
    } else {
      // Check domain match (strip protocol)
      const originDomain = origin.replace(/^https?:\/\//, '').split(':')[0];
      isAllowed = allowedDomains.some(domain => originDomain === domain || originDomain.endsWith('.' + domain));
    }
    
    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Allow-Credentials', 'true');
      if (req.path && req.path.includes('event-scoring-config')) {
        console.log('[CORS Middleware] Headers set for origin:', origin);
      }
    } else if (req.path && req.path.includes('event-scoring-config')) {
      console.log('[CORS Middleware] Origin not allowed:', origin);
    }
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware to attach pool to request
router.use((req, res, next) => {
  req.pool = router.pool;
  next();
});

// Default scoring parameters (can be overridden from database)
const DEFAULT_SCORING_CONFIG = {
  absoluteWeight: 0.3,        // Weight for absolute RSVP count
  densityWeight: 0.7,         // Weight for RSVP density
  useSquareRoot: true,        // Use sqrt(duration) instead of linear
  maxDensityScore: null,      // Cap density component (null = no cap)
  minRSVPsForCompetition: 0,  // Minimum RSVPs to compete (0 = no minimum)
  applyMinWhenOversubscribed: true  // Only apply minimum when events > city limit
};

// Get current scoring configuration
async function getScoringConfig(pool) {
  try {
    const result = await pool.query(`
      SELECT config_key, config_value 
      FROM event_scoring_config
    `);
    
    const config = { ...DEFAULT_SCORING_CONFIG };
    result.rows.forEach(row => {
      const key = row.config_key;
      let value = row.config_value;
      
      // Parse values based on type
      if (value === 'null' || value === null) {
        config[key] = null;
      } else if (value === 'true') {
        config[key] = true;
      } else if (value === 'false') {
        config[key] = false;
      } else if (!isNaN(value) && value !== '') {
        // Try to parse as number
        const num = parseFloat(value);
        if (!isNaN(num)) {
          config[key] = num;
        } else {
          config[key] = value;
        }
      } else {
        // Try JSON parse for complex values
        try {
          config[key] = JSON.parse(value);
        } catch {
          config[key] = value;
        }
      }
    });
    
    return config;
  } catch (error) {
    console.error('Error loading scoring config, using defaults:', error);
    return DEFAULT_SCORING_CONFIG;
  }
}

// Calculate event score with configurable parameters
async function calculateEventScore(eventId, startTime, pool) {
  const config = await getScoringConfig(pool);
  
  const result = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE er.created_at < e.start_time) as rsvps_before_start,
      COUNT(*) FILTER (WHERE er.created_at >= e.start_time) as rsvps_after_start,
      EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 3600.0 as duration_hours
    FROM events e
    LEFT JOIN event_rsvps er ON e.event_id = er.event_id
    WHERE e.event_id = $1
    GROUP BY e.start_time, e.end_time
  `, [eventId]);
  
  if (result.rows.length === 0) return 0;
  
  const row = result.rows[0];
  const rsvpsBeforeStart = parseInt(row.rsvps_before_start) || 0;
  const rsvpsAfterStart = parseInt(row.rsvps_after_start) || 0;
  const durationHours = parseFloat(row.duration_hours) || 1;
  
  // RSVPs after start count 0.5x
  const weightedRSVPs = rsvpsBeforeStart + (rsvpsAfterStart * 0.5);
  
  // Calculate density component
  let densityScore;
  if (config.useSquareRoot) {
    densityScore = weightedRSVPs / Math.sqrt(durationHours);
  } else {
    densityScore = weightedRSVPs / durationHours;
  }
  
  // Apply density cap if configured
  if (config.maxDensityScore !== null && densityScore > config.maxDensityScore) {
    densityScore = config.maxDensityScore;
  }
  
  // Hybrid score: absolute weight + density weight
  const absoluteComponent = weightedRSVPs * config.absoluteWeight;
  const densityComponent = densityScore * config.densityWeight;
  
  return absoluteComponent + densityComponent;
}

// Get event limit based on location type and population
function getLocationEventLimit(locationType, population) {
  if (!locationType) {
    // Digital events without location - global limit
    return 50; // Global limit for digital events
  }
  
  // For cities, use the existing getCityEventLimit logic
  if (locationType === 'city') {
    if (!population || population < 50000) return 2;
    if (population < 100000) return 5;
    if (population < 250000) return 10;
    if (population < 500000) return 15;
    if (population < 1000000) return 20;
    return 25; // 1M+
  }
  
  // For counties, use higher limits (counties are larger)
  if (locationType === 'county') {
    if (!population || population < 100000) return 5;
    if (population < 250000) return 10;
    if (population < 500000) return 15;
    if (population < 1000000) return 20;
    if (population < 2500000) return 30;
    return 40; // 2.5M+
  }
  
  // For states/regions, use even higher limits
  if (locationType === 'state') {
    if (!population || population < 500000) return 10;
    if (population < 1000000) return 20;
    if (population < 5000000) return 30;
    if (population < 10000000) return 40;
    return 50; // 10M+
  }
  
  // For countries, use very high limits
  if (locationType === 'country') {
    if (!population || population < 10000000) return 30;
    if (population < 50000000) return 50;
    if (population < 100000000) return 75;
    return 100; // 100M+
  }
  
  // Default fallback
  return 10;
}

// Recalculate visibility for all events
async function recalculateEventVisibility(pool, getCityEventLimit) {
  try {
    console.log('Recalculating event visibility...');
    const config = await getScoringConfig(pool);
    
    // Get all active events (upcoming or currently happening) with their RSVP counts
    // Include event_type and location_type for proper grouping
    const eventsResult = await pool.query(`
      SELECT 
        e.id, e.event_id, e.location_id, e.start_time, e.end_time, e.event_type,
        l.population, l.location_type,
        COUNT(er.id) as rsvp_count
      FROM events e
      LEFT JOIN locations l ON e.location_id = l.id
      LEFT JOIN event_rsvps er ON e.event_id = er.event_id
      WHERE e.is_active = true 
        AND e.deleted_at IS NULL
        AND e.end_time > NOW() - INTERVAL '24 hours'
        AND e.is_ended = false
      GROUP BY e.id, e.event_id, e.location_id, e.start_time, e.end_time, e.event_type, l.population, l.location_type
    `);
    
    // Calculate scores for each event
    const eventsWithScores = await Promise.all(eventsResult.rows.map(async (event) => {
      const score = await calculateEventScore(event.event_id, event.start_time, pool);
      return { ...event, score };
    }));
    
    // Separate events by type
    const physicalEvents = eventsWithScores.filter(e => e.event_type === 'physical');
    const digitalEvents = eventsWithScores.filter(e => e.event_type === 'digital');
    const hybridEvents = eventsWithScores.filter(e => e.event_type === 'hybrid');
    
    const allVisibleEventIds = [];
    
    // Process physical events (grouped by location)
    const physicalByLocation = {};
    physicalEvents.forEach(event => {
      const locationKey = event.location_id || 'no-location';
      if (!physicalByLocation[locationKey]) {
        physicalByLocation[locationKey] = { withRSVPs: [], withoutRSVPs: [] };
      }
      if (event.rsvp_count > 0) {
        physicalByLocation[locationKey].withRSVPs.push(event);
      } else {
        physicalByLocation[locationKey].withoutRSVPs.push(event);
      }
    });
    
    // Process each physical location
    for (const [locationKey, locationEvents] of Object.entries(physicalByLocation)) {
      const sampleEvent = locationEvents.withRSVPs[0] || locationEvents.withoutRSVPs[0];
      if (!sampleEvent) continue;
      
      const locationType = sampleEvent.location_type || 'city';
      const population = sampleEvent.population || 0;
      const limit = getLocationEventLimit(locationType, population);
      
      // Apply minimum RSVP threshold if oversubscribed and configured
      let eventsToRank = locationEvents.withRSVPs;
      if (config.applyMinWhenOversubscribed && 
          config.minRSVPsForCompetition > 0 && 
          locationEvents.withRSVPs.length > limit) {
        eventsToRank = locationEvents.withRSVPs.filter(e => e.rsvp_count >= config.minRSVPsForCompetition);
      }
      
      // Sort by score (descending)
      eventsToRank.sort((a, b) => b.score - a.score);
      
      // Take top N events with RSVPs
      const topEventsWithRSVPs = eventsToRank.slice(0, limit);
      const remainingSlots = limit - topEventsWithRSVPs.length;
      
      // Fill remaining slots with events without RSVPs
      const topEventsWithoutRSVPs = locationEvents.withoutRSVPs
        .sort((a, b) => a.id - b.id)
        .slice(0, remainingSlots);
      
      // Combine and mark as visible
      [...topEventsWithRSVPs, ...topEventsWithoutRSVPs].forEach(event => {
        allVisibleEventIds.push(event.event_id);
      });
    }
    
    // Process digital events (global competition, no location grouping)
    const digitalWithRSVPs = digitalEvents.filter(e => e.rsvp_count > 0);
    const digitalWithoutRSVPs = digitalEvents.filter(e => e.rsvp_count === 0);
    const digitalLimit = getLocationEventLimit(null, null); // Global limit
    
    // Apply minimum RSVP threshold if oversubscribed
    let digitalToRank = digitalWithRSVPs;
    if (config.applyMinWhenOversubscribed && 
        config.minRSVPsForCompetition > 0 && 
        digitalWithRSVPs.length > digitalLimit) {
      digitalToRank = digitalWithRSVPs.filter(e => e.rsvp_count >= config.minRSVPsForCompetition);
    }
    
    // Sort by score
    digitalToRank.sort((a, b) => b.score - a.score);
    
    // Take top N digital events
    const topDigitalWithRSVPs = digitalToRank.slice(0, digitalLimit);
    const remainingDigitalSlots = digitalLimit - topDigitalWithRSVPs.length;
    const topDigitalWithoutRSVPs = digitalWithoutRSVPs
      .sort((a, b) => a.id - b.id)
      .slice(0, remainingDigitalSlots);
    
    [...topDigitalWithRSVPs, ...topDigitalWithoutRSVPs].forEach(event => {
      allVisibleEventIds.push(event.event_id);
    });
    
    // Process hybrid events (can compete in both physical and digital)
    // For now, treat them like physical events (by location), but they could also compete globally
    // Future: Use hybrid_visibility_config to determine if they compete in both
    const hybridByLocation = {};
    hybridEvents.forEach(event => {
      const locationKey = event.location_id || 'no-location';
      if (!hybridByLocation[locationKey]) {
        hybridByLocation[locationKey] = { withRSVPs: [], withoutRSVPs: [] };
      }
      if (event.rsvp_count > 0) {
        hybridByLocation[locationKey].withRSVPs.push(event);
      } else {
        hybridByLocation[locationKey].withoutRSVPs.push(event);
      }
    });
    
    // Process each hybrid location (same logic as physical)
    for (const [locationKey, locationEvents] of Object.entries(hybridByLocation)) {
      const sampleEvent = locationEvents.withRSVPs[0] || locationEvents.withoutRSVPs[0];
      if (!sampleEvent) continue;
      
      const locationType = sampleEvent.location_type || 'city';
      const population = sampleEvent.population || 0;
      const limit = getLocationEventLimit(locationType, population);
      
      // Apply minimum RSVP threshold if oversubscribed
      let eventsToRank = locationEvents.withRSVPs;
      if (config.applyMinWhenOversubscribed && 
          config.minRSVPsForCompetition > 0 && 
          locationEvents.withRSVPs.length > limit) {
        eventsToRank = locationEvents.withRSVPs.filter(e => e.rsvp_count >= config.minRSVPsForCompetition);
      }
      
      // Sort by score
      eventsToRank.sort((a, b) => b.score - a.score);
      
      // Take top N events
      const topEventsWithRSVPs = eventsToRank.slice(0, limit);
      const remainingSlots = limit - topEventsWithRSVPs.length;
      const topEventsWithoutRSVPs = locationEvents.withoutRSVPs
        .sort((a, b) => a.id - b.id)
        .slice(0, remainingSlots);
      
      [...topEventsWithRSVPs, ...topEventsWithoutRSVPs].forEach(event => {
        allVisibleEventIds.push(event.event_id);
      });
    }
    
    // Update is_visible flag for all events
    await pool.query('UPDATE events SET is_visible = false');
    if (allVisibleEventIds.length > 0) {
      await pool.query(
        `UPDATE events SET is_visible = true WHERE event_id = ANY($1)`,
        [allVisibleEventIds]
      );
    }
    
    console.log(`Visibility updated: ${allVisibleEventIds.length} events visible (${physicalEvents.length} physical, ${digitalEvents.length} digital, ${hybridEvents.length} hybrid)`);
    
    // Mark events as ended if they've passed (>24h after end_time)
    await pool.query(`
      UPDATE events 
      SET is_ended = true 
      WHERE is_active = true 
        AND end_time < NOW() - INTERVAL '24 hours'
    `);
  } catch (error) {
    console.error('Error recalculating event visibility:', error);
  }
}

// Handle OPTIONS preflight for event-scoring-config
router.options('/api/event-scoring-config', (req, res) => {
  const origin = req.headers.origin;
  console.log('[OPTIONS] event-scoring-config, Origin:', origin);
  const adminUrl = process.env.ADMIN_URL || 'https://admin.atls.city';
  if (origin && (
    origin === adminUrl ||
    origin === 'https://skymapadmin.fema.monster' ||
    origin.startsWith('http://localhost')
  )) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    console.log('[OPTIONS] CORS headers set');
  }
  res.sendStatus(200);
});

// API: Get scoring configuration
// NOTE: If this endpoint is behind Cloudflare proxy, Cloudflare may strip CORS headers.
// Solutions: Use Cloudflare Workers/Transform Rules, set DNS to "DNS only" mode, or use a non-proxied subdomain.
router.get('/api/event-scoring-config', async (req, res) => {
  // Set CORS headers FIRST, before any async operations
  const origin = req.headers.origin;
  console.log('[GET] event-scoring-config, Origin:', origin, 'Path:', req.path, 'URL:', req.url);
  
  // Always set CORS headers if origin matches (before any async work)
  const setCorsHeaders = () => {
    const adminUrl = process.env.ADMIN_URL || 'https://admin.atls.city';
    if (origin && (
      origin === adminUrl ||
      origin === 'https://skymapadmin.fema.monster' ||
      origin.startsWith('http://localhost')
    )) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      console.log('[GET] CORS headers set for origin:', origin);
      console.log('[GET] Response headers:', res.getHeaders());
      return true;
    } else {
      console.log('[GET] Origin not allowed or missing:', origin);
      return false;
    }
  };
  
  const corsSet = setCorsHeaders();
  
  try {
    const config = await getScoringConfig(req.pool);
    console.log('[GET] Sending response with config, CORS set:', corsSet);
    res.json(config);
  } catch (error) {
    console.error('[GET] Error fetching scoring config:', error);
    // Make sure CORS headers are still set even on error
    if (!corsSet) setCorsHeaders();
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// API: Update scoring configuration
router.put('/api/event-scoring-config', async (req, res) => {
  // Set CORS headers FIRST, before any async operations
  const origin = req.headers.origin;
  console.log('[PUT] event-scoring-config, Origin:', origin);
  const adminUrl = process.env.ADMIN_URL || 'https://admin.atls.city';
  if (origin && (
    origin === adminUrl ||
    origin === 'https://skymapadmin.fema.monster' ||
    origin.startsWith('http://localhost')
  )) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    console.log('[PUT] CORS headers set');
  }
  
  try {
    const updates = req.body;
    
    // Validate and update each config value
    for (const [key, value] of Object.entries(updates)) {
      if (!DEFAULT_SCORING_CONFIG.hasOwnProperty(key)) {
        continue; // Skip unknown keys
      }
      
      // Store as JSON string
      const jsonValue = JSON.stringify(value);
      
      await req.pool.query(`
        INSERT INTO event_scoring_config (config_key, config_value)
        VALUES ($1, $2)
        ON CONFLICT (config_key) 
        DO UPDATE SET config_value = $2, updated_at = NOW()
      `, [key, jsonValue]);
    }
    
    // Trigger recalculation - getCityEventLimit is passed from server.js
    // We need to get it from the module that requires us
    const serverModule = require.cache[require.resolve('../server')];
    if (serverModule && serverModule.exports && serverModule.exports.getCityEventLimit) {
      const getCityEventLimit = serverModule.exports.getCityEventLimit;
      await recalculateEventVisibility(req.pool, getCityEventLimit);
    } else {
      // Fallback: define inline if not available
      function getCityEventLimit(population) {
        if (!population || population < 50000) return 2;
        if (population < 100000) return 5;
        if (population < 250000) return 10;
        if (population < 500000) return 15;
        if (population < 1000000) return 20;
        return 25;
      }
      await recalculateEventVisibility(req.pool, getCityEventLimit);
    }
    
    const config = await getScoringConfig(req.pool);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error updating scoring config:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// Export functions for use in server.js
module.exports = {
  router,
  calculateEventScore,
  recalculateEventVisibility,
  getScoringConfig
};
