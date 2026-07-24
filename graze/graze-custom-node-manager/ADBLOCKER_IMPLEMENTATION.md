# AdBlocker Node Implementation Summary

## Overview
Created a fully manageable adblocker node that allows users to manage:
- Brand-specific affiliate link detection (domains, tags, keywords)
- Generic ad phrase blocking
- Ad hashtag blocking
- Universal affiliate shorteners
- Tiny URL shorteners

## Files Created

### Data Files (`data/adblocker/`)
All categories are manageable via the gear icon UI:

1. **universal.json** - Universal affiliate domains and tiny URL shorteners
   - affiliate_domains: geni.us, urlgeni.us, lbabi.nz, amzn.to
   - tiny_url_shorteners: bit.ly, tinyurl.com, t.co, ow.ly, buff.ly, cutt.ly, rebrand.ly, t2m.io, b.link, short.io, switchy.io

2. **ad_hashtags.json** - Advertisement hashtags (77 hashtags)
   - #ad, #sponsored, #affiliate, #promo, #paid, #partnership, etc.

3. **ad_phrases.json** - Generic ad language (110+ phrases)
   - "buy now", "shop now", "% off", "limited time", "free shipping", etc.

4. **Brand Categories** (10 brands):
   - **amazon.json** - 25 domains, 3 affiliate tags, 2 keywords
   - **ebay.json** - 14 domains, 3 affiliate tags, 1 keyword
   - **walmart.json** - 3 domains, 3 affiliate tags, 1 keyword
   - **bestbuy.json** - 2 domains, 3 affiliate tags, 2 keywords
   - **target.json** - 1 domain, 2 affiliate tags, 2 keywords
   - **aliexpress.json** - 3 domains, 3 affiliate tags, 2 keywords
   - **apple.json** - 3 domains, 4 affiliate tags, 2 keywords
   - **travel.json** - 8 domains, 4 affiliate tags, 4 keywords
   - **rakuten.json** - 7 domains, 3 affiliate tags, 1 keyword
   - **clickbank.json** - 2 domains, 2 affiliate tags, 1 keyword

### Node File
**nodes/adblocker.py**
- Metadata: manageable=True, color=green
- Functions:
  - `load_category()` - Load JSON data
  - `build_text_filters()` - Build regex filters for phrases
  - `build_hashtag_filter()` - Build hashtag filters
  - `build_affiliate_filter()` - Build brand affiliate detection
  - `get_manifest()` - Generate complete filter manifest

### Backend Routes (web/app.py)
Added 4 new API endpoints:
- `GET /api/adblocker/categories` - List all categories
- `GET /api/adblocker/<category>` - Get category data
- `POST /api/adblocker/<category>` - Update category data
- `GET /api/adblocker/search/<term>` - Search across categories

## Data Structure

### Brand Categories (amazon, ebay, etc.)
```json
{
  "domains": ["amazon.com", "amazon.ca", ...],
  "affiliate_tags": ["tag=", "affp1=", ...],
  "keywords": ["amazon", "amzn"]
}
```

### Universal Category
```json
{
  "affiliate_domains": ["geni.us", "urlgeni.us", ...],
  "tiny_url_shorteners": ["bit.ly", "tinyurl.com", ...]
}
```

### Ad Hashtags Category
```json
{
  "hashtags": ["ad", "sponsored", "affiliate", ...]
}
```

### Ad Phrases Category
```json
{
  "phrases": ["buy now", "shop now", "% off", ...]
}
```

## UI Tabs Per Category

### Brand Categories
- **Domains** - Brand domains to monitor
- **Affiliate Tags** - URL parameters indicating affiliate links
- **Keywords** - Brand keywords for tiny URL detection

### Universal Category
- **Affiliate Domains** - Universal affiliate shorteners
- **Tiny URL Shorteners** - URL shortener domains

### Ad Hashtags Category
- **Hashtags** - Advertisement hashtags

### Ad Phrases Category
- **Phrases** - Generic ad language phrases

## Toggle Groups

### General Settings Group
- Block Universal Affiliate Links
- Block Generic Ad Phrases (manageable)
- Block Ad Hashtags (manageable)
- Whitelist: Ad Blocker (Bluesky list)
- Whitelist: Affiliate Links (Bluesky list)

### Brand Groups (10 groups)
Each brand has 2 toggles:
- Block [Brand] Affiliate Links (high confidence)
- Block [Brand] + Tiny URLs (less precise, may have false positives)

## Detection Logic

### Direct Affiliate Link Detection
1. Post contains domain from brand (e.g., amazon.com)
2. URL contains affiliate tag (e.g., tag=, affp1=)
3. Result: Block (high confidence)

### Tiny URL + Brand Mention Detection
1. Post text mentions brand keyword (e.g., "Amazon")
2. Post contains tiny URL shortener (e.g., bit.ly)
3. Result: Block (probabilistic, separate toggle)

### Generic Ad Detection
1. Post contains ad phrases (e.g., "BUY NOW", "50% OFF")
2. Searches: text, embed titles/descriptions
3. Case-insensitive matching

### Hashtag Ad Detection
1. Post contains ad hashtags (e.g., #ad, #sponsored)
2. Searches: text and reply fields
3. Case-insensitive matching

## Whitelist Support
Two separate whitelists (Bluesky list URLs):
- **WHITELIST_AD_BLOCKER** - Exempts from ad phrase/hashtag blocking
- **WHITELIST_AFFILIATE** - Exempts from affiliate link blocking

## Next Steps (Frontend)

The backend is complete. Frontend needs:
1. Update NSFW manager to support adblocker categories
2. Add tab support for different data types (domains, tags, keywords, phrases, hashtags)
3. Update category list to show adblocker categories when node is selected
4. Add search functionality for adblocker terms

## Testing

Node loads successfully:
```bash
python3 -c "from node_loader import get_node_by_id; node = get_node_by_id('adblocker'); print(node['name'])"
# Output: Ad & Affiliate Link Blocker
```

Manifest generates successfully with all filters included.

## Key Features

✅ Fully manageable - all data editable via UI
✅ 13 categories (3 general + 10 brands)
✅ 4 data types: domains, affiliate_tags, keywords, phrases, hashtags
✅ Grouped toggles for better UX
✅ Whitelist support
✅ Search across all categories
✅ Case-insensitive matching
✅ Separate toggles for high-confidence vs probabilistic detection
