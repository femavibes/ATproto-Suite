// NSFW Manager module
import { api } from './api.js';
import { showAISuggestions } from './ai-suggestions.js';

let currentCategory = null;
let currentCategoryData = null;

export async function showManager() {
    const categories = await api.get('/api/nsfw/categories');
    
    // Setup click-away
    import('./modal-utils.js').then(({ setupModalClickAway }) => {
        setupModalClickAway('nsfw-manager-modal', closeNSFWManager);
        setupModalClickAway('bulk-add-modal', closeBulkAdd);
    });
    
    const list = document.getElementById('nsfw-categories-list');
    list.innerHTML = `
        <input type="text" id="nsfw-global-search" placeholder="Search term across all categories..." style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px;">
        <div id="nsfw-global-results" style="display: none; padding: 0.5rem; margin-bottom: 0.5rem; background: #f0f9ff; border: 1px solid #3b82f6; border-radius: 4px;"></div>
        <input type="text" id="nsfw-category-search" placeholder="Filter categories..." style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px;">` + 
        categories.map(cat => `
            <div class="nsfw-category-item" data-name="${cat.name.toLowerCase()}" data-desc="${cat.description.toLowerCase()}" onclick="window.loadNSFWCategory('${cat.id}', '${cat.name}', '${cat.description}')" 
                 style="padding: 0.75rem; margin-bottom: 0.5rem; background: #f9fafb; border-radius: 4px; cursor: pointer; transition: background 0.2s;">
                <strong>${cat.name}</strong>
                <div style="font-size: 0.875rem; color: #666;">${cat.description}</div>
                <span style="color: #888; font-size: 0.9em;" id="count-${cat.id}">Loading...</span>
            </div>
        `).join('');
    
    // Global search
    document.getElementById('nsfw-global-search').oninput = async (e) => {
        const term = e.target.value.trim();
        const resultsDiv = document.getElementById('nsfw-global-results');
        if (!term) {
            resultsDiv.style.display = 'none';
            return;
        }
        const results = await api.get(`/api/nsfw/search/${encodeURIComponent(term)}`);
        if (results.length > 0) {
            resultsDiv.innerHTML = `<strong>"${term}" found in:</strong> ${results.map(r => r.category).join(', ')}`;
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.innerHTML = `<strong>"${term}" not found</strong>`;
            resultsDiv.style.display = 'block';
        }
    };
    
    // Category filter
    document.getElementById('nsfw-category-search').oninput = (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.nsfw-category-item').forEach(item => {
            const match = item.dataset.name.includes(term) || item.dataset.desc.includes(term);
            item.style.display = match ? 'block' : 'none';
        });
    };
    
    // Load counts
    categories.forEach(async cat => {
        const data = await api.get(`/api/nsfw/${cat.id}`);
        const total = (data.terms || []).length + (data.hashtags || []).length + (data.domains || []).length;
        document.getElementById(`count-${cat.id}`).textContent = `${total} items`;
    });
    
    document.getElementById('nsfw-manager-modal').classList.add('active');
    
    // Auto-select first category
    if (categories.length > 0) {
        const first = categories[0];
        loadNSFWCategory(first.id, first.name, first.description);
    }
}

export function closeNSFWManager() {
    document.getElementById('nsfw-manager-modal').classList.remove('active');
    document.getElementById('nsfw-editor').style.display = 'none';
    currentCategory = null;
    currentCategoryData = null;
}

export async function loadNSFWCategory(categoryId, categoryName, categoryDescription) {
    currentCategory = categoryId;
    const data = await api.get(`/api/nsfw/${categoryId}`);
    currentCategoryData = data;
    
    document.getElementById('nsfw-category-name').textContent = categoryName;
    document.getElementById('nsfw-editor').style.display = 'block';
    
    // Show AI button for *_terms.json files
    const aiBtn = document.getElementById('nsfw-ai-suggest-btn');
    if (aiBtn && categoryId.endsWith('_terms')) {
        aiBtn.style.display = 'inline-block';
        aiBtn.onclick = () => {
            // Always show all three fields
            const fields = [
                { key: 'terms', label: 'Terms' },
                { key: 'hashtags', label: 'Hashtags' },
                { key: 'domains', label: 'Domains' }
            ];
            
            // Create a simple selection dialog
            const modal = document.createElement('div');
            modal.id = 'field-select-modal';
            modal.className = 'modal active';
            
            const content = document.createElement('div');
            content.className = 'modal-content';
            content.style.maxWidth = '400px';
            
            content.innerHTML = `
                <h2>Select Field</h2>
                <p style="color: #666; margin-bottom: 1.5rem;">Generate AI suggestions for:</p>
                <div id="field-buttons" style="display: flex; flex-direction: column; align-items: center;"></div>
            `;
            
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            // Add buttons with proper event listeners
            const buttonsContainer = document.getElementById('field-buttons');
            fields.forEach(f => {
                const btn = document.createElement('button');
                btn.textContent = f.label;
                btn.style.cssText = 'padding: 1rem 2rem; margin: 0.5rem; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;';
                btn.onclick = () => {
                    modal.remove();
                    showAISuggestions('nsfw', categoryId, categoryName, f.key);
                };
                buttonsContainer.appendChild(btn);
            });
        };
    } else if (aiBtn) {
        aiBtn.style.display = 'none';
    }
    
    renderNSFWList('terms', data.terms || []);
    renderNSFWList('hashtags', data.hashtags || []);
    renderNSFWList('domains', data.domains || []);
    
    // Wire up search boxes
    document.getElementById('nsfw-terms-search').oninput = (e) => filterNSFWList('terms', e.target.value);
    document.getElementById('nsfw-hashtags-search').oninput = (e) => filterNSFWList('hashtags', e.target.value);
    document.getElementById('nsfw-domains-search').oninput = (e) => filterNSFWList('domains', e.target.value);
    
    showNSFWTab('terms');
}

function filterNSFWList(type, searchTerm) {
    const items = currentCategoryData[type] || [];
    const filtered = searchTerm ? items.filter(item => item.toLowerCase().includes(searchTerm.toLowerCase())) : items;
    renderNSFWList(type, filtered);
}

function renderNSFWList(type, items) {
    const list = document.getElementById(`nsfw-${type}-list`);
    list.innerHTML = items.map((item, i) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: #f9fafb; margin-bottom: 0.25rem; border-radius: 4px;">
            <span>${item}</span>
            <button onclick="if(confirm('Remove ${item}?')) window.removeNSFWTerm('${type}', ${i})" style="background: none; color: #666; border: none; padding: 0.25rem 0.5rem; cursor: pointer; font-size: 1.2rem;">×</button>
        </div>
    `).join('');
}

export function removeNSFWTerm(type, index) {
    const searchTerm = document.getElementById(`nsfw-${type}-search`).value;
    if (searchTerm) {
        // If filtering, find the actual index in full list
        const filtered = currentCategoryData[type].filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()));
        const itemToRemove = filtered[index];
        const actualIndex = currentCategoryData[type].indexOf(itemToRemove);
        currentCategoryData[type].splice(actualIndex, 1);
        filterNSFWList(type, searchTerm);
    } else {
        currentCategoryData[type].splice(index, 1);
        renderNSFWList(type, currentCategoryData[type]);
    }
}

export async function addNSFWTerm(type) {
    const input = document.getElementById(`nsfw-${type}-input`);
    const value = input.value.trim();
    
    if (!value) return;
    
    if (!currentCategoryData[type]) currentCategoryData[type] = [];
    if (!currentCategoryData[type].includes(value)) {
        currentCategoryData[type].push(value);
        currentCategoryData[type].sort();
        renderNSFWList(type, currentCategoryData[type]);
    }
    
    input.value = '';
}

export async function saveNSFWCategory() {
    const result = await api.post(`/api/nsfw/${currentCategory}`, currentCategoryData);
    
    if (result.success) {
        // Silent success - no alert
        return true;
    } else {
        alert('Error: ' + result.error);
        return false;
    }
}

export function showNSFWTab(tabName) {
    document.querySelectorAll('.nsfw-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.nsfw-tab-content').forEach(content => content.style.display = 'none');
    
    // Find and activate the clicked tab button
    const buttons = document.querySelectorAll('.nsfw-tab-btn');
    buttons.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(tabName)) {
            btn.classList.add('active');
        }
    });
    
    document.getElementById(`nsfw-${tabName}-tab`).style.display = 'block';
}

export function parseBulkInput(text) {
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
    } catch {}
    
    if (text.includes(',')) {
        return text.split(',').map(s => s.trim()).filter(Boolean);
    }
    
    return text.split('\n').map(s => s.trim()).filter(Boolean);
}

export function showBulkAdd(type) {
    document.getElementById('bulk-add-type').textContent = type;
    document.getElementById('bulk-add-modal').classList.add('active');
    document.getElementById('bulk-add-modal').dataset.type = type;
}

export function closeBulkAdd() {
    document.getElementById('bulk-add-modal').classList.remove('active');
    document.getElementById('bulk-add-input').value = '';
}

export function processBulkAdd() {
    const type = document.getElementById('bulk-add-modal').dataset.type;
    const text = document.getElementById('bulk-add-input').value;
    const items = parseBulkInput(text);
    
    if (!currentCategoryData[type]) currentCategoryData[type] = [];
    
    items.forEach(item => {
        if (!currentCategoryData[type].includes(item)) {
            currentCategoryData[type].push(item);
        }
    });
    
    currentCategoryData[type].sort();
    renderNSFWList(type, currentCategoryData[type]);
    closeBulkAdd();
}

export function addNSFWTermFromAI(type, term) {
    if (!currentCategoryData[type]) currentCategoryData[type] = [];
    if (!currentCategoryData[type].includes(term)) {
        currentCategoryData[type].push(term);
        currentCategoryData[type].sort();
        renderNSFWList(type, currentCategoryData[type]);
    }
}

window.addNSFWTermFromAI = addNSFWTermFromAI;

// Expose functions globally for onclick handlers
window.loadNSFWCategory = loadNSFWCategory;
window.showNSFWTab = showNSFWTab;
window.addNSFWTerm = addNSFWTerm;
window.removeNSFWTerm = removeNSFWTerm;
window.saveNSFWCategory = saveNSFWCategory;
window.showBulkAdd = showBulkAdd;
window.closeBulkAdd = closeBulkAdd;
window.processBulkAdd = processBulkAdd;
window.closeNSFWManager = closeNSFWManager;
