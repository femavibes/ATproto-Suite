const { Pool } = require('pg');

class FeedGenerator {
  constructor(pool) {
    this.pool = pool;
  }

  async generateAllHashtagsManifest() {
    // Get all cities with hashtags, grouped by country > state > city
    const result = await this.pool.query(`
      SELECT 
        l.id,
        l.name,
        l.region_name,
        l.country_code,
        array_agg(h.hashtag) as hashtags
      FROM locations l
      JOIN hashtag_mappings h ON l.id = h.location_id
      WHERE l.parent_id IS NOT NULL
      GROUP BY l.id, l.name, l.region_name, l.country_code
      ORDER BY l.country_code, l.region_name, l.name
    `);

    if (result.rows.length === 0) {
      throw new Error('No hashtags found in database');
    }

    // Build flat list of city nodes with full path in title
    const cityNodes = result.rows.map(city => {
      const countryName = city.country_code === 'US' ? 'US' : city.country_code === 'CA' ? 'Canada' : city.country_code;
      return {
        metadata: { 
          title: `${countryName} > ${city.region_name} > ${city.name}`
        },
        entity_matches: ["hashtags", city.hashtags]
      };
    });

    return {
      order: "new",
      manifest: {
        filter: {
          or: cityNodes,
          metadata: {}
        }
      }
    };
  }
}

module.exports = FeedGenerator;
