const http = require('http');

const BASE = 'http://localhost:3008';
let pass = 0, fail = 0;
const errors = [];

function check(method, path, minStatus, maxStatus) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      res.resume();
      const status = res.statusCode;
      if (status >= minStatus && status <= maxStatus) {
        pass++;
      } else {
        fail++;
        errors.push(`  FAIL: ${method} ${path} -> ${status} (expected ${minStatus}-${maxStatus})`);
      }
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      fail++;
      errors.push(`  FAIL: ${method} ${path} -> TIMEOUT`);
      resolve();
    });

    req.on('error', (e) => {
      fail++;
      errors.push(`  FAIL: ${method} ${path} -> ERROR: ${e.message}`);
      resolve();
    });

    if (method !== 'GET') req.write('{}');
    req.end();
  });
}

async function run() {
  console.log('=== Web Directory Route Validation ===\n');

  const tests = [
    // HTML pages
    ['GET', '/', 200, 200],
    ['GET', '/manage', 200, 200],
    ['GET', '/feed-settings', 200, 200],
    ['GET', '/algo', 200, 200],
    ['GET', '/customnodebuilder', 200, 200],
    ['GET', '/feedbuilder', 200, 302],
    ['GET', '/mynodes', 200, 200],
    ['GET', '/list/US-CA-LosAngeles', 200, 200],
    ['GET', '/event/test', 200, 404],

    // Short URL redirect
    ['GET', '/e/nonexistent', 200, 404],

    // Auth
    ['GET', '/api/auth/session', 200, 200],
    ['POST', '/api/auth/login', 400, 401],
    ['POST', '/api/auth/logout', 200, 200],

    // Public API endpoints
    ['GET', '/api/locations?search=portland', 200, 200],
    ['GET', '/api/autocomplete?q=port', 200, 200],
    ['GET', '/api/user-labels?handle=test', 200, 500],
    ['GET', '/api/bot-handle', 200, 200],
    ['GET', '/api/user-count', 200, 200],
    ['GET', '/api/user-growth', 200, 200],
    ['GET', '/api/countries', 200, 200],
    ['GET', '/api/regions?country=US', 200, 200],
    ['GET', '/api/map-locations?country=US', 200, 200],
    ['GET', '/api/map-locations/geometry?ids=1', 200, 200],
    ['GET', '/api/geocode?q=portland', 200, 400],
    ['GET', '/api/location-lists', 200, 200],
    ['GET', '/api/heatmap-data', 200, 200],
    ['GET', '/api/location/US-CA-LosAngeles/lists', 200, 200],
    ['GET', '/api/map-posts/feed?bounds=0,0,90,180', 200, 500],
    ['GET', '/api/map-posts/1', 200, 200],
    ['GET', '/api/explore-users', 200, 200],

    // Short URL creation
    ['POST', '/api/shorten', 200, 400],

    // Auth-required endpoints (expect 401 without session)
    ['GET', '/api/labels/my-labels', 200, 401],
    ['GET', '/api/my-profile-image', 200, 401],
    ['POST', '/api/my-profile-image', 200, 401],
    ['POST', '/api/labels/add', 200, 401],
    ['POST', '/api/labels/remove', 200, 401],
    ['POST', '/api/labels/set-primary', 200, 401],
    ['POST', '/api/post-to-bluesky', 200, 401],
    ['POST', '/api/upload-image', 200, 401],
    ['POST', '/api/report-image', 200, 401],
    ['GET', '/api/mutuals', 200, 401],

    // Label requests (can be anonymous)
    ['POST', '/api/label-requests', 200, 400],
    ['GET', '/api/label-requests', 200, 401],

    // Events
    ['GET', '/api/events/active', 200, 200],
    ['GET', '/api/events/map', 200, 400],
    ['GET', '/api/events/my-events', 200, 401],
    ['GET', '/api/events/categories', 200, 200],
    ['GET', '/api/events/list', 200, 200],
    ['GET', '/api/events/test123', 200, 404],
    ['POST', '/api/events', 200, 401],
    ['PUT', '/api/events/test123', 200, 401],
    ['DELETE', '/api/events/test123', 200, 401],
    ['GET', '/api/events/test123/rsvps', 200, 404],
    ['GET', '/api/event-scoring-config-test', 200, 200],

    // User permissions & image requests
    ['GET', '/api/user/permission', 200, 401],
    ['POST', '/api/image-requests', 200, 401],
    ['GET', '/api/image-requests/my-request', 200, 401],

    // User settings
    ['GET', '/api/user/settings', 200, 401],
    ['POST', '/api/user/settings', 200, 401],

    // Feed settings
    ['GET', '/api/user/feed-settings', 200, 401],
    ['POST', '/api/user/feed-settings', 200, 401],
    ['GET', '/api/user/feed-settings/overrides', 200, 401],
    ['POST', '/api/user/feed-settings/overrides', 200, 401],

    // Interests (already extracted)
    ['GET', '/api/interests', 200, 404],

    // User custom nodes (already extracted)
    ['GET', '/api/user/custom-nodes', 200, 401],
  ];

  for (const [method, path, min, max] of tests) {
    await check(method, path, min, max);
    await new Promise(r => setTimeout(r, 20));
  }

  console.log(`\n=== Results ===`);
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);
  if (errors.length > 0) {
    console.log(`\nFailures:`);
    errors.forEach(e => console.log(e));
  }
  console.log('');
}

run();
