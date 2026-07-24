// Feed Settings Modal
function openFeedSettings() {
    const modal = document.createElement('div');
    modal.id = 'feedSettingsModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 2000;';
    
    const content = document.createElement('div');
    content.style.cssText = 'background: #2a2a2a; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; max-height: 80vh; overflow: auto; border: 2px solid #4a9eff;';
    
    content.innerHTML = `
        <h2 style="margin: 0 0 20px 0; color: #4a9eff; font-size: 20px;">⚙️ Feed Settings</h2>
        
        <div style="margin-bottom: 25px;">
            <h3 style="font-size: 14px; color: #888; margin-bottom: 15px; text-transform: uppercase;">Feed Configuration</h3>
            
            <div style="margin-bottom: 20px; padding: 15px; background: #1a1a1a; border-radius: 8px;">
                <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
                    <input type="checkbox" id="enablePinnedPosts" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
                    <div>
                        <div style="font-size: 14px; font-weight: 600; color: white;">📌 Pinned Posts</div>
                        <div style="font-size: 12px; color: #888;">Static posts always at top</div>
                    </div>
                </label>
                <div id="pinnedPostsConfig" style="margin-top: 10px; padding-left: 28px;">
                    <textarea id="pinnedPostUrls" placeholder="Enter post URLs (one per line)\nhttps://bsky.app/profile/user.bsky.social/post/..." rows="3" style="width: 100%; background: #2a2a2a; border: 1px solid #444; color: white; padding: 8px; border-radius: 4px; font-size: 12px; resize: vertical; font-family: monospace; margin-bottom: 8px;"></textarea>
                    <label style="display: block; font-size: 12px; color: #888; margin-bottom: 5px;">Show every X posts</label>
                    <input type="number" id="pinnedFrequency" value="1" min="1" style="width: 100px; background: #2a2a2a; border: 1px solid #444; color: white; padding: 6px; border-radius: 4px; font-size: 12px;">
                </div>
            </div>
            
            <div style="margin-bottom: 20px; padding: 15px; background: #1a1a1a; border-radius: 8px;">
                <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
                    <input type="checkbox" id="enableRotatingPosts" style="margin-right: 10px; width: 18px; height: 18px; cursor: pointer;">
                    <div>
                        <div style="font-size: 14px; font-weight: 600; color: white;">🔄 Rotating Pinned Posts</div>
                        <div style="font-size: 12px; color: #888;">Cycles through posts at fixed position</div>
                    </div>
                </label>
                <div id="rotatingPostsConfig" style="margin-top: 10px; padding-left: 28px;">
                    <textarea id="rotatingPostUrls" placeholder="Enter post URLs (one per line)\nhttps://bsky.app/profile/user.bsky.social/post/..." rows="3" style="width: 100%; background: #2a2a2a; border: 1px solid #444; color: white; padding: 8px; border-radius: 4px; font-size: 12px; resize: vertical; font-family: monospace; margin-bottom: 8px;"></textarea>
                    <label style="display: block; font-size: 12px; color: #888; margin-bottom: 5px;">Fixed position (post #)</label>
                    <input type="number" id="rotatingPosition" value="1" min="0" style="width: 100px; background: #2a2a2a; border: 1px solid #444; color: white; padding: 6px; border-radius: 4px; font-size: 12px; margin-bottom: 8px;">
                    <label style="display: block; font-size: 12px; color: #888; margin-bottom: 5px;">Rotate every X minutes</label>
                    <input type="number" id="rotatingFrequency" value="30" min="1" style="width: 100px; background: #2a2a2a; border: 1px solid #444; color: white; padding: 6px; border-radius: 4px; font-size: 12px;">
                </div>
            </div>
        </div>
        
        <div style="margin-bottom: 25px;">
            <h3 style="font-size: 14px; color: #888; margin-bottom: 15px; text-transform: uppercase;">Feed Metadata</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 5px;">Feed Name</label>
                <input type="text" id="feedName" placeholder="My Custom Feed" style="width: 100%; background: #1a1a1a; border: 1px solid #444; color: white; padding: 8px; border-radius: 4px; font-size: 14px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 5px;">Description</label>
                <textarea id="feedDescription" placeholder="Describe your feed..." rows="3" style="width: 100%; background: #1a1a1a; border: 1px solid #444; color: white; padding: 8px; border-radius: 4px; font-size: 14px; resize: vertical;"></textarea>
            </div>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button onclick="saveFeedSettings()" style="flex: 1; background: #4a9eff; border: none; color: white; padding: 12px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">Save Settings</button>
            <button onclick="closeFeedSettings()" style="flex: 1; background: #3a3a3a; border: 1px solid #555; color: white; padding: 12px; border-radius: 6px; cursor: pointer; font-size: 14px;">Cancel</button>
        </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Load existing settings
    const settings = JSON.parse(localStorage.getItem('feedSettings') || '{}');
    document.getElementById('enablePinnedPosts').checked = settings.enablePinnedPosts || false;
    document.getElementById('enableRotatingPosts').checked = settings.enableRotatingPosts || false;
    document.getElementById('feedName').value = settings.feedName || '';
    document.getElementById('feedDescription').value = settings.feedDescription || '';
    document.getElementById('pinnedPostUrls').value = settings.pinnedPostUrls || '';
    document.getElementById('rotatingPostUrls').value = settings.rotatingPostUrls || '';
    document.getElementById('pinnedFrequency').value = settings.pinnedFrequency || '1';
    document.getElementById('rotatingPosition').value = settings.rotatingPosition || '1';
    document.getElementById('rotatingFrequency').value = settings.rotatingFrequency || '30';
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFeedSettings();
    });
}

function saveFeedSettings() {
    const settings = {
        enablePinnedPosts: document.getElementById('enablePinnedPosts').checked,
        enableRotatingPosts: document.getElementById('enableRotatingPosts').checked,
        feedName: document.getElementById('feedName').value,
        feedDescription: document.getElementById('feedDescription').value,
        pinnedPostUrls: document.getElementById('pinnedPostUrls').value,
        rotatingPostUrls: document.getElementById('rotatingPostUrls').value,
        pinnedFrequency: document.getElementById('pinnedFrequency').value,
        rotatingPosition: document.getElementById('rotatingPosition').value,
        rotatingFrequency: document.getElementById('rotatingFrequency').value
    };
    
    localStorage.setItem('feedSettings', JSON.stringify(settings));
    closeFeedSettings();
    alert('✅ Feed settings saved!');
}

function closeFeedSettings() {
    const modal = document.getElementById('feedSettingsModal');
    if (modal) modal.remove();
}
