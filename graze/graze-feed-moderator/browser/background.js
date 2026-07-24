// Background service worker for Feed Moderator extension
// Load auto-updater
try {
  importScripts('auto-updater.js');
} catch (error) {
  console.error('Failed to load auto-updater:', error);
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Feed Moderator extension installed');
  
  // Initialize auto-updater
  setTimeout(() => {
    try {
      new AutoUpdater();
    } catch (error) {
      console.error('Failed to initialize auto-updater:', error);
    }
  }, 1000);
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['apiKey', 'apiUrl'], (result) => {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }
});

// Update badge when settings change
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.apiKey) {
    updateBadge();
  }
});

async function updateBadge() {
  const result = await chrome.storage.sync.get(['apiKey']);
  if (result.apiKey) {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  } else {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }
}

// Set initial badge
updateBadge();