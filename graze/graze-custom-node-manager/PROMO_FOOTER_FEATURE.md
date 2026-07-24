# Promotional Footer Feature - Implementation Summary

## Overview
Added a promotional footer system that automatically appends custom content to every custom node's description when pushed to Graze.

## What Was Implemented

### 1. Backend (web/app.py)
- **GET /api/user/promo-footer** - Retrieves user's promotional footer settings
- **POST /api/user/promo-footer** - Saves promotional footer content and enabled state
- **Modified push_node()** - Automatically appends footer to description when pushing nodes

### 2. Frontend UI (web/templates/index.html)
- **Settings Button** - Added "⚙ Promo Footer" button next to "Available Custom Nodes" heading
- **Promo Footer Modal** - New modal with:
  - Enable/disable checkbox
  - Large textarea for footer content (supports markdown & line breaks)
  - Live preview section
  - Save/Cancel buttons
- **Push Modal Enhancement** - Added "Include promotional footer" checkbox (checked by default)

### 3. JavaScript (web/static/js/promo-footer.js)
- `loadPromoFooter()` - Loads footer on app init
- `showPromoFooterModal()` - Opens settings modal
- `savePromoFooter()` - Saves footer to backend
- `updatePromoFooterPreview()` - Live preview as user types

### 4. Integration (web/static/app.js)
- Imported promo-footer module
- Added modal click-away handler
- Exposed functions globally for onclick handlers

### 5. Data Storage
- Stored in `/data/user_configs/{handle}_config.json`
- Structure:
  ```json
  {
    "gemini_api_key": "...",
    "promotional_footer": "Your footer content here",
    "promotional_footer_enabled": true
  }
  ```

## How It Works

1. **User configures footer:**
   - Clicks "⚙ Promo Footer" button
   - Types promotional content (markdown supported)
   - Sees live preview
   - Saves settings

2. **When pushing a node:**
   - User can override title/description as before
   - Footer is appended AFTER any overrides: `{description}\n\n---\n\n{footer}`
   - User can uncheck "Include promotional footer" to skip for specific nodes
   - Footer is independent of title/desc overrides

3. **Footer format:**
   ```
   [Original Description]
   
   ---
   
   [Promotional Footer]
   ```

## Key Features

✅ Per-user configuration
✅ Supports markdown and line breaks
✅ Live preview in settings modal
✅ Can be disabled globally or per-push
✅ Independent of title/description overrides
✅ Automatically appended to all nodes
✅ Non-destructive (doesn't modify node defaults)

## Usage Example

**Footer content:**
```markdown
Check out my other custom nodes:
- [NSFW Filter](https://graze.social/custom-nodes/1622)
- [Ad Blocker](https://graze.social/custom-nodes/1623)
- [Time Master](https://graze.social/custom-nodes/1624)
```

**Result when pushing any node:**
The node's description will have this footer automatically appended at the bottom.

## Notes

- If Graze has description length limits, the footer may get cut off
- Users need to re-push existing nodes to update their footers
- Footer is only added when "Include promotional footer" is checked during push
- Empty footers are ignored (won't add separator)
