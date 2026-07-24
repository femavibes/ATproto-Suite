// Shared Graze session management
const GrazeSession = {
  sessionCookie: null,
  username: null,
  
  async init() {
    // Try to get existing session from server
    try {
      const response = await fetch('/api/graze-session');
      const data = await response.json();
      
      if (data.success) {
        this.sessionCookie = data.sessionCookie;
        this.username = data.username;
        this.updateUI(true);
        return true;
      }
    } catch (error) {
      console.error('Error fetching Graze session:', error);
    }
    
    // If no session, try to login
    return await this.login();
  },
  
  async login() {
    try {
      const response = await fetch('/api/graze-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.sessionCookie = result.sessionCookie;
        this.username = result.username;
        this.updateUI(true);
        return true;
      } else {
        this.updateUI(false, result.error);
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
    const loginStatus = document.getElementById('loginStatus');
    const pushBtn = document.getElementById('pushBtn');
    const pushAllBtn = document.getElementById('pushAllBtn');
    const pushHeatmapBtn = document.getElementById('pushHeatmapBtn');
    const saveFeedBtn = document.getElementById('saveFeedBtn');
    const publishFeedBtn = document.getElementById('publishFeedBtn');
    
    console.log('GrazeSession.updateUI:', { success, error, username: this.username });
    
    if (success) {
      if (loginStatus) {
        loginStatus.textContent = `✓ Logged in as ${this.username}`;
        loginStatus.style.color = 'green';
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
      if (loginStatus) {
        loginStatus.textContent = error ? `✗ ${error}` : 'Connecting to Graze...';
        loginStatus.style.color = error ? 'red' : '#737373';
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
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('loginStatus') || document.getElementById('loginBtn')) {
    GrazeSession.init();
  }
});
