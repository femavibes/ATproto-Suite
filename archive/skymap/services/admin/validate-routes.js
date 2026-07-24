const http = require('http');

const BASE = 'http://localhost:3009';
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
      errors.push(`  FAIL: ${method} ${path} -> TIMEOUT (10s)`);
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
  console.log('=== ATlas Admin Route Validation ===\n');

  const tests = [
    // Auth (no auth required)
    ['GET',  '/api/auth/session', 200, 200],
    ['POST', '/api/auth/login', 400, 400],
    ['POST', '/api/auth/logout', 200, 200],

    // HTML pages (302 redirect to login or 200)
    ['GET', '/', 200, 302],
    ['GET', '/login', 200, 200],
    ['GET', '/lists.html', 200, 302],
    ['GET', '/whitelist.html', 200, 302],
    ['GET', '/feeds.html', 200, 302],
    ['GET', '/ingestion.html', 200, 302],
    ['GET', '/users.html', 200, 302],
    ['GET', '/location-display.html', 200, 302],
    ['GET', '/eventmanager.html', 200, 302],
    ['GET', '/interests.html', 200, 302],
    ['GET', '/backups.html', 200, 302],
    ['GET', '/refactor', 200, 302],
    ['GET', '/favicon.ico', 200, 204],
    ['GET', '/graze-session.js', 200, 200],

    // Locations
    ['GET',    '/api/locations', 200, 302],
    ['GET',    '/api/locations/test/users', 200, 302],
    ['GET',    '/api/locations/test/check-user?handle=test', 200, 302],
    ['DELETE', '/api/locations/test/users/test', 200, 302],
    ['DELETE', '/api/locations/1/inactive-lists', 200, 302],

    // Hashtags
    ['POST',   '/api/hashtags', 200, 302],
    ['DELETE', '/api/hashtags', 200, 302],

    // Config
    ['GET',  '/api/config', 200, 302],
    ['POST', '/api/config', 200, 302],

    // Ingestion
    ['GET',  '/api/ingestion/status', 200, 302],
    ['POST', '/api/ingestion/update-feed-uri', 200, 302],
    ['POST', '/api/ingestion/restart-listener', 200, 302],
    ['POST', '/api/ingestion/reset-cursor', 200, 302],
    ['GET',  '/api/ingestion/recent-activity', 200, 302],
    ['GET',  '/api/ingestion/logs', 200, 302],

    // Parsers
    ['POST', '/api/parse-geoapify', 200, 302],
    ['POST', '/api/parse-us', 200, 302],
    ['POST', '/api/parse-canada', 200, 302],

    // Lists
    ['POST',   '/api/create-lists', 200, 302],
    ['POST',   '/api/create-list/1', 200, 302],
    ['DELETE', '/api/lists/1', 200, 302],

    // Graze
    ['GET',    '/api/graze-nodes/CA', 200, 302],
    ['POST',   '/api/graze-feed', 200, 302],
    ['POST',   '/api/graze-login', 200, 302],
    ['GET',    '/api/graze-session', 200, 302],
    ['GET',    '/api/generate-hashtag-feed', 200, 302],
    ['GET',    '/api/graze-feeds', 200, 302],
    ['DELETE', '/api/graze-feeds/1', 200, 302],
    ['POST',   '/api/push-to-graze/CA', 200, 302],
    ['POST',   '/api/set-node-id', 200, 302],
    ['POST',   '/api/set-graze-component-id', 200, 302],
    ['POST',   '/api/push-all-to-graze', 200, 302],
    ['GET',    '/api/graze-heatmap-node', 200, 302],
    ['POST',   '/api/push-heatmap-to-graze', 200, 302],
    ['POST',   '/api/update-feed', 200, 302],
    ['POST',   '/api/create-feed', 200, 302],

    // Stats/regions/countries
    ['GET', '/api/stats', 200, 302],
    ['GET', '/api/countries', 200, 302],
    ['GET', '/api/geoapify-countries', 200, 302],
    ['GET', '/api/regions-by-country', 200, 302],
    ['GET', '/api/regions', 200, 302],
    ['GET', '/api/regions/CA/cities-without-lists', 200, 302],
    ['GET', '/api/regions/CA/cities', 200, 302],
    ['GET', '/api/cities-for-search', 200, 302],

    // Users
    ['GET',    '/api/all-locations', 200, 302],
    ['GET',    '/api/user-labels?handle=test', 200, 302],
    ['POST',   '/api/admin/user-labels', 200, 302],
    ['DELETE', '/api/admin/user-labels', 200, 302],
    ['POST',   '/api/admin/set-primary-location', 200, 302],
    ['POST',   '/api/admin/set-max-labels', 200, 302],
    ['POST',   '/api/admin/bulk-import-labels', 200, 302],
    ['GET',    '/api/admin/all-users', 200, 302],

    // Images
    ['POST', '/api/admin/location-images', 200, 302],
    ['POST', '/api/admin/user-profile-image', 200, 302],
    ['GET',  '/api/image-requests', 200, 302],
    ['POST', '/api/image-requests/1/approve', 200, 302],
    ['POST', '/api/image-requests/1/deny', 200, 302],
    ['POST', '/api/admin/upload-image', 200, 302],
    ['GET',  '/api/admin/reported-images', 200, 302],
    ['POST', '/api/admin/reported-images/1/review', 200, 302],

    // Labels
    ['GET',  '/api/admin/label-requests', 200, 302],
    ['POST', '/api/admin/label-requests/1/review', 200, 302],

    // Whitelist
    ['GET',  '/api/whitelist', 200, 302],
    ['POST', '/api/whitelist/add', 200, 302],
    ['POST', '/api/whitelist/remove', 200, 302],

    // Backups
    ['GET',  '/api/backups', 200, 302],
    ['GET',  '/api/backups/download?database=test&type=daily&filename=test', 200, 302],
    ['GET',  '/api/backups/schedule', 200, 302],
    ['GET',  '/api/backups/status', 200, 302],
    ['GET',  '/api/backups/logs', 200, 302],
    ['POST', '/api/backups/trigger', 200, 302],
    ['POST', '/api/backups/schedule', 200, 302],

    // Proxy
    ['GET', '/api/proxy/web-directory/api/test', 200, 302],

    // Already-extracted sub-routers
    ['GET', '/api/location-display', 200, 302],
    ['GET', '/api/admin/interests', 200, 302],
    ['GET', '/api/admin/interests/categories', 200, 302],
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
