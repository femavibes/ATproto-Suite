// Shared Graze session management
const GrazeSession = {
  sessionCookie: null,
  username: null,
  initializing: false,
  initialized: false,
  
  async init() {
    console.log('GrazeSession.init() called');
    
    // Prevent multiple simultaneous init calls
    if (this.initializing) {
      console.log('GrazeSession.init() already in progress, skipping...');
      return false;
    }
    
    // If already initialized and have session, just update UI
    if (this.initialized && this.sessionCookie) {
      console.log('GrazeSession already initialized, updating UI');
      this.updateUI(true);
      return true;
    }
    
    console.log('Starting GrazeSession initialization...');
    this.initializing = true;
    
    try {
      // Try to get existing session from server
      const response = await fetch('/api/graze-session', {
        credentials: 'include' // Include cookies for authentication
      });
      
      if (!response.ok) {
        console.error('Graze session API returned non-OK status:', response.status, response.statusText);
        const text = await response.text();
        console.error('Response body:', text);
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Graze session API response:', data);
      
      if (data.success) {
        this.sessionCookie = data.sessionCookie;
        this.username = data.username;
        this.initialized = true;
        this.updateUI(true);
        this.initializing = false;
        return true;
      } else {
        console.log('Graze session API returned success: false, will try to login');
      }
    } catch (error) {
      console.error('Error fetching Graze session:', error);
    }
    
    // If no session, try to login
    try {
      const result = await this.login();
      this.initializing = false;
      return result;
    } catch (error) {
      this.initializing = false;
      throw error;
    }
  },
  
  async login() {
    try {
      const response = await fetch('/api/graze-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' // Include cookies for authentication
      });
      
      if (!response.ok) {
        console.error('Graze login API returned non-OK status:', response.status, response.statusText);
        const text = await response.text();
        console.error('Response body:', text);
        throw new Error(`Login API returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Graze login API response:', result);
      
      if (result.success) {
        this.sessionCookie = result.sessionCookie;
        this.username = result.username;
        this.initialized = true;
        this.updateUI(true);
        return true;
      } else {
        const errorMsg = result.error || 'Unknown error';
        console.error('Graze login failed:', errorMsg);
        this.updateUI(false, errorMsg);
        return false;
      }
    } catch (error) {
      console.error('Graze login error:', error);
      this.updateUI(false, error.message);
      return false;
    }
  },
  
  updateUI(success, error = null) {
    const loginBtn = document.getElementById('loginBtn');
    // Get ALL loginStatus elements (there may be multiple on different tabs)
    const loginStatusElements = document.querySelectorAll('#loginStatus');
    const pushBtn = document.getElementById('pushBtn');
    const pushAllBtn = document.getElementById('pushAllBtn');
    const pushHeatmapBtn = document.getElementById('pushHeatmapBtn');
    const saveFeedBtn = document.getElementById('saveFeedBtn');
    const publishFeedBtn = document.getElementById('publishFeedBtn');
    
    console.log('GrazeSession.updateUI:', { success, error, username: this.username, loginStatusCount: loginStatusElements.length });
    
    if (success) {
      // Update ALL loginStatus elements (for all tabs)
      loginStatusElements.forEach((loginStatus, index) => {
        loginStatus.textContent = `✓ Logged in as ${this.username}`;
        loginStatus.style.color = 'green';
        console.log(`Updated loginStatus ${index} text to:`, loginStatus.textContent);
      });
      if (loginStatusElements.length === 0) {
        console.warn('loginStatus element not found on page');
      }
      if (loginBtn) {
        loginBtn.textContent = 'Logged In';
        loginBtn.disabled = true;
        loginBtn.style.display = 'none';
      }
      
      if (pushBtn) pushBtn.disabled = false;
      if (pushAllBtn) pushAllBtn.disabled = false;
      if (pushHeatmapBtn) pushHeatmapBtn.disabled = false;
      if (saveFeedBtn) saveFeedBtn.disabled = false;
      if (publishFeedBtn) publishFeedBtn.disabled = false;
    } else {
      // Update ALL loginStatus elements (for all tabs)
      loginStatusElements.forEach((loginStatus) => {
        loginStatus.textContent = error ? `✗ ${error}` : 'Connecting to Graze...';
        loginStatus.style.color = error ? 'red' : '#737373';
      });
      if (loginStatusElements.length === 0) {
        console.warn('loginStatus element not found on page');
      }
      if (loginBtn) {
        loginBtn.textContent = 'Login to Graze';
        loginBtn.disabled = false;
        loginBtn.style.display = 'inline-block';
      }
      
      if (pushBtn) pushBtn.disabled = true;
      if (pushAllBtn) pushAllBtn.disabled = true;
      if (pushHeatmapBtn) pushHeatmapBtn.disabled = true;
      if (saveFeedBtn) saveFeedBtn.disabled = true;
      if (publishFeedBtn) publishFeedBtn.disabled = true;
    }
  }
};

// Auto-initialize on page load
// Use both DOMContentLoaded and a fallback for pages that load content dynamically
function tryInitGrazeSession() {
  const hasLoginStatus = !!document.getElementById('loginStatus');
  const hasLoginBtn = !!document.getElementById('loginBtn');
  console.log('GrazeSession auto-init check:', { hasLoginStatus, hasLoginBtn, url: window.location.href });
  
  if (hasLoginStatus || hasLoginBtn) {
    console.log('GrazeSession.init() called from auto-initialize');
    GrazeSession.init();
    return true;
  } else {
    console.log('GrazeSession: No loginStatus or loginBtn found, skipping auto-init');
    return false;
  }
}

document.addEventListener('DOMContentLoaded', tryInitGrazeSession);

// Also try after a short delay in case elements are added dynamically
setTimeout(() => {
  if (!GrazeSession.initialized && !GrazeSession.initializing) {
    console.log('GrazeSession: Retrying init after delay');
    tryInitGrazeSession();
  } else if (GrazeSession.initialized && GrazeSession.sessionCookie) {
    // If already initialized, refresh the UI in case content was loaded dynamically
    console.log('GrazeSession: Refreshing UI after delay (content may have loaded)');
    GrazeSession.updateUI(true);
  }
}, 500);
