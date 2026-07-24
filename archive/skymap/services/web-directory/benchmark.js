const http = require('http');

function timeRequest(path) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request({ hostname: 'localhost', port: 3008, path, timeout: 15000, headers: { 'Accept-Encoding': 'gzip, deflate' } }, (res) => {
      let size = 0;
      const encoding = res.headers['content-encoding'] || 'none';
      const cacheControl = res.headers['cache-control'] || 'none';
      res.on('data', (chunk) => size += chunk.length);
      res.on('end', () => resolve({ ms: Date.now() - start, sizeKB: (size/1024).toFixed(0), encoding, cacheControl }));
    });
    req.on('error', (e) => resolve({ ms: Date.now() - start, error: e.message }));
    req.end();
  });
}

async function run() {
  const endpoints = [
    '/api/map-locations',
    '/api/countries',
    '/api/regions?country=US',
    '/api/explore-users',
    '/api/user-count',
    '/api/heatmap-data',
    '/api/location-lists',
  ];

  console.log('=== Cold (first request) ===');
  for (const ep of endpoints) {
    const r = await timeRequest(ep);
    const name = ep.split('?')[0].replace('/api/', '').padEnd(20);
    if (r.error) {
      console.log(`${name} ERROR: ${r.error}`);
    } else {
      console.log(`${name} ${r.ms}ms  ${r.sizeKB}KB  enc:${r.encoding}  cache:${r.cacheControl}`);
    }
  }

  console.log('\n=== Warm (second request) ===');
  for (const ep of endpoints) {
    const r = await timeRequest(ep);
    const name = ep.split('?')[0].replace('/api/', '').padEnd(20);
    if (r.error) {
      console.log(`${name} ERROR: ${r.error}`);
    } else {
      console.log(`${name} ${r.ms}ms  ${r.sizeKB}KB  enc:${r.encoding}  cache:${r.cacheControl}`);
    }
  }
}

run();
