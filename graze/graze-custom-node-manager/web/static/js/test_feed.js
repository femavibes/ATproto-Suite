// Test Feed Manager
import { api } from './api.js';

const CATEGORIES = [
    { id: 'nsfw', name: 'NSFW Lists', description: 'Lists of known NSFW content posters' },
    { id: 'ads', name: 'Ads Lists', description: 'Lists of known advertisers' },
    { id: 'spam', name: 'Spam Lists', description: 'Lists of known spammers' },
    { id: 'bots', name: 'Bot Lists', description: 'Lists of known bot accounts' }
];

let currentCategory = null;
let categoryData = {};

export async function showManager() {
    const modal = document.getElementById('test-feed-modal');
    modal.style.display = 'flex';
    
    await loadCategories();
    renderCategoryList();
}

async function loadCategories() {
    for (const cat of CATEGORIES) {
        const data = await api.get(`/api/test-feed/${cat.id}`);
        categoryData[cat.id] = data;
    }
}

function renderCategoryList() {
    const list = document.getElementById('test-categories-list');
    list.innerHTML = CATEGORIES.map(cat => `
        <div class="category-item ${currentCategory === cat.id ? 'active' : ''}" 
             onclick="window.testFeedModule.selectCategory('${cat.id}')" 
             style="padding: 0.75rem; margin-bottom: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px; cursor: pointer; ${currentCategory === cat.id ? 'background: #f0f9ff; border-color: #3b82f6;' : ''}">
            <strong>${cat.name}</strong>
            <div style="font-size: 0.85rem; color: #666; margin-top: 0.25rem;">${cat.description}</div>
        </div>
    `).join('');
}

function selectCategory(categoryId) {
    currentCategory = categoryId;
    renderCategoryList();
    renderEditor();
}

function renderEditor() {
    if (!currentCategory) return;
    
    const editor = document.getElementById('test-editor');
    const category = CATEGORIES.find(c => c.id === currentCategory);
    
    editor.style.display = 'block';
    document.getElementById('test-category-name').textContent = category.name;
    
    renderListsList();
}

function renderListsList() {
    const data = categoryData[currentCategory];
    const lists = data.lists || [];
    const list = document.getElementById('test-lists-list');
    
    list.innerHTML = lists.map(uri => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px; margin-bottom: 0.25rem;">
            <span style="font-family: monospace; font-size: 0.9rem;">${uri}</span>
            <button onclick="window.testFeedModule.removeList('${uri.replace(/'/g, "\\'")}')" style="background: #ef4444; color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">×</button>
        </div>
    `).join('');
}

function addList() {
    const input = document.getElementById('test-list-input');
    const uri = input.value.trim();
    
    if (!uri) return;
    
    if (!categoryData[currentCategory].lists) {
        categoryData[currentCategory].lists = [];
    }
    
    if (!categoryData[currentCategory].lists.includes(uri)) {
        categoryData[currentCategory].lists.push(uri);
        renderListsList();
    }
    
    input.value = '';
}

function removeList(uri) {
    const data = categoryData[currentCategory];
    data.lists = data.lists.filter(l => l !== uri);
    renderListsList();
}

async function saveCategory() {
    await api.post(`/api/test-feed/${currentCategory}`, categoryData[currentCategory]);
    alert('Category saved!');
}

function closeManager() {
    document.getElementById('test-feed-modal').style.display = 'none';
}

window.testFeedModule = {
    showManager,
    selectCategory,
    addList,
    removeList,
    saveCategory,
    closeManager
};
