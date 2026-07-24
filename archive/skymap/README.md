# SkyMap - Geographic Logic Engine

A Bluesky labeler system for verified location-based feeds.

## Quick Start

1. Download census data:
   - Go to: https://www.census.gov/data/tables/time-series/demo/popest/2020s-total-cities-and-towns.html
   - Download the CSV file and save as `./data/census-cities.csv`

2. Start services:
   ```bash
   docker-compose up -d
   ```

3. Parse census data:
   ```bash
   docker-compose exec data-parser npm run parse
   ```

## Configuration

- `MIN_POPULATION`: Minimum city population (default: 50000)
- Adjust in docker-compose.yml environment variables

## Database

- PostgreSQL on port 5435
- Database: `skymap`
- User: `dev` / Password: `devpass`

## Architecture

- **Database Schema**: Locations with parent-child relationships
- **Data Parser**: Census CSV → PostgreSQL with configurable population threshold
- **Location Keys**: Format `US-{STATE}-{City}` (e.g., `US-OR-Portland`)

## Next Steps

- Command bot for Bluesky mentions
- List management service
- Web directory for location lookup