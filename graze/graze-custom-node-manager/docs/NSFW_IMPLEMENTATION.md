# NSFW Content Filter Implementation

## Overview
Complete NSFW content filtering system with web-based term management.

## Components Created

### 1. Data Files (`/root/custom-nodes/data/nsfw/`)
All terms, hashtags, and domains organized by category:
- **Sites**: creator_sites.json, xxx_sites.json, shop_sites.json
- **Terms**: general_terms.json, creator_terms.json, gay_terms.json, penis_terms.json, furry_terms.json, fetish_terms.json, cuckold_terms.json, mature_terms.json, bbw_terms.json, curvy_terms.json, racial_terms.json, ai_terms.json, domination_terms.json, anime_gaming_terms.json, ass_terms.json, vagina_terms.json, boobs_terms.json, art_terms.json, misc_terms.json

### 2. Custom Node (`/root/custom-nodes/nodes/nsfw_filter.py`)
- Reads from JSON data files
- Generates filter manifest dynamically
- 22 toggleable categories
- Includes Bluesky label filtering
- Marked as `manageable: True` to show gear icon

### 3. Backend API (`/root/custom-nodes/web/app.py`)
New endpoints:
- `GET /api/nsfw/categories` - List all categories
- `GET /api/nsfw/<category>` - Get terms for category
- `POST /api/nsfw/<category>` - Update terms for category

### 4. Frontend UI
**Gear Icon** - Added to NSFW node card, opens management modal

**Management Modal** (`index.html`):
- Two-column layout: categories list + editor
- Add/remove terms, hashtags, and domains
- Real-time updates
- Save button persists changes to JSON files

**JavaScript** (`app.js`):
- `showNSFWManager()` - Opens modal with categories
- `loadNSFWCategory()` - Loads category data
- `addNSFWTerm()` - Adds new term/hashtag/domain
- `removeNSFWTerm()` - Removes term/hashtag/domain
- `saveNSFWCategory()` - Saves changes to backend

**CSS** (`style.css`):
- Gear button styling with rotation animation
- Category list styling
- Term item styling with remove buttons

## Usage

1. **View Node**: NSFW Content Filter appears in node list with gear icon
2. **Manage Terms**: Click gear icon to open management interface
3. **Edit Categories**: Select category, add/remove terms, save changes
4. **Push Node**: Configure toggles and push to Graze
5. **Update Terms**: Edit terms anytime, repush node to apply changes

## Data Structure

Each category JSON file contains:
```json
{
  "terms": ["term1", "term2"],      // Text search terms
  "hashtags": ["tag1", "tag2"],     // Hashtag filters
  "domains": ["site1.com", "site2.com"]  // Domain filters
}
```

## Key Features

- ✅ All terms from original manifest transferred
- ✅ Web UI for easy management
- ✅ No database needed (JSON files)
- ✅ Real-time updates
- ✅ Per-category organization
- ✅ Supports terms, hashtags, and domains
- ✅ Gear icon on node card
- ✅ Clean, intuitive interface

## Future Enhancements

- Import/export categories
- Bulk operations
- Search within categories
- Category templates
- Standalone `/nsfw-mapper` service (if needed for other apps)
