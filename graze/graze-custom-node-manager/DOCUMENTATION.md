# Custom Node Manager Documentation

## Overview
The Custom Node Manager is a web interface for creating, configuring, and deploying custom filter nodes to Graze (graze.social). It provides a visual interface for managing complex filtering logic without writing JSON manually.

## Getting Started

### Login
1. Click "Login" in the top right
2. Enter your Bluesky handle (e.g., `user.bsky.social`)
3. Enter your Bluesky app password (not your main password!)
4. You can generate an app password at: https://bsky.app/settings/app-passwords

### Basic Workflow
1. Browse available custom nodes on the main page
2. Click a node card to configure it
3. Customize the title and description
4. Push to Graze to deploy
5. View your deployed node on Graze

## Node Types

### Standard Nodes
Most nodes work out of the box with no special configuration:
- **Master Term Search** - Search for terms across all post fields
- **After Dark** - Time-based filtering
- **Video Options** - Video-specific filters
- **Options** - General filtering options

### Nodes with Bespoke Settings (Gear Icon ⚙)

When a node has a gear icon, it means it has special configuration beyond title/description.

#### Manageable Nodes
**What:** Nodes that manage large datasets (terms, hashtags, domains)
**Example:** NSFW Content Filter
**Icon:** ⚙ Manage Terms

**When to use:**
- You need to manage hundreds or thousands of items
- Items are organized into categories
- You need bulk add/remove functionality
- Data is stored in JSON files

**Technical Implementation:**
- **Backend**: Set `"manageable": True` in node metadata
- **Data Storage**: JSON files in `data/nsfw/` (or similar)
- **API Routes**: 
  - `GET /api/nsfw/categories` - List all categories
  - `GET /api/nsfw/<category>` - Load category data
  - `POST /api/nsfw/<category>` - Save category data
  - `GET /api/nsfw/search/<term>` - Search across categories
- **Frontend**: 
  - Modal: `#nsfw-manager-modal` in `index.html`
  - Module: `web/static/js/nsfw.js`
  - Entry: `showNSFWManager()` function
  - Gear icon check: `node.manageable` in `nodes.js`
- **Data Format**: `{"terms": [], "hashtags": [], "domains": []}`
- **Files to modify**:
  - Add node: `nodes/your_node.py` with `"manageable": True`
  - Add categories: Backend route in `web/app.py`
  - Add data: JSON files in `data/your_category/`

**Features:**
- Category-based organization
- Search across all categories
- Filter categories by name
- Per-category tabs (Terms, Hashtags, Domains)
- Bulk add (paste lists in any format)
- Item counts per category
- Auto-save to JSON files

**How to use:**
1. Click the gear icon on the node card
2. Select a category from the left panel
3. Switch between Terms/Hashtags/Domains tabs
4. Add items individually or use "Bulk Add"
5. Click "Save Changes" when done

#### Configurable Nodes
**What:** Nodes with simple numeric or text settings
**Example:** Any X of These (num_terms setting)
**Icon:** ⚙ Configure Node

**When to use:**
- Node behavior needs customization
- Settings affect manifest generation
- Simple inputs (numbers, text)

**Technical Implementation:**
- **Backend**: Add `"configurable": {...}` dict in node metadata
- **Data Storage**: Saved in `data/pushed_nodes.json` per user
- **API Routes**:
  - `GET /api/nodes/<id>` - Returns `saved_config` field
  - `POST /api/nodes/<id>/config` - Saves config to DB
  - `POST /api/nodes/<id>/push` - Passes config to `get_manifest(options)`
- **Frontend**:
  - Modal: `#node-config-modal` in `index.html`
  - Module: `web/static/js/node-config.js`
  - Entry: `showNodeSettings(nodeId)` → `showConfigModal(node)`
  - Gear icon check: `node.configurable` (excluding title/desc) in `nodes.js`
- **Config Format**: `{"key": {"type": "number", "default": 10, "min": 5, "max": 50, "description": "..."}}`
- **Files to modify**:
  - Add config: `nodes/your_node.py` metadata `"configurable": {...}`
  - Use config: `get_manifest(options)` function reads `options['key']`
  - Save logic: Already handled by `web/app.py` `/api/nodes/<id>/config`

**Features:**
- Form-based configuration
- Min/max validation for numbers
- Saved per-user
- Applied when pushing to Graze

**How to use:**
1. Click the gear icon on the node card
2. Adjust the settings in the form
3. Click "Save Configuration"
4. Settings are applied when you push the node

#### Nodes with Both (Future)
If a node has both manageable data AND configurable options, the gear icon opens a tabbed modal:
- **Manage Terms** tab - For managing datasets
- **Configuration** tab - For settings

**Technical Implementation:**
- **Backend**: Set both `"manageable": True` AND `"configurable": {...}`
- **Frontend**:
  - Modal: `#unified-settings-modal` in `index.html`
  - Module: `web/static/js/node-config.js`
  - Entry: `showNodeSettings(nodeId)` → `showTabbedModal(node)`
  - Logic: Checks `hasManageable && hasConfigurable` in `showNodeSettings()`
- **Tabs**: Dynamically generated, "Manage Terms" first, then "Configuration"
- **Files to modify**:
  - Node: Set both flags in metadata
  - NSFW content: Embed in `#manage-tab` (currently placeholder)
  - Config form: Rendered in `#config-tab`

## Creating Custom Nodes

### Node Metadata
Every node needs these fields in its Python file:
```python
metadata = {
    "id": "my_node",
    "name": "My Custom Node",
    "description": "What this node does",
    "color": "blue",  # blue, green, yellow, red, purple
    "version": "1.0.0",
    "author": "Your Name",
    "tags": ["tag1", "tag2"],
    "configurable": {},  # Optional: for simple settings
    "manageable": False  # Optional: for complex data management
}
```

### Adding Configurable Options
For simple settings that affect manifest generation:
```python
"configurable": {
    "num_items": {
        "type": "number",
        "default": 10,
        "min": 5,
        "max": 50,
        "description": "Number of items to generate"
    }
}
```

Then use in `get_manifest(options=None)`:
```python
def get_manifest(options=None):
    num_items = 10
    if options and 'num_items' in options:
        num_items = int(options['num_items'])
    # Use num_items in your manifest...
```

### Adding Manageable Data
For complex data management (like NSFW filter):
```python
"manageable": True
```

Then create JSON files in `data/[category_name]/`:
```json
{
  "terms": ["term1", "term2"],
  "hashtags": ["tag1", "tag2"],
  "domains": ["example.com"]
}
```

Load in your node:
```python
def load_category(category):
    data_path = os.path.join(os.path.dirname(__file__), "data", category + ".json")
    with open(data_path, "r") as f:
        return json.load(f)
```

## Best Practices

### Node Design
- **Keep it simple** - One clear purpose per node
- **Good descriptions** - Users should understand what it does immediately
- **Sensible defaults** - Node should work without configuration
- **Clear naming** - Use descriptive names for settings

### Configurable vs Manageable
**Use Configurable when:**
- 1-5 simple settings
- Numeric thresholds or text inputs
- Settings rarely change
- Example: "Match threshold: 3"

**Use Manageable when:**
- 100+ items to manage
- Organized into categories
- Frequent additions/removals
- Example: NSFW term lists

**Use Both when:**
- Complex data management + behavior settings
- Example: NSFW filter with sensitivity threshold

### Title & Description
- **Title**: Short, clear, action-oriented
  - Good: "Block NSFW Content"
  - Bad: "NSFW Content Filter Node v2.0"
- **Description**: One sentence explaining what it does
  - Good: "Block NSFW content by category. Configure categories and terms in settings."
  - Bad: "This node filters posts..."

### Testing
1. Test with default settings first
2. Push to Graze and verify it works
3. Test edge cases (empty lists, max values)
4. Update version number when changing behavior

## Troubleshooting

### Node Not Showing
- Check `nodes/` directory
- Verify `metadata` dict exists
- Check for Python syntax errors
- Restart the Flask app

### Gear Icon Not Showing
- Verify `manageable: True` or `configurable: {...}` in metadata
- Check that configurable options aren't just title/description
- Refresh the page

### Push Fails
- Verify you're logged in
- Check manifest is valid JSON
- Look for errors in browser console
- Check Flask logs

### Settings Not Saving
- Ensure you're logged in
- Click "Save" before closing modal
- Check browser console for errors

## Advanced Features

### Component ID Override
When pushing a node, you can link it to an existing Graze node:
1. Check "Link to existing Graze node"
2. Enter the component ID (e.g., 1615)
3. Push - it will update instead of creating new

### Custom Title/Description
Each node can have custom title/description per deployment:
- Defaults to node's metadata
- Can be customized before pushing
- Reset button restores defaults
- Saved per-user

### Bulk Add Formats
The NSFW manager accepts multiple formats:
- **One per line**: `term1\nterm2\nterm3`
- **Comma-separated**: `term1, term2, term3`
- **JSON array**: `["term1", "term2", "term3"]`

## File Structure
```
custom-nodes/
├── nodes/              # Node definitions (.py files)
│   ├── nsfw_filter.py  # Example: manageable node
│   ├── any_x_of_these.py # Example: configurable node
│   └── master_term_search.py # Example: standard node
├── data/               # Manageable data (JSON files)
│   ├── nsfw/          # NSFW categories
│   │   ├── general_terms.json
│   │   └── creator_sites.json
│   └── pushed_nodes.json # Saved configs per user
├── web/
│   ├── app.py         # Flask backend (API routes)
│   ├── static/
│   │   ├── app.js     # Main entry point
│   │   ├── js/        # Modular JavaScript
│   │   │   ├── api.js        # Fetch wrapper
│   │   │   ├── auth.js       # Login/logout
│   │   │   ├── nodes.js      # Node grid + gear icon logic
│   │   │   ├── modal.js      # Node detail modal
│   │   │   ├── nsfw.js       # NSFW manager (manageable)
│   │   │   ├── node-config.js # Config modal (configurable + unified)
│   │   │   └── ui.js         # UI utilities
│   │   └── docs/      # Static documentation HTML
│   └── templates/
│       └── index.html # Main page (all modals defined here)
├── node_loader.py     # Loads nodes from nodes/ directory
├── node_db.py         # Database for pushed nodes + configs
└── docs/              # Additional documentation
```

## Technical Flow

### Gear Icon Display Logic
**File**: `web/static/js/nodes.js` in `loadNodes()`
```javascript
if (node.manageable) {
    gearIcon = `<button onclick="showNodeSettings('${node.id}')">⚙</button>`;
} else if (node.configurable && Object.keys(node.configurable).some(k => k !== 'title' && k !== 'description')) {
    gearIcon = `<button onclick="showNodeSettings('${node.id}')">⚙</button>`;
}
```

### Settings Modal Routing
**File**: `web/static/js/node-config.js` in `showNodeSettings()`
```javascript
const hasManageable = node.manageable;
const hasConfigurable = node.configurable && Object.keys(node.configurable).some(k => k !== 'title' && k !== 'description');

if (hasManageable && hasConfigurable) {
    showTabbedModal(node);  // #unified-settings-modal
} else if (hasManageable) {
    showNSFWManager();      // #nsfw-manager-modal
} else if (hasConfigurable) {
    showConfigModal(node);  // #node-config-modal
}
```

### Backend Node Loading
**File**: `web/app.py` in `get_node(node_id)`
```python
result = {
    'id': node['id'],
    'name': node['name'],
    'configurable': node.get('configurable', {}),
    'manageable': node.get('manageable', False),
    'saved_config': node_data.get('config', {}) if node_data else {}
}
```

### Config Save Flow
1. User clicks "Save Configuration" in modal
2. `saveNodeConfig()` in `node-config.js` collects form data
3. `POST /api/nodes/<id>/config` saves to `data/pushed_nodes.json`
4. When pushing, `POST /api/nodes/<id>/push` passes config to `get_manifest(options)`

## API Endpoints

### Nodes
- `GET /api/nodes` - List all nodes
- `GET /api/nodes/<id>` - Get node details
- `POST /api/nodes/<id>/push` - Push to Graze
- `POST /api/nodes/<id>/config` - Save configuration

### NSFW
- `GET /api/nsfw/categories` - List categories
- `GET /api/nsfw/<category>` - Get category data
- `POST /api/nsfw/<category>` - Update category
- `GET /api/nsfw/search/<term>` - Search for term

### Auth
- `POST /api/login` - Login with Bluesky
- `POST /api/logout` - Logout
- `GET /api/session` - Check session

## Contributing

### Adding a New Node
1. Create `nodes/my_node.py`
2. Define `metadata` dict
3. Implement `get_manifest(options=None)`
4. Test locally
5. Push to Graze
6. Commit to repo

### Modifying the UI
- JavaScript is modular in `web/static/js/`
- Each module has single responsibility
- See `web/static/JS_MODULES.md` for structure

### Adding Documentation
- User docs: This file
- Developer docs: `web/static/JS_MODULES.md`
- API docs: Inline in `web/app.py`
