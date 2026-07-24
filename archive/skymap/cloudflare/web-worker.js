export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Proxy API requests to web directory service
    if (url.pathname.startsWith('/api/')) {
      const webUrl = new URL(url.pathname + url.search, env.WEB_API_URL);
      
      const modifiedRequest = new Request(webUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
      
      return fetch(modifiedRequest);
    }
    
    // Serve web directory HTML
    return new Response(webHTML, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};

const webHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SkyMap Directory</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .search-box { width: 100%; padding: 15px; font-size: 16px; border: 2px solid #ddd; border-radius: 5px; margin: 20px 0; }
        .filters { display: flex; gap: 10px; margin: 20px 0; }
        .filter-select { padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        .location-item { padding: 15px; margin: 10px 0; border: 1px solid #eee; border-radius: 5px; background: #fafafa; }
        .location-name { font-weight: bold; font-size: 18px; color: #333; }
        .location-details { color: #666; margin-top: 5px; }
        .no-results { text-align: center; color: #666; margin: 40px 0; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #2c3e50; margin-bottom: 10px; }
        .header p { color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗺️ SkyMap Directory</h1>
            <p>Find and explore locations across the United States</p>
        </div>
        
        <input type="text" class="search-box" id="searchInput" placeholder="Search for cities...">
        
        <div class="filters">
            <select class="filter-select" id="stateFilter">
                <option value="">All States</option>
            </select>
        </div>
        
        <div id="results"></div>
    </div>
    
    <script>
        let allStates = [];
        let searchTimeout;
        
        async function loadStates() {
            try {
                const response = await fetch('/api/states');
                allStates = await response.json();
                const stateSelect = document.getElementById('stateFilter');
                allStates.forEach(state => {
                    const option = document.createElement('option');
                    option.value = state.region_code;
                    option.textContent = state.region_name;
                    stateSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Error loading states:', error);
            }
        }
        
        async function searchLocations() {
            const search = document.getElementById('searchInput').value;
            const state = document.getElementById('stateFilter').value;
            
            try {
                const params = new URLSearchParams();
                if (search) params.append('search', search);
                if (state) params.append('state', state);
                
                const response = await fetch('/api/locations?' + params);
                const locations = await response.json();
                
                const resultsDiv = document.getElementById('results');
                
                if (locations.length === 0) {
                    resultsDiv.innerHTML = '<div class="no-results">No locations found</div>';
                    return;
                }
                
                resultsDiv.innerHTML = locations.map(location => \`
                    <div class="location-item">
                        <div class="location-name">\${location.name}</div>
                        <div class="location-details">
                            \${location.region_name} • Population: \${location.population?.toLocaleString() || 'N/A'}
                        </div>
                    </div>
                \`).join('');
                
            } catch (error) {
                console.error('Error searching locations:', error);
                document.getElementById('results').innerHTML = '<div class="no-results">Error loading results</div>';
            }
        }
        
        document.getElementById('searchInput').addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(searchLocations, 300);
        });
        
        document.getElementById('stateFilter').addEventListener('change', searchLocations);
        
        loadStates();
        searchLocations();
    </script>
</body>
</html>`;