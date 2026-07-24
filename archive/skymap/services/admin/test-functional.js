const http = require('http');

let sessionCookie = null;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3009,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(process.env.ADMIN_CREDS || 'admin:admin').toString('base64'),
      },
      timeout: 15000,
    };
    if (sessionCookie) {
      options.headers['Cookie'] = sessionCookie;
    }

    const req = http.request(options, (res) => {
      let data = '';
      // Capture set-cookie
      if (res.headers['set-cookie']) {
        sessionCookie = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
      }
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
    req.on('error', reject);

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== Authenticated Functional Tests ===\n');
  let pass = 0, fail = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  PASS: ${name}`);
      pass++;
    } catch (e) {
      console.log(`  FAIL: ${name} - ${e.message}`);
      fail++;
    }
    await new Promise(r => setTimeout(r, 50));
  }

  // Login with HTTP Basic Auth (triggers session creation)
  await test('Login via Basic Auth', async () => {
    const res = await request('GET', '/api/locations?limit=1');
    // Basic auth should create session and return data
    if (res.status === 302) throw new Error('Got redirect, auth failed');
    if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
  });

  // Auth session check
  await test('GET /api/auth/session returns authenticated', async () => {
    const res = await request('GET', '/api/auth/session');
    const data = JSON.parse(res.body);
    if (!data.authenticated) throw new Error('Not authenticated');
  });

  // Config
  await test('GET /api/config returns object', async () => {
    const res = await request('GET', '/api/config');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (typeof data !== 'object') throw new Error('Not an object');
  });

  // Locations
  await test('GET /api/locations returns array with data', async () => {
    const res = await request('GET', '/api/locations?limit=5');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data) || data.length === 0) throw new Error('Empty or not array');
    if (!data[0].name) throw new Error('Missing name field');
  });

  // Stats
  await test('GET /api/stats returns stats', async () => {
    const res = await request('GET', '/api/stats');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!data.cities) throw new Error('Missing cities field');
  });

  // Countries
  await test('GET /api/countries returns array', async () => {
    const res = await request('GET', '/api/countries');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error('Not array');
  });

  // Regions
  await test('GET /api/regions returns array', async () => {
    const res = await request('GET', '/api/regions');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error('Not array');
  });

  // All locations (user management)
  await test('GET /api/all-locations returns array', async () => {
    const res = await request('GET', '/api/all-locations');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data) || data.length === 0) throw new Error('Empty or not array');
  });

  // All users
  await test('GET /api/admin/all-users returns array', async () => {
    const res = await request('GET', '/api/admin/all-users');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error('Not array');
  });

  // Interests
  await test('GET /api/admin/interests returns array', async () => {
    const res = await request('GET', '/api/admin/interests');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error('Not array');
  });

  // Interest categories
  await test('GET /api/admin/interests/categories returns array', async () => {
    const res = await request('GET', '/api/admin/interests/categories');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error('Not array');
  });

  // Ingestion status
  await test('GET /api/ingestion/status returns status', async () => {
    const res = await request('GET', '/api/ingestion/status');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (data.totalLocations === undefined) throw new Error('Missing totalLocations');
  });

  // Graze session
  await test('GET /api/graze-session returns session', async () => {
    const res = await request('GET', '/api/graze-session');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (data.success === undefined) throw new Error('Missing success field');
  });

  // Graze feeds
  await test('GET /api/graze-feeds returns array', async () => {
    const res = await request('GET', '/api/graze-feeds');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error('Not array');
  });

  // Whitelist
  await test('GET /api/whitelist returns array', async () => {
    const res = await request('GET', '/api/whitelist');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error('Not array');
  });

  // Image requests
  await test('GET /api/image-requests returns object with requests', async () => {
    const res = await request('GET', '/api/image-requests');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!data.requests) throw new Error('Missing requests field');
  });

  // Reported images
  await test('GET /api/admin/reported-images returns object', async () => {
    const res = await request('GET', '/api/admin/reported-images');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!data.reports) throw new Error('Missing reports field');
  });

  // Label requests
  await test('GET /api/admin/label-requests returns object', async () => {
    const res = await request('GET', '/api/admin/label-requests');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!data.requests) throw new Error('Missing requests field');
  });

  // Location display overrides
  await test('GET /api/location-display returns array', async () => {
    const res = await request('GET', '/api/location-display');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error('Not array');
  });

  // Backup schedule
  await test('GET /api/backups/schedule returns schedule', async () => {
    const res = await request('GET', '/api/backups/schedule');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!data.schedule) throw new Error('Missing schedule field');
  });

  // Cities for search
  await test('GET /api/cities-for-search returns array', async () => {
    const res = await request('GET', '/api/cities-for-search');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error('Not array');
  });

  // Geoapify countries
  await test('GET /api/geoapify-countries returns array', async () => {
    const res = await request('GET', '/api/geoapify-countries');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error('Not array');
  });

  // HTML pages serve correctly
  await test('GET / serves index.html (not 404/500)', async () => {
    const res = await request('GET', '/');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.body.includes('html')) throw new Error('Not HTML');
  });

  await test('GET /feeds.html serves page', async () => {
    const res = await request('GET', '/feeds.html');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  await test('GET /users.html serves page', async () => {
    const res = await request('GET', '/users.html');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  await test('GET /ingestion.html serves page', async () => {
    const res = await request('GET', '/ingestion.html');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  await test('GET /interests.html serves page', async () => {
    const res = await request('GET', '/interests.html');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  console.log(`\n=== Results: ${pass} pass, ${fail} fail ===\n`);
}

run().catch(e => console.error('Fatal:', e));
