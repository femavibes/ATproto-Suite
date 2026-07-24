const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { createReadStream } = require('fs');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');
const yauzl = require('yauzl');
const https = require('https');
const http = require('http');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dev:devpass@localhost:5435/skymap'
});

// State/Province code mappings
const stateMap = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

const provinceMap = {
  'Alberta': 'AB',
  'British Columbia': 'BC',
  'Manitoba': 'MB',
  'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL',
  'Northwest Territories': 'NT',
  'Nova Scotia': 'NS',
  'Nunavut': 'NU',
  'Ontario': 'ON',
  'Prince Edward Island': 'PE',
  'Quebec': 'QC',
  'Saskatchewan': 'SK',
  'Yukon': 'YT'
};

// Country code to region map mapping
const countryRegionMaps = {
  'us': stateMap,
  'ca': provinceMap
};

// Override for countries whose address.country is non-English or multilingual
const countryNameOverrides = {
  'ch': 'Switzerland',
  'de': 'Germany',
  'at': 'Austria',
  'jp': 'Japan',
  'kr': 'South Korea',
  'cn': 'China',
  'br': 'Brazil',
  'es': 'Spain',
  'fr': 'France',
  'pt': 'Portugal',
  'nl': 'Netherlands',
  'be': 'Belgium',
  'se': 'Sweden',
  'no': 'Norway',
  'dk': 'Denmark',
  'fi': 'Finland',
  'pl': 'Poland',
  'cz': 'Czechia',
  'gr': 'Greece',
  'tr': 'Turkey',
  'ru': 'Russia',
  'ua': 'Ukraine',
  'eg': 'Egypt',
  'sa': 'Saudi Arabia',
  'ae': 'United Arab Emirates',
  'in': 'India',
  'th': 'Thailand',
  'vn': 'Vietnam',
  'tw': 'Taiwan',
  'il': 'Israel',
  'hr': 'Croatia',
  'rs': 'Serbia',
  'bg': 'Bulgaria',
  'ro': 'Romania',
  'hu': 'Hungary',
  'sk': 'Slovakia',
  'si': 'Slovenia',
  'lt': 'Lithuania',
  'lv': 'Latvia',
  'ee': 'Estonia',
  'is': 'Iceland',
  'ge': 'Georgia',
  'am': 'Armenia',
  'az': 'Azerbaijan',
  'mx': 'Mexico',
  'ar': 'Argentina',
  'cl': 'Chile',
  'co': 'Colombia',
  'pe': 'Peru',
  'ma': 'Morocco',
  'za': 'South Africa',
  'ph': 'Philippines',
};

/**
 * Fetch polygon geometry from Nominatim API (preferred) or Overpass API (fallback)
 * Nominatim returns complete assembled polygons, while Overpass requires manual assembly
 * @param {number} osmId - OSM ID
 * @param {string} osmType - OSM type ('relation', 'way', or 'node')
 * @param {string} cityName - City name for Nominatim lookup
 * @param {string} regionName - Region/state name for Nominatim lookup
 * @returns {Promise<Object|null>} GeoJSON polygon or null if not found
 */
async function fetchPolygonFromOSM(osmId, osmType, cityName = null, regionName = null, countryCode = null) {
  // Try Nominatim first (returns complete assembled polygons)
  if (cityName) {
    try {
      // Build query parts — don't hardcode country
      const queryParts = [cityName];
      if (regionName) queryParts.push(regionName);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryParts.join(','))}&format=json&limit=1&polygon_geojson=1&namedetails=1${countryCode ? '&countrycodes=' + countryCode.toLowerCase() : ''}`;
      
      const result = await new Promise((resolve) => {
        const urlObj = new URL(nominatimUrl);
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'User-Agent': 'SkyMap/1.0 (city boundary fetcher)'
          },
          timeout: 10000
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              if (res.statusCode !== 200) {
                resolve(null);
                return;
              }
              const results = JSON.parse(data);
              if (results && results.length > 0 && results[0].geojson) {
                const geojson = results[0].geojson;
                if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
                  const nameEn = results[0].namedetails?.['name:en'] || null;
                  resolve({ geometry: geojson, nameEn });
                  return;
                }
              }
              resolve(null);
            } catch (e) {
              resolve(null);
            }
          });
        });
        
        req.on('error', () => resolve(null));
        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });
        
        req.end();
      });
      
      if (result) {
        return result;
      }
    } catch (error) {
      // Fall through to Overpass API
    }
  }
  
  // Fallback to Overpass API
  if (!osmId || !osmType) {
    return null;
  }
  
  // Normalize osm_type
  const normalizedType = osmType.toLowerCase();
  if (!['relation', 'way', 'node'].includes(normalizedType)) {
    return null;
  }
  
  let overpassQuery;
  if (normalizedType === 'relation') {
    overpassQuery = `[out:json][timeout:180];
relation(${osmId});
(._;>;);
out geom;`;
  } else {
    overpassQuery = `[out:json][timeout:180];
${normalizedType}(${osmId});
out geom;`;
  }
  
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await new Promise((resolve) => {
        const postData = overpassQuery;
        const urlObj = new URL('https://overpass-api.de/api/interpreter');
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 200000
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode === 429 || res.statusCode === 504 || res.statusCode === 503) {
              resolve({ retry: true, status: res.statusCode });
              return;
            }
            if (res.statusCode !== 200) {
              console.warn(`  ⚠ OSM API returned ${res.statusCode} for ${normalizedType}/${osmId}`);
              resolve(null);
              return;
            }
            try {
              resolve({ data: JSON.parse(data) });
            } catch (error) {
              console.warn(`  ⚠ Error parsing OSM response for ${normalizedType}/${osmId}:`, error.message);
              resolve(null);
            }
          });
        });
        
        req.on('error', (error) => {
          console.warn(`  ⚠ Error fetching polygon from OSM for ${normalizedType}/${osmId}:`, error.message);
          resolve({ retry: true, status: 'network_error' });
        });
        
        req.on('timeout', () => {
          req.destroy();
          resolve({ retry: true, status: 'timeout' });
        });
        
        req.write(postData);
        req.end();
      });
      
      if (!result) return null;
      
      if (result.retry) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 2000; // 4s, 8s, 16s
          console.warn(`  ⚠ Overpass ${result.status} for ${normalizedType}/${osmId}, retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        console.warn(`  ⚠ Overpass failed after ${maxRetries} attempts for ${normalizedType}/${osmId}`);
        return null;
      }
      
      const parsed = result.data;
      if (!parsed.elements || parsed.elements.length === 0) return null;
      
      const mainElement = parsed.elements.find(e => e.type === normalizedType && e.id === osmId);
      if (!mainElement) return null;
      
      const geom = convertOSMToGeoJSON(mainElement, parsed.elements, normalizedType);
      if (!geom) return null;
      const nameEn = mainElement.tags?.['name:en'] || null;
      return { geometry: geom, nameEn };
    } catch (error) {
      console.warn(`  ⚠ Error in fetchPolygonFromOSM for ${normalizedType}/${osmId}:`, error.message);
      return null;
    }
  }
  return null;
}

/**
 * Convert OSM element to GeoJSON polygon
 * @param {Object} mainElement - The main OSM element (relation, way, or node)
 * @param {Array} allElements - All elements from OSM response (for relation members)
 * @param {string} osmType - OSM type
 * @returns {Object|null} GeoJSON polygon or null
 */
function convertOSMToGeoJSON(mainElement, allElements, osmType) {
  if (osmType === 'relation') {
    // For relations, collect all outer ways to form the polygon
    const outerWays = [];
    const innerWays = [];
    const members = mainElement.members || [];
    
    for (const member of members) {
      if (member.role === 'outer' && member.type === 'way') {
        const way = allElements.find(e => e.type === 'way' && e.id === member.ref);
        if (way && way.geometry) {
          outerWays.push(way);
        }
      } else if (member.role === 'inner' && member.type === 'way') {
        const way = allElements.find(e => e.type === 'way' && e.id === member.ref);
        if (way && way.geometry) {
          innerWays.push(way);
        }
      }
    }
    
    if (outerWays.length === 0) {
      return null;
    }
    
    const tolerance = 0.0001;
    
    function pointsMatch(a, b) {
      return Math.abs(a[0] - b[0]) < tolerance && Math.abs(a[1] - b[1]) < tolerance;
    }
    
    function closeRing(coords) {
      if (coords.length < 3) return coords;
      if (!pointsMatch(coords[0], coords[coords.length - 1])) {
        coords.push([coords[0][0], coords[0][1]]);
      }
      return coords;
    }
    
    // Stitch ways into closed rings, checking both head and tail
    function stitchWaysIntoRings(ways) {
      const wayCoordsList = ways.map(w => w.geometry.map(c => [c.lon, c.lat]));
      const used = new Array(wayCoordsList.length).fill(false);
      const rings = [];
      
      while (true) {
        // Find first unused way to start a new chain
        const startIdx = used.indexOf(false);
        if (startIdx === -1) break;
        
        used[startIdx] = true;
        let chain = [...wayCoordsList[startIdx]];
        
        let foundConnection = true;
        while (foundConnection) {
          foundConnection = false;
          const head = chain[0];
          const tail = chain[chain.length - 1];
          
          // Check if ring is already closed
          if (chain.length >= 4 && pointsMatch(head, tail)) break;
          
          for (let i = 0; i < wayCoordsList.length; i++) {
            if (used[i]) continue;
            const wc = wayCoordsList[i];
            const wFirst = wc[0];
            const wLast = wc[wc.length - 1];
            
            if (pointsMatch(tail, wFirst)) {
              chain.push(...wc.slice(1));
            } else if (pointsMatch(tail, wLast)) {
              chain.push(...wc.slice(0, -1).reverse());
            } else if (pointsMatch(head, wLast)) {
              chain.unshift(...wc.slice(0, -1));
            } else if (pointsMatch(head, wFirst)) {
              chain.unshift(...wc.slice(1).reverse());
            } else {
              continue;
            }
            used[i] = true;
            foundConnection = true;
            break; // restart scan from beginning after each connection
          }
        }
        
        if (chain.length >= 3) {
          rings.push(closeRing(chain));
        }
      }
      
      return rings;
    }
    
    // Stitch outer ways into rings (may produce multiple for MultiPolygon)
    const outerRings = stitchWaysIntoRings(outerWays);
    
    if (outerRings.length === 0) {
      return null;
    }
    
    // Stitch inner ways into rings too
    const innerRings = stitchWaysIntoRings(innerWays);
    
    // Helper: check if point is inside a ring (ray casting)
    function pointInRing(point, ring) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        if (((yi > point[1]) !== (yj > point[1])) &&
            (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    }
    
    if (outerRings.length === 1) {
      // Simple polygon — all inner rings are holes in the single outer ring
      return {
        type: 'Polygon',
        coordinates: [outerRings[0], ...innerRings]
      };
    }
    
    // MultiPolygon — assign inner rings to their containing outer ring
    const polygons = outerRings.map(outer => {
      const holes = innerRings.filter(inner => pointInRing(inner[0], outer));
      return [outer, ...holes];
    });
    
    return {
      type: 'MultiPolygon',
      coordinates: polygons
    };
  } else if (osmType === 'way') {
    // For ways, use the geometry directly
    if (mainElement.geometry && mainElement.geometry.length >= 3) {
      const coordinates = mainElement.geometry.map(coord => [coord.lon, coord.lat]);
      // Close the polygon if not already closed
      if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
          coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
        coordinates.push(coordinates[0]);
      }
      
      return {
        type: 'Polygon',
        coordinates: [coordinates]
      };
    }
  }
  // Nodes don't have polygon geometry
  return null;
}

/**
 * Generate location key in format: {COUNTRY}-{REGION}-{CITY}
 * City name has spaces and special chars removed
 */
function generateKey(countryCode, regionCode, cityName) {
  const cleanCityName = cityName.replace(/[^a-zA-Z0-9]/g, '');
  return `${countryCode.toUpperCase()}-${regionCode}-${cleanCityName}`;
}

/**
 * Generate county key in format: {COUNTRY}-{REGION}-{COUNTY}
 */
function generateCountyKey(countryCode, regionCode, countyName) {
  const cleanCountyName = countyName.replace(/[^a-zA-Z0-9]/g, '');
  return `${countryCode.toUpperCase()}-${regionCode}-${cleanCountyName}`;
}

/**
 * Normalize city name for matching (lowercase, remove common suffixes and complex parts)
 */
function normalizeCityName(name) {
  if (!name) return '';
  
  // Remove parenthetical content (e.g., "(balance)", "(city proper)")
  let normalized = name.replace(/\s*\([^)]*\)/g, '');
  
  // Remove complex suffixes and administrative terms
  normalized = normalized
    .toLowerCase()
    .replace(/\s+unified\s+government.*$/i, '')
    .replace(/\s+consolidated\s+government.*$/i, '')
    .replace(/\s+city$/, '')
    .replace(/\s+town$/, '')
    .replace(/\s+township$/, '')
    .replace(/\s+municipality$/, '')
    .replace(/\s+village$/, '')
    .replace(/\s+hamlet$/, '')
    .replace(/\s+borough$/, '')
    .replace(/\s+charter\s+township$/i, '')
    .replace(/\s+county.*$/i, '') // Remove "County" and everything after
    .trim();
  
  // Extract main city name from complex names (e.g., "Athens-Clarke County" -> "Athens")
  const dashParts = normalized.split('-');
  if (dashParts.length > 1) {
    // Take the first part if it looks like a city name
    const firstPart = dashParts[0].trim();
    if (firstPart.length > 2 && !firstPart.includes('county')) {
      normalized = firstPart;
    }
  }
  
  return normalized;
}

/**
 * Extract base city name from complex names (for better matching)
 */
function extractBaseCityName(name) {
  if (!name) return '';
  
  // Remove parenthetical content
  let base = name.replace(/\s*\([^)]*\)/g, '');
  
  // Split by common separators and take the first meaningful part
  const separators = ['-', ',', 'unified', 'consolidated', 'county'];
  for (const sep of separators) {
    const parts = base.split(new RegExp(`\\s*${sep}\\s*`, 'i'));
    if (parts.length > 1) {
      const firstPart = parts[0].trim();
      // If first part looks like a city name (not too short, doesn't contain "county")
      if (firstPart.length > 2 && !firstPart.toLowerCase().includes('county')) {
        base = firstPart;
        break;
      }
    }
  }
  
  return normalizeCityName(base);
}

/**
 * Generate all possible keys for a city name (handles variations)
 */
function generatePossibleKeys(countryCode, regionCode, cityName) {
  const normalized = normalizeCityName(cityName);
  const cleanName = cityName.replace(/[^a-zA-Z0-9]/g, '');
  const cleanNormalized = normalized.replace(/[^a-zA-Z0-9]/g, '');
  
  const keys = [
    generateKey(countryCode, regionCode, cityName), // Original
    generateKey(countryCode, regionCode, normalized), // Normalized
  ];
  
  // Remove duplicates
  return [...new Set(keys)];
}

/**
 * Extract region code from ISO3166-2-lvl4/lvl5/lvl6 (e.g., "US-CA" -> "CA", "BB-07" -> "07")
 */
function extractRegionCode(isoCode) {
  if (!isoCode) return null;
  const parts = isoCode.split('-');
  return parts.length === 2 ? parts[1] : null;
}

/**
 * Extract the best available region ISO code from an address object.
 * Tries lvl3-lvl8 in order (lowest = broadest admin division).
 */
function extractBestRegionCode(address) {
  for (let lvl = 3; lvl <= 8; lvl++) {
    const val = address[`ISO3166-2-lvl${lvl}`];
    if (val) return extractRegionCode(val);
  }
  return null;
}

/**
 * Parse NDJSON file from zip archive
 */
async function parseNdjsonFromZip(zipPath, filename) {
  return new Promise((resolve, reject) => {
    const cities = [];
    
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        if (entry.fileName === filename || entry.fileName.endsWith(`/${filename}`)) {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);
            
            let buffer = '';
            readStream.on('data', (chunk) => {
              buffer += chunk.toString();
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer
              
              for (const line of lines) {
                if (line.trim()) {
                  try {
                    const data = JSON.parse(line);
                    cities.push(data);
                  } catch (e) {
                    // Skip invalid JSON lines
                  }
                }
              }
            });
            
            readStream.on('end', () => {
              // Process remaining buffer
              if (buffer.trim()) {
                try {
                  const data = JSON.parse(buffer);
                  cities.push(data);
                } catch (e) {
                  // Skip invalid JSON
                }
              }
              resolve(cities);
            });
            
            readStream.on('error', reject);
          });
        } else {
          zipfile.readEntry();
        }
      });
      
      zipfile.on('end', () => {
        resolve(cities); // Return empty if file not found
      });
      
      zipfile.on('error', reject);
    });
  });
}

/**
 * Process cities from Geoapify data
 * @param {string} countryCode - Country code (e.g., 'us')
 * @param {number} minPop - Minimum population for NEW cities (existing cities matched regardless)
 * @param {Set} existingCityNames - Set of existing city names+regions to match against (for lower threshold matching)
 */
async function processGeoapifyCountry(countryCode, minPop = 50000, existingCityNames = null) {
  // Data directory: check container path, then ATlas path, then legacy path
  const dataDir = fs.existsSync('/app/data') ? '/app/data' : fs.existsSync('/ATlas/data') ? '/ATlas/data' : '/root/skymap/data';
  const zipPath = path.join(dataDir, `${countryCode}.zip`);
  
  if (!fs.existsSync(zipPath)) {
    console.log(`Zip file not found: ${zipPath}`);
    return { cities: [], regions: new Map() };
  }
  
  console.log(`Processing ${countryCode.toUpperCase()}...`);
  
  // Parse all place types (city, town, village, hamlet) to get all localities
  // Geoapify structure: {country}/place_city.ndjson, {country}/place-town.ndjson, etc.
  // Include "census" type which are CDPs (Census Designated Places)
  const placeTypes = ['place_city', 'place-town', 'place-village', 'place-hamlet'];
  let allEntries = [];
  
  for (const placeType of placeTypes) {
    const possibleFiles = [
      `${countryCode}/${placeType}.ndjson`,
      `${placeType}.ndjson`
    ];
    
    for (const filename of possibleFiles) {
      try {
        const entries = await parseNdjsonFromZip(zipPath, filename);
        if (entries.length > 0) {
          console.log(`Found ${entries.length} entries in ${filename}`);
          allEntries = allEntries.concat(entries);
          break; // Found this type, move to next
        }
      } catch (err) {
        // Try next file
      }
    }
  }
  
  if (allEntries.length === 0) {
    console.log(`No locality data found in ${zipPath}`);
    return { cities: [], regions: new Map() };
  }
  
  console.log(`Total entries from all place types: ${allEntries.length}`);
  const cities = allEntries; // Use all entries, filter by population below
  
  const regionMap = countryRegionMaps[countryCode.toLowerCase()] || null;
  let countryFullName = null; // Will be populated from address.country of first entry
  
  const processedCities = [];
  const regions = new Map();
  
  for (const city of cities) {
    // Filter by population - but include cities that match existing ones even if below threshold
    const population = city.population || 0;
    const type = city.type || '';
    
    // Check if this city matches an existing one (for lower threshold matching)
    let matchesExisting = false;
    if (existingCityNames) {
      const address = city.address || {};
      const regionCode = extractBestRegionCode(address);
      const normalized = normalizeCityName(city.name);
      const lookupKey = `${normalized}|${regionCode}`;
      matchesExisting = existingCityNames.has(lookupKey);
    }
    
    // Process all localities that meet population threshold OR match existing cities
    // "census" type = CDPs (Census Designated Places) - include them
    if (population < minPop && !matchesExisting) {
      continue;
    }
    
    const address = city.address || {};
    const stateName = address.state || address.state_district || address.province || address.county || '';
    const country = address.country_code || countryCode.toLowerCase();
    
    // Capture the proper country name from the data (e.g., "Barbados", "Ísland")
    // Prepend English name if it differs from the local name
    if (!countryFullName && address.country) {
      const localName = address.country;
      const englishName = countryNameOverrides[country.toLowerCase()];
      if (englishName && englishName.toLowerCase() !== localName.toLowerCase()) {
        countryFullName = `${englishName} - ${localName}`;
      } else {
        countryFullName = localName;
      }
    }
    
    // Extract region code - prefer ISO3166-2-lvl4, fallback to lvl5/lvl6, then region map
    let regionCode = extractBestRegionCode(address);
    if (!regionCode && stateName && regionMap) {
      // Fallback: lookup by state name (only if region map exists)
      regionCode = regionMap[stateName] || null;
    }
    
    if (!regionCode || !city.name) {
      continue; // Skip if we can't determine region
    }
    
    // Store region info
    if (!regions.has(regionCode)) {
      // Fallback name: try city name if it's a city-state (e.g. Berlin, Vienna, Tokyo)
      // or use the region code as last resort
      let resolvedStateName = stateName;
      if (!resolvedStateName && city.name) {
        // For city-states and capital districts, the city name IS the region name
        resolvedStateName = city.name;
      }
      regions.set(regionCode, { code: regionCode, name: resolvedStateName || regionCode });
    }
    
    // Extract bounding box
    const bbox = city.bbox || null;
    let bbox_south = null, bbox_west = null, bbox_north = null, bbox_east = null;
    
    if (bbox && Array.isArray(bbox) && bbox.length === 4) {
      // Geoapify bbox format: [west, south, east, north]
      [bbox_west, bbox_south, bbox_east, bbox_north] = bbox;
    }
    
    // Extract location coordinates
    const location = city.location || null;
    let latitude = null, longitude = null;
    if (location && Array.isArray(location) && location.length === 2) {
      [longitude, latitude] = location; // Geoapify format: [lon, lat]
    }
    
    // Extract county information
    const countyName = address.county || null;
    // Remove "County" suffix if present (e.g., "Multnomah County" -> "Multnomah")
    const normalizedCountyName = countyName ? countyName.replace(/\s+County$/i, '').trim() : null;
    
    // Skip entries where the city name matches the county name and population is 0
    // These are likely misclassified counties, not actual cities
    if (normalizedCountyName && city.name === normalizedCountyName && population === 0) {
      continue;
    }
    
    // Extract border/osm_id for polygon fetching
    const border = city.border || null;
    let osmId = null;
    let osmType = null;
    if (border) {
      const borderData = Array.isArray(border) ? border[border.length - 1] : border;
      if (borderData && typeof borderData === 'object') {
        osmId = borderData.osm_id || null;
        osmType = borderData.osm_type || null;
      }
    }
    
    processedCities.push({
      name: city.name,
      normalizedName: normalizeCityName(city.name),
      regionName: stateName,
      regionCode: regionCode,
      countryCode: country.toUpperCase(),
      population: population,
      bbox_south,
      bbox_west,
      bbox_north,
      bbox_east,
      latitude,
      longitude,
      countyName: normalizedCountyName,
      osmId: osmId,
      osmType: osmType,
      key: generateKey(country.toUpperCase(), regionCode, city.name)
    });
  }
  
  console.log(`Processed ${processedCities.length} cities from ${countryCode.toUpperCase()}`);
  return { cities: processedCities, regions, countryFullName };
}

/**
 * Match existing location to new Geoapify city
 */
async function findMatchingLocation(client, city) {
  // Special case: "New York" from Geoapify should ALWAYS match to "New York City" if it exists
  // This must be checked FIRST, before any other matching logic
  if (city.name.toLowerCase() === 'new york' && city.regionCode === 'NY') {
    const nycMatch = await client.query(
      `SELECT id, key, name FROM locations 
       WHERE region_code = $1 
         AND country_code = $2
         AND location_type = 'city'
         AND (LOWER(name) LIKE '%new york city%' OR key ILIKE '%NewYorkCity%')
       LIMIT 1`,
      [city.regionCode, city.countryCode]
    );
    
    if (nycMatch.rows.length > 0) {
      // Also check if there's a duplicate "New York" entry that should be deleted
      const duplicateNy = await client.query(
        `SELECT id, key, name FROM locations 
         WHERE region_code = $1 
           AND country_code = $2
           AND location_type = 'city'
           AND LOWER(name) = 'new york'
           AND key != $3
         LIMIT 1`,
        [city.regionCode, city.countryCode, nycMatch.rows[0].key]
      );
      
      if (duplicateNy.rows.length > 0) {
        return { 
          match: nycMatch.rows[0], 
          method: 'new_york_city', 
          keepName: true,
          duplicateToDelete: duplicateNy.rows[0]
        };
      }
      
      return { match: nycMatch.rows[0], method: 'new_york_city', keepName: true };
    }
  }
  
  // First try exact key match
  // BUT: If this is "New York" and the key matches a duplicate "New York" entry,
  // check if "New York City" exists first and use that instead
  const keyMatch = await client.query(
    'SELECT id, key, name FROM locations WHERE key = $1',
    [city.key]
  );
  
  if (keyMatch.rows.length > 0) {
    // Special safeguard: If we matched to a "New York" entry but "New York City" exists, use that instead
    if (city.name.toLowerCase() === 'new york' && city.regionCode === 'NY' && 
        keyMatch.rows[0].name.toLowerCase() === 'new york' && 
        keyMatch.rows[0].key === 'US-NY-NewYork') {
      const nycCheck = await client.query(
        `SELECT id, key, name FROM locations 
         WHERE region_code = $1 
           AND country_code = $2
           AND location_type = 'city'
           AND (LOWER(name) LIKE '%new york city%' OR key ILIKE '%NewYorkCity%')
         LIMIT 1`,
        [city.regionCode, city.countryCode]
      );
      
      if (nycCheck.rows.length > 0) {
        // Use "New York City" and mark the duplicate for deletion
        return { 
          match: nycCheck.rows[0], 
          method: 'new_york_city', 
          keepName: true,
          duplicateToDelete: keyMatch.rows[0]
        };
      }
    }
    
    return { match: keyMatch.rows[0], method: 'key' };
  }
  
  // Try all possible key variations (handles "municipality", "city", etc.)
  const possibleKeys = generatePossibleKeys(city.countryCode, city.regionCode, city.name);
  for (const possibleKey of possibleKeys) {
    if (possibleKey === city.key) continue; // Already tried
    
    const keyVarMatch = await client.query(
      'SELECT id, key, name FROM locations WHERE key = $1',
      [possibleKey]
    );
    
    if (keyVarMatch.rows.length > 0) {
      return { match: keyVarMatch.rows[0], method: 'key_variation' };
    }
  }
  
  // Try matching by normalized name (strips suffixes), region, and country
  // Exclude states (parent_id IS NULL) to avoid matching states when looking for cities
  const normalizedMatch = await client.query(
    `SELECT id, key, name FROM locations 
     WHERE LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(name, '\\s*\\([^)]*\\)', '', 'g'), '\\s+(city|town|township|municipality|village|hamlet|borough|county.*)$', '', 'i'))) = $1
       AND region_code = $2 
       AND country_code = $3
       AND parent_id IS NOT NULL
     LIMIT 1`,
    [city.normalizedName, city.regionCode, city.countryCode]
  );
  
  if (normalizedMatch.rows.length > 0) {
    return { match: normalizedMatch.rows[0], method: 'normalized_name' };
  }
  
  // Try extracting base city name from complex names (e.g., "Athens-Clarke County" -> "Athens")
  const baseCityName = extractBaseCityName(city.name);
  if (baseCityName !== city.normalizedName) {
    const baseMatch = await client.query(
      `SELECT id, key, name FROM locations 
       WHERE LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(name, '\\s*\\([^)]*\\)', '', 'g'), '\\s+(city|town|township|municipality|village|hamlet|borough|county.*)$', '', 'i'))) = $1
         AND region_code = $2 
         AND country_code = $3
       LIMIT 1`,
      [baseCityName, city.regionCode, city.countryCode]
    );
    
    if (baseMatch.rows.length > 0) {
      return { match: baseMatch.rows[0], method: 'base_city_name' };
    }
  }
  
  // Try matching by name without spaces, region, and country
  const nameNoSpaces = city.name.replace(/\s+/g, '').toLowerCase();
  const nameMatch = await client.query(
    `SELECT id, key, name FROM locations 
     WHERE LOWER(REPLACE(name, ' ', '')) = $1
       AND region_code = $2 
       AND country_code = $3
     LIMIT 1`,
    [nameNoSpaces, city.regionCode, city.countryCode]
  );
  
  if (nameMatch.rows.length > 0) {
    return { match: nameMatch.rows[0], method: 'name_no_spaces' };
  }
  
  // Try fuzzy match: check if normalized names are similar (handles typos/variations)
  // Also check if our complex names contain the Geoapify city name
  const baseCityNameForFuzzy = extractBaseCityName(city.name);
  const searchTerms = [city.normalizedName];
  if (baseCityNameForFuzzy !== city.normalizedName) {
    searchTerms.push(baseCityNameForFuzzy);
  }
  
  for (const searchTerm of searchTerms) {
    const fuzzyMatch = await client.query(
      `SELECT id, key, name FROM locations 
       WHERE region_code = $1 
         AND country_code = $2
         AND (
           LOWER(name) LIKE $3 || '%'
           OR LOWER(name) LIKE '%' || $3 || '%'
           OR LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(name, '\\s*\\([^)]*\\)', '', 'g'), '\\s+(city|town|township|municipality|village|hamlet|borough|county.*)$', '', 'i'))) = $3
           OR LOWER(SPLIT_PART(REGEXP_REPLACE(name, '\\s*\\([^)]*\\)', '', 'g'), '-', 1)) = $3
         )
       LIMIT 1`,
      [city.regionCode, city.countryCode, searchTerm]
    );
    
    if (fuzzyMatch.rows.length > 0) {
      return { match: fuzzyMatch.rows[0], method: 'fuzzy' };
    }
  }
  
  // NOTE: "New York" special case handling is now done at the very beginning of findMatchingLocation
  // This ensures it's checked before any other matching logic that might match to a duplicate "New York" entry
  
  const majorCityMappings = {
    'indianapolis': { region: 'IN', patterns: ['indianapolis (balance)', 'indianapolisbalance', 'indianapolis'] },
    'nashville': { region: 'TN', patterns: ['nashville-davidson', 'nashvilledavidson', 'nashville'] },
    'louisville': { region: 'KY', patterns: ['louisville/jefferson', 'louisvillejefferson', 'louisville'] }
  };
  
  const cityLower = city.name.toLowerCase();
  for (const [geoName, mapping] of Object.entries(majorCityMappings)) {
    if ((cityLower === geoName || cityLower.startsWith(geoName + ' ')) && 
        city.regionCode === mapping.region) {
      for (const pattern of mapping.patterns) {
        const majorCityMatch = await client.query(
          `SELECT id, key, name FROM locations 
           WHERE region_code = $1 
             AND country_code = $2
             AND (
               LOWER(name) LIKE '%' || $3 || '%'
               OR LOWER(REPLACE(REPLACE(name, ' ', ''), '-', '')) LIKE '%' || REPLACE($3, ' ', '') || '%'
             )
           LIMIT 1`,
          [city.regionCode, city.countryCode, pattern]
        );
        
        if (majorCityMatch.rows.length > 0) {
          return { match: majorCityMatch.rows[0], method: 'major_city_mapping' };
        }
      }
    }
  }
  
  // Handle "Saint" vs "St." variations (e.g., "Saint Paul" vs "St. Paul")
  const saintVariations = [
    city.name.toLowerCase().replace(/^saint\s+/i, 'st. '),
    city.name.toLowerCase().replace(/^saint\s+/i, 'st '),
    city.name.toLowerCase().replace(/^st\.\s+/i, 'saint '),
    city.name.toLowerCase().replace(/^st\s+/i, 'saint ')
  ];
  
  for (const saintVar of saintVariations) {
    if (saintVar !== city.name.toLowerCase()) {
      const saintMatch = await client.query(
        `SELECT id, key, name FROM locations 
         WHERE region_code = $1 
           AND country_code = $2
           AND LOWER(name) = $3
         LIMIT 1`,
        [city.regionCode, city.countryCode, saintVar]
      );
      
      if (saintMatch.rows.length > 0) {
        return { match: saintMatch.rows[0], method: 'saint_variation' };
      }
    }
  }
  
  // Handle accented characters (e.g., "Mayagüez" vs "Mayaguez")
  const unaccented = city.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  
  if (unaccented !== city.name.toLowerCase()) {
    const accentMatch = await client.query(
      `SELECT id, key, name FROM locations 
       WHERE region_code = $1 
         AND country_code = $2
         AND LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(name, 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u')) = $3
       LIMIT 1`,
      [city.regionCode, city.countryCode, unaccented]
    );
    
    if (accentMatch.rows.length > 0) {
      return { match: accentMatch.rows[0], method: 'accent_normalization' };
    }
  }
  
  // Last resort: try matching by first word of city name (handles "Bossier City" -> "Bossier")
  const firstWord = city.name.split(/\s+/)[0].toLowerCase();
  if (firstWord.length > 3) {
    const firstWordMatch = await client.query(
      `SELECT id, key, name FROM locations 
       WHERE region_code = $1 
         AND country_code = $2
         AND (
           LOWER(SPLIT_PART(name, ' ', 1)) = $3
           OR LOWER(SPLIT_PART(REGEXP_REPLACE(name, '\\s*\\([^)]*\\)', '', 'g'), '-', 1)) = $3
         )
       LIMIT 1`,
      [city.regionCode, city.countryCode, firstWord]
    );
    
    if (firstWordMatch.rows.length > 0) {
      return { match: firstWordMatch.rows[0], method: 'first_word' };
    }
  }
  
  // Try matching by name similarity (handles cases like "Arlington, VA" when we have "Arlington" in multiple states)
  // Only match if there's exactly one city with that name in that region
  // BUT: Skip if this is "New York" - we want to match to "New York City" instead (handled above)
  if (!(city.name.toLowerCase() === 'new york' && city.regionCode === 'NY')) {
    const exactNameMatch = await client.query(
      `SELECT id, key, name FROM locations 
       WHERE region_code = $1 
         AND country_code = $2
         AND parent_id IS NOT NULL
         AND LOWER(TRIM(REGEXP_REPLACE(name, '\\s*\\([^)]*\\)', '', 'g'))) = LOWER($3)
       LIMIT 1`,
      [city.regionCode, city.countryCode, city.name]
    );
    
    if (exactNameMatch.rows.length > 0) {
      return { match: exactNameMatch.rows[0], method: 'exact_name_region' };
    }
  }
  
  // Handle "Township" suffix (e.g., "Lakewood Township" -> "Lakewood")
  if (city.name.toLowerCase().endsWith(' township')) {
    const nameWithoutTownship = city.name.replace(/\s+township$/i, '').trim();
    const townshipMatch = await client.query(
      `SELECT id, key, name FROM locations 
       WHERE region_code = $1 
         AND country_code = $2
         AND LOWER(TRIM(REGEXP_REPLACE(name, '\\s*\\([^)]*\\)', '', 'g'))) = LOWER($3)
       LIMIT 1`,
      [city.regionCode, city.countryCode, nameWithoutTownship]
    );
    
    if (townshipMatch.rows.length > 0) {
      return { match: townshipMatch.rows[0], method: 'township_suffix' };
    }
  }
  
  // Handle "Village" suffix (e.g., "Arlington Heights village" -> "Arlington Heights")
  if (city.name.toLowerCase().endsWith(' village')) {
    const nameWithoutVillage = city.name.replace(/\s+village$/i, '').trim();
    const villageMatch = await client.query(
      `SELECT id, key, name FROM locations 
       WHERE region_code = $1 
         AND country_code = $2
         AND LOWER(TRIM(REGEXP_REPLACE(name, '\\s*\\([^)]*\\)', '', 'g'))) LIKE LOWER($3 || '%')
       LIMIT 1`,
      [city.regionCode, city.countryCode, nameWithoutVillage]
    );
    
    if (villageMatch.rows.length > 0) {
      return { match: villageMatch.rows[0], method: 'village_suffix' };
    }
  }
  
  return { match: null, method: null };
}

/**
 * Insert or update locations with Geoapify data
 * @param {Array<string>} countries - Country codes to process
 * @param {number} minPop - Minimum population threshold
 * @param {boolean} dryRun - If true, don't actually modify database
 * @param {boolean} deleteUnmatched - If true, delete unmatched cities
 * @param {boolean} fetchPolygons - If true, fetch polygon geometry from OSM API
 * @param {boolean} forceRefreshPolygons - If true, re-fetch polygons even if they already exist
 */
async function insertGeoapifyData(countries = ['us', 'ca'], minPop = 50000, dryRun = false, deleteUnmatched = false, fetchPolygons = false, forceRefreshPolygons = false, regionFilter = null, citySearch = null) {
  const client = await pool.connect();
  
  try {
    if (!dryRun) {
      await client.query('BEGIN');
    }
    
    const stats = {
      matched: 0,
      updated: 0,
      inserted: 0,
      regionsCreated: 0,
      deleted: 0,
      polygonsFetched: 0,
      polygonsSucceeded: 0,
      errors: []
    };
    
    // Track which cities were matched (for deletion of unmatched)
    const matchedLocationIds = new Set();
    
    // Build set of existing city names+regions for lower threshold matching
    const existingCityNames = new Set();
    for (const countryCode of countries) {
      const existingCities = await client.query(
        `SELECT name, region_code FROM locations 
         WHERE country_code = $1 AND parent_id IS NOT NULL`,
        [countryCode.toUpperCase()]
      );
      for (const city of existingCities.rows) {
        const normalized = normalizeCityName(city.name);
        existingCityNames.add(`${normalized}|${city.region_code}`);
      }
    }
    
    // Process each country
    for (const countryCode of countries) {
      let { cities, regions, countryFullName } = await processGeoapifyCountry(countryCode, minPop, existingCityNames);
      
      // Filter by region if specified (e.g., 'OR' for Oregon)
      if (regionFilter) {
        cities = cities.filter(city => city.regionCode === regionFilter.toUpperCase());
        console.log(`Filtered to ${cities.length} cities in region ${regionFilter.toUpperCase()}`);
      }
      
      // Filter by city search if specified
      if (citySearch) {
        const searchLower = citySearch.toLowerCase();
        cities = cities.filter(city => 
          city.name.toLowerCase().includes(searchLower) || 
          normalizeCityName(city.name).toLowerCase().includes(searchLower)
        );
        console.log(`Filtered to ${cities.length} cities matching "${citySearch}"`);
      }
      
      // Create/ensure country exists
      const countryKey = countryCode.toUpperCase();
      const countryName = countryFullName || countryCode.toUpperCase();
      let countryId = null;
      if (!dryRun) {
        const countryResult = await client.query(
          `INSERT INTO locations (key, name, country_code, location_type)
           VALUES ($1, $2, $3, 'country')
           ON CONFLICT (key) DO UPDATE SET location_type = 'country', name = EXCLUDED.name
           RETURNING id`,
          [countryKey, countryName, countryKey]
        );
        countryId = countryResult.rows[0]?.id || (await client.query('SELECT id FROM locations WHERE key = $1', [countryKey])).rows[0]?.id;
      } else {
        console.log(`[DRY RUN] Would create/ensure country: ${countryKey} (${countryName})`);
      }
      
      // Create/ensure states/regions exist
      const stateIds = new Map(); // regionCode -> stateId
      for (const [regionCode, regionInfo] of regions) {
        const regionName = regionInfo.name;
        const regionKey = `${countryCode.toUpperCase()}-${regionCode}`;
        
        if (!dryRun) {
          const regionResult = await client.query(
            `INSERT INTO locations (key, name, region_code, region_name, country_code, parent_id, location_type)
             VALUES ($1, $2, $3, $4, $5, $6, 'state')
             ON CONFLICT (key) DO UPDATE SET location_type = 'state', parent_id = COALESCE(locations.parent_id, $6), name = EXCLUDED.name, region_name = EXCLUDED.region_name
             RETURNING id`,
            [regionKey, regionName, regionCode, regionName, countryCode.toUpperCase(), countryId]
          );
          
          const stateId = regionResult.rows[0]?.id || (await client.query('SELECT id FROM locations WHERE key = $1', [regionKey])).rows[0]?.id;
          stateIds.set(regionCode, stateId);
          
          if (regionResult.rows.length > 0) {
            stats.regionsCreated++;
          }
        }
      }
      
      // Collect unique counties from cities
      const counties = new Map(); // countyKey -> {name, regionCode, stateId}
      for (const city of cities) {
        if (city.countyName) {
          const countyKey = generateCountyKey(city.countryCode, city.regionCode, city.countyName);
          if (!counties.has(countyKey)) {
            const stateId = stateIds.get(city.regionCode) || null;
            counties.set(countyKey, {
              name: city.countyName,
              regionCode: city.regionCode,
              stateId: stateId,
              key: countyKey
            });
          }
        }
      }
      
      // Create/ensure counties exist
      const countyIds = new Map(); // countyKey -> countyId
      if (counties.size > 0) {
        console.log(`Found ${counties.size} unique counties in ${countryCode.toUpperCase()}`);
      }
      for (const [countyKey, county] of counties) {
        if (!dryRun) {
          const countyResult = await client.query(
            `INSERT INTO locations (key, name, region_code, country_code, parent_id, location_type)
             VALUES ($1, $2, $3, $4, $5, 'county')
             ON CONFLICT (key) DO UPDATE SET location_type = 'county', parent_id = COALESCE(locations.parent_id, $5)
             RETURNING id`,
            [countyKey, county.name, county.regionCode, countryCode.toUpperCase(), county.stateId]
          );
          
          const countyId = countyResult.rows[0]?.id || (await client.query('SELECT id FROM locations WHERE key = $1', [countyKey])).rows[0]?.id;
          countyIds.set(countyKey, countyId);
        } else {
          console.log(`[DRY RUN] Would create/ensure county: ${countyKey} (${county.name}, ${county.regionCode})`);
        }
      }
      
      // Process cities
      for (const city of cities) {
        try {
          // AGGRESSIVE FIX: Before ANY matching, if this is "New York", force match to "New York City"
          let match = null;
          let method = null;
          
          if (city.name.toLowerCase() === 'new york' && city.regionCode === 'NY') {
            const forceNycMatch = await client.query(
              `SELECT id, key, name FROM locations 
               WHERE region_code = $1 
                 AND country_code = $2
                 AND location_type = 'city'
                 AND (LOWER(name) LIKE '%new york city%' OR key ILIKE '%NewYorkCity%')
               LIMIT 1`,
              [city.regionCode, city.countryCode]
            );
            
            if (forceNycMatch.rows.length > 0) {
              match = forceNycMatch.rows[0];
              method = 'new_york_city';
              
              // Check for duplicate "New York" entries to delete
              const duplicateNy = await client.query(
                `SELECT id, key, name FROM locations 
                 WHERE region_code = $1 
                   AND country_code = $2
                   AND location_type = 'city'
                   AND LOWER(name) = 'new york'
                   AND key != $3
                 LIMIT 1`,
                [city.regionCode, city.countryCode, match.key]
              );
              
              if (duplicateNy.rows.length > 0) {
                match.duplicateToDelete = duplicateNy.rows[0];
              }
              
              console.log(`[FORCE MATCH] "New York" -> "New York City" (${match.key})`);
            } else {
              // "New York City" doesn't exist, proceed with normal matching
              const matchResult = await findMatchingLocation(client, city);
              match = matchResult.match;
              method = matchResult.method;
            }
          } else {
            // Normal matching for other cities
            const matchResult = await findMatchingLocation(client, city);
            match = matchResult.match;
            method = matchResult.method;
          }
          
          if (match) {
            // CRITICAL SAFEGUARD: If we matched to a duplicate "New York" entry but "New York City" exists,
            // switch to "New York City" instead
            if (city.name.toLowerCase() === 'new york' && city.regionCode === 'NY' && 
                match.name.toLowerCase() === 'new york' && match.key === 'US-NY-NewYork' &&
                method !== 'new_york_city') {
              const nycCheck = await client.query(
                `SELECT id, key, name FROM locations 
                 WHERE region_code = $1 
                   AND country_code = $2
                   AND location_type = 'city'
                   AND (LOWER(name) LIKE '%new york city%' OR key ILIKE '%NewYorkCity%')
                 LIMIT 1`,
                [city.regionCode, city.countryCode]
              );
              
              if (nycCheck.rows.length > 0) {
                console.log(`[CRITICAL] Switching match from duplicate "New York" (${match.key}) to "New York City" (${nycCheck.rows[0].key})`);
                const duplicateToDelete = { id: match.id, key: match.key, name: match.name };
                match = nycCheck.rows[0];
                match.duplicateToDelete = duplicateToDelete;
                method = 'new_york_city';
              }
            }
            
            // ABSOLUTE FINAL CHECK: If this is "New York" and we're about to update, make absolutely sure
            // we're updating "New York City" and not a duplicate "New York"
            if (city.name.toLowerCase() === 'new york' && city.regionCode === 'NY') {
              if (match.key !== 'US-NY-NewYorkCity' && match.name.toLowerCase() !== 'new york city') {
                console.log(`[ABSOLUTE CHECK] Match key is ${match.key}, name is ${match.name} - checking for "New York City"...`);
                const absoluteCheck = await client.query(
                  `SELECT id, key, name FROM locations 
                   WHERE region_code = $1 
                     AND country_code = $2
                     AND location_type = 'city'
                     AND (LOWER(name) LIKE '%new york city%' OR key ILIKE '%NewYorkCity%')
                   LIMIT 1`,
                  [city.regionCode, city.countryCode]
                );
                
                if (absoluteCheck.rows.length > 0) {
                  console.log(`[ABSOLUTE CHECK] FORCING switch to "New York City" (${absoluteCheck.rows[0].key})`);
                  const duplicateToDelete = { id: match.id, key: match.key, name: match.name };
                  match = absoluteCheck.rows[0];
                  match.duplicateToDelete = duplicateToDelete;
                  method = 'new_york_city';
                }
              }
            }
            
            // Update existing location
            stats.matched++;
            matchedLocationIds.add(match.id); // Track matched cities
            
            // Special case: Keep "New York City" name instead of "New York"
            // Also keep the existing key (don't change US-NY-NewYorkCity to US-NY-NewYork)
            // ABSOLUTE ENFORCEMENT: If this is "New York", ALWAYS use "New York City" name and key
            let finalName, finalKey;
            if (city.name.toLowerCase() === 'new york' && city.regionCode === 'NY') {
              // Force "New York City" if we matched to it, otherwise keep existing name
              if (match.key === 'US-NY-NewYorkCity' || match.name.toLowerCase().includes('new york city')) {
                finalName = match.name; // Keep "New York City"
                finalKey = match.key; // Keep "US-NY-NewYorkCity"
              } else {
                // We matched to wrong entry, this shouldn't happen but force correct values
                console.log(`[ERROR] Matched to wrong entry for "New York": ${match.key} (${match.name})`);
                finalName = 'New York City';
                finalKey = 'US-NY-NewYorkCity';
              }
            } else {
              finalName = (method === 'new_york_city' && match.name === 'New York City') 
                ? match.name 
                : city.name;
              finalKey = (method === 'new_york_city' && match.key === 'US-NY-NewYorkCity')
                ? match.key
                : city.key;
            }
            
            if (!dryRun) {
              // Handle duplicate deletion for New York case
              if (match.duplicateToDelete) {
                const duplicateId = match.duplicateToDelete.id;
                // Delete foreign key references first
                await client.query('DELETE FROM hashtag_mappings WHERE location_id = $1', [duplicateId]);
                await client.query('DELETE FROM location_post_stats WHERE location_id = $1', [duplicateId]);
                await client.query('DELETE FROM city_counties WHERE city_id = $1', [duplicateId]);
                await client.query('DELETE FROM user_labels WHERE location_id = $1', [duplicateId]);
                await client.query('DELETE FROM location_lists WHERE location_id = $1', [duplicateId]);
                // Update any child locations to point to state instead
                await client.query(
                  `UPDATE locations SET parent_id = (SELECT id FROM locations WHERE key = $1 AND location_type = 'state')
                   WHERE parent_id = $2`,
                  [`${city.countryCode}-${city.regionCode}`, duplicateId]
                );
                // Delete the duplicate
                await client.query('DELETE FROM locations WHERE id = $1', [duplicateId]);
                console.log(`Deleted duplicate entry: ${match.duplicateToDelete.key} (${match.duplicateToDelete.name})`);
              }
              // Get existing population to check if we should update it
              const existingCity = await client.query(
                'SELECT population FROM locations WHERE id = $1',
                [match.id]
              );
              const existingPop = existingCity.rows[0]?.population || 0;
              
              // Only update population if:
              // 1. New population >= minPop, OR
              // 2. Existing population is already < minPop (don't make it worse, but allow updates to existing low-pop cities)
              // This prevents updating good cities (>= 50k) with bad data (< 50k)
              const shouldUpdatePopulation = city.population >= minPop || existingPop < minPop;
              const finalPopulation = shouldUpdatePopulation ? city.population : existingPop;
              
              // Get state ID for parent_id
              const stateId = stateIds.get(city.regionCode) || null;
              
              // Get county ID if city has a county
              let countyId = null;
              let countyKey = null;
              let countyCodeShort = null; // Short code for county_code column (max 10 chars)
              if (city.countyName) {
                countyKey = generateCountyKey(city.countryCode, city.regionCode, city.countyName);
                countyId = countyIds.get(countyKey) || null;
                // Generate short code (just the county name part, max 10 chars)
                const cleanCountyName = city.countyName.replace(/\s+County$/i, '').replace(/[^a-zA-Z0-9]/g, '');
                countyCodeShort = cleanCountyName.length > 10 ? cleanCountyName.substring(0, 10) : cleanCountyName;
              }
              
              // Fetch polygon geometry if osm_id is available AND fetchPolygons is enabled
              // Only fetch if geometry doesn't already exist (unless forceRefresh is true)
              let geometry = null;
              if (fetchPolygons && city.osmId && city.osmType) {
                // Check if geometry already exists
                const existingGeometry = await client.query(
                  'SELECT geometry FROM locations WHERE id = $1',
                  [match.id]
                );
                const hasGeometry = existingGeometry.rows[0]?.geometry !== null;
                
                if (!hasGeometry || forceRefreshPolygons) {
                  try {
                    // For New York City matching, use "New York City" as the search term for better Nominatim results
                    const searchName = (method === 'new_york_city' && finalName === 'New York City') 
                      ? 'New York City' 
                      : city.name;
                    process.stdout.write(`  Fetching polygon for ${searchName}... `);
                    stats.polygonsFetched++;
                    const osmResult = await fetchPolygonFromOSM(city.osmId, city.osmType, searchName, city.regionName, city.countryCode);
                    if (osmResult) {
                      geometry = osmResult.geometry;
                      if (osmResult.nameEn && osmResult.nameEn.toLowerCase() !== city.name.toLowerCase()) {
                        city.nameEn = osmResult.nameEn;
                      }
                      console.log('✓');
                      stats.polygonsSucceeded++;
                    } else {
                      console.log('⚠ (using bbox fallback)');
                    }
                    await new Promise(resolve => setTimeout(resolve, 1500));
                  } catch (error) {
                    console.log(`⚠ Error: ${error.message}`);
                  }
                } else {
                  // Geometry already exists, keep it
                  geometry = existingGeometry.rows[0].geometry;
                }
              }
              
              // Prepend English name if available and different from local name
              if (city.nameEn && city.name.toLowerCase() !== 'new york') {
                finalName = `${city.nameEn} - ${finalName}`;
              }
              
              // FINAL VERIFICATION: If this is "New York", verify we're updating the correct entry
              if (city.name.toLowerCase() === 'new york' && city.regionCode === 'NY') {
                const verifyMatch = await client.query(
                  'SELECT id, key, name FROM locations WHERE id = $1',
                  [match.id]
                );
                if (verifyMatch.rows.length > 0 && verifyMatch.rows[0].key !== 'US-NY-NewYorkCity') {
                  console.log(`[FINAL VERIFICATION] ERROR: About to UPDATE wrong entry! ID=${match.id}, Key=${verifyMatch.rows[0].key}, Name=${verifyMatch.rows[0].name}`);
                  // Find the correct entry
                  const correctEntry = await client.query(
                    `SELECT id FROM locations WHERE key = 'US-NY-NewYorkCity' AND location_type = 'city' LIMIT 1`
                  );
                  if (correctEntry.rows.length > 0) {
                    console.log(`[FINAL VERIFICATION] Switching to correct entry ID=${correctEntry.rows[0].id}`);
                    match.id = correctEntry.rows[0].id;
                    finalKey = 'US-NY-NewYorkCity';
                    finalName = 'New York City';
                  }
                }
              }
              
              await client.query(
                `UPDATE locations 
                 SET name = $1,
                     population = $2,
                     bbox_south = $3,
                     bbox_west = $4,
                     bbox_north = $5,
                     bbox_east = $6,
                     key = $7,
                     location_type = 'city',
                     parent_id = COALESCE($8, parent_id),
                     county_code = $9,
                     county_name = $10,
                     geometry = CASE WHEN $11::jsonb IS NOT NULL THEN $11::jsonb ELSE geometry END,
                     region_name = COALESCE($12, region_name),
                     region_code = COALESCE($13, region_code),
                     latitude = COALESCE($15, latitude),
                     longitude = COALESCE($16, longitude),
                     osm_id = COALESCE($17, osm_id),
                     osm_type = COALESCE($18, osm_type)
                 WHERE id = $14`,
                [
                  finalName,
                  finalPopulation,
                  city.bbox_south,
                  city.bbox_west,
                  city.bbox_north,
                  city.bbox_east,
                  finalKey,
                  stateId,
                  countyCodeShort,
                  city.countyName,
                  geometry ? JSON.stringify(geometry) : null,
                  city.regionName,
                  city.regionCode,
                  match.id,
                  city.latitude,
                  city.longitude,
                  city.osmId,
                  city.osmType
                ]
              );
              
              // Link city to county via junction table (many-to-many)
              if (countyId) {
                await client.query(
                  `INSERT INTO city_counties (city_id, county_id)
                   VALUES ($1, $2)
                   ON CONFLICT (city_id, county_id) DO NOTHING`,
                  [match.id, countyId]
                );
              }
              
              stats.updated++;
              
              console.log(`Updated: ${match.key} -> ${finalKey} (matched by ${method})`);
            } else {
              console.log(`[DRY RUN] Would update: ${match.key} -> ${finalKey} (matched by ${method})`);
            }
          } else {
            // Before inserting, check if this is "New York" and "New York City" already exists
            // This prevents creating a duplicate "New York" entry
            if (city.name.toLowerCase() === 'new york' && city.regionCode === 'NY') {
              const nycCheck = await client.query(
                `SELECT id, key, name FROM locations 
                 WHERE region_code = $1 
                   AND country_code = $2
                   AND location_type = 'city'
                   AND (LOWER(name) LIKE '%new york city%' OR key ILIKE '%NewYorkCity%')
                 LIMIT 1`,
                [city.regionCode, city.countryCode]
              );
              
              if (nycCheck.rows.length > 0) {
                // "New York City" exists, so update it instead of inserting "New York"
                console.log(`Skipping insert of "New York" - "New York City" already exists (${nycCheck.rows[0].key})`);
                stats.matched++;
                matchedLocationIds.add(nycCheck.rows[0].id);
                // Treat as a match and update the existing "New York City" entry
                const match = nycCheck.rows[0];
                const finalName = match.name; // Keep "New York City"
                const finalKey = match.key; // Keep existing key
                
                // Get existing population
                const existingCity = await client.query(
                  'SELECT population FROM locations WHERE id = $1',
                  [match.id]
                );
                const existingPop = existingCity.rows[0]?.population || 0;
                const shouldUpdatePopulation = city.population >= minPop || existingPop < minPop;
                const finalPopulation = shouldUpdatePopulation ? city.population : existingPop;
                
                // Get state ID for parent_id
                const stateId = stateIds.get(city.regionCode) || null;
                
                // Get county ID if city has a county
                let countyId = null;
                let countyKey = null;
                let countyCodeShort = null;
                if (city.countyName) {
                  countyKey = generateCountyKey(city.countryCode, city.regionCode, city.countyName);
                  countyId = countyIds.get(countyKey) || null;
                  const cleanCountyName = city.countyName.replace(/\s+County$/i, '').replace(/[^a-zA-Z0-9]/g, '');
                  countyCodeShort = cleanCountyName.length > 10 ? cleanCountyName.substring(0, 10) : cleanCountyName;
                }
                
                // Fetch polygon geometry if needed
                let geometry = null;
                if (fetchPolygons && city.osmId && city.osmType) {
                  const existingGeometry = await client.query(
                    'SELECT geometry FROM locations WHERE id = $1',
                    [match.id]
                  );
                  const hasGeometry = existingGeometry.rows[0]?.geometry !== null;
                  
                  if (!hasGeometry || forceRefreshPolygons) {
                    try {
                      // Use "New York City" as the search term for better Nominatim results
                      const searchName = 'New York City';
                      process.stdout.write(`  Fetching polygon for ${searchName}... `);
                      stats.polygonsFetched++;
                      const osmResult = await fetchPolygonFromOSM(city.osmId, city.osmType, searchName, city.regionName, city.countryCode);
                      if (osmResult) {
                        geometry = osmResult.geometry;
                        if (osmResult.nameEn && osmResult.nameEn.toLowerCase() !== city.name.toLowerCase()) {
                          city.nameEn = osmResult.nameEn;
                        }
                        console.log('✓');
                        stats.polygonsSucceeded++;
                      } else {
                        console.log('⚠ (using bbox fallback)');
                      }
                      await new Promise(resolve => setTimeout(resolve, 1500));
                    } catch (error) {
                      console.log(`⚠ Error: ${error.message}`);
                    }
                  } else {
                    geometry = existingGeometry.rows[0].geometry;
                  }
                }
                
                // Update the existing "New York City" entry
                await client.query(
                  `UPDATE locations 
                   SET name = $1,
                       population = $2,
                       bbox_south = $3,
                       bbox_west = $4,
                       bbox_north = $5,
                       bbox_east = $6,
                       key = $7,
                       location_type = 'city',
                       parent_id = COALESCE($8, parent_id),
                       county_code = $9,
                       county_name = $10,
                       geometry = CASE WHEN $11::jsonb IS NOT NULL THEN $11::jsonb ELSE geometry END,
                       region_name = COALESCE($12, region_name),
                       region_code = COALESCE($13, region_code),
                       latitude = COALESCE($15, latitude),
                       longitude = COALESCE($16, longitude),
                       osm_id = COALESCE($17, osm_id),
                       osm_type = COALESCE($18, osm_type)
                   WHERE id = $14`,
                  [
                    finalName,
                    finalPopulation,
                    city.bbox_south,
                    city.bbox_west,
                    city.bbox_north,
                    city.bbox_east,
                    finalKey,
                    stateId,
                    countyCodeShort,
                    city.countyName,
                    geometry ? JSON.stringify(geometry) : null,
                    city.regionName,
                    city.regionCode,
                    match.id,
                    city.latitude,
                    city.longitude,
                    city.osmId,
                    city.osmType
                  ]
                );
                
                // Link city to county via junction table
                if (countyId) {
                  await client.query(
                    `INSERT INTO city_counties (city_id, county_id)
                     VALUES ($1, $2)
                     ON CONFLICT (city_id, county_id) DO NOTHING`,
                    [match.id, countyId]
                  );
                }
                
                stats.updated++;
                console.log(`Updated: ${match.key} -> ${city.key} (New York -> New York City)`);
                continue; // Skip the insert logic below
              }
            }
            
            // Insert new location
            stats.inserted++;
            
            if (!dryRun) {
              // Get parent state ID
              const stateId = stateIds.get(city.regionCode) || null;
              
              // Get county ID if city has a county
              let countyId = null;
              let countyKey = null;
              let countyCodeShort = null; // Short code for county_code column (max 10 chars)
              if (city.countyName) {
                countyKey = generateCountyKey(city.countryCode, city.regionCode, city.countyName);
                countyId = countyIds.get(countyKey) || null;
                // Generate short code (just the county name part, max 10 chars)
                const cleanCountyName = city.countyName.replace(/\s+County$/i, '').replace(/[^a-zA-Z0-9]/g, '');
                countyCodeShort = cleanCountyName.length > 10 ? cleanCountyName.substring(0, 10) : cleanCountyName;
              }
              
              // Fetch polygon geometry if osm_id is available AND fetchPolygons is enabled
              // For new inserts, always try to fetch (no existing geometry to check)
              let geometry = null;
              if (fetchPolygons && city.osmId && city.osmType) {
                try {
                  process.stdout.write(`  Fetching polygon for ${city.name}... `);
                  stats.polygonsFetched++;
                  const osmResult = await fetchPolygonFromOSM(city.osmId, city.osmType, city.name, city.regionName, city.countryCode);
                  if (osmResult) {
                    geometry = osmResult.geometry;
                    if (osmResult.nameEn && osmResult.nameEn.toLowerCase() !== city.name.toLowerCase()) {
                      city.nameEn = osmResult.nameEn;
                    }
                    console.log('✓');
                    stats.polygonsSucceeded++;
                  } else {
                    console.log('⚠ (using bbox fallback)');
                  }
                  await new Promise(resolve => setTimeout(resolve, 1500));
                } catch (error) {
                  console.log(`⚠ Error: ${error.message}`);
                }
              }
              
              // Prepend English name if available for new inserts
              if (city.nameEn) {
                city.name = `${city.nameEn} - ${city.name}`;
              }
              
              // ABSOLUTE FINAL SAFEGUARD: Before inserting, ALWAYS check if this is "New York" 
              // and "New York City" exists - this should NEVER be bypassed
              if (city.name.toLowerCase() === 'new york' && city.regionCode === 'NY') {
                console.log(`[ABSOLUTE SAFEGUARD] Checking for "New York City" before INSERT...`);
                const finalNycCheck = await client.query(
                  `SELECT id, key, name FROM locations 
                   WHERE region_code = $1 
                     AND country_code = $2
                     AND location_type = 'city'
                     AND (LOWER(name) LIKE '%new york city%' OR key ILIKE '%NewYorkCity%')
                   LIMIT 1`,
                  [city.regionCode, city.countryCode]
                );
                
                if (finalNycCheck.rows.length > 0) {
                  console.log(`[ABSOLUTE SAFEGUARD] BLOCKING INSERT of "New York" - "New York City" exists (${finalNycCheck.rows[0].key})`);
                  console.log(`[ABSOLUTE SAFEGUARD] This should NEVER happen - matching logic should have caught this!`);
                  stats.matched++;
                  matchedLocationIds.add(finalNycCheck.rows[0].id);
                  continue; // Skip insert - this is critical!
                } else {
                  console.log(`[ABSOLUTE SAFEGUARD] "New York City" not found, but this is "New York" - something is wrong!`);
                }
              }
              
              // One more check - if the key is "US-NY-NewYork", check for "New York City" by key
              if (city.key === 'US-NY-NewYork') {
                const keyCheck = await client.query(
                  `SELECT id, key, name FROM locations WHERE key = 'US-NY-NewYorkCity' LIMIT 1`
                );
                if (keyCheck.rows.length > 0) {
                  console.log(`[KEY SAFEGUARD] BLOCKING INSERT of key "US-NY-NewYork" - "US-NY-NewYorkCity" exists`);
                  stats.matched++;
                  matchedLocationIds.add(keyCheck.rows[0].id);
                  continue; // Skip insert
                }
              }
              
              const insertResult = await client.query(
                `INSERT INTO locations 
                 (key, name, region_code, region_name, country_code, population, 
                  bbox_south, bbox_west, bbox_north, bbox_east, latitude, longitude, parent_id, location_type, county_code, county_name, geometry, osm_id, osm_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'city', $14, $15, $16, $17, $18)
                 ON CONFLICT (key) DO UPDATE SET
                   name = $2,
                   population = $6,
                   bbox_south = $7,
                   bbox_west = $8,
                   bbox_north = $9,
                   bbox_east = $10,
                   latitude = $11,
                   longitude = $12,
                   location_type = 'city',
                   parent_id = COALESCE(locations.parent_id, $13),
                   county_code = $14,
                   county_name = $15,
                   geometry = CASE WHEN $16 IS NOT NULL THEN $16 ELSE locations.geometry END,
                   region_name = COALESCE($4, locations.region_name),
                   region_code = COALESCE($3, locations.region_code),
                   osm_id = COALESCE($17, locations.osm_id),
                   osm_type = COALESCE($18, locations.osm_type)
                 RETURNING id`,
                [
                  city.key,
                  city.name,
                  city.regionCode,
                  city.regionName,
                  city.countryCode,
                  city.population,
                  city.bbox_south,
                  city.bbox_west,
                  city.bbox_north,
                  city.bbox_east,
                  city.latitude,
                  city.longitude,
                  stateId,
                  countyCodeShort,
                  city.countyName,
                  geometry ? JSON.stringify(geometry) : null,
                  city.osmId,
                  city.osmType
                ]
              );
              
              const cityId = insertResult.rows[0].id;
              
              // Link city to county via junction table (many-to-many)
              if (countyId) {
                await client.query(
                  `INSERT INTO city_counties (city_id, county_id)
                   VALUES ($1, $2)
                   ON CONFLICT (city_id, county_id) DO NOTHING`,
                  [cityId, countyId]
                );
              }
              
              console.log(`Inserted: ${city.key} (${city.name}, ${city.regionCode})`);
            } else {
              console.log(`[DRY RUN] Would insert: ${city.key} (${city.name}, ${city.regionCode})`);
            }
          }
        } catch (err) {
          stats.errors.push({ city: city.key, error: err.message });
          console.error(`Error processing ${city.key}:`, err.message);
        }
      }
    }
    
    // Delete unmatched cities if requested
    if (deleteUnmatched && !dryRun) {
      // Get all cities for the countries we processed
      const countryCodesUpper = countries.map(c => c.toUpperCase());
      const allCities = await client.query(
        `SELECT id, key, name FROM locations 
         WHERE country_code = ANY($1) AND parent_id IS NOT NULL`,
        [countryCodesUpper]
      );
      
      const unmatchedIds = allCities.rows
        .filter(city => !matchedLocationIds.has(city.id))
        .map(city => city.id);
      
      if (unmatchedIds.length > 0) {
        // Check for foreign key constraints before deleting
        const hasUsers = await client.query(
          `SELECT COUNT(*) FROM user_labels WHERE location_id = ANY($1)`,
          [unmatchedIds]
        );
        const hasLists = await client.query(
          `SELECT COUNT(*) FROM location_lists WHERE location_id = ANY($1)`,
          [unmatchedIds]
        );
        const hasBlueskyLists = await client.query(
          `SELECT COUNT(*) FROM bluesky_lists WHERE location_id = ANY($1)`,
          [unmatchedIds]
        );
        
        if (hasUsers.rows[0].count > 0 || hasLists.rows[0].count > 0 || hasBlueskyLists.rows[0].count > 0) {
          console.log(`\n⚠️  WARNING: Cannot delete ${unmatchedIds.length} unmatched cities - they have users/lists mapped to them!`);
          console.log(`   Users: ${hasUsers.rows[0].count}, Lists: ${hasLists.rows[0].count}, Bluesky Lists: ${hasBlueskyLists.rows[0].count}`);
        } else {
          await client.query(
            `DELETE FROM locations WHERE id = ANY($1)`,
            [unmatchedIds]
          );
          stats.deleted = unmatchedIds.length;
          console.log(`\nDeleted ${stats.deleted} unmatched cities`);
        }
      }
    } else if (deleteUnmatched && dryRun) {
      // Show what would be deleted
      const countryCodesUpper = countries.map(c => c.toUpperCase());
      const allCities = await client.query(
        `SELECT id, key, name FROM locations 
         WHERE country_code = ANY($1) AND parent_id IS NOT NULL`,
        [countryCodesUpper]
      );
      
      const unmatched = allCities.rows.filter(city => !matchedLocationIds.has(city.id));
      if (unmatched.length > 0) {
        console.log(`\n[DRY RUN] Would delete ${unmatched.length} unmatched cities:`);
        unmatched.slice(0, 20).forEach(city => {
          console.log(`  - ${city.key} (${city.name})`);
        });
        if (unmatched.length > 20) {
          console.log(`  ... and ${unmatched.length - 20} more`);
        }
      }
    }
    
    if (!dryRun) {
      await client.query('COMMIT');
    }
    
    // Query polygon stats from DB for processed countries
    if (fetchPolygons) {
      const countryCodesUpper = countries.map(c => c.toUpperCase());
      const polyStats = await client.query(
        `SELECT 
           COUNT(*) FILTER (WHERE location_type = 'city') AS total_cities,
           COUNT(*) FILTER (WHERE location_type = 'city' AND geometry IS NOT NULL) AS with_polygon
         FROM locations WHERE country_code = ANY($1)`,
        [countryCodesUpper]
      );
      const total = parseInt(polyStats.rows[0].total_cities);
      const withPoly = parseInt(polyStats.rows[0].with_polygon);
      
      // Detect suspected subdivisions: cities with no geometry whose lat/lon
      // falls inside another city's polygon in the same country
      const noPoly = await client.query(
        `SELECT id, name, region_code, latitude, longitude FROM locations
         WHERE country_code = ANY($1) AND location_type = 'city' AND geometry IS NULL`,
        [countryCodesUpper]
      );
      const withGeom = await client.query(
        `SELECT name, region_code, geometry FROM locations
         WHERE country_code = ANY($1) AND location_type = 'city' AND geometry IS NOT NULL`,
        [countryCodesUpper]
      );
      
      const suspected = [];
      for (const city of noPoly.rows) {
        if (!city.latitude || !city.longitude) continue;
        const pt = [city.longitude, city.latitude];
        for (const other of withGeom.rows) {
          const geom = typeof other.geometry === 'string' ? JSON.parse(other.geometry) : other.geometry;
          if (!geom) continue;
          const rings = geom.type === 'Polygon' ? [geom.coordinates[0]]
            : geom.type === 'MultiPolygon' ? geom.coordinates.map(p => p[0]) : [];
          let inside = false;
          for (const ring of rings) {
            let hit = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
              const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
              if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) hit = !hit;
            }
            if (hit) { inside = true; break; }
          }
          if (inside) {
            suspected.push({ name: city.name, region: city.region_code, parent: other.name });
            break;
          }
        }
      }
      
      const realMissing = noPoly.rows.length - suspected.length;
      console.log('\n=== Polygon Coverage ===');
      console.log(`Cities with boundaries: ${withPoly}/${withPoly + realMissing} (${(withPoly + realMissing) > 0 ? Math.round(withPoly / (withPoly + realMissing) * 100) : 0}%)`);
      console.log(`Fetched this run: ${stats.polygonsSucceeded}/${stats.polygonsFetched} succeeded`);
      if (suspected.length > 0) {
        console.log(`\n⚠ ${suspected.length} suspected subdivision(s) (inside another city's boundary):`);
        for (const s of suspected) {
          console.log(`  - ${s.name} (${s.region}) → inside ${s.parent}`);
        }
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Regions created: ${stats.regionsCreated}`);
    console.log(`Cities matched: ${stats.matched}`);
    console.log(`Cities updated: ${stats.updated}`);
    console.log(`Cities inserted: ${stats.inserted}`);
    if (deleteUnmatched) {
      console.log(`Cities deleted: ${stats.deleted}`);
    }
    console.log(`Errors: ${stats.errors.length}`);
    
    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.forEach(e => console.log(`  ${e.city}: ${e.error}`));
    }
    
    return stats;
  } catch (err) {
    if (!dryRun) {
      await client.query('ROLLBACK');
    }
    console.error('Error inserting Geoapify data:', err);
    throw err;
  } finally {
    client.release();
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const deleteUnmatched = args.includes('--delete-unmatched');
  const countries = args.filter(arg => !arg.startsWith('--') && arg.length === 2);
  const minPop = parseInt(process.env.MIN_POPULATION) || 50000;
  
  const countriesToProcess = countries.length > 0 ? countries : ['us', 'ca'];
  
  console.log(`Processing countries: ${countriesToProcess.join(', ')}`);
  console.log(`Min population: ${minPop}`);
  console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);
  console.log(`Delete unmatched: ${deleteUnmatched ? 'YES' : 'NO'}`);
  console.log('');
  
  const fetchPolygons = args.includes('--fetch-polygons');
  const forceRefreshPolygons = args.includes('--force-refresh-polygons');
  
  insertGeoapifyData(countriesToProcess, minPop, dryRun, deleteUnmatched, fetchPolygons, forceRefreshPolygons)
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { insertGeoapifyData, processGeoapifyCountry, findMatchingLocation };
