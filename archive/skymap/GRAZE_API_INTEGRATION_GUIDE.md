# Graze API Integration Guide

## Overview
This guide explains how to authenticate with Graze.social and push custom nodes (algorithm components) to their platform. Graze is a social media platform that allows users to create custom feed algorithms.

## Authentication

### Login Endpoint
**URL:** `https://api.graze.social/app/login`  
**Method:** POST  
**Content-Type:** application/json

### Login Request
```javascript
{
  "username": "your-bluesky-handle",
  "password": "your-bluesky-app-password"
}
```

### Required Headers
```javascript
{
  'Content-Type': 'application/json',
  'Origin': 'https://www.graze.social',
  'Referer': 'https://www.graze.social/login',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}
```

### Login Response
The session cookie is returned in the `Set-Cookie` header:
```
Set-Cookie: session_cookie=<token>; Path=/; HttpOnly
```

Extract the `session_cookie` value from the response headers. This token is used for all subsequent API calls.

### Session Cookie Format
The session cookie is a base64-encoded JWT-like token containing:
```javascript
{
  "session_token": "...",
  "user_id": 123,
  "is_oauth": true
}
```

## Custom Nodes API

### Base URL
`https://api.graze.social/app/api/v1`

### Create Custom Node
**Endpoint:** `POST /algorithm-components/components`

**Headers:**
```javascript
{
  'Content-Type': 'application/json',
  'Cookie': `session_cookie=${sessionCookie}`,
  'Origin': 'https://www.graze.social',
  'Referer': 'https://www.graze.social/'
}
```

**Request Body:**
```javascript
{
  "name": "Node Name",
  "title": "Node Title",
  "description": "Node description",
  "public": true,
  "color": "purple",
  "component": {
    // Filter manifest (see below)
  },
  "component_metadata": {
    "snapshot": {
      "document": {
        "store": {},
        "schema": {
          "schemaVersion": 2
        }
      }
    }
  },
  "version_message": ""
}
```

**Response:**
```javascript
{
  "id": 1234,  // Component ID
  "name": "Node Name",
  // ... other fields
}
```

### Update Custom Node
**Endpoint:** `PUT /algorithm-components/components/{componentId}`

Same request body as create, but include the `id` field:
```javascript
{
  "id": 1234,
  "name": "Updated Node Name",
  // ... rest of fields
}
```

### Get User Components
**Endpoint:** `GET /algorithm-components/users/{userId}/components`

Returns all custom nodes created by a user.

## Filter Manifest Structure

The `component` field contains the filter logic for the custom node. Here are common patterns:

### List Member Filter
Filter posts from users in specific lists:
```javascript
{
  "or": [
    {
      "list_member": ["at://did:web:lists.example.com/app.bsky.graph.list/list1", "in"]
    },
    {
      "list_member": ["at://did:web:lists.example.com/app.bsky.graph.list/list2", "in"]
    }
  ]
}
```

### Hashtag Filter
Filter posts containing specific hashtags:
```javascript
{
  "or": [
    {
      "entity_matches": ["hashtags", ["hashtag1", "hashtag2"]]
    }
  ]
}
```

### Custom Node with Parameters
Create toggleable filters with custom parameters:
```javascript
{
  "or": [
    {
      "and": [
        {
          "custom_node_parameter": ["PARAM_NAME", "==", true]
        },
        {
          "list_member": ["at://...", "in"]
        }
      ]
    }
  ],
  "metadata": {
    "color": "purple",
    "customNodeParameters": [
      {
        "name": "PARAM_NAME",
        "type": "toggle",
        "displayName": "Display Name",
        "exampleValue": false,
        "description": "Parameter description"
      }
    ],
    "customNodeParameterGroups": [
      {
        "name": "Group Name",
        "id": "group-id"
      }
    ]
  }
}
```

## Feed Creation API

### Base URL
`https://api.graze.social/app`

### Create Feed
**Endpoint:** `POST /add_algo_image`  
**Content-Type:** multipart/form-data

**Form Fields:**
```javascript
{
  "display_name": "Feed Name",
  "description": "Feed description",
  "sticky_type": "new",  // or "hot", "top"
  "algorithm_manifest": JSON.stringify(manifest),
  "metadata": JSON.stringify(metadata),
  "order": "new",
  "active": "true",
  "public": "true",
  "status": "published",
  "user_id": userId
}
```

### Update Feed
**Endpoint:** `POST /edit_algo_image`

Same as create, but include:
```javascript
{
  "id": feedId,
  "user_id": userId,
  // ... other fields
}
```

### Publish Feed
**Endpoint:** `GET /publish_algo/${feedId}`

Makes the feed publicly visible.

### Get Feed
**Endpoint:** `GET /publish_algo/${feedId}`

Returns feed details.

### Get Feed Content
**Endpoint:** `GET /my_feeds/${feedId}/content?limit=20&cursor=${cursor}`

Returns posts in the feed.

## Getting User ID

The user ID is embedded in the session cookie. Decode the base64 payload:

```javascript
function getUserId(sessionCookie) {
  const parts = sessionCookie.split('.');
  const payload = Buffer.from(parts[0], 'base64').toString('utf8');
  const data = JSON.parse(payload);
  return data.user_id;
}
```

## Complete Example

```javascript
const axios = require('axios');

class GrazeClient {
  constructor(sessionCookie = null) {
    this.sessionCookie = sessionCookie;
    this.baseURL = 'https://api.graze.social/app/api/v1';
    this.appBaseURL = 'https://api.graze.social/app';
    this.headers = {
      'Content-Type': 'application/json',
      'Origin': 'https://www.graze.social',
      'Referer': 'https://www.graze.social/'
    };
    
    if (sessionCookie) {
      this.headers['Cookie'] = `session_cookie=${sessionCookie}`;
    }
  }

  async login(username, password) {
    const response = await axios.post('https://api.graze.social/app/login', {
      username: username,
      password: password
    }, { 
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.graze.social',
        'Referer': 'https://www.graze.social/login',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      const sessionCookie = cookies.find(cookie => cookie.startsWith('session_cookie='));
      if (sessionCookie) {
        this.sessionCookie = sessionCookie.split(';')[0].replace('session_cookie=', '');
        this.headers['Cookie'] = `session_cookie=${this.sessionCookie}`;
        return { success: true, sessionCookie: this.sessionCookie };
      }
    }
    
    return { success: false, error: 'No authentication token received' };
  }

  async createCustomNode(title, description, manifest) {
    const payload = {
      name: title,
      title: title,
      description: description,
      public: true,
      color: "purple",
      component: manifest.filter,
      component_metadata: {
        snapshot: {
          document: {
            store: {},
            schema: { schemaVersion: 2 }
          }
        }
      },
      version_message: ""
    };

    const response = await axios.post(
      `${this.baseURL}/algorithm-components/components`,
      payload,
      { headers: this.headers }
    );

    return response.data;
  }

  async updateCustomNode(componentId, title, description, manifest) {
    const payload = {
      id: componentId,
      name: title,
      title: title,
      description: description,
      public: true,
      color: "purple",
      component: manifest.filter,
      component_metadata: {
        snapshot: {
          document: {
            store: {},
            schema: { schemaVersion: 2 }
          }
        }
      },
      version_message: ""
    };

    const response = await axios.put(
      `${this.baseURL}/algorithm-components/components/${componentId}`,
      payload,
      { headers: this.headers }
    );

    return response.data;
  }

  getUserId() {
    const parts = this.sessionCookie.split('.');
    const payload = Buffer.from(parts[0], 'base64').toString('utf8');
    const data = JSON.parse(payload);
    return data.user_id;
  }
}

// Usage
async function main() {
  const client = new GrazeClient();
  
  // Login
  const loginResult = await client.login('your-handle.bsky.social', 'your-app-password');
  if (!loginResult.success) {
    console.error('Login failed:', loginResult.error);
    return;
  }
  
  console.log('Logged in successfully');
  
  // Create a custom node
  const manifest = {
    filter: {
      or: [
        {
          list_member: ["at://did:web:lists.example.com/app.bsky.graph.list/abc123", "in"]
        }
      ]
    }
  };
  
  const node = await client.createCustomNode(
    'My Custom Node',
    'A custom feed node',
    manifest
  );
  
  console.log('Created node:', node.id);
  console.log('View at: https://www.graze.social/custom-nodes/' + node.id);
}

main().catch(console.error);
```

## Important Notes

1. **Session Expiration:** Session cookies typically expire after 24 hours. Implement re-authentication logic.

2. **Rate Limiting:** Graze may rate limit API requests. Add delays between bulk operations (1 second recommended).

3. **Error Handling:** Always check response status codes:
   - 200: Success
   - 401: Unauthorized (session expired or invalid)
   - 429: Rate limited
   - 500: Server error

4. **Component IDs:** Store component IDs after creation for future updates.

5. **Manifest Validation:** Graze validates the manifest structure. Invalid manifests will be rejected.

6. **List URIs:** List URIs must be in AT Protocol format: `at://did:web:domain/app.bsky.graph.list/{listId}`

## Common Patterns

### Multi-City Custom Node
```javascript
{
  "or": [
    {
      "and": [
        {
          "custom_node_parameter": ["CITY_1", "==", true]
        },
        {
          "list_member": ["at://did:web:lists.example.com/app.bsky.graph.list/city1", "in"]
        }
      ]
    },
    {
      "and": [
        {
          "custom_node_parameter": ["CITY_2", "==", true]
        },
        {
          "list_member": ["at://did:web:lists.example.com/app.bsky.graph.list/city2", "in"]
        }
      ]
    }
  ],
  "metadata": {
    "color": "purple",
    "customNodeParameters": [
      {
        "name": "CITY_1",
        "type": "toggle",
        "displayName": "City 1",
        "exampleValue": false
      },
      {
        "name": "CITY_2",
        "type": "toggle",
        "displayName": "City 2",
        "exampleValue": false
      }
    ]
  }
}
```

### Hashtag Heatmap Node
```javascript
{
  "or": [
    {
      "entity_matches": ["hashtags", ["hashtag1", "hashtag2"]],
      "metadata": {
        "title": "Region 1"
      }
    },
    {
      "entity_matches": ["hashtags", ["hashtag3", "hashtag4"]],
      "metadata": {
        "title": "Region 2"
      }
    }
  ],
  "metadata": {
    "color": "purple"
  }
}
```

## Troubleshooting

### Login Issues
- Verify credentials are correct
- Use Bluesky app password, not main password
- Check for rate limiting (wait and retry)

### Custom Node Creation Fails
- Validate manifest JSON structure
- Ensure all list URIs are valid
- Check component_metadata format

### Session Expired
- Re-authenticate when receiving 401 errors
- Implement automatic session refresh

## Resources

- Graze Website: https://www.graze.social
- Custom Nodes: https://www.graze.social/custom-nodes
- Bluesky AT Protocol: https://atproto.com
