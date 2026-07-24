const express = require('express');
const router = express.Router();

// This will be passed from server.js
let pool;

// Initialize router with database pool
function initLocationDisplayRoutes(dbPool) {
  pool = dbPool;
  return router;
}

// Get display overrides for a specific location
router.get('/:locationId', async (req, res) => {
  const { locationId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT id, key, name, display_key, display_name 
       FROM locations 
       WHERE id = $1`,
      [locationId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const location = result.rows[0];
    res.json({
      id: location.id,
      key: location.key,
      name: location.name,
      display_key: location.display_key || null,
      display_name: location.display_name || null,
      has_override: !!(location.display_key || location.display_name)
    });
  } catch (error) {
    console.error('Error fetching location display:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all locations with display overrides
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, key, name, display_key, display_name, location_type, region_code, country_code
       FROM locations 
       WHERE display_key IS NOT NULL OR display_name IS NOT NULL
       ORDER BY name`
    );
    
    res.json(result.rows.map(loc => ({
      id: loc.id,
      key: loc.key,
      name: loc.name,
      display_key: loc.display_key,
      display_name: loc.display_name,
      location_type: loc.location_type,
      region_code: loc.region_code,
      country_code: loc.country_code
    })));
  } catch (error) {
    console.error('Error fetching locations with display overrides:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Set display overrides for a location
router.put('/:locationId', async (req, res) => {
  const { locationId } = req.params;
  const { display_key, display_name } = req.body;
  
  // Validate display_key format if provided
  if (display_key && !/^[A-Z]{2}-[A-Z]{2}-[A-Za-z0-9]+$/.test(display_key)) {
    return res.status(400).json({ 
      error: 'Invalid display_key format. Expected format: US-OR-Portland' 
    });
  }
  
  // Check if display_key is already used by another location
  if (display_key) {
    const existingResult = await pool.query(
      `SELECT id, key FROM locations 
       WHERE (key = $1 OR display_key = $1) AND id != $2`,
      [display_key, locationId]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ 
        error: `Display key "${display_key}" is already in use by location: ${existingResult.rows[0].key}` 
      });
    }
  }
  
  try {
    // Verify location exists
    const locationCheck = await pool.query(
      'SELECT id, key, name FROM locations WHERE id = $1',
      [locationId]
    );
    
    if (locationCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const location = locationCheck.rows[0];
    
    // Update display overrides
    const updateResult = await pool.query(
      `UPDATE locations 
       SET display_key = $1, display_name = $2
       WHERE id = $3
       RETURNING id, key, name, display_key, display_name`,
      [
        display_key || null,
        display_name || null,
        locationId
      ]
    );
    
    res.json({
      success: true,
      location: updateResult.rows[0],
      message: `Display overrides updated for ${location.name}`
    });
  } catch (error) {
    console.error('Error updating location display:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Remove display overrides for a location
router.delete('/:locationId', async (req, res) => {
  const { locationId } = req.params;
  
  try {
    // Verify location exists
    const locationCheck = await pool.query(
      'SELECT id, key, name FROM locations WHERE id = $1',
      [locationId]
    );
    
    if (locationCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    const location = locationCheck.rows[0];
    
    // Remove display overrides
    await pool.query(
      `UPDATE locations 
       SET display_key = NULL, display_name = NULL
       WHERE id = $1`,
      [locationId]
    );
    
    res.json({
      success: true,
      message: `Display overrides removed for ${location.name}`
    });
  } catch (error) {
    console.error('Error removing location display overrides:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = initLocationDisplayRoutes;
