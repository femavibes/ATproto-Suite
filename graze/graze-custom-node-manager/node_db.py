"""
Simple JSON-based database for tracking pushed nodes
"""
import json
import os
from typing import Optional, Dict, Any

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'pushed_nodes.json')

def load_db() -> Dict[str, Any]:
    """Load the database"""
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_db(data: Dict[str, Any]):
    """Save the database"""
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def get_node_id(node_key: str) -> Optional[str]:
    """Get the Graze component ID for a node"""
    db = load_db()
    return db.get(node_key, {}).get("component_id")

def get_node_data(node_key: str) -> Optional[Dict[str, Any]]:
    """Get all data for a node"""
    db = load_db()
    return db.get(node_key)

def save_node_id(node_key: str, component_id: str, title: str, description: str, config: Optional[Dict[str, Any]] = None, color: Optional[str] = None):
    """Save a node's Graze component ID and configuration"""
    db = load_db()
    db[node_key] = {
        "component_id": component_id,
        "title": title,
        "description": description,
        "color": color,
        "config": config or {},
        "last_pushed": __import__('datetime').datetime.now().isoformat()
    }
    save_db(db)

def get_all_pushed_nodes() -> Dict[str, Any]:
    """Get all pushed nodes"""
    return load_db()

def clear_node(node_key: str):
    """Remove a node from tracking"""
    db = load_db()
    if node_key in db:
        del db[node_key]
        save_db(db)
