#!/usr/bin/env python3
import requests
import json
import base64
from typing import Optional, Dict, Any

class GrazeClient:
    def __init__(self, session_cookie: Optional[str] = None):
        self.session_cookie = session_cookie
        self.base_url = "https://api.graze.social/app/api/v1"
        self.app_base_url = "https://api.graze.social/app"
        self.headers = {
            "Content-Type": "application/json",
            "Origin": "https://www.graze.social",
            "Referer": "https://www.graze.social/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        if session_cookie:
            self.headers["Cookie"] = f"session_cookie={session_cookie}"
    
    def login(self, handle: str, app_password: str) -> Dict[str, Any]:
        """Login to Graze with Bluesky credentials"""
        response = requests.post(
            f"{self.app_base_url}/login",
            json={"username": handle, "password": app_password},
            headers={
                "Content-Type": "application/json",
                "Origin": "https://www.graze.social",
                "Referer": "https://www.graze.social/login",
                "User-Agent": self.headers["User-Agent"]
            }
        )
        
        if response.status_code == 200:
            cookies = response.cookies
            if "session_cookie" in cookies:
                self.session_cookie = cookies["session_cookie"]
                self.headers["Cookie"] = f"session_cookie={self.session_cookie}"
                return {"success": True, "session_cookie": self.session_cookie}
        
        return {"success": False, "error": f"Login failed: {response.status_code}", "response": response.text}
    
    def get_user_id(self) -> str:
        """Extract user ID from session cookie"""
        if not self.session_cookie:
            raise ValueError("No session cookie available")
        
        parts = self.session_cookie.split('.')
        payload = base64.b64decode(parts[0] + '==').decode('utf-8')
        data = json.loads(payload)
        return data["user_id"]
    
    def create_custom_node(self, title: str, description: str, manifest: Dict[str, Any], 
                          color: str = "purple", public: bool = True) -> Dict[str, Any]:
        """Create a new custom node"""
        payload = {
            "name": title,
            "title": title,
            "description": description,
            "public": public,
            "color": color,
            "component": manifest["filter"],
            "component_metadata": {
                "snapshot": {
                    "document": {
                        "store": {},
                        "schema": {"schemaVersion": 2}
                    }
                }
            },
            "version_message": ""
        }
        
        response = requests.post(
            f"{self.base_url}/algorithm-components/components",
            json=payload,
            headers=self.headers
        )
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✓ Created custom node: {title}")
            print(f"  ID: {data.get('id')}")
            print(f"  URL: https://www.graze.social/custom-nodes/{data.get('id')}")
            return data
        else:
            print(f"✗ Failed to create custom node: {response.status_code}")
            print(f"  Response: {response.text}")
            return {"error": response.text, "status_code": response.status_code}
    
    def update_custom_node(self, component_id: str, title: str, description: str, 
                          manifest: Dict[str, Any], color: str = "purple", 
                          public: bool = True) -> Dict[str, Any]:
        """Update an existing custom node"""
        payload = {
            "id": component_id,
            "name": title,
            "title": title,
            "description": description,
            "public": public,
            "color": color,
            "component": manifest["filter"],
            "component_metadata": {
                "snapshot": {
                    "document": {
                        "store": {},
                        "schema": {"schemaVersion": 2}
                    }
                }
            },
            "version_message": ""
        }
        
        response = requests.put(
            f"{self.base_url}/algorithm-components/components/{component_id}",
            json=payload,
            headers=self.headers
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Updated custom node: {title}")
            print(f"  URL: https://www.graze.social/custom-nodes/{component_id}")
            return data
        else:
            print(f"✗ Failed to update custom node: {response.status_code}")
            print(f"  Response: {response.text}")
            return {"error": response.text, "status_code": response.status_code}
    
    def get_user_components(self) -> Dict[str, Any]:
        """Get all custom nodes created by the user"""
        user_id = self.get_user_id()
        response = requests.get(
            f"{self.base_url}/algorithm-components/users/{user_id}/components",
            headers=self.headers
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": response.text, "status_code": response.status_code}
    
    def push_node_from_file(self, filepath: str, update_id: Optional[str] = None) -> Dict[str, Any]:
        """Push a custom node from a JSON file"""
        with open(filepath, 'r') as f:
            data = json.load(f)
        
        manifest = data.get("manifest", data)
        title = data.get("title", "Untitled Node")
        description = data.get("description", "")
        color = data.get("color", "purple")
        
        if update_id:
            return self.update_custom_node(update_id, title, description, manifest, color)
        else:
            return self.create_custom_node(title, description, manifest, color)


if __name__ == "__main__":
    import sys
    import os
    
    # Example usage
    if len(sys.argv) < 3:
        print("Usage: python graze_client.py <handle> <app_password> [node.json]")
        print("\nExample:")
        print("  python graze_client.py user.bsky.social xxxx-xxxx-xxxx-xxxx my_node.json")
        sys.exit(1)
    
    handle = sys.argv[1]
    app_password = sys.argv[2]
    
    client = GrazeClient()
    
    # Login
    print(f"Logging in as {handle}...")
    result = client.login(handle, app_password)
    
    if not result["success"]:
        print(f"Login failed: {result.get('error')}")
        sys.exit(1)
    
    print("✓ Logged in successfully")
    
    # If node file provided, push it
    if len(sys.argv) > 3:
        node_file = sys.argv[3]
        if os.path.exists(node_file):
            print(f"\nPushing custom node from {node_file}...")
            client.push_node_from_file(node_file)
        else:
            print(f"File not found: {node_file}")
    else:
        print("\nNo node file provided. Use:")
        print(f"  python graze_client.py {handle} <password> node.json")
