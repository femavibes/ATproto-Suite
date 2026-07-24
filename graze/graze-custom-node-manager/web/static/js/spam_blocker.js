// Spam Blocker Manager
import { api } from './api.js';

const CATEGORIES = [
    { id: 'cryptobros', name: 'Cryptobros', description: 'Crypto scammers and trading signal spammers' },
    { id: 'engagement_farmers', name: 'Engagement Farmers', description: 'Follow-for-follow and engagement bait accounts' },
    // { id: 'thirst_traps', name: 'Thirst Traps', description: 'Adult content promoters and OnlyFans spam' },  // DISABLED: Needs refinement
    { id: 'huns', name: 'MLM Huns', description: 'MLM/pyramid scheme promoters and boss babes' },
    { id: 'manosphere_grifters', name: 'Manosphere Grifters', description: 'Alpha male coaches, course sellers, and toxic masculinity hustlers' },
    { id: 'dropshitters', name: 'Dropshitters', description: 'Ecommerce spam and wholesale DM merchants' },
    { id: 'prize_pigs', name: 'Prize Pigs', description: 'Fake giveaway and "you won!" scammers' },
    { id: 'wolf_of_wall_street_wannabes', name: 'Wolf of Wall Street Wannabes', description: 'Forex/stock trading signal scammers and day trading gurus' },
    { id: 'hustle_porn', name: 'Hustle Porn', description: 'Get rich quick and passive income fantasies' },
    { id: 'link_leeches', name: 'Link Leeches', description: 'Generic "link in bio" and "DM me" spammers' }
];

let currentCategory = null;
let currentTab = 'bio_terms';
let categoryData = {};

export async function showManager() {
    const modal = document.getElementById('spam-blocker-modal');
    modal.style.display = 'flex';
    
    await loadCategories();
    renderCategoryList();
}

async function loadCategories() {
    for (const cat of CATEGORIES) {
        const data = await api.get(`/api/spam-blocker/${cat.id}`);
        categoryData[cat.id] = data;
    }
}

function renderCategoryList() {
    const list = document.getElementById('spam-categories-list');
    list.innerHTML = CATEGORIES.map(cat => `
        <div class="category-item ${currentCategory === cat.id ? 'active' : ''}" 
             onclick="window.spamBlockerModule.selectCategory('${cat.id}')" 
             style="padding: 0.75rem; margin-bottom: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px; cursor: pointer; ${currentCategory === cat.id ? 'background: #f0f9ff; border-color: #3b82f6;' : ''}">
            <strong>${cat.name}</strong>
            <div style="font-size: 0.85rem; color: #666; margin-top: 0.25rem;">${cat.description}</div>
        </div>
    `).join('');
}

function selectCategory(categoryId) {
    currentCategory = categoryId;
    currentTab = 'bio_terms';
    renderCategoryList();
    renderEditor();
}

function renderEditor() {
    if (!currentCategory) return;
    
    const editor = document.getElementById('spam-editor');
    const category = CATEGORIES.find(c => c.id === currentCategory);
    
    editor.style.display = 'block';
    document.getElementById('spam-category-name').textContent = category.name;
    
    showSpamTab('bio_terms');
}

function showSpamTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.spam-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottom = '3px solid transparent';
    });
    
    document.querySelectorAll('.spam-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    const activeBtn = document.querySelector(`.spam-tab-btn[onclick*="${tab}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.borderBottom = '3px solid #6366f1';
    }
    
    document.getElementById(`spam-${tab}-tab`).style.display = 'block';
    renderTermsList(tab);
}

function renderTermsList(tab) {
    const data = categoryData[currentCategory];
    const terms = data[tab] || [];
    const list = document.getElementById(`spam-${tab}-list`);
    
    const isExceptions = tab === 'bio_exceptions';
    const label = isExceptions ? 'Exception' : 'Term';
    
    list.innerHTML = terms.map(term => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px; margin-bottom: 0.25rem; ${isExceptions ? 'background: #f0fdf4;' : ''}">
            <span>${term}</span>
            <button onclick="window.spamBlockerModule.removeTerm('${tab}', '${term.replace(/'/g, "\\'")}')">×</button>
        </div>
    `).join('');
}

function addTerm(tab) {
    const input = document.getElementById(`spam-${tab}-input`);
    const term = input.value.trim();
    
    if (!term) return;
    
    if (!categoryData[currentCategory][tab]) {
        categoryData[currentCategory][tab] = [];
    }
    
    if (!categoryData[currentCategory][tab].includes(term)) {
        categoryData[currentCategory][tab].push(term);
        renderTermsList(tab);
    }
    
    input.value = '';
}

function removeTerm(tab, term) {
    const data = categoryData[currentCategory];
    data[tab] = data[tab].filter(t => t !== term);
    renderTermsList(tab);
}

async function saveCategory() {
    await api.post(`/api/spam-blocker/${currentCategory}`, categoryData[currentCategory]);
    alert('Category saved!');
}

function closeManager() {
    document.getElementById('spam-blocker-modal').style.display = 'none';
}

window.spamBlockerModule = {
    showManager,
    selectCategory,
    showSpamTab,
    addTerm,
    removeTerm,
    saveCategory,
    closeManager
};
