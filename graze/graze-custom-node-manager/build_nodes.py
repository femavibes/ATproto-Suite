#!/usr/bin/env python3
"""
Simple tool to build and push Graze custom nodes
"""
import json
from graze_client import GrazeClient

def build_time_of_day_node():
    """Build an 'After Dark' time-of-day filter node"""
    manifest = {
        "filter": {
            "or": [
                {
                    "param_compare": ["$ENABLE_TIME_FILTER", "==", False]
                },
                {
                    "or": [
                        {"regex_matches": ["createdAt", "T(22|23):", True]},
                        {"regex_matches": ["createdAt", "T(00|01|02|03):", True]}
                    ],
                    "metadata": {}
                }
            ],
            "metadata": {
                "color": "purple",
                "customNodeParameters": [
                    {
                        "name": "ENABLE_TIME_FILTER",
                        "type": "toggle",
                        "displayName": "Enable After Dark Filter (10pm-4am UTC)",
                        "description": "Toggle to only show posts created between 10pm and 4am UTC. Great for 'after dark' feeds or late-night content.",
                        "exampleValue": True
                    }
                ]
            }
        }
    }
    
    return {
        "title": "After Dark Time Filter",
        "description": "Filter posts by time of day. Currently set for 'After Dark' hours (10pm-4am UTC). Toggle on to enable time filtering.",
        "color": "purple",
        "manifest": manifest
    }

def save_node(node_data, filename):
    """Save node to JSON file"""
    with open(filename, 'w') as f:
        json.dump(node_data, f, indent=2)
    print(f"Saved node to {filename}")

def push_node(client, node_data):
    """Push node to Graze"""
    return client.create_custom_node(
        title=node_data["title"],
        description=node_data["description"],
        manifest=node_data["manifest"],
        color=node_data.get("color", "purple")
    )

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python build_nodes.py save <node_name>     - Save node to file")
        print("  python build_nodes.py push <handle> <app_password> <node_name>  - Push node to Graze")
        print("\nAvailable nodes:")
        print("  - time_of_day")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "save":
        if len(sys.argv) < 3:
            print("Usage: python build_nodes.py save <node_name>")
            sys.exit(1)
        
        node_name = sys.argv[2]
        
        if node_name == "time_of_day":
            node = build_time_of_day_node()
            save_node(node, "time_of_day_node.json")
        else:
            print(f"Unknown node: {node_name}")
    
    elif command == "push":
        if len(sys.argv) < 5:
            print("Usage: python build_nodes.py push <handle> <app_password> <node_name>")
            sys.exit(1)
        
        handle = sys.argv[2]
        app_password = sys.argv[3]
        node_name = sys.argv[4]
        
        # Build node
        if node_name == "time_of_day":
            node = build_time_of_day_node()
        else:
            print(f"Unknown node: {node_name}")
            sys.exit(1)
        
        # Login and push
        client = GrazeClient()
        print(f"Logging in as {handle}...")
        result = client.login(handle, app_password)
        
        if not result["success"]:
            print(f"Login failed: {result.get('error')}")
            sys.exit(1)
        
        print("✓ Logged in successfully\n")
        print(f"Pushing '{node['title']}'...")
        push_node(client, node)
    
    else:
        print(f"Unknown command: {command}")
        print("Use 'save' or 'push'")
