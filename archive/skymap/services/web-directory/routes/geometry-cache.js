let geometryCache = new Map();
let lastRefresh = 0;
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

async function refreshGeometryCache(pool) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT l.id, l.geometry, l.bbox_south, l.bbox_north, l.bbox_west, l.bbox_east, l.latitude, l.longitude
      FROM locations l
      JOIN user_labels ul ON l.id = ul.location_id
      WHERE ul.active = true AND l.geometry IS NOT NULL
    `);
    const newCache = new Map();
    for (const row of result.rows) {
      newCache.set(row.id, {
        geometry: row.geometry,
        bbox_south: row.bbox_south,
        bbox_north: row.bbox_north,
        bbox_west: row.bbox_west,
        bbox_east: row.bbox_east,
        latitude: row.latitude,
        longitude: row.longitude,
      });
    }
    geometryCache = newCache;
    lastRefresh = Date.now();
    console.log(`Geometry cache refreshed: ${newCache.size} locations`);
  } catch (e) {
    console.error('Error refreshing geometry cache:', e.message);
  }
}

function getLocationGeo(locationId) {
  return geometryCache.get(locationId) || null;
}

function needsRefresh() {
  return Date.now() - lastRefresh > REFRESH_INTERVAL;
}

module.exports = { refreshGeometryCache, getLocationGeo, needsRefresh };
