export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Proxy API requests to admin service
    if (url.pathname.startsWith('/api/')) {
      const adminUrl = new URL(url.pathname + url.search, env.ADMIN_API_URL);
      
      const modifiedRequest = new Request(adminUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
      
      return fetch(modifiedRequest);
    }
    
    // Proxy static files (JS, CSS, images, etc.) to admin service
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
    const isStaticFile = staticExtensions.some(ext => url.pathname.endsWith(ext));
    
    if (isStaticFile) {
      const adminUrl = new URL(url.pathname + url.search, env.ADMIN_API_URL);
      
      const modifiedRequest = new Request(adminUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
      
      return fetch(modifiedRequest);
    }
    
    // Serve admin interface HTML
    return new Response(adminHTML, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};

const adminHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SkyMap Admin</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; }
        button { padding: 10px 20px; margin: 5px; cursor: pointer; }
        input, select { padding: 8px; margin: 5px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .stat-card { padding: 15px; background: #f5f5f5; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>SkyMap Admin Dashboard</h1>
        
        <div class="section">
            <h2>System Stats</h2>
            <div class="stats" id="stats"></div>
        </div>
        
        <div class="section">
            <h2>Location Management</h2>
            <div id="locations"></div>
        </div>
        
        <div class="section">
            <h2>Graze Integration</h2>
            <button onclick="grazeLogin()">Login to Graze</button>
            <div id="graze-status"></div>
        </div>
    </div>
    
    <script>
        async function loadStats() {
            try {
                const response = await fetch('/api/stats');
                const stats = await response.json();
                document.getElementById('stats').innerHTML = \`
                    <div class="stat-card">
                        <h3>Regions</h3>
                        <p>\${stats.regions}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Cities</h3>
                        <p>\${stats.cities}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Population Range</h3>
                        <p>\${stats.min_pop?.toLocaleString()} - \${stats.max_pop?.toLocaleString()}</p>
                    </div>
                \`;
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        }
        
        async function grazeLogin() {
            try {
                const response = await fetch('/api/graze-login', { method: 'POST' });
                const result = await response.json();
                document.getElementById('graze-status').innerHTML = result.success 
                    ? '<p style="color: green;">Graze login successful</p>'
                    : '<p style="color: red;">Graze login failed: ' + result.error + '</p>';
            } catch (error) {
                console.error('Error logging into Graze:', error);
            }
        }
        
        loadStats();
    </script>
</body>
</html>`;