# Quick Reference

## Start the System

```bash
cd /root/custom-nodes
./start.sh
```

Or with Docker:
```bash
docker compose up
```

Visit: http://localhost:5000

## Create a New Node

1. Create `/root/custom-nodes/nodes/my_node.py`
2. Copy this template:

```python
metadata = {
    "id": "my_node",
    "name": "My Node Name",
    "description": "What it does",
    "color": "purple",
    "version": "1.0.0",
    "author": "Your Name",
    "tags": ["category"],
    "configurable": {
        "title": {"type": "text", "default": "Title", "required": True},
        "description": {"type": "textarea", "default": "Desc", "required": True}
    }
}

def get_manifest(options=None):
    return {"filter": { /* your logic */ }}
```

3. Refresh browser - node appears automatically!

## Update a Node

1. Edit the node file
2. Increment version number
3. Refresh browser
4. Click node → Push (it will update, not create new)

## File Structure

```
nodes/          ← Add new nodes here
web/            ← Web interface (don't touch unless adding features)
data/           ← Auto-generated tracking data
GRAZE_REFERENCE.md  ← Complete Graze documentation
```

## Common Tasks

**Test a node locally:**
```bash
python3 -c "from nodes.my_node import get_manifest; import json; print(json.dumps(get_manifest(), indent=2))"
```

**List all nodes:**
```bash
python3 -c "from node_loader import get_all_nodes; [print(n['name']) for n in get_all_nodes()]"
```

**Clear tracking (force new push):**
Delete or edit `/root/custom-nodes/data/pushed_nodes.json`

## Tips

- Node IDs must be unique and match filename
- Use semantic versioning (1.0.0, 1.1.0, 2.0.0)
- Test manifests before pushing
- Keep nodes focused on one task
- Document what parameters do

## Next Steps

1. Start the system: `./start.sh`
2. Login with Bluesky credentials
3. Browse the "After Dark" example node
4. Create your first custom node!
5. Check the Documentation tab for Graze reference
