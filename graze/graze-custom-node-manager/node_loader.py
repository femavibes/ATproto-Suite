"""
Node loader - auto-discovers and loads all node modules
"""
import os
import importlib.util
from typing import Dict, Any, List

NODES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'nodes')

def load_node_module(filepath: str):
    """Load a node module from file"""
    spec = importlib.util.spec_from_file_location("node", filepath)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def get_all_nodes() -> List[Dict[str, Any]]:
    """Get all available nodes"""
    nodes = []
    
    if not os.path.exists(NODES_DIR):
        return nodes
    
    for filename in os.listdir(NODES_DIR):
        if filename.endswith('.py') and not filename.startswith('_'):
            filepath = os.path.join(NODES_DIR, filename)
            try:
                module = load_node_module(filepath)
                if hasattr(module, 'metadata') and hasattr(module, 'get_manifest'):
                    node_data = module.metadata.copy()
                    node_data['module'] = module
                    node_data['filename'] = filename
                    nodes.append(node_data)
            except Exception as e:
                print(f"Error loading {filename}: {e}")
    
    return sorted(nodes, key=lambda x: x.get('name', ''))

def get_node_by_id(node_id: str) -> Dict[str, Any]:
    """Get a specific node by ID"""
    nodes = get_all_nodes()
    for node in nodes:
        if node['id'] == node_id:
            return node
    return None
