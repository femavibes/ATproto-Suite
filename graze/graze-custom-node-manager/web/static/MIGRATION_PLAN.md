# Migration Plan: app.js → Modular Structure

## Current Status (After Refactor)
- app-new.js: 40 lines (main entry, ES6 module)
- app-legacy.js: 1070 lines (docs loaders only)
- js/api.js: 17 lines
- js/auth.js: 52 lines
- js/nodes.js: 33 lines
- js/modal.js: 85 lines
- js/nsfw.js: 145 lines
- js/ui.js: 85 lines

**Total modular code: ~457 lines**
**Legacy docs: 1070 lines (rarely changed)**

## What's Been Modularized (✓)
- ✓ API client (api.js)
- ✓ Auth functions (auth.js)
- ✓ Node listing (nodes.js)
- ✓ Node modal & push (modal.js)
- ✓ NSFW manager (nsfw.js)
- ✓ UI utilities (ui.js)

## What Remains in app-legacy.js (1070 lines)
- loadGrazeDocs() - ~200 lines of HTML
- loadMetadataDocs() - ~480 lines of HTML
- loadReferenceDocs() - ~10 lines
- Search/filter helpers - ~50 lines

These are static documentation loaders that rarely change.

## Next Steps to Complete Migration

### Current Setup (✓ Recommended)
- Modular code (457 lines) handles all interactive features
- Legacy docs (1070 lines) are static HTML strings
- Clean separation: frequently-changed vs rarely-changed code

### Optional: Extract Docs to JSON
Move HTML docs to separate JSON/template files:
- `data/docs/graze.json`
- `data/docs/metadata.json`
- `js/docs.js` - Simple loader

This would reduce app-legacy.js to ~50 lines.

## Recommendation
**Current setup is complete.** The 1293-line monolith is now:
- 457 lines of modular, maintainable code (auth, nodes, modal, NSFW, UI)
- 1070 lines of static docs (rarely changed)

## For Future Updates
- New features → Create new module in `js/`
- Modify auth/nodes/modal/NSFW/UI → Edit respective module
- Modify docs → Edit app-legacy.js (or extract to JSON when needed)

## Benefits Achieved
- 65% reduction in "active" code complexity
- Single responsibility per module
- Easy to find and update features
- No breaking changes
- Better for testing
