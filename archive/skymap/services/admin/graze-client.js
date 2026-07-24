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
    try {
      console.log('Making login request to Graze API...');
      
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
      
      console.log('Login response status:', response.status);
      console.log('Login response data:', response.data);
      
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        console.log('Received cookies:', cookies);
        const sessionCookie = cookies.find(cookie => cookie.startsWith('session_cookie='));
        if (sessionCookie) {
          this.sessionCookie = sessionCookie.split(';')[0].replace('session_cookie=', '');
          this.headers['Cookie'] = `session_cookie=${this.sessionCookie}`;
          return { success: true, sessionCookie: this.sessionCookie };
        }
      }
      
      return { success: false, error: 'No authentication token received' };
    } catch (error) {
      console.error('Login error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      return { success: false, error: JSON.stringify(error.response?.data) || error.message };
    }
  }

  async createCustomNode(title, description, jsonData) {
    try {
      const payload = {
        name: title,
        title: title,
        description: description,
        public: true,
        color: "purple",
        component: jsonData.manifest.filter,
        component_metadata: {
          snapshot: {
            document: {
              store: {},
              schema: {
                schemaVersion: 2
              }
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
    } catch (error) {
      console.error('Error creating custom node:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateCustomNode(componentId, title, description, jsonData) {
    try {
      const payload = {
        id: componentId,
        name: title,
        title: title,
        description: description,
        public: true,
        color: "purple",
        component: jsonData.manifest.filter,
        component_metadata: {
          snapshot: {
            document: {
              store: {},
              schema: {
                schemaVersion: 2
              }
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
    } catch (error) {
      console.error('Error updating custom node:', error.response?.data || error.message);
      throw error;
    }
  }

  async getUserComponents(userId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/algorithm-components/users/${userId}/components`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting user components:', error.response?.data || error.message);
      throw error;
    }
  }

  async createFeed(displayName, recordName, manifest) {
    try {
      const payload = {
        display_name: displayName,
        record_name: recordName,
        description: "",
        public: false,
        algorithm_type: "hosted"
      };

      const response = await axios.post(
        `${this.appBaseURL}/my_feeds`,
        payload,
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error('Error creating feed:', error.response?.data || error.message);
      throw error;
    }
  }

  async getFeed(feedId) {
    try {
      const response = await axios.get(
        `${this.appBaseURL}/publish_algo/${feedId}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting feed:', error.response?.data || error.message);
      throw error;
    }
  }

  async getFeedContent(feedId, limit = 20, cursor = null) {
    try {
      let url = `${this.appBaseURL}/my_feeds/${feedId}/content?limit=${limit}`;
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }
      
      const response = await axios.get(url, { headers: this.headers });
      return response.data;
    } catch (error) {
      console.error('Error getting feed content:', error.response?.data || error.message);
      throw error;
    }
  }

  async createOrUpdateFeed(displayName, description, stickyType, listUrls, feedId = null, userId = null, publish = false, customManifest = null) {
    try {
      console.log('=== createOrUpdateFeed ===');
      console.log('Display Name:', displayName);
      console.log('Description:', description);
      console.log('Sticky Type:', stickyType);
      console.log('List URLs:', listUrls);
      console.log('Feed ID:', feedId);
      console.log('User ID:', userId);
      console.log('Publish:', publish);
      console.log('Custom Manifest:', !!customManifest);
      
      // Build the manifest
      let manifest;
      if (customManifest) {
        manifest = customManifest;
      } else {
        manifest = {
          filter: {
            or: listUrls.map(url => ({
              list_member: [url, "in"]
            }))
          }
        };
      }

      // Build the algorithm_manifest JSON string
      const algorithmManifest = JSON.stringify(manifest);
      console.log('Algorithm Manifest:', algorithmManifest);

      // Build metadata (empty for now, but matches the structure from your example)
      const metadata = JSON.stringify({
        snapshot: {
          document: {
            store: {},
            schema: { schemaVersion: 2 }
          },
          session: {
            version: 0,
            currentPageId: "page:page",
            exportBackground: true,
            isFocusMode: false,
            isDebugMode: false,
            isToolLocked: false,
            isGridMode: false,
            pageStates: []
          }
        },
        testPosts: []
      });

      // Create FormData
      const FormData = require('form-data');
      const formData = new FormData();
      
      formData.append('display_name', displayName);
      formData.append('description', description || '');
      formData.append('sticky_type', stickyType);
      formData.append('algorithm_manifest', algorithmManifest);
      formData.append('metadata', metadata);
      formData.append('order', stickyType);
      formData.append('active', publish ? 'true' : 'false');
      formData.append('public', publish ? 'true' : 'false');
      if (publish) {
        formData.append('status', 'published');
      }
      
      if (feedId && userId) {
        console.log('Updating existing feed - feedId:', feedId, 'userId:', userId);
        formData.append('user_id', userId.toString());
        formData.append('id', feedId.toString());
      } else if (userId) {
        console.log('Creating new feed with userId:', userId);
        formData.append('user_id', userId.toString());
      } else {
        console.log('Creating new feed without userId');
      }

      const headers = {
        ...this.headers,
        ...formData.getHeaders()
      };
      delete headers['Content-Type']; // Let form-data set the correct boundary

      const endpoint = feedId 
        ? `${this.appBaseURL}/edit_algo_image`
        : `${this.appBaseURL}/add_algo_image`;

      console.log('Endpoint:', endpoint);
      console.log('Headers:', JSON.stringify(headers, null, 2));

      const response = await axios.post(endpoint, formData, { headers });
      
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));

      return response.data;
    } catch (error) {
      console.error('Error in createOrUpdateFeed:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async getUserId() {
    try {
      // Extract user_id from the session cookie
      // Cookie format: session_cookie=eyJzZXNzaW9uX3Rva2VuIjoiLi4uIiwidXNlcl9pZCI6NTk1M30...
      const cookieValue = this.sessionCookie;
      if (!cookieValue) {
        throw new Error('No session cookie');
      }
      
      // Decode the base64 JWT payload (middle part)
      const parts = cookieValue.split('.');
      if (parts.length < 2) {
        throw new Error('Invalid session cookie format');
      }
      
      const payload = Buffer.from(parts[0], 'base64').toString('utf8');
      const data = JSON.parse(payload);
      
      console.log('Decoded session data:', data);
      
      if (data.user_id) {
        return data.user_id;
      }
      
      throw new Error('user_id not found in session');
    } catch (error) {
      console.error('Error getting user ID:', error.message);
      throw error;
    }
  }

  async publishFeed(feedId) {
    try {
      console.log('Publishing feed via GET:', feedId);
      
      const response = await axios.get(
        `${this.appBaseURL}/publish_algo/${feedId}`,
        { headers: this.headers }
      );
      
      console.log('Publish response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error publishing feed:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = GrazeClient;