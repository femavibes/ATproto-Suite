# JavaScript Module Structure

## Overview
The app has been refactored into modular ES6 modules for better maintainability.

## Structure

```
web/static/
├── app-new.js          # Main entry (40 lines)
├── app-legacy.js       # Docs loaders (1070 lines)
└── js/
    ├── api.js          # API client (17 lines)
    ├── auth.js         # Login/logout (52 lines)
    ├── nodes.js        # Node listing (33 lines)
    ├── modal.js        # Node modal (85 lines)
    ├── nsfw.js         # NSFW manager (145 lines)
    └── ui.js           # UI utilities (85 lines)
```

## Modules

### api.js
- `api.get(url)` - GET requests
- `api.post(url, data)` - POST requests

### auth.js
- `checkSession()` - Check login status
- `login(event)` - Handle login
- `logout()` - Handle logout
- `showLoginModal()` - Show login modal
- `closeModal()` - Close login modal

### nodes.js
- `loadNodes()` - Load and render node grid

### modal.js
- `showNodeDetail(nodeId)` - Show node detail modal
- `pushNode()` - Push node to Graze
- `closeNodeModal()` - Close node modal

### nsfw.js
- `showNSFWManager()` - Show NSFW manager modal
- `loadNSFWCategory(id, name, desc)` - Load category data
- `addNSFWTerm(type)` - Add term/hashtag/domain
- `removeNSFWTerm(type, index)` - Remove item
- `saveNSFWCategory()` - Save changes
- `showNSFWTab(tabName)` - Switch tabs
- `showBulkAdd(type)` - Show bulk add modal
- `processBulkAdd()` - Process bulk input

### ui.js
- `toggleComponentIdOverride()` - Toggle ID override
- `updateResetButtons()` - Show/hide reset buttons
- `resetTitle()` - Reset title to default
- `resetDescription()` - Reset description to default
- `renderConfigOptions(node)` - Render config inputs
- `showTab(tabName)` - Switch main tabs
- `filterCards(term, id)` - Filter doc cards
- `searchContent(term, id, type)` - Search docs

## Adding New Features

1. Create new module in `js/` directory
2. Export functions from module
3. Import in `app-new.js`
4. Expose to window if needed for onclick handlers

Example:
```javascript
// js/newfeature.js
export function myFunction() { ... }

// app-new.js
import { myFunction } from './js/newfeature.js';
window.myFunction = myFunction;
```
