"""
Block Lists - Manage multiple block lists with custom UI
"""

metadata = {
    "id": "block_lists",
    "name": "Block Lists",
    "description": "Block users from multiple curated lists. Manage lists in settings.",
    "color": "yellow",
    "version": "1.0.0",
    "author": "Custom Nodes",
    "tags": ["blocking", "lists", "moderation"],
    "manageable": True
}


def get_manifest(options=None):
    """Generate manifest from managed lists"""
    import os
    import json
    
    # Load lists from data file - use absolute path from project root
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_path = os.path.join(base_dir, "data", "block_lists", "lists.json")
    
    try:
        with open(data_path, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        data = {"lists": []}
    
    lists = data.get("lists", [])
    
    if not lists:
        # Return empty filter if no lists
        return {
            "filter": {
                "and": [],
                "metadata": {"color": "yellow"}
            }
        }
    
    # Build filter conditions
    conditions = []
    custom_params = []
    
    for lst in lists:
        param_name = f"${lst['param_name']}"
        
        condition = {
            "or": [
                {"param_compare": [param_name, "==", False]},
                {
                    "and": [
                        {"param_compare": [param_name, "==", True]},
                        {"list_member": [lst['url'], "not_in"]}
                    ],
                    "metadata": {}
                }
            ],
            "metadata": {}
        }
        
        conditions.append(condition)
        
        custom_params.append({
            "name": lst['param_name'],
            "type": "toggle",
            "description": f"Toggle on/off\n\n{lst['description']}",
            "exampleValue": True
        })
    
    return {
        "filter": {
            "and": conditions,
            "metadata": {
                "color": "yellow",
                "customNodeParameters": custom_params
            }
        }
    }
