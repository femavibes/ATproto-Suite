// Enhanced Auto-updater for ModMaster Browser Extension
class AutoUpdater {
  constructor() {
    this.currentVersion = chrome.runtime.getManifest().version;
    this.updateCheckInterval = 6 * 60 * 60 * 1000; // 6 hours
    this.githubRepo = 'femavibes/modmaster-browser';
    this.init();
  }

  async init() {
    console.log('ModMaster AutoUpdater: Starting...');
    
    // Check for updates on startup
    setTimeout(() => this.checkForUpdates(), 5000);
    
    // Set up periodic checks
    this.startPeriodicChecks();
  }

  async checkForUpdates() {
    try {
      console.log('ModMaster AutoUpdater: Checking for updates...');
      
      const response = await fetch(`https://api.github.com/repos/${this.githubRepo}/releases/latest`);
      const release = await response.json();
      const latestVersion = release.tag_name.replace('v', '');
      
      console.log('ModMaster AutoUpdater: Current version:', this.currentVersion);
      console.log('ModMaster AutoUpdater: Latest version:', latestVersion);
      
      if (this.compareVersions(latestVersion, this.currentVersion) > 0) {
        console.log('ModMaster AutoUpdater: New version available!');
        await this.handleUpdate(release);
      } else {
        console.log('ModMaster AutoUpdater: Up to date');
      }
    } catch (error) {
      console.error('ModMaster AutoUpdater: Update check failed:', error);
    }
  }

  async handleUpdate(release) {
    const latestVersion = release.tag_name.replace('v', '');
    
    // Use GitHub's automatic zip download for tags
    const downloadUrl = `https://github.com/${this.githubRepo}/archive/refs/tags/${release.tag_name}.zip`;

    // Show update notification
    this.showUpdateNotification(latestVersion, release.html_url, downloadUrl);
    
    // Store update info for later
    await chrome.storage.local.set({
      pendingUpdate: {
        version: latestVersion,
        downloadUrl: downloadUrl,
        releaseUrl: release.html_url,
        releaseNotes: release.body
      }
    });
  }

  showUpdateNotification(version, releaseUrl, downloadUrl) {
    // Create notification
    chrome.notifications.create('modmaster-update', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'ModMaster Update Available',
      message: `Version ${version} is available. Click to update.`,
      buttons: [
        { title: 'Update Now' },
        { title: 'Later' }
      ]
    });

    // Handle notification clicks
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
      if (notificationId === 'modmaster-update') {
        if (buttonIndex === 0) {
          // Update Now
          this.startUpdateProcess();
        }
        chrome.notifications.clear(notificationId);
      }
    });

    // Handle notification click
    chrome.notifications.onClicked.addListener((notificationId) => {
      if (notificationId === 'modmaster-update') {
        this.startUpdateProcess();
        chrome.notifications.clear(notificationId);
      }
    });
  }

  async startUpdateProcess() {
    try {
      const { pendingUpdate } = await chrome.storage.local.get(['pendingUpdate']);
      if (!pendingUpdate) return;

      // Show progress notification
      chrome.notifications.create('modmaster-updating', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'ModMaster Updating',
        message: 'Downloading update...'
      });

      // Download the update
      const downloadId = await this.downloadUpdate(pendingUpdate.downloadUrl);
      
      // Monitor download progress
      this.monitorDownload(downloadId);
      
    } catch (error) {
      console.error('ModMaster AutoUpdater: Update failed:', error);
      this.showUpdateError();
    }
  }

  async downloadUpdate(url) {
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: url,
        filename: 'modmaster-update.zip',
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(downloadId);
        }
      });
    });
  }

  monitorDownload(downloadId) {
    const checkProgress = () => {
      chrome.downloads.search({ id: downloadId }, (downloads) => {
        if (downloads.length === 0) return;
        
        const download = downloads[0];
        
        if (download.state === 'complete') {
          this.handleDownloadComplete(download.filename);
        } else if (download.state === 'interrupted') {
          this.showUpdateError();
        } else {
          setTimeout(checkProgress, 500);
        }
      });
    };
    
    checkProgress();
  }

  async handleDownloadComplete(filename) {
    // Clear progress notification
    chrome.notifications.clear('modmaster-updating');
    
    // Show completion notification with instructions
    chrome.notifications.create('modmaster-update-ready', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'ModMaster Update Ready',
      message: 'Update downloaded. Click for installation instructions.',
      buttons: [
        { title: 'Install Now' },
        { title: 'Later' }
      ]
    });

    // Handle install button
    chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
      if (notificationId === 'modmaster-update-ready' && buttonIndex === 0) {
        this.showInstallInstructions();
        chrome.notifications.clear(notificationId);
      }
    });
  }

  showInstallInstructions() {
    // Create installation instructions page
    const instructionsHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>ModMaster Update Instructions</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .step { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
          .step h3 { margin-top: 0; color: #333; }
          .highlight { background: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0; }
          .success { background: #d4edda; color: #155724; }
        </style>
      </head>
      <body>
        <h1>🛡️ ModMaster Update Instructions</h1>
        <div class="highlight success">
          <strong>Good news!</strong> Your update has been downloaded. Follow these steps to install it:
        </div>
        
        <div class="step">
          <h3>Step 1: Open Chrome Extensions</h3>
          <p>Go to <code>chrome://extensions/</code> in your browser</p>
        </div>
        
        <div class="step">
          <h3>Step 2: Remove Old Version</h3>
          <p>Find "ModMaster Browser Extension" and click <strong>Remove</strong></p>
          <div class="highlight">
            <strong>Don't worry!</strong> Your API key and settings are safely stored and will be restored.
          </div>
        </div>
        
        <div class="step">
          <h3>Step 3: Install New Version</h3>
          <p>1. Click <strong>Load unpacked</strong></p>
          <p>2. Navigate to your Downloads folder</p>
          <p>3. Extract <code>modmaster-update.zip</code></p>
          <p>4. Select the extracted folder</p>
        </div>
        
        <div class="step">
          <h3>Step 4: Verify Installation</h3>
          <p>Your settings should be automatically restored. If not, re-enter your API key in the extension popup.</p>
        </div>
        
        <div class="highlight">
          <strong>Future updates will be even easier!</strong> We're working on making this process automatic.
        </div>
      </body>
      </html>
    `;
    
    // Create a blob URL and open it
    const blob = new Blob([instructionsHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    chrome.tabs.create({ url: url });
  }

  showUpdateError() {
    chrome.notifications.clear('modmaster-updating');
    chrome.notifications.create('modmaster-update-error', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'ModMaster Update Failed',
      message: 'Update failed. Please try again later.'
    });
  }

  compareVersions(a, b) {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    
    return 0;
  }

  startPeriodicChecks() {
    // Check for updates every 6 hours
    setInterval(() => {
      this.checkForUpdates();
    }, this.updateCheckInterval);
  }
}

// Initialize auto-updater
const autoUpdater = new AutoUpdater();