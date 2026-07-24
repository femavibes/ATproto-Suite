# Block Lists Custom Node

## Overview
A manageable custom node that allows you to add/remove block lists through the web UI. Each list becomes a toggle in the Graze custom node.

## Files Created/Modified

### Backend
- **nodes/block_lists.py** - Node definition with `manageable: True`
- **data/block_lists/lists.json** - Stores the list configurations
- **web/app.py** - Added API routes:
  - `GET /api/block-lists` - Load lists
  - `POST /api/block-lists` - Save lists

### Frontend
- **web/static/js/block-lists.js** - Manager UI module
- **web/templates/index.html** - Added modal
- **web/static/style.css** - Added styles

## How It Works

1. **Node loads lists** from `data/block_lists/lists.json`
2. **Generates manifest** with one condition per list
3. **Each list** creates a toggle parameter in Graze
4. **Web UI** lets you add/remove lists with:
   - Parameter name (e.g., `MY_LIST`)
   - List URL (Bluesky list URL)
   - Description (shown in Graze)

## Usage

1. Click gear icon on "Block Lists" node
2. Click "Add List" to add a new list
3. Enter:
   - Parameter name (will be uppercased)
   - List URL (full Bluesky list URL)
   - Description (what the list blocks)
4. Click "Save Changes"
5. Push node to Graze
6. Users can toggle each list on/off in Graze

## Default Lists Included

- GREENSKY_LIST (Blacksky anti-blackness)
- TROLLS (Skywatch Blue trolls)
- TERFS (Skywatch Blue TERFs)
- MAGA (Skywatch Blue MAGA)
- ELON_MUSK (Skywatch Blue Elon references)
- NAZI_SYMBOLISM (Skywatch Blue Nazi symbols)
- RMVE_IMVE (Skywatch Blue extremism)
- CASEYHO_LIST (Spam accounts)
- AI_POSTERS (AI content)
- FOLLOW_FARMING (Follow farming)
- AMPLIFIERS (Amplifiers)

## Data Format

```json
{
  "lists": [
    {
      "param_name": "MY_LIST",
      "url": "https://bsky.app/profile/user.bsky.social/lists/abc123",
      "description": "Description of what this list blocks"
    }
  ]
}
```

## Manifest Structure

Each list generates:
```json
{
  "or": [
    {"param_compare": ["$MY_LIST", "==", false]},
    {
      "and": [
        {"param_compare": ["$MY_LIST", "==", true]},
        {"list_member": ["<list_url>", "not_in"]}
      ]
    }
  ]
}
```

This means: "If toggle is off OR (toggle is on AND user not in list)" = show post
