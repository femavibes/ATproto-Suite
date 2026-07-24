# SkyMap - Geographic Logic Engine

A Bluesky labeler system that creates verified location-based feeds by bridging Ozone (labeler), Bluesky Lists, and Graze.social custom feeds.

## Architecture Overview

### Core Concept
Instead of native location fields, we use a **Trusted Authority (Labeler)** to verify where users live, then distribute them into location-based feeds via automated list management.

## Data Foundation

### Location Schema
```sql
locations (
  key VARCHAR(100),           -- "US-OR-Portland", "CA-ON-Toronto" 
  name VARCHAR(100),          -- "Portland", "Toronto"
  region_code VARCHAR(10),    -- "OR", "ON" (state/province)
  region_name VARCHAR(50),    -- "Oregon", "Ontario"
  country_code VARCHAR(2),    -- "US", "CA"
  population INTEGER,
  parent_id INTEGER           -- Points to region/state record
)
```

### Label Format
- **Pattern**: `{COUNTRY}-{REGION}-{CITY}`
- **US Examples**: `US-OR-Portland`, `US-CA-LosAngeles`, `US-TX-Houston`
- **Future**: `CA-ON-Toronto`, `UK-EN-London`, `AU-NSW-Sydney`

### Population Threshold
- **Current**: 50,000+ population cities (805 US cities loaded)
- **Configurable**: `MIN_POPULATION` environment variable
- **Expandable**: Different parsers per country

## System Components

### 1. Data Parsers
- **US Parser**: Processes Census Bureau Excel files (`SUB-IP-EST2024-POP.xlsx`)
- **Future Parsers**: `parse-canada.js`, `parse-uk.js`, etc.
- **Generic Schema**: All countries use same `region_code`/`region_name` fields

### 2. Command Bot (Planned)
- **Listens**: Bluesky mentions to labeler account
- **Commands**: 
  - `!set US-OR-Portland` - Apply location label
  - `!remove US-OR-Portland` - Revoke location label
- **Limits**: Max 3 locations per user
- **Redundancy Rule**: City label auto-removes parent state label

### 3. List Manager (Planned)
- **Auto-Sync**: Label applied → User added to corresponding Bluesky List
- **Bucket System**: Max 3,000 members per list
- **Overflow**: Creates `Portland_2`, `Portland_3` when needed
- **Admin Alerts**: Notifies when new lists need Graze.social integration

### 4. Web Directory (Planned)
- **Search Interface**: Users find their city's exact key
- **Format**: `US-OR-Portland` lookup for `!set` commands
- **Filterable**: By state, population, etc.

## Geographic Logic Rules

### Parent-Child Redundancy
```
User has: US-OR (Oregon state label)
User adds: US-OR-Portland (Portland city label)
Result: Oregon label auto-negated, Portland label applied
Reason: City is more granular than state
```

### 3-Location Limit
- Users can have max 3 active location labels
- Prevents spam and keeps feeds focused
- Enforced before applying new labels

## Feed Distribution (Graze.social)

### Custom Node Structure
- **State Hubs**: One node per state (Oregon, California, etc.)
- **City Toggles**: Individual switches per city within state
- **OR Logic**: Toggle "Portland" includes all Portland list buckets

### Dual Feed Sources
1. **Verified Lists**: Posts from labeled users only
2. **Hashtag Mapping**: Organic posts with mapped hashtags
3. **Master Toggle**: Users can disable hashtags, keep verified-only

### Hashtag Mapping Rules
- **Manual Curation**: Hashtags mapped to cities in database
- **Big Fish Rule**: Generic tags go to largest city (`#portland` → Portland, OR)
- **Disambiguation**: Smaller cities get specific tags (`#portlandME`)

## Database Tables

### Core Tables
- `locations` - Geographic hierarchy (countries → regions → cities)
- `user_labels` - Active location labels per user DID
- `location_lists` - Bluesky list URIs per location + bucket management
- `hashtag_mappings` - Manual hashtag → location mappings
- `config` - System settings (population thresholds, etc.)

### Relationships
- Cities have `parent_id` pointing to their state/region
- States have `parent_id` pointing to country (future)
- Lists track `member_count` for bucket overflow logic

## Deployment

### Current Services
- **PostgreSQL**: Port 5435, database `skymap`
- **Data Parser**: Census Excel → PostgreSQL
- **Docker Compose**: Development environment

### Planned Services
- **Command Bot**: Bluesky mention listener
- **List Manager**: Bluesky API integration
- **Web Directory**: Location search interface

## Scalability

### Geographic Expansion
- Add country-specific parsers
- Same database schema works globally
- Label format supports any country code

### List Management
- Automatic bucket creation at 3,000 members
- Admin notifications for Graze.social updates
- Redis caching for high-frequency operations

### Feed Performance
- Bluesky lists perform best under 3,000 members
- Hashtag mapping reduces API calls
- Parent-child logic prevents redundant feeds

## Configuration

### Environment Variables
- `MIN_POPULATION`: City population threshold (default: 50000)
- `DATABASE_URL`: PostgreSQL connection
- `BLUESKY_HANDLE`: Bot account handle
- `BLUESKY_PASSWORD`: Bot app password
- `LABELER_DID`: Ozone labeler DID

### Data Sources
- **US**: Census Bureau SUB-IP Excel files
- **Future**: Country-specific population databases
- **Manual**: Hashtag mappings via admin interface