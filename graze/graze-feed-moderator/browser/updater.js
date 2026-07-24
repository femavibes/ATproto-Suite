// Auto-updater for ModMaster Browser Extension
class AutoUpdater {
  constructor() {
    this.currentVersion = chrome.runtime.getManifest().version;
    this.updateCheckInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.lastUpdateCheck = 0;
  }

  async checkForUpdates(force = false) {
    const now = Date.now();
    
    // Skip if recently checked (unless forced)
    if (!force && (now - this.lastUpdateCheck) < this.updateCheckInterval) {
      return null;
    }

    try {
      const response = await fetch('https://api.github.com/repos/femavibes/modmaster-browser/releases/latest');
      const release = await response.json();
      const latestVersion = release.tag_name.replace('v', '');
      
      this.lastUpdateCheck = now;
      chrome.storage.local.set({ lastUpdateCheck: now });
      
      if (this.compareVersions(latestVersion, this.currentVersion) > 0) {
        return {
          available: true,
          version: latestVersion,
          downloadUrl: `https://github.com/femavibes/modmaster-browser/archive/refs/tags/v${latestVersion}.zip`,
          releaseNotes: release.body || 'No release notes available'
        };
      }
      
      return { available: false, version: this.currentVersion };
    } catch (error) {
      console.error('Update check failed:', error);
      return null;
    }
  }

  async downloadUpdate(downloadUrl, version) {
    try {
      // For security reasons, Chrome extensions can't auto-install
      // But we can trigger a download and show instructions
      
      // Create notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.svg',
        title: 'ModMaster Update Available',
        message: `Version ${version} is ready to download!`
      });
      
      // Trigger download
      chrome.downloads.download({
        url: downloadUrl,
        filename: `modmaster-browser-v${version}.zip`,
        saveAs: true
      });
      
      return true;
    } catch (error) {
      console.error('Download failed:', error);
      return false;
    }
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

  // Start periodic update checks
  startPeriodicChecks() {
    // Check on startup
    this.checkForUpdates();
    
    // Set up periodic checks
    setInterval(() => {
      this.checkForUpdates();
    }, this.updateCheckInterval);
  }
}

// Initialize auto-updater
const autoUpdater = new AutoUpdater();

// Export for use in popup
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutoUpdater;
} else {
  window.AutoUpdater = AutoUpdater;
}