// Content script for Bluesky Feed Moderator
class BlueskyModerator {
  constructor() {
    this.apiKey = null;
    this.apiUrl = null;
    this.userInfo = null;
    this.lastMysteryNumber = null;
    this.init();
  }

  async init() {
    console.log('Feed Moderator: Initializing...');
    
    // Get settings from storage
    const result = await chrome.storage.sync.get(['apiKey', 'apiUrl', 'dryRunMode']);
    this.apiKey = result.apiKey;
    this.apiUrl = result.apiUrl || 'https://modmaster.fema.monster';
    this.dryRunMode = result.dryRunMode || false;
    
    console.log('Feed Moderator: API Key present:', !!this.apiKey);
    console.log('Feed Moderator: API URL:', this.apiUrl);
    console.log('Feed Moderator: Dry Run Mode:', this.dryRunMode);
    
    if (!this.apiKey) {
      console.log('Feed Moderator: No API key configured');
      return;
    }

    // Get user info
    await this.loadUserInfo();
    
    // Start observing for new content
    this.observeContent();
    
    // Process existing content
    this.processExistingContent();
    
    // Start mystery number monitoring
    this.startMysteryNumberMonitoring();
    
    console.log('Feed Moderator: Initialization complete');
  }

  async loadUserInfo() {
    try {
      const response = await fetch(`${this.apiUrl}/api/extension/user/profile`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      if (response.ok) {
        this.userInfo = await response.json();
        console.log('Feed Moderator: Loaded user info', this.userInfo.user.handle);
      }
    } catch (error) {
      console.error('Feed Moderator: Failed to load user info', error);
    }
  }

  startMysteryNumberMonitoring() {
    console.log('ModMaster: Starting mystery number monitoring...');
    
    // Check every 5 seconds for mystery number changes
    setInterval(() => {
      this.checkForMysteryNumber();
    }, 5000);
    
    // Also check immediately
    this.checkForMysteryNumber();
  }
  
  checkForMysteryNumber() {
    // Check title first
    const title = document.title.replace(' — Bluesky', '').replace(' / Bluesky', '').trim();
    let mysteryNumber = null;
    let source = null;
    
    if (title && title !== 'Bluesky' && title !== 'Home') {
      const numberMatch = title.match(/^\((\d+)\)/);
      if (numberMatch) {
        mysteryNumber = numberMatch[1];
        source = 'title';
      }
    }
    
    // If not found in title, check page elements
    if (!mysteryNumber) {
      const feedSelectors = [
        'h1',
        '[role="heading"]',
        '[data-testid*="feedHeader"]'
      ];
      
      for (const selector of feedSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent?.trim();
          if (text && text.length > 0) {
            const numberMatch = text.match(/^\((\d+)\)/);
            if (numberMatch) {
              mysteryNumber = numberMatch[1];
              source = `element:${selector}`;
              break;
            }
          }
        }
        if (mysteryNumber) break;
      }
    }
    
    // If we found a mystery number and it's different from the last one
    if (mysteryNumber && mysteryNumber !== this.lastMysteryNumber) {
      console.log('🔥 MYSTERY NUMBER CHANGED!');
      console.log('🔥 Previous number:', this.lastMysteryNumber || 'none');
      console.log('🔥 New number:', mysteryNumber);
      console.log('🔥 Source:', source);
      console.log('🔥 URL:', window.location.href);
      console.log('🔥 Timestamp:', new Date().toISOString());
      
      // Show prominent notification
      this.showNotification(`Mystery number changed: ${this.lastMysteryNumber || 'none'} → ${mysteryNumber}`, 'info');
      
      // Update stored value
      this.lastMysteryNumber = mysteryNumber;
    } else if (mysteryNumber && mysteryNumber === this.lastMysteryNumber) {
      // Same number, just log quietly
      console.log('ModMaster: Mystery number unchanged:', mysteryNumber);
    }
  }

  observeContent() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.processElement(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  processExistingContent() {
    console.log('Feed Moderator: Processing existing content...');
    
    // Wait a bit for page to load
    setTimeout(() => {
      this.findAndProcessPosts();
    }, 2000);
    
    // Also try immediately
    this.findAndProcessPosts();
    
    // Set up URL change detection for SPA navigation
    let lastUrl = window.location.href;
    const checkUrlChange = () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('ModMaster: URL changed, reprocessing posts');
        setTimeout(() => {
          this.findAndProcessPosts();
        }, 1000);
      }
    };
    
    // Check for URL changes every 500ms
    setInterval(checkUrlChange, 500);
  }
  
  findAndProcessPosts() {
    // Remove existing moderation UI first to avoid duplicates
    document.querySelectorAll('.fm-post-actions').forEach(el => el.remove());
    
    // Use the correct Bluesky selectors based on page analysis
    const selectors = [
      // Current Bluesky post selectors (found in analysis)
      '[data-testid^="feedItem-by-"]',
      // Fallback selectors
      '[data-testid="feedItem"]',
      '[data-testid="postThreadItem"]'
    ];
    
    let posts = [];
    for (const selector of selectors) {
      try {
        posts = document.querySelectorAll(selector);
        console.log(`Feed Moderator: Selector "${selector}" found`, posts.length, 'elements');
        if (posts.length > 0) {
          console.log('Feed Moderator: Sample element:', posts[0]);
          break;
        }
      } catch (e) {
        console.log(`Feed Moderator: Selector "${selector}" failed:`, e.message);
      }
    }
    
    posts.forEach(post => {
      this.addPostModerationUI(post);
    });

    // Process profiles
    if (window.location.pathname.startsWith('/profile/')) {
      console.log('Feed Moderator: On profile page, adding profile UI');
      this.addProfileModerationUI();
    }
    
    console.log(`Feed Moderator: Processed ${posts.length} posts`);
  }

  processElement(element) {
    // Check for new posts using correct selectors
    if (element.matches && element.matches('[data-testid^="feedItem-by-"]')) {
      this.addPostModerationUI(element);
      return;
    }
    
    // Check for posts within the element
    if (element.querySelectorAll) {
      element.querySelectorAll('[data-testid^="feedItem-by-"]').forEach(post => {
        this.addPostModerationUI(post);
      });
    }

    // Check if we're on a profile page
    if (window.location.pathname.startsWith('/profile/')) {
      this.addProfileModerationUI();
    }
  }

  addPostModerationUI(postElement) {
    // Skip if already processed
    if (postElement.querySelector('.fm-post-actions')) return;

    // Skip notifications page to prevent layout issues
    if (window.location.pathname === '/notifications') {
      return;
    }

    console.log('Feed Moderator: Processing post element:', postElement);

    // Find the bottom of the post to add our buttons
    let insertLocation = postElement;
    
    // Try to find a better insertion point (after post content, before engagement buttons)
    const postText = postElement.querySelector('[data-testid="postText"]');
    if (postText) {
      insertLocation = postText.parentElement;
    }

    // Extract post info from the data-testid
    const testId = postElement.getAttribute('data-testid');
    if (!testId || !testId.startsWith('feedItem-by-')) {
      console.log('Feed Moderator: Invalid post testId:', testId);
      return;
    }
    
    const authorHandle = testId.replace('feedItem-by-', '');
    
    // Try to find post URI from links
    const postLink = postElement.querySelector('a[href*="/post/"]');
    let postUri = null;
    
    if (postLink) {
      const href = postLink.getAttribute('href');
      const match = href.match(/\/profile\/([^\/]+)\/post\/([^\/\?]+)/);
      if (match) {
        const [, handle, postId] = match;
        postUri = `at://${handle.replace('@', '')}/app.bsky.feed.post/${postId}`;
      }
    }

    const postInfo = {
      uri: postUri,
      authorHandle: authorHandle,
      element: postElement
    };

    console.log('Feed Moderator: Adding moderation UI for post:', postInfo);

    // Create moderation buttons - get fresh feed info each time
    const buttonsContainer = this.createPostDropdown(postInfo);
    insertLocation.appendChild(buttonsContainer);
  }

  extractPostInfo(postElement) {
    try {
      // Try to find the post URI from various possible locations
      const linkElement = postElement.querySelector('a[href*="/post/"]');
      if (!linkElement) return null;

      const href = linkElement.getAttribute('href');
      const match = href.match(/\/profile\/([^\/]+)\/post\/([^\/\?]+)/);
      if (!match) return null;

      const [, handle, postId] = match;
      const postUri = `at://${handle.replace('@', '')}/app.bsky.feed.post/${postId}`;

      // Extract author handle
      const authorElement = postElement.querySelector('[data-testid="authorHandle"]');
      const authorHandle = authorElement ? authorElement.textContent.replace('@', '') : handle.replace('@', '');

      return {
        uri: postUri,
        authorHandle: authorHandle,
        element: postElement
      };
    } catch (error) {
      console.error('Failed to extract post info:', error);
      return null;
    }
  }

  createPostDropdown(postInfo) {
    const container = document.createElement('div');
    container.className = 'fm-post-actions';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 0;
      border-top: 1px solid #e1e8ed;
      margin-top: 8px;
    `;

    const currentFeed = this.getCurrentFeed();
    console.log('ModMaster: Current feed:', currentFeed);

    // Check if current feed is configured
    const isConfiguredFeed = this.isConfiguredFeed(currentFeed);
    console.log('ModMaster: Is configured feed:', isConfiguredFeed);

    // Ban section
    const banSection = document.createElement('div');
    banSection.style.cssText = 'display: flex; align-items: center; gap: 4px;';
    
    const banLabel = document.createElement('button');
    banLabel.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
      <circle cx="12" cy="12" r="10"/>
      <path d="m4.9 4.9 14.2 14.2"/>
    </svg>Ban:`;
    banLabel.style.cssText = `
      background: #f8f9fa;
      color: #536471;
      border: 1px solid #e1e8ed;
      padding: 2px 8px;
      border-radius: 3px;
      cursor: default;
      font-size: 10px;
      font-weight: 600;
      display: flex;
      align-items: center;
      width: 80px;
      justify-content: center;
    `;
    
    // Ban [Current Feed] button (first)
    const banCurrentBtn = document.createElement('button');
    banCurrentBtn.textContent = `[${currentFeed}]`;
    
    if (!isConfiguredFeed) {
      banCurrentBtn.style.cssText = `
        background: #6c757d;
        color: #fff;
        border: none;
        padding: 2px 6px;
        border-radius: 3px;
        cursor: not-allowed;
        font-size: 10px;
        font-weight: 500;
        opacity: 0.6;
      `;
      banCurrentBtn.title = 'Feed not configured';
      banCurrentBtn.onclick = (e) => {
        e.stopPropagation();
        this.showNotification('Feed not configured in ModMaster', 'error');
      };
    } else {
      banCurrentBtn.style.cssText = `
        background: #ffc107;
        color: #000;
        border: none;
        padding: 2px 6px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 500;
        transition: all 0.2s;
      `;
      banCurrentBtn.onmouseover = () => banCurrentBtn.style.backgroundColor = '#e0a800';
      banCurrentBtn.onmouseout = () => banCurrentBtn.style.backgroundColor = '#ffc107';
      banCurrentBtn.onclick = (e) => {
        e.stopPropagation();
        
        if (this.dryRunMode) {
          this.dryRunAction('banUser', {
            handle: postInfo.authorHandle,
            targets: [currentFeed],
            description: `Ban ${postInfo.authorHandle} from ${currentFeed}`
          });
          return;
        }
        
        if (confirm(`Ban ${postInfo.authorHandle} from ${currentFeed}?`)) {
          this.banUser(postInfo.authorHandle, [currentFeed]);
        }
      };
    }

    // Ban [All Configured Lists] button (second)
    const banConfiguredBtn = document.createElement('button');
    banConfiguredBtn.textContent = '[All Configured Lists]';
    banConfiguredBtn.style.cssText = `
      background: #6c757d;
      color: white;
      border: none;
      padding: 2px 6px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    banConfiguredBtn.onmouseover = () => banConfiguredBtn.style.backgroundColor = '#5a6268';
    banConfiguredBtn.onmouseout = () => banConfiguredBtn.style.backgroundColor = '#6c757d';
    banConfiguredBtn.onclick = (e) => {
      e.stopPropagation();
      
      if (this.dryRunMode) {
        this.dryRunAction('banUser', {
          handle: postInfo.authorHandle,
          targets: [],
          description: `Ban ${postInfo.authorHandle} from all your configured lists`
        });
        return;
      }
      
      if (confirm(`Ban ${postInfo.authorHandle} from all your configured lists?`)) {
        this.banUser(postInfo.authorHandle, []);
      }
    };

    // Ban [Group] button
    const banGroupBtn = document.createElement('button');
    banGroupBtn.textContent = '[Group]';
    banGroupBtn.style.cssText = `
      background: #6f42c1;
      color: white;
      border: none;
      padding: 2px 6px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    banGroupBtn.onmouseover = () => banGroupBtn.style.backgroundColor = '#5a2d91';
    banGroupBtn.onmouseout = () => banGroupBtn.style.backgroundColor = '#6f42c1';
    banGroupBtn.onclick = (e) => {
      e.stopPropagation();
      this.showGroupSelector('ban', postInfo.authorHandle, currentFeed);
    };

    // Ban [Global] button (last)
    const banGlobalBtn = document.createElement('button');
    banGlobalBtn.textContent = '[Global]';
    banGlobalBtn.style.cssText = `
      background: #dc3545;
      color: white;
      border: none;
      padding: 2px 6px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    banGlobalBtn.onmouseover = () => banGlobalBtn.style.backgroundColor = '#c82333';
    banGlobalBtn.onmouseout = () => banGlobalBtn.style.backgroundColor = '#dc3545';
    banGlobalBtn.onclick = (e) => {
      e.stopPropagation();
      
      if (this.dryRunMode) {
        this.dryRunAction('banUser', {
          handle: postInfo.authorHandle,
          targets: ['global'],
          description: `Ban ${postInfo.authorHandle} from global list`
        });
        return;
      }
      
      if (confirm(`Ban ${postInfo.authorHandle} from global list?`)) {
        this.banUser(postInfo.authorHandle, ['global']);
      }
    };

    banSection.appendChild(banLabel);
    banSection.appendChild(banCurrentBtn);
    banSection.appendChild(banConfiguredBtn);
    banSection.appendChild(banGroupBtn);
    banSection.appendChild(banGlobalBtn);

    // Remove section
    const removeSection = document.createElement('div');
    removeSection.style.cssText = 'display: flex; align-items: center; gap: 4px;';
    
    const removeLabel = document.createElement('button');
    removeLabel.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
      <polyline points="3,6 5,6 21,6"/>
      <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
    </svg>Remove:`;
    removeLabel.style.cssText = `
      background: #f8f9fa;
      color: #536471;
      border: 1px solid #e1e8ed;
      padding: 2px 8px;
      border-radius: 3px;
      cursor: default;
      font-size: 10px;
      font-weight: 600;
      display: flex;
      align-items: center;
      width: 80px;
      justify-content: center;
    `;

    // Remove [Current Feed] button
    const removeCurrentBtn = document.createElement('button');
    removeCurrentBtn.textContent = `[${currentFeed}]`;
    
    if (!isConfiguredFeed) {
      removeCurrentBtn.style.cssText = `
        background: #6c757d;
        color: #fff;
        border: none;
        padding: 2px 6px;
        border-radius: 3px;
        cursor: not-allowed;
        font-size: 10px;
        font-weight: 500;
        opacity: 0.6;
      `;
      removeCurrentBtn.title = 'Feed not configured';
      removeCurrentBtn.onclick = (e) => {
        e.stopPropagation();
        this.showNotification('Feed not configured in ModMaster', 'error');
      };
    } else {
      removeCurrentBtn.style.cssText = `
        background: #ffc107;
        color: #000;
        border: none;
        padding: 2px 6px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 500;
        transition: all 0.2s;
      `;
      removeCurrentBtn.onmouseover = () => removeCurrentBtn.style.backgroundColor = '#e0a800';
      removeCurrentBtn.onmouseout = () => removeCurrentBtn.style.backgroundColor = '#ffc107';
      removeCurrentBtn.onclick = (e) => {
        e.stopPropagation();
        
        if (this.dryRunMode) {
          this.dryRunAction('removePost', {
            postUri: postInfo.uri,
            targets: [currentFeed],
            description: `Remove post from ${currentFeed}`
          });
          return;
        }
        
        if (confirm(`Remove this post from ${currentFeed}?`)) {
          this.removePost(postInfo.uri, [currentFeed]);
        }
      };
    }

    // Remove [All Configured Feeds] button
    const removeConfiguredBtn = document.createElement('button');
    removeConfiguredBtn.textContent = '[All Configured Feeds]';
    removeConfiguredBtn.style.cssText = `
      background: #6c757d;
      color: white;
      border: none;
      padding: 2px 6px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    removeConfiguredBtn.onmouseover = () => removeConfiguredBtn.style.backgroundColor = '#5a6268';
    removeConfiguredBtn.onmouseout = () => removeConfiguredBtn.style.backgroundColor = '#6c757d';
    removeConfiguredBtn.onclick = (e) => {
      e.stopPropagation();
      
      if (this.dryRunMode) {
        this.dryRunAction('removePost', {
          postUri: postInfo.uri,
          targets: [],
          description: 'Remove post from all your configured feeds'
        });
        return;
      }
      
      if (confirm('Remove this post from all your configured feeds?')) {
        this.removePost(postInfo.uri, []);
      }
    };

    // Remove [Group] button
    const removeGroupBtn = document.createElement('button');
    removeGroupBtn.textContent = '[Group]';
    removeGroupBtn.style.cssText = `
      background: #6f42c1;
      color: white;
      border: none;
      padding: 2px 6px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    removeGroupBtn.onmouseover = () => removeGroupBtn.style.backgroundColor = '#5a2d91';
    removeGroupBtn.onmouseout = () => removeGroupBtn.style.backgroundColor = '#6f42c1';
    removeGroupBtn.onclick = (e) => {
      e.stopPropagation();
      this.showGroupSelector('remove', postInfo.uri, currentFeed);
    };

    // Remove [All Feeds] button
    const removeAllBtn = document.createElement('button');
    removeAllBtn.textContent = '[All Feeds]';
    removeAllBtn.style.cssText = `
      background: #dc3545;
      color: white;
      border: none;
      padding: 2px 6px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    removeAllBtn.onmouseover = () => removeAllBtn.style.backgroundColor = '#c82333';
    removeAllBtn.onmouseout = () => removeAllBtn.style.backgroundColor = '#dc3545';
    removeAllBtn.onclick = (e) => {
      e.stopPropagation();
      
      if (this.dryRunMode) {
        this.dryRunAction('removePost', {
          postUri: postInfo.uri,
          targets: ['all'],
          description: 'Remove post from all feeds in the system'
        });
        return;
      }
      
      if (confirm('Remove this post from ALL feeds in the system?')) {
        this.removePost(postInfo.uri, ['all']);
      }
    };

    removeSection.appendChild(removeLabel);
    removeSection.appendChild(removeCurrentBtn);
    removeSection.appendChild(removeConfiguredBtn);
    removeSection.appendChild(removeGroupBtn);
    removeSection.appendChild(removeAllBtn);

    container.appendChild(banSection);
    container.appendChild(removeSection);
    return container;
  }

  addProfileModerationUI() {
    // Skip if already processed
    if (document.querySelector('.fm-profile-actions')) return;

    // Skip notifications page to prevent layout issues
    if (window.location.pathname === '/notifications') {
      return;
    }

    // Find profile header
    const profileHeader = document.querySelector('[data-testid="profileHeaderDisplayName"]')?.parentElement?.parentElement;
    if (!profileHeader) return;

    // Extract profile handle
    const handleElement = document.querySelector('[data-testid="profileHeaderHandle"]');
    if (!handleElement) return;

    const handle = handleElement.textContent.replace('@', '');

    // Create moderation panel
    const panel = this.createProfilePanel(handle);
    profileHeader.appendChild(panel);
  }

  createProfilePanel(handle) {
    const panel = document.createElement('div');
    panel.className = 'fm-profile-actions';
    panel.style.cssText = `
      margin-top: 16px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 12px;
      border: 1px solid #cfd9de;
      backdrop-filter: blur(12px);
    `;

    const title = document.createElement('div');
    title.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; margin-right: 6px; vertical-align: middle;">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>Feed Moderator`;
    title.style.cssText = 'font-weight: bold; margin-bottom: 12px; font-size: 14px; display: flex; align-items: center; color: #0f1419;';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';

    const currentFeed = this.getCurrentFeed();
    const buttons = [
      { text: 'Ban [Global]', action: () => {
        if (this.dryRunMode) {
          this.dryRunAction('banUser', {
            handle: handle,
            targets: ['global'],
            description: `Ban ${handle} from global list`
          });
          return;
        }
        if (confirm(`Ban ${handle} from global list?`)) {
          this.banUser(handle, ['global']);
        }
      }},
      { text: `Ban [${currentFeed}]`, action: () => {
        if (this.dryRunMode) {
          this.dryRunAction('banUser', {
            handle: handle,
            targets: [currentFeed],
            description: `Ban ${handle} from ${currentFeed}`
          });
          return;
        }
        if (confirm(`Ban ${handle} from ${currentFeed}?`)) {
          this.banUser(handle, [currentFeed]);
        }
      }},
      { text: 'Unban [Global]', action: () => {
        if (this.dryRunMode) {
          this.dryRunAction('unbanUser', {
            handle: handle,
            targets: ['global'],
            description: `Unban ${handle} from global list`
          });
          return;
        }
        if (confirm(`Unban ${handle} from global list?`)) {
          this.unbanUser(handle, ['global']);
        }
      }},
      { text: `Unban [${currentFeed}]`, action: () => {
        if (this.dryRunMode) {
          this.dryRunAction('unbanUser', {
            handle: handle,
            targets: [currentFeed],
            description: `Unban ${handle} from ${currentFeed}`
          });
          return;
        }
        if (confirm(`Unban ${handle} from ${currentFeed}?`)) {
          this.unbanUser(handle, [currentFeed]);
        }
      }}
    ];

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.textContent = btn.text;
      button.style.cssText = `
        padding: 8px 12px;
        background: #fff;
        color: #536471;
        border: 1px solid #cfd9de;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s;
      `;
      button.onmouseover = () => {
        button.style.backgroundColor = '#f7f9f9';
        button.style.borderColor = '#536471';
      };
      button.onmouseout = () => {
        button.style.backgroundColor = '#fff';
        button.style.borderColor = '#cfd9de';
      };
      button.onclick = btn.action;
      buttonContainer.appendChild(button);
    });

    panel.appendChild(title);
    panel.appendChild(buttonContainer);
    return panel;
  }

  async banUser(handle, targets = ['global']) {
    if (!this.apiKey) {
      this.showNotification('No API key configured', 'error');
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/extension/moderation/ban`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ handle, targets })
      });

      const result = await response.json();
      if (response.ok) {
        this.showNotification(`Banned ${handle} successfully`, 'success');
      } else {
        this.showNotification(result.error || 'Ban failed', 'error');
      }
    } catch (error) {
      this.showNotification('Network error', 'error');
      console.error('Ban error:', error);
    }
  }

  async unbanUser(handle, targets = ['global']) {
    if (!this.apiKey) {
      this.showNotification('No API key configured', 'error');
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/extension/moderation/unban`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ handle, targets })
      });

      const result = await response.json();
      if (response.ok) {
        this.showNotification(`Unbanned ${handle} successfully`, 'success');
      } else {
        this.showNotification(result.error || 'Unban failed', 'error');
      }
    } catch (error) {
      this.showNotification('Network error', 'error');
      console.error('Unban error:', error);
    }
  }

  async removePost(postUri, targets = []) {
    if (!this.apiKey) {
      this.showNotification('No API key configured', 'error');
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/extension/moderation/remove`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ postUri, targets })
      });

      const result = await response.json();
      if (response.ok) {
        this.showNotification('Post removed successfully', 'success');
      } else {
        this.showNotification(result.error || 'Remove failed', 'error');
      }
    } catch (error) {
      this.showNotification('Network error', 'error');
      console.error('Remove error:', error);
    }
  }

  dryRunAction(actionType, params) {
    const apiCall = {
      url: `${this.apiUrl}/api/extension/moderation/${actionType === 'banUser' ? 'ban' : 'remove'}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    };
    
    const dryRunInfo = `🧪 DRY RUN MODE\n\nAction: ${params.description}\nCurrent Feed: ${this.getCurrentFeed()}\n\nAPI Call that would be made:\n${JSON.stringify(apiCall, null, 2)}`;
    
    console.log('ModMaster Dry Run:', apiCall);
    
    // Copy to clipboard
    navigator.clipboard.writeText(dryRunInfo).then(() => {
      alert(dryRunInfo + '\n\n✅ Copied to clipboard!');
    }).catch(() => {
      alert(dryRunInfo);
    });
  }

  isConfiguredFeed(feedName) {
    if (!this.userInfo || !this.userInfo.feeds) {
      console.log('ModMaster: No user info available for feed check');
      return false;
    }

    // Normalize the feed name (remove number prefix like "(1) ")
    const normalizedFeedName = feedName.replace(/^\(\d+\)\s+/, '');
    console.log('ModMaster: Checking if feed is configured:', normalizedFeedName);

    // Check against user's configured feeds
    const isConfigured = this.userInfo.feeds.some(feed => {
      // Match against feed_slug or bluesky_feed_name
      const slugMatch = feed.feed_slug && feed.feed_slug.toLowerCase() === normalizedFeedName.toLowerCase();
      const nameMatch = feed.bluesky_feed_name && feed.bluesky_feed_name.toLowerCase() === normalizedFeedName.toLowerCase();
      
      console.log('ModMaster: Checking feed:', {
        configuredSlug: feed.feed_slug,
        configuredName: feed.bluesky_feed_name,
        targetName: normalizedFeedName,
        slugMatch,
        nameMatch
      });
      
      return slugMatch || nameMatch;
    });

    console.log('ModMaster: Feed configured:', isConfigured);
    return isConfigured;
  }

  getCurrentFeed() {
    // Detect current feed - prioritize Bluesky URL slug for matching
    const url = window.location.href;
    console.log('ModMaster: Detecting current feed from URL:', url);
    
    // Method 1: Extract Bluesky feed slug from URL (most reliable for matching)
    const feedMatch = url.match(/\/profile\/[^\/]+\/feed\/([^\/\?]+)/);
    if (feedMatch) {
      const blueskySlug = feedMatch[1];
      console.log('ModMaster: Found Bluesky feed slug:', blueskySlug);
      return blueskySlug;
    }
    
    // Method 2: Check page title for feed name (fallback) - STRIP THE NUMBER!
    const title = document.title.replace(' — Bluesky', '').replace(' / Bluesky', '').trim();
    if (title && title !== 'Bluesky' && title !== 'Home') {
      // Check for mystery number in title
      const numberMatch = title.match(/^\((\d+)\)/);
      if (numberMatch) {
        const mysteryNumber = numberMatch[1];
        console.log('🔍 MYSTERY NUMBER DETECTED IN TITLE:', mysteryNumber);
        console.log('🔍 Full title:', title);
        console.log('🔍 URL:', window.location.href);
        console.log('🔍 Timestamp:', new Date().toISOString());
        
        // Also show a notification to make it more visible
        this.showNotification(`Mystery number detected: ${mysteryNumber}`, 'info');
      }
      
      // Remove the number prefix like "(6) " from the title
      const cleanTitle = title.replace(/^\(\d+\)\s+/, '');
      console.log('ModMaster: Found feed name in title:', title, '-> cleaned:', cleanTitle);
      return cleanTitle;
    }
    
    // Method 3: Look for feed header/name in the page
    const feedSelectors = [
      'h1',
      '[role="heading"]',
      '[data-testid*="feedHeader"]'
    ];
    
    for (const selector of feedSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        if (text && text.length > 0 && text !== 'Home' && text !== 'Bluesky' && !text.includes('Back')) {
          // Check for mystery number in page elements
          const numberMatch = text.match(/^\((\d+)\)/);
          if (numberMatch) {
            const mysteryNumber = numberMatch[1];
            console.log('🔍 MYSTERY NUMBER DETECTED IN PAGE ELEMENT:', mysteryNumber);
            console.log('🔍 Full text:', text);
            console.log('🔍 Element selector:', selector);
            console.log('🔍 URL:', window.location.href);
            console.log('🔍 Timestamp:', new Date().toISOString());
            
            // Also show a notification to make it more visible
            this.showNotification(`Mystery number detected: ${mysteryNumber}`, 'info');
          }
          
          // Remove the number prefix like "(6) " from the text
          const cleanText = text.replace(/^\(\d+\)\s+/, '');
          console.log(`ModMaster: Found feed name "${text}" -> cleaned: "${cleanText}" from ${selector}`);
          return cleanText;
        }
      }
    }
    
    // Default to following for home timeline
    console.log('ModMaster: Defaulting to following');
    return 'following';
  }

  addTestButton() {
    testButton.innerHTML = '🛡️ ModMaster Active - Click to inspect page<br><small>Toggle dry run in popup settings</small>';
    testButton.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: #1d9bf0;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      cursor: pointer;
      line-height: 1.3;
    `;
    testButton.onclick = () => {
      // Show page structure info
      const allDivs = document.querySelectorAll('div').length;
      const allButtons = document.querySelectorAll('button').length;
      const testIds = Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid')).slice(0, 20);
      const allTestIds = Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid')).filter((v,i,a) => a.indexOf(v) === i).sort();
      
      const info = `ModMaster Page Analysis:

Total divs: ${allDivs}
Total buttons: ${allButtons}
URL: ${window.location.href}

First 20 data-testid values:
${testIds.join('\n')}

All unique data-testid values (${allTestIds.length} total):
${allTestIds.join('\n')}`;
      
      console.log('ModMaster Page Analysis:', {
        totalDivs: allDivs,
        totalButtons: allButtons,
        firstTestIds: testIds,
        allTestIds: allTestIds,
        url: window.location.href
      });
      
      // Copy to clipboard
      navigator.clipboard.writeText(info).then(() => {
        this.showNotification('Page analysis copied to clipboard!', 'success');
      }).catch(() => {
        // Fallback: show in alert if clipboard fails
        alert(info);
      });
    };
    document.body.appendChild(testButton);
    console.log('Feed Moderator: Added test button with page analysis');
  }

  showGroupSelector(action, target, currentFeed) {
    // Remove any existing group selector
    const existing = document.querySelector('.fm-group-selector');
    if (existing) existing.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'fm-group-selector';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 20px;
      max-width: 400px;
      width: 90%;
      max-height: 80%;
      overflow-y: auto;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = `Select Groups to ${action === 'ban' ? 'Ban From' : 'Remove From'}`;
    title.style.cssText = 'margin: 0 0 15px 0; font-size: 16px; color: #333;';
    modal.appendChild(title);

    // Loading message
    const loading = document.createElement('div');
    loading.textContent = 'Loading groups...';
    loading.style.cssText = 'text-align: center; padding: 20px; color: #666;';
    modal.appendChild(loading);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 15px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
    `;
    closeBtn.onclick = () => overlay.remove();
    modal.appendChild(closeBtn);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    // Fetch groups for current feed
    this.fetchFeedGroups(currentFeed).then(groups => {
      loading.remove();
      
      if (!groups || groups.length === 0) {
        const noGroups = document.createElement('div');
        noGroups.textContent = 'This feed is not in any groups.';
        noGroups.style.cssText = 'text-align: center; padding: 20px; color: #666;';
        modal.appendChild(noGroups);
        return;
      }

      // Create checkboxes for each group
      const groupList = document.createElement('div');
      groupList.style.cssText = 'margin-bottom: 20px;';
      
      const checkboxes = [];
      groups.forEach(group => {
        const groupItem = document.createElement('label');
        groupItem.style.cssText = `
          display: flex;
          align-items: center;
          padding: 8px 0;
          cursor: pointer;
        `;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = group.name;
        checkbox.style.cssText = 'margin-right: 10px;';
        checkboxes.push(checkbox);
        
        const label = document.createElement('span');
        label.textContent = group.name;
        label.style.cssText = 'font-size: 14px;';
        
        groupItem.appendChild(checkbox);
        groupItem.appendChild(label);
        groupList.appendChild(groupItem);
      });
      
      modal.appendChild(groupList);

      // Action buttons
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
      
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = `
        padding: 8px 16px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      `;
      cancelBtn.onclick = () => overlay.remove();
      
      const actionBtn = document.createElement('button');
      actionBtn.textContent = action === 'ban' ? 'Ban' : 'Remove';
      actionBtn.style.cssText = `
        padding: 8px 16px;
        background: ${action === 'ban' ? '#dc3545' : '#ffc107'};
        color: ${action === 'ban' ? 'white' : '#000'};
        border: none;
        border-radius: 4px;
        cursor: pointer;
      `;
      actionBtn.onclick = () => {
        const selectedGroups = checkboxes
          .filter(cb => cb.checked)
          .map(cb => `group:${cb.value}`);
        
        if (selectedGroups.length === 0) {
          alert('Please select at least one group.');
          return;
        }
        
        overlay.remove();
        
        if (action === 'ban') {
          this.banUser(target, selectedGroups);
        } else {
          this.removePost(target, selectedGroups);
        }
      };
      
      buttonContainer.appendChild(cancelBtn);
      buttonContainer.appendChild(actionBtn);
      modal.appendChild(buttonContainer);
    }).catch(error => {
      loading.textContent = 'Error loading groups.';
      console.error('Failed to load groups:', error);
    });
  }

  async fetchFeedGroups(feedName) {
    if (!this.apiKey) return [];
    
    try {
      const response = await fetch(`${this.apiUrl}/api/extension/feed/groups?feed=${encodeURIComponent(feedName)}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.groups || [];
      }
    } catch (error) {
      console.error('Failed to fetch feed groups:', error);
    }
    
    return [];
  }

  showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.fm-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'fm-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds for mystery number notifications, 3 seconds for others
    const timeout = message.includes('Mystery number') ? 5000 : 3000;
    setTimeout(() => {
      notification.remove();
    }, timeout);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new BlueskyModerator());
} else {
  new BlueskyModerator();
}