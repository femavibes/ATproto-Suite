# NSFW Custom Node - Continuation Prompt

## System Overview
Web-based NSFW content filtering system at http://192.168.0.184:5000 for Graze.social custom nodes. Multi-user with per-user node tracking.

## Current Implementation Status

### ✅ Completed Features

**42 Categories Organized into 8 Groups:**

1. **Sites (3)**: Creator Sites, General XXX Sites, NSFW Shop Sites
2. **General Content (5)**: General NSFW Terms, Creator Terms, AI Terms, NSFW Art Terms, Misc Terms
3. **Orientation/Identity (5)**: Straight, Gay, Lesbian/WLW, Bisexual, Trans
4. **Kinks & Fetishes (7)**: Domination, Fetish, Cuckold, Interracial, Feet, Latex/Leather/Rubber, Roleplay
5. **Media & Genre (5)**: Anime/Gaming, Hentai, Furry, Cosplay, Softcore/Suggestive
6. **Body Parts (4)**: Boobs, Ass, Vagina, Penis
7. **Body Types & Age (5)**: BBW, Curvy, Mature/GILF, MILF, Young Adult (18+)
8. **Acts & Scenarios (8)**: Oral/Blowjob, Anal, Group/Threesome/Orgy, Solo/Masturbation, Pregnancy/Breeding, Cam/Streaming, Sex Work, Nudity (Non-Sexual)

**Features Implemented:**
- ✅ Block All NSFW toggle (overrides all other toggles)
- ✅ Bluesky NSFW labels blocking
- ✅ Gear icon on node card opens management UI
- ✅ Web UI with tabs for Terms, Hashtags, Domains
- ✅ Search within each tab (filters terms/hashtags/domains)
- ✅ Separate counts displayed: "Category (X terms, Y hashtags, Z domains)"
- ✅ Add/remove terms, hashtags, domains per category
- ✅ Save changes to JSON files
- ✅ All data stored in `/root/custom-nodes/data/nsfw/*.json`
- ✅ Global term lists (shared across all users)
- ✅ Per-user node push tracking

## File Structure

**Node File:**
- `/root/custom-nodes/nodes/nsfw_filter.py` - v2.0.0, loads all 42 categories dynamically

**Data Files (42 total):**
- `/root/custom-nodes/data/nsfw/*.json` - Each contains `{"terms": [], "hashtags": [], "domains": []}`

**Backend:**
- `/root/custom-nodes/web/app.py` - Flask routes including `/api/nsfw/categories`, `/api/nsfw/<category>` (GET/POST)

**Frontend:**
- `/root/custom-nodes/web/templates/index.html` - NSFW manager modal with tabs
- `/root/custom-nodes/web/static/app.js` - `showNSFWManager()`, `loadNSFWCategory()`, `addNSFWTerm()`, `removeNSFWTerm()`, `saveNSFWCategory()`, `updateNSFWSearch()`
- `/root/custom-nodes/web/static/style.css` - Gear button, category items, term items, tab styles

## Key Implementation Details

**Node Structure:**
```python
metadata = {
    "manageable": True  # Shows gear icon
}

def load_category(category):
    # Loads from data/nsfw/{category}.json
    
def get_manifest(options=None):
    # Generates filter with all categories
    # Uses filter_parts for flexible domain/term/hashtag combinations
```

**Filter Logic:**
- Block All: `{"or": [{"param_compare": ["$BLOCK_ALL_NSFW", "==", False]}, {"and": []}]}`
- Per category: Checks domains, terms (regex_none), hashtags (entity_excludes)
- All wrapped in `{"and": filters}` at root level

**UI Flow:**
1. Click gear icon → `showNSFWManager()`
2. Select category → `loadNSFWCategory()` - shows counts, renders items with data-term attributes
3. Switch tabs → `showNSFWTab()` - updates search
4. Search → `updateNSFWSearch()` - filters by data-term attribute
5. Add/remove → Updates currentCategoryData
6. Save → `saveNSFWCategory()` - POSTs to backend

## Planned Features (PLANNED_FEATURES.md)
- Import/Export term lists
- Bulk operations (clear all, batch delete)
- Community term database
- CSV import

## Known Issues / TODO
- ❌ Duplicate detection not yet implemented (should warn when adding term that exists in other categories)
- ❌ Category search removed (was searching category names, not useful)
- ⚠️ Some placeholder terms like "alf" need to be replaced with real terms

## Docker Commands
```bash
cd /root/custom-nodes
docker compose restart  # Apply changes
docker compose logs --tail=50 web  # Check logs
```

## Testing
- Login required to push nodes
- Gear icon only shows on nsfw_filter node
- All 42 categories should load with counts
- Search should filter items in current tab
- Changes persist to JSON files

## Next Steps
Continue improving NSFW filter system - add duplicate detection, populate missing terms, or implement planned features.
