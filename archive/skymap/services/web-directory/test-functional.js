const http = require('http');
const zlib = require('zlib');

let sessionCookie = null;
let pass = 0, fail = 0;
const failures = [];

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: 3008, path, method,
      headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      timeout: 15000,
    };
    if (sessionCookie) options.headers['Cookie'] = sessionCookie;

    const req = http.request(options, (res) => {
      if (res.headers['set-cookie']) {
        sessionCookie = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        let body = Buffer.concat(chunks);
        if (res.headers['content-encoding'] === 'gzip') {
          try { body = zlib.gunzipSync(body); } catch(e) {}
        }
        resolve({ status: res.statusCode, body: body.toString(), headers: res.headers });
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    pass++;
  } catch (e) {
    console.log(`  FAIL: ${name} - ${e.message}`);
    fail++;
    failures.push(name + ': ' + e.message);
  }
  await new Promise(r => setTimeout(r, 30));
}

async function run() {
  console.log('=== Comprehensive Web Directory Functional Tests ===\n');

  // === PUBLIC ENDPOINTS (no auth) ===
  console.log('--- Public endpoints ---');

  await test('GET /api/locations?search=portland returns results', async () => {
    const r = await request('GET', '/api/locations?search=portland');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!Array.isArray(d) || d.length === 0) throw new Error('No results');
    if (!d[0].name) throw new Error('Missing name');
  });

  await test('GET /api/autocomplete?q=port returns results', async () => {
    const r = await request('GET', '/api/autocomplete?q=port');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!Array.isArray(d)) throw new Error('Not array');
  });

  await test('GET /api/countries returns array', async () => {
    const r = await request('GET', '/api/countries');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!Array.isArray(d) || d.length === 0) throw new Error('Empty');
    if (!d[0].country_code) throw new Error('Missing country_code');
  });

  await test('GET /api/regions?country=US returns array', async () => {
    const r = await request('GET', '/api/regions?country=US');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!Array.isArray(d) || d.length === 0) throw new Error('Empty');
  });

  await test('GET /api/map-locations returns locations with user_count', async () => {
    const r = await request('GET', '/api/map-locations');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!Array.isArray(d) || d.length === 0) throw new Error('Empty');
    if (d[0].user_count === undefined) throw new Error('Missing user_count');
  });

  await test('GET /api/map-locations/geometry?ids=1 returns array', async () => {
    const r = await request('GET', '/api/map-locations/geometry?ids=1');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!Array.isArray(d)) throw new Error('Not array');
  });

  await test('GET /api/user-count returns totalUsers', async () => {
    const r = await request('GET', '/api/user-count');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (d.totalUsers === undefined) throw new Error('Missing totalUsers');
  });

  await test('GET /api/user-growth returns growth array', async () => {
    const r = await request('GET', '/api/user-growth');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!d.growth) throw new Error('Missing growth');
  });

  await test('GET /api/location-lists returns array', async () => {
    const r = await request('GET', '/api/location-lists');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!Array.isArray(d)) throw new Error('Not array');
  });

  await test('GET /api/heatmap-data returns array', async () => {
    const r = await request('GET', '/api/heatmap-data');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!Array.isArray(d)) throw new Error('Not array');
  });

  await test('GET /api/bot-handle returns handle', async () => {
    const r = await request('GET', '/api/bot-handle');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!d.handle) throw new Error('Missing handle');
  });

  await test('GET /api/explore-users returns users array', async () => {
    const r = await request('GET', '/api/explore-users?zoom=4');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!d.users || !Array.isArray(d.users)) throw new Error('Missing users array');
    if (d.users.length > 0) {
      const u = d.users[0];
      if (!u.latitude || !u.longitude) throw new Error('Missing coords');
      if (!u.handle) throw new Error('Missing handle');
    }
  });

  await test('GET /api/auth/session returns auth status', async () => {
    const r = await request('GET', '/api/auth/session');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (d.authenticated === undefined) throw new Error('Missing authenticated');
  });

  // Events
  await test('GET /api/events/active returns array', async () => {
    const r = await request('GET', '/api/events/active');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!Array.isArray(d)) throw new Error('Not array');
  });

  await test('GET /api/events/categories returns array', async () => {
    const r = await request('GET', '/api/events/categories');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!Array.isArray(d)) throw new Error('Not array');
  });

  await test('GET /api/events/list returns events', async () => {
    const r = await request('GET', '/api/events/list');
    if (r.status !== 200) throw new Error(`Status ${r.status}: ${r.body.substring(0, 200)}`);
    const d = JSON.parse(r.body);
    if (!d.events) throw new Error('Missing events');
  });

  await test('GET /api/events/nonexistent returns 404', async () => {
    const r = await request('GET', '/api/events/NONEXISTENT');
    if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`);
  });

  // Short URLs
  await test('GET /e/nonexistent returns 404', async () => {
    const r = await request('GET', '/e/nonexistent');
    if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`);
  });

  // HTML pages
  await test('GET / returns HTML', async () => {
    const r = await request('GET', '/');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (!r.body.includes('html')) throw new Error('Not HTML');
  });

  await test('GET /manage returns HTML', async () => {
    const r = await request('GET', '/manage');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
  });

  await test('GET /feed-settings returns HTML', async () => {
    const r = await request('GET', '/feed-settings');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
  });

  await test('GET /algo returns HTML', async () => {
    const r = await request('GET', '/algo');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
  });

  // === AUTH-REQUIRED ENDPOINTS (should return 401) ===
  console.log('\n--- Auth-required endpoints (expect 401) ---');

  const authEndpoints = [
    ['GET', '/api/labels/my-labels'],
    ['GET', '/api/my-profile-image'],
    ['POST', '/api/labels/add'],
    ['POST', '/api/labels/remove'],
    ['POST', '/api/labels/set-primary'],
    ['POST', '/api/post-to-bluesky'],
    ['GET', '/api/mutuals'],
    ['GET', '/api/events/my-events'],
    ['POST', '/api/events'],
    ['GET', '/api/user/settings'],  // returns defaults when unauthed, not 401
    ['POST', '/api/user/settings'],
    ['GET', '/api/user/feed-settings'],  // returns {} when unauthed, not 401
    ['POST', '/api/user/feed-settings'],
    ['GET', '/api/user/feed-settings/overrides'],
    ['POST', '/api/user/feed-settings/overrides'],
    ['POST', '/api/image-requests'],
    ['GET', '/api/image-requests/my-request'],
    ['GET', '/api/label-requests'],
  ];

  for (const [method, path] of authEndpoints) {
    // Some GET endpoints return defaults instead of 401 when unauthed
    const expectDefault = method === 'GET' && ['/api/user/settings', '/api/user/feed-settings'].includes(path);
    await test(`${method} ${path} ${expectDefault ? 'returns defaults' : 'returns 401'}`, async () => {
      const r = await request(method, path, method === 'POST' ? {} : undefined);
      if (expectDefault) {
        if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
      } else {
        if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}: ${r.body.substring(0, 100)}`);
      }
    });
  }

  // === LOGIN AND TEST AUTHENTICATED ENDPOINTS ===
  console.log('\n--- Authenticated endpoints ---');

  await test('POST /api/auth/login succeeds', async () => {
    const r = await request('POST', '/api/auth/login', {
      handle: 'atls.city',
      password: 'giad-atw2-urz4-palz'
    });
    if (r.status !== 200) throw new Error(`Status ${r.status}: ${r.body.substring(0, 200)}`);
    const d = JSON.parse(r.body);
    if (!d.success) throw new Error('Login failed');
  });

  await test('GET /api/auth/session shows authenticated', async () => {
    const r = await request('GET', '/api/auth/session');
    const d = JSON.parse(r.body);
    if (!d.authenticated) throw new Error('Not authenticated after login');
  });

  await test('GET /api/labels/my-labels returns labels', async () => {
    const r = await request('GET', '/api/labels/my-labels');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!d.labels) throw new Error('Missing labels');
  });

  await test('GET /api/my-profile-image returns data', async () => {
    const r = await request('GET', '/api/my-profile-image');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
  });

  await test('GET /api/mutuals returns mutuals (may be empty)', async () => {
    const r = await request('GET', '/api/mutuals');
    if (r.status !== 200) throw new Error(`Status ${r.status}: ${r.body.substring(0, 200)}`);
    const d = JSON.parse(r.body);
    if (!d.mutuals) throw new Error('Missing mutuals key');
    if (d.mutuals.length > 0) {
      const m = d.mutuals[0];
      if (!m.latitude || !m.longitude) throw new Error('Missing coords on mutual');
      if (!m.handle) throw new Error('Missing handle on mutual');
    }
  });

  await test('GET /api/user/settings returns settings', async () => {
    const r = await request('GET', '/api/user/settings');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
  });

  await test('GET /api/user/feed-settings returns settings', async () => {
    const r = await request('GET', '/api/user/feed-settings');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
  });

  await test('GET /api/user/feed-settings/overrides returns overrides', async () => {
    const r = await request('GET', '/api/user/feed-settings/overrides');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
  });

  await test('GET /api/user/permission returns tier', async () => {
    const r = await request('GET', '/api/user/permission');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (d.tier === undefined) throw new Error('Missing tier');
  });

  await test('GET /api/events/my-events returns events', async () => {
    const r = await request('GET', '/api/events/my-events');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!d.events) throw new Error('Missing events');
  });

  await test('GET /api/image-requests/my-request returns data', async () => {
    const r = await request('GET', '/api/image-requests/my-request');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
  });

  await test('GET /api/label-requests returns requests', async () => {
    const r = await request('GET', '/api/label-requests');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    const d = JSON.parse(r.body);
    if (!d.requests) throw new Error('Missing requests');
  });

  // Compression check
  console.log('\n--- Performance checks ---');

  await test('Responses are gzip compressed', async () => {
    const r = await request('GET', '/api/map-locations');
    if (!r.headers['content-encoding'] || !r.headers['content-encoding'].includes('gzip')) {
      throw new Error('Not gzip: ' + (r.headers['content-encoding'] || 'none'));
    }
  });

  await test('Cached endpoints have Cache-Control', async () => {
    const r = await request('GET', '/api/countries');
    if (!r.headers['cache-control']) {
      throw new Error('No Cache-Control header');
    }
  });

  // Logout
  await test('POST /api/auth/logout succeeds', async () => {
    const r = await request('POST', '/api/auth/logout');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
  });

  console.log(`\n=== Results: ${pass} pass, ${fail} fail ===`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  ' + f));
  }
  console.log('');
}

run().catch(e => console.error('Fatal:', e));
