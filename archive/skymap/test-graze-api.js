#!/usr/bin/env node

// Test script to find the correct Graze API endpoint
// Usage: node test-graze-api.js

const https = require('https');

const SESSION_COOKIE = 'eyJzZXNzaW9uX3Rva2VuIjoiUnpvdWs5bFlDOGppMkJqcjEzLXZhMkdpOVNHYUMyZzRZWVp6aXRqZVI0SSIsInVzZXJfaWQiOjM2OSwiaXNfb2F1dGgiOnRydWV9.aWUiFw.HvYCKE5fKEhToAmtmBqXgDXsL98';

const testEndpoints = [
  'POST /app/api/v1/algorithm-components/components',
  'PUT /app/api/v1/algorithm-components/components/1410',
  'POST /app/api/v1/algorithm-components',
  'PUT /app/api/v1/algorithm-components/1410',
  'POST /app/custom-nodes',
  'PUT /app/custom-nodes/1410'
];

const testPayload = {
  name: 'Test SkyMap Alabama',
  description: 'Test custom node for Alabama',
  manifest: {
    filter: {
      or: [],
      metadata: {
        color: 'purple',
        customNodeParameters: [
          {
            name: 'STATE',
            type: 'toggle',
            displayName: 'Alabama',
            exampleValue: false,
            description: 'Test parameter'
          }
        ],
        customNodeParameterGroups: [
          {
            name: 'State',
            id: 'test-group-id'
          }
        ]
      }
    }
  }
};

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.graze.social',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_cookie=${SESSION_COOKIE}`,
        'Origin': 'https://www.graze.social',
        'Referer': 'https://www.graze.social/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testEndpoint(endpoint) {
  const [method, path] = endpoint.split(' ');
  
  console.log(`\nTesting: ${method} ${path}`);
  
  try {
    const response = await makeRequest(method, path, testPayload);
    console.log(`Status: ${response.status}`);
    
    if (response.status < 400) {
      console.log('✅ SUCCESS!');
      console.log('Response:', response.body.substring(0, 200) + '...');
    } else {
      console.log('❌ Failed');
      console.log('Error:', response.body.substring(0, 200));
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function main() {
  console.log('Testing Graze API endpoints...\n');
  
  for (const endpoint of testEndpoints) {
    await testEndpoint(endpoint);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between requests
  }
}

main().catch(console.error);