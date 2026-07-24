// Global state
let isAuthenticated = false;

// Dark mode functions
function initDarkMode() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateDarkModeToggle();
}

function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Immediately update toggle UI
    const toggle = document.getElementById('darkModeToggle');
    const label = document.getElementById('darkModeLabel');
    const track = document.getElementById('darkModeTrack');
    const thumb = document.getElementById('darkModeThumb');
    
    if (toggle) toggle.checked = newTheme === 'dark';
    if (label) label.textContent = newTheme === 'dark' ? 'Disable Dark Mode' : 'Enable Dark Mode';
    if (track) track.style.backgroundColor = newTheme === 'dark' ? '#2196F3' : '#ccc';
    if (thumb) thumb.style.transform = newTheme === 'dark' ? 'translateX(24px)' : 'translateX(0)';
}

function updateDarkModeToggle() {
    const toggle = document.getElementById('darkModeToggle');
    const label = document.getElementById('darkModeLabel');
    const track = document.getElementById('darkModeTrack');
    const thumb = document.getElementById('darkModeThumb');
    
    if (toggle && label) {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        toggle.checked = currentTheme === 'dark';
        label.textContent = currentTheme === 'dark' ? 'Disable Dark Mode' : 'Enable Dark Mode';
        
        // Update track and thumb colors
        if (track && thumb) {
            if (currentTheme === 'dark') {
                track.style.backgroundColor = '#2196F3';
                thumb.style.transform = 'translateX(24px)';
            } else {
                track.style.backgroundColor = '#ccc';
                thumb.style.transform = 'translateX(0)';
            }
        }
    }
}

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Find the button that was clicked (handle clicks on child elements)
    const clickedButton = event.target.closest('.tab');
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    
    const tabContent = document.getElementById(tabName + 'Tab');
    tabContent.classList.add('active');
    
    if (tabName === 'map' && typeof map !== 'undefined' && !map) {
        initMap();
    }
    
    // Initialize event map when Events tab becomes visible
    if (tabName === 'events' && typeof window.initEventMapIfNeeded === 'function') {
        window.initEventMapIfNeeded();
    }

    if (tabName === 'labelRequests' && isAuthenticated && typeof loadMyLabelRequests === 'function') {
        loadMyLabelRequests();
    }
}

// ATproto client config
const ATPROTO_CLIENTS = [
    { name: 'Bluesky', baseUrl: 'https://bsky.app', icon: '🦋' },
    { name: 'Blacksky', baseUrl: 'https://blacksky.community', icon: '🖤' },
    { name: 'Northsky', baseUrl: 'https://northsky.app', icon: '🧭' },
    { name: 'Langit', baseUrl: 'https://langit.pages.dev', icon: '🌐' },
];

function openComposer(text, clientBaseUrl) {
    const base = clientBaseUrl || 'https://bsky.app';
    const encodedText = encodeURIComponent(text);
    window.open(`${base}/intent/compose?text=${encodedText}`, '_blank');
}

function showClientDropdown(text, anchorEl) {
    const existing = document.getElementById('client-dropdown');
    if (existing) existing.remove();

    const dropdown = document.createElement('div');
    dropdown.id = 'client-dropdown';
    dropdown.style.cssText = 'position:fixed;z-index:10000;background:#fff;border:1px solid rgba(0,0,0,0.15);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);padding:0.25rem 0;min-width:160px;';

    ATPROTO_CLIENTS.forEach(client => {
        const item = document.createElement('button');
        item.style.cssText = 'display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.5rem 0.75rem;border:none;background:none;cursor:pointer;font-size:0.875rem;color:#171717;text-align:left;';
        item.onmouseover = () => item.style.background = '#f3f4f6';
        item.onmouseout = () => item.style.background = 'none';
        item.innerHTML = `<span>${client.icon}</span><span>${client.name}</span>`;
        item.onclick = (e) => {
            e.stopPropagation();
            dropdown.remove();
            openComposer(text, client.baseUrl);
        };
        dropdown.appendChild(item);
    });

    document.body.appendChild(dropdown);
    const rect = anchorEl.getBoundingClientRect();
    const dw = dropdown.offsetWidth;
    const dh = dropdown.offsetHeight;
    let top = rect.bottom + 4;
    let left = rect.left;
    if (left + dw > window.innerWidth) left = window.innerWidth - dw - 8;
    if (top + dh > window.innerHeight) top = rect.top - dh - 4;
    dropdown.style.top = top + 'px';
    dropdown.style.left = left + 'px';

    setTimeout(() => {
        const close = (e) => { if (!dropdown.contains(e.target)) { dropdown.remove(); document.removeEventListener('click', close); } };
        document.addEventListener('click', close);
    }, 0);
}

function getComposeText(command, locationKey) {
    const handle = window.BLUESKY_HANDLE || 'labeler.domain';
    return `@${handle} ${command} ${locationKey}`;
}

// Bluesky integration
function openBluesky(command, locationKey) {
    openComposer(getComposeText(command, locationKey));
}

function openBlueskyOther(event, command, locationKey) {
    event.stopPropagation();
    showClientDropdown(getComposeText(command, locationKey), event.currentTarget);
}

function copyCommand(event, command, locationKey) {
    const handle = window.BLUESKY_HANDLE || 'labeler.domain';
    const text = `@${handle} ${command} ${locationKey}`;
    const button = event.currentTarget;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showCopyFeedback(button);
        });
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopyFeedback(button);
    }
}

function showCopyFeedback(button) {
    const originalHTML = button.innerHTML;
    button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    setTimeout(() => {
        button.innerHTML = originalHTML;
    }, 1000);
}

// Modal functions
function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
    // Check for prefilled handle
    const handleInput = document.getElementById('modalHandle');
    if (handleInput && !handleInput.value) {
        handleInput.focus();
    }
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
}

function openAboutModal() {
    document.getElementById('aboutModal').classList.add('active');
    switchAboutTab('atlas');
}

function closeAboutModal() {
    document.getElementById('aboutModal').classList.remove('active');
}

function switchAboutTab(tab) {
    // Reset all tabs
    document.getElementById('atlasTabContent').style.display = 'none';
    document.getElementById('skymapTabContent').style.display = 'none';
    const termsTabContent = document.getElementById('termsTabContent');
    if (termsTabContent) termsTabContent.style.display = 'none';
    
    // Reset all buttons - remove active class
    const tabs = ['atlasTabBtn', 'skymapTabBtn', 'termsTabBtn'];
    tabs.forEach(tabId => {
        const btn = document.getElementById(tabId);
        if (btn) {
            btn.classList.remove('active');
        }
    });
    
    // Activate selected tab
    if (tab === 'atlas') {
        document.getElementById('atlasTabContent').style.display = 'block';
        document.getElementById('atlasTabBtn').classList.add('active');
    } else if (tab === 'skymap') {
        document.getElementById('skymapTabContent').style.display = 'block';
        document.getElementById('skymapTabBtn').classList.add('active');
    } else if (tab === 'terms') {
        if (termsTabContent) termsTabContent.style.display = 'block';
        const btn = document.getElementById('termsTabBtn');
        if (btn) btn.classList.add('active');
    }
}

function openSettingsModal() {
    loadSettingsContent();
    const modal = document.getElementById('settingsModal');
    modal.classList.add('active');
    
    // Add click listener to close on background click (only once)
    if (!modal.hasAttribute('data-click-listener')) {
        modal.setAttribute('data-click-listener', 'true');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeSettingsModal();
        });
    }
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

async function openCheckLabelsModal() {
    const content = document.getElementById('checkLabelsModalContent');
    try {
        const response = await fetch('/checklabels.html');
        const html = await response.text();
        content.innerHTML = html;
        
        // Execute scripts in the loaded HTML
        const scripts = content.querySelectorAll('script');
        scripts.forEach(script => {
            const newScript = document.createElement('script');
            newScript.textContent = script.textContent;
            document.body.appendChild(newScript);
            script.remove();
        });
        
        // Load user labels if authenticated
        if (typeof loadMyLabels === 'function') {
            loadMyLabels();
        }
        
        document.getElementById('checkLabelsModal').classList.add('active');
    } catch (error) {
        console.error('Error loading check labels:', error);
        content.innerHTML = '<div class="empty-state">Failed to load check labels</div>';
    }
}

function closeCheckLabelsModal() {
    document.getElementById('checkLabelsModal').classList.remove('active');
}

async function openCheckInterestsModal() {
    const content = document.getElementById('checkInterestsModalContent');
    try {
        const response = await fetch('/checkinterests.html');
        const html = await response.text();
        content.innerHTML = html;
        
        // Execute scripts in the loaded HTML
        const scripts = content.querySelectorAll('script');
        scripts.forEach(script => {
            const newScript = document.createElement('script');
            newScript.textContent = script.textContent;
            document.body.appendChild(newScript);
            script.remove();
        });
        
        // Load user interests if authenticated
        if (typeof loadMyInterestsCheck === 'function') {
            loadMyInterestsCheck();
        }
        
        document.getElementById('checkInterestsModal').classList.add('active');
    } catch (error) {
        console.error('Error loading check interests:', error);
        content.innerHTML = '<div class="empty-state">Failed to load check interests</div>';
    }
}

function closeCheckInterestsModal() {
    document.getElementById('checkInterestsModal').classList.remove('active');
}

async function openCheckEventsModal() {
    const content = document.getElementById('checkEventsModalContent');
    try {
        const response = await fetch('/checkevents.html');
        const html = await response.text();
        content.innerHTML = html;
        
        // Execute scripts in the loaded HTML
        const scripts = content.querySelectorAll('script');
        scripts.forEach(script => {
            const newScript = document.createElement('script');
            newScript.textContent = script.textContent;
            document.body.appendChild(newScript);
            script.remove();
        });
        
        // Load user events if authenticated
        if (typeof loadMyEventsCheck === 'function') {
            loadMyEventsCheck();
        }
        
        document.getElementById('checkEventsModal').classList.add('active');
    } catch (error) {
        console.error('Error loading check events:', error);
        content.innerHTML = '<div class="empty-state">Failed to load check events</div>';
    }
}

function closeCheckEventsModal() {
    document.getElementById('checkEventsModal').classList.remove('active');
}

async function openCreateEventModalContent() {
    const content = document.getElementById('createEventModalContent');
    try {
        const response = await fetch('/events.html');
        const html = await response.text();
        content.innerHTML = html;
        
        // Execute scripts in the loaded HTML
        const scripts = content.querySelectorAll('script');
        scripts.forEach(script => {
            const newScript = document.createElement('script');
            // Wrap in IIFE to avoid redeclaration errors
            newScript.textContent = `(function() { ${script.textContent} })();`;
            document.body.appendChild(newScript);
            script.remove();
        });
        
        const modal = document.getElementById('createEventModal');
        modal.classList.add('active');
        
        // Add click listener to close on background click
        if (!modal.hasAttribute('data-click-listener')) {
            modal.setAttribute('data-click-listener', 'true');
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeCreateEventModal();
            });
        }
        
        // Trigger auth check after content loads
        setTimeout(() => {
            if (typeof window.checkEventAuth === 'function') {
                window.checkEventAuth();
            }
        }, 100);
    } catch (error) {
        console.error('Error loading create event form:', error);
        content.innerHTML = '<div class="empty-state">Failed to load create event form</div>';
    }
}

function closeCreateEventModal() {
    document.getElementById('createEventModal').classList.remove('active');
}

async function loadSettingsContent() {
    const content = document.getElementById('settingsModalContent');
    try {
        const response = await fetch('/settings.html');
        const html = await response.text();
        
        // Inject dark mode toggle at the beginning
        const darkModeHTML = `
            <div style="background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(30px); border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 12px; padding: 1rem; margin-bottom: 0.75rem;">
                <h3 style="margin-bottom: 0.5rem; font-size: 1rem; font-weight: 500;">🌓 Dark Mode</h3>
                <p style="color: var(--text-tertiary); margin-bottom: 0.75rem; font-size: 0.8125rem; line-height: 1.4;">Toggle between light and dark themes.</p>
                <div style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;" onclick="toggleDarkMode()">
                    <div style="position: relative; width: 48px; height: 24px; flex-shrink: 0;">
                        <input type="checkbox" id="darkModeToggle" style="opacity: 0; width: 0; height: 0; position: absolute; pointer-events: none;" />
                        <span id="darkModeTrack" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: 0.3s; border-radius: 24px; pointer-events: none;"></span>
                        <span id="darkModeThumb" style="position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%; pointer-events: none;"></span>
                    </div>
                    <span id="darkModeLabel" style="font-size: 0.875rem; font-weight: 500; user-select: none; color: var(--text-primary);">Enable Dark Mode</span>
                </div>
            </div>
        `;
        
        const feedSettingsLink = `
            <a href="https://nearyou.atls.city/" target="_blank" style="display:block;background:rgba(255,255,255,0.5);backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,0.6);border-radius:12px;padding:1rem;margin-bottom:0.75rem;text-decoration:none;color:var(--text-primary);">
                <h3 style="margin-bottom:0.25rem;font-size:1rem;font-weight:500;">Near You Feed Settings</h3>
                <p style="color:var(--text-tertiary);font-size:0.8125rem;line-height:1.4;">Customize how the Near You feeds work for you — opens nearyou.atls.city</p>
            </a>
        `;
        
        content.innerHTML = darkModeHTML + feedSettingsLink + html;
        
        // Execute scripts in the loaded HTML
        const scripts = content.querySelectorAll('script');
        scripts.forEach(script => {
            const newScript = document.createElement('script');
            newScript.textContent = script.textContent;
            document.body.appendChild(newScript);
            document.body.removeChild(newScript);
        });
        
        // Update dark mode toggle and check auth
        updateDarkModeToggle();
        
        // Manually trigger checkAuthForSettings if it exists
        if (typeof checkAuthForSettings === 'function') {
            checkAuthForSettings();
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
        content.innerHTML = '<p style="color: #f44336;">Failed to load settings. Please try again.</p>';
    }
}

// Auth functions
function oauthLogin() {
    const handle = document.getElementById('modalHandle').value.trim();
    if (!handle) { alert('Please enter your handle'); return; }
    const btn = document.getElementById('oauthLoginBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Redirecting...'; }
    window.location.href = '/oauth/authorize?handle=' + encodeURIComponent(handle) + '&returnTo=' + encodeURIComponent(window.location.pathname);
}

function toggleAppPasswordLogin() {
    const section = document.getElementById('appPasswordSection');
    if (!section) return;
    const visible = section.style.display === 'block';
    section.style.display = visible ? 'none' : 'block';
    if (!visible) {
        const h = document.getElementById('modalHandle').value.trim();
        const apHandle = document.getElementById('appPasswordHandle');
        if (h && apHandle) apHandle.value = h;
        const pw = document.getElementById('modalPassword');
        if (pw) pw.focus();
    }
}

async function modalLogin() {
    const handle = document.getElementById('appPasswordHandle').value.trim();
    const password = document.getElementById('modalPassword').value.trim();
    if (!handle || !password) {
        alert('Please enter both handle and password');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ handle, password })
        });
        const data = await response.json();
        
        if (data.success) {
            isAuthenticated = true;
            document.getElementById('loginPrompt').style.display = 'none';
            document.getElementById('loggedInStatus').style.display = 'flex';
            document.getElementById('loggedInHandle').textContent = data.handle;
            updateAuthButtons();
            if (typeof loadMyLabels === 'function') loadMyLabels();
            
            if (typeof window.checkEventAuth === 'function') {
                window.checkEventAuth();
            }
            
            closeLoginModal();
            document.getElementById('appPasswordHandle').value = '';
            document.getElementById('modalPassword').value = '';
        } else {
            alert('Login failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

async function quickLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    isAuthenticated = false;
    const loginPrompt = document.getElementById('loginPrompt');
    const loggedInStatus = document.getElementById('loggedInStatus');
    const myLabelsSection = document.getElementById('myLabelsSection');
    const checkLabelsSection = document.getElementById('checkLabelsSection');
    
    if (loginPrompt) loginPrompt.style.display = 'flex';
    if (loggedInStatus) loggedInStatus.style.display = 'none';
    if (myLabelsSection) myLabelsSection.style.display = 'none';
    if (checkLabelsSection) checkLabelsSection.style.display = 'block';
    updateAuthButtons();
}

function updateAuthButtons() {
    document.querySelectorAll('.auth-required').forEach(btn => {
        btn.style.display = isAuthenticated ? 'inline-block' : 'none';
    });
    document.querySelectorAll('.no-auth').forEach(btn => {
        btn.style.display = isAuthenticated ? 'none' : 'inline-block';
    });
}

async function addLabelDirect(locationKey, locationName) {
    try {
        const response = await fetch('/api/labels/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locationKey })
        });
        const data = await response.json();
        
        if (data.success) {
            alert(`Added ${locationName} to your labels!`);
            if (typeof loadMyLabels === 'function') loadMyLabels();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Failed to add label');
    }
}

async function removeLabelDirect(locationKey, locationName) {
    try {
        const response = await fetch('/api/labels/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locationKey })
        });
        const data = await response.json();
        
        if (data.success) {
            alert(`Removed ${locationName} from your labels!`);
            if (typeof loadMyLabels === 'function') loadMyLabels();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Failed to remove label');
    }
}

// Check session on load - exported function to be called after DOM is ready
async function checkSession() {
    try {
        const response = await fetch('/api/auth/session', {
            credentials: 'same-origin'
        });
        const data = await response.json();
        if (data.authenticated) {
            isAuthenticated = true;
            document.getElementById('loginPrompt').style.display = 'none';
            document.getElementById('loggedInStatus').style.display = 'flex';
            document.getElementById('loggedInHandle').textContent = data.handle;
            updateAuthButtons();
        }
        if (typeof loadMyLabels === 'function') loadMyLabels();
        // Check for OAuth error in URL
        const urlParams = new URLSearchParams(window.location.search);
        const oauthError = urlParams.get('oauthError');
        if (oauthError) {
            alert(oauthError);
            window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        }
        return data;
    } catch (error) {
        console.error('Session check failed:', error);
        return { authenticated: false };
    }
}
