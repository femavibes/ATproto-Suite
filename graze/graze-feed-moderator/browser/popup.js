// Popup script for Feed Moderator extension
document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const apiUrlInput = document.getElementById('apiUrl');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const updateBtn = document.getElementById('updateBtn');
  const status = document.getElementById('status');
  const userInfo = document.getElementById('userInfo');
  const userHandle = document.getElementById('userHandle');
  const feedCount = document.getElementById('feedCount');

  // Load saved settings
  const result = await chrome.storage.sync.get(['apiKey', 'apiUrl', 'dryRunMode']);
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
  if (result.apiUrl) {
    apiUrlInput.value = result.apiUrl;
  }
  if (result.dryRunMode) {
    document.getElementById('dryRunMode').checked = result.dryRunMode;
  }

  // Test connection on load if we have settings
  if (result.apiKey && result.apiUrl) {
    testConnection(result.apiKey, result.apiUrl, false);
  }

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const apiUrl = apiUrlInput.value.trim();

    if (!apiKey) {
      showStatus('API key is required', 'error');
      return;
    }

    if (!apiUrl) {
      showStatus('API URL is required', 'error');
      return;
    }

    // Validate API key format
    if (!apiKey.startsWith('fm_live_')) {
      showStatus('Invalid API key format. Should start with fm_live_', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ 
        apiKey, 
        apiUrl, 
        dryRunMode: document.getElementById('dryRunMode').checked 
      });
      showStatus('Settings saved successfully', 'success');
      
      // Test connection after saving
      setTimeout(() => {
        testConnection(apiKey, apiUrl);
      }, 1000);
    } catch (error) {
      showStatus('Failed to save settings', 'error');
    }
  });

  // Test connection
  testBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const apiUrl = apiUrlInput.value.trim();
    
    if (!apiKey || !apiUrl) {
      showStatus('Please enter API key and URL first', 'error');
      return;
    }
    
    testConnection(apiKey, apiUrl);
  });

  // Update button - open GitHub tags
  updateBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com/femavibes/modmaster-browser/tags' });
  });

  async function testConnection(apiKey, apiUrl, showLoading = true) {
    if (showLoading) {
      testBtn.disabled = true;
      testBtn.textContent = 'Testing...';
      showStatus('Testing connection...', 'info');
    }

    try {
      const response = await fetch(`${apiUrl}/api/extension/user/profile`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        showStatus('Connection successful!', 'success');
        
        // Show user info
        userHandle.textContent = data.user.handle;
        feedCount.textContent = data.feeds.length;
        userInfo.style.display = 'block';
        
        // Reload content script
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.url && tab.url.includes('bsky.app')) {
            chrome.tabs.reload(tab.id);
          }
        } catch (e) {
          // Ignore tab reload errors
        }
      } else {
        const error = await response.json();
        showStatus(error.error || 'Connection failed', 'error');
        userInfo.style.display = 'none';
      }
    } catch (error) {
      showStatus('Network error - check your API URL', 'error');
      userInfo.style.display = 'none';
    } finally {
      if (showLoading) {
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
      }
    }
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    if (type === 'success') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 3000);
    }
  }
});