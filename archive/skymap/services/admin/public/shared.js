// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    const clickedButton = event.target.closest('.tab');
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    
    const tabContent = document.getElementById(tabName + 'Tab');
    if (tabContent) {
        tabContent.classList.add('active');
    }
}

// Auth headers for HTTP Basic Auth
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json'
    };
}

// More tab sub-panel switching
function switchMoreSub(sub) {
    document.querySelectorAll('.more-sub-panel').forEach(function(p) { p.style.display = 'none'; });
    document.querySelectorAll('.more-sub-btn').forEach(function(b) { b.style.background = '#eee'; b.style.color = '#525252'; });
    var panel = document.getElementById('moreSub' + sub.charAt(0).toUpperCase() + sub.slice(1));
    if (panel) panel.style.display = 'block';
    var btn = event.target.closest('.more-sub-btn');
    if (btn) { btn.style.background = '#333'; btn.style.color = 'white'; }
}
