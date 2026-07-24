// Authentication module
import { api } from './api.js';

let isAdmin = false;

export function getIsAdmin() {
    return isAdmin;
}

export async function checkSession() {
    const data = await api.get('/api/session');
    
    if (data.logged_in) {
        isAdmin = data.is_admin || false;
        window.isAdminUser = isAdmin;
        document.getElementById('logged-in-status').style.display = 'inline';
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-handle').textContent = data.handle;
        
        // Show/hide admin buttons
        const addActionBtn = document.getElementById('add-action-btn');
        if (addActionBtn) {
            addActionBtn.style.display = isAdmin ? 'block' : 'none';
        }
    } else {
        isAdmin = false;
        window.isAdminUser = false;
        document.getElementById('logged-in-status').style.display = 'none';
        document.getElementById('login-btn').style.display = 'inline';
        
        // Hide admin buttons
        const addActionBtn = document.getElementById('add-action-btn');
        if (addActionBtn) {
            addActionBtn.style.display = 'none';
        }
    }
    
    return data;
}

export async function login(event) {
    event.preventDefault();
    
    const handle = document.getElementById('handle').value;
    const password = document.getElementById('password').value;
    
    const data = await api.post('/api/login', {handle, password});
    
    if (data.success) {
        isAdmin = data.is_admin || false;
        window.isAdminUser = isAdmin;
        closeModal();
        checkSession();
        window.loadNodes(); // Reload to show gear icons
        window.updateTabVisibility?.(); // Update tab visibility
        window.updatePromoFooterButtonVisibility?.(); // Update promo footer button
        window.loadActions?.(); // Reload actions to show edit buttons
        document.getElementById('handle').value = '';
        document.getElementById('password').value = '';
    } else {
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = data.error || 'Login failed';
        errorEl.classList.add('active');
    }
}

export async function logout() {
    isAdmin = false;
    window.isAdminUser = false;
    await api.post('/api/logout', {});
    checkSession();
    window.loadNodes();
    window.updateTabVisibility?.(); // Update tab visibility
    window.updatePromoFooterButtonVisibility?.(); // Update promo footer button
    window.loadActions?.(); // Reload actions to hide edit buttons
}

export function showLoginModal() {
    document.getElementById('login-modal').classList.add('active');
}

export function closeModal() {
    document.getElementById('login-modal').classList.remove('active');
    document.getElementById('login-error').classList.remove('active');
}
