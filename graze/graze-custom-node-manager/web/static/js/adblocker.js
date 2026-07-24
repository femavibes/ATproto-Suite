// AdBlocker Manager module
import { api } from './api.js';
import { showAISuggestions } from './ai-suggestions.js';

let currentCategory = null;
let currentTab = 'domains';
let categories = [];
let categoryData = {};

export async function showManager() {
    // Load categories
    categories = await api.get('/api/adblocker/categories');
    
    // Setup click-away
    import('./modal-utils.js').then(({ setupModalClickAway }) => {
        setupModalClickAway('adblocker-manager-modal', closeAdBlockerManager);
        setupModalClickAway('adblocker-bulk-add-modal', closeBulkAdd);
    });
    
    // Show modal
    document.getElementById('adblocker-manager-modal').classList.add('active');
    
    // Render category list
    renderCategoryList();
    
    // Load first category
    if (categories.length > 0) {
        await loadCategory(categories[0].id);
    }
}

export function closeAdBlockerManager() {
    document.getElementById('adblocker-manager-modal').classList.remove('active');
    currentCategory = null;
    currentTab = 'domains';
}

function renderCategoryList() {
    const container = document.getElementById('adblocker-category-list');
    const searchTerm = document.getElementById('adblocker-category-search').value.toLowerCase();
    
    const filtered = categories.filter(cat => 
        cat.name.toLowerCase().includes(searchTerm) ||
        cat.description.toLowerCase().includes(searchTerm)
    );
    
    container.innerHTML = filtered.map(cat => `
        <div onclick="window.adBlockerLoadCategory('${cat.id}')" 
             style="padding: 0.75rem; margin-bottom: 0.5rem; background: ${currentCategory === cat.id ? '#e0e7ff' : '#f9fafb'}; border-radius: 4px; cursor: pointer; transition: background 0.2s;">
            <strong>${cat.name}</strong>
            <div style="font-size: 0.875rem; color: #666;">${cat.description}</div>
            <span style="color: #888; font-size: 0.9em;" id="count-${cat.id}">Loading...</span>
        </div>
    `).join('');
    
    // Update counts
    updateCategoryCounts();
}

async function updateCategoryCounts() {
    for (const cat of categories) {
        try {
            const data = await api.get(`/api/adblocker/${cat.id}`);
            let count = 0;
            
            // Count all items in category
            if (data.domains) count += data.domains.length;
            if (data.affiliate_tags) count += data.affiliate_tags.length;
            if (data.keywords) count += data.keywords.length;
            if (data.affiliate_domains) count += data.affiliate_domains.length;
            if (data.tiny_url_shorteners) count += data.tiny_url_shorteners.length;
            if (data.hashtags) count += data.hashtags.length;
            if (data.phrases) count += data.phrases.length;
            
            const countEl = document.getElementById(`count-${cat.id}`);
            if (countEl) {
                countEl.textContent = `${count} items`;
            }
        } catch (e) {
            console.error(`Error loading count for ${cat.id}:`, e);
        }
    }
}

async function loadCategory(categoryId) {
    currentCategory = categoryId;
    categoryData = await api.get(`/api/adblocker/${categoryId}`);
    
    // Update active state
    renderCategoryList();
    
    // Get category name for AI button
    const category = categories.find(c => c.id === categoryId);
    const categoryName = category ? category.name : categoryId;
    
    // Show AI button for ad_hashtags and ad_phrases
    const aiBtn = document.getElementById('adblocker-ai-suggest-btn');
    if (aiBtn && (categoryId === 'ad_hashtags' || categoryId === 'ad_phrases')) {
        aiBtn.style.display = 'inline-block';
        aiBtn.onclick = () => showAISuggestions('adblocker', categoryId, categoryName);
    } else if (aiBtn) {
        aiBtn.style.display = 'none';
    }
    
    // Determine available tabs based on data structure
    const availableTabs = [];
    if (categoryData.domains !== undefined) availableTabs.push('domains');
    if (categoryData.affiliate_tags !== undefined) availableTabs.push('affiliate_tags');
    if (categoryData.keywords !== undefined) availableTabs.push('keywords');
    if (categoryData.affiliate_domains !== undefined) availableTabs.push('affiliate_domains');
    if (categoryData.tiny_url_shorteners !== undefined) availableTabs.push('tiny_url_shorteners');
    if (categoryData.hashtags !== undefined) availableTabs.push('hashtags');
    if (categoryData.phrases !== undefined) availableTabs.push('phrases');
    
    // Render tabs
    const tabsContainer = document.getElementById('adblocker-tabs');
    tabsContainer.innerHTML = availableTabs.map(tab => {
        const labels = {
            'domains': 'Domains',
            'affiliate_tags': 'Affiliate Tags',
            'keywords': 'Keywords',
            'affiliate_domains': 'Affiliate Domains',
            'tiny_url_shorteners': 'Tiny URLs',
            'hashtags': 'Hashtags',
            'phrases': 'Phrases'
        };
        return `<button class="tab ${tab === availableTabs[0] ? 'active' : ''}" 
                        onclick="window.adBlockerSwitchTab('${tab}')">${labels[tab]}</button>`;
    }).join('');
    
    // Load first tab
    currentTab = availableTabs[0];
    renderCurrentTab();
}

function renderCurrentTab() {
    const container = document.getElementById('adblocker-items-list');
    const items = categoryData[currentTab] || [];
    
    if (items.length === 0) {
        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #666;">No items yet. Add some below!</div>';
        return;
    }
    
    container.innerHTML = items.map((item, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f9fafb; margin-bottom: 0.25rem; border-radius: 4px;">
            <span>${escapeHtml(item)}</span>
            <button onclick="window.adBlockerDeleteItem(${index})" style="background: none; color: #666; border: none; padding: 0.25rem 0.5rem; cursor: pointer; font-size: 1.2rem;">×</button>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('#adblocker-tabs .tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    renderCurrentTab();
}

export function addItem() {
    const input = document.getElementById('adblocker-add-input');
    const value = input.value.trim();
    
    if (!value) return;
    
    if (!categoryData[currentTab]) {
        categoryData[currentTab] = [];
    }
    
    // Check for duplicates
    if (categoryData[currentTab].includes(value)) {
        alert('This item already exists!');
        return;
    }
    
    categoryData[currentTab].push(value);
    input.value = '';
    renderCurrentTab();
}

export function deleteItem(index) {
    if (!categoryData[currentTab]) return;
    
    const item = categoryData[currentTab][index];
    if (confirm(`Remove ${item}?`)) {
        categoryData[currentTab].splice(index, 1);
        renderCurrentTab();
    }
}

export async function saveChanges() {
    if (!currentCategory) return;
    
    try {
        await api.post(`/api/adblocker/${currentCategory}`, categoryData);
        // Silent success - no alert
        updateCategoryCounts();
        return true;
    } catch (e) {
        alert('Error saving: ' + e.message);
        return false;
    }
}

export function showBulkAdd() {
    document.getElementById('adblocker-bulk-add-modal').classList.add('active');
    document.getElementById('adblocker-bulk-textarea').value = '';
}

export function closeBulkAdd() {
    document.getElementById('adblocker-bulk-add-modal').classList.remove('active');
}

export function processBulkAdd() {
    const textarea = document.getElementById('adblocker-bulk-textarea');
    const text = textarea.value.trim();
    
    if (!text) return;
    
    // Parse different formats
    let items = [];
    
    // Try JSON array first
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            items = parsed;
        }
    } catch (e) {
        // Not JSON, try other formats
        // Split by newlines or commas
        items = text.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
    }
    
    if (items.length === 0) {
        alert('No items found!');
        return;
    }
    
    // Add items
    if (!categoryData[currentTab]) {
        categoryData[currentTab] = [];
    }
    
    let added = 0;
    let skipped = 0;
    
    for (const item of items) {
        if (!categoryData[currentTab].includes(item)) {
            categoryData[currentTab].push(item);
            added++;
        } else {
            skipped++;
        }
    }
    
    alert(`Added ${added} items${skipped > 0 ? `, skipped ${skipped} duplicates` : ''}`);
    closeBulkAdd();
    renderCurrentTab();
}

export async function searchTerm() {
    const term = document.getElementById('adblocker-search-input').value.trim();
    
    if (!term) {
        alert('Enter a search term');
        return;
    }
    
    const results = await api.get(`/api/adblocker/search/${encodeURIComponent(term)}`);
    
    if (results.length === 0) {
        alert(`"${term}" not found in any category`);
    } else {
        const message = results.map(r => `${r.category} (${r.type})`).join('\n');
        alert(`Found "${term}" in:\n\n${message}`);
    }
}

export function addAdBlockerTermFromAI(fieldType, term) {
    if (!categoryData[fieldType]) categoryData[fieldType] = [];
    if (!categoryData[fieldType].includes(term)) {
        categoryData[fieldType].push(term);
        if (currentTab === fieldType) {
            renderCurrentTab();
        }
    }
}

window.addAdBlockerTermFromAI = addAdBlockerTermFromAI;

// Expose functions globally for onclick handlers
window.adBlockerLoadCategory = loadCategory;
window.adBlockerSwitchTab = switchTab;
window.adBlockerAddItem = addItem;
window.adBlockerDeleteItem = deleteItem;
window.adBlockerSaveChanges = saveChanges;
window.adBlockerShowBulkAdd = showBulkAdd;
window.adBlockerCloseBulkAdd = closeBulkAdd;
window.adBlockerProcessBulkAdd = processBulkAdd;
window.adBlockerSearchTerm = searchTerm;
window.closeAdBlockerManager = closeAdBlockerManager;
