// UI utilities module

export function toggleComponentIdOverride() {
    const checkbox = document.getElementById('override-component-id');
    const override = document.getElementById('component-id-override');
    override.style.display = checkbox.checked ? 'block' : 'none';
}

export function updateResetButtons() {
    const titleInput = document.getElementById('node-form-title');
    const descInput = document.getElementById('node-form-description');
    const colorInput = document.getElementById('node-form-color');
    const titleReset = document.getElementById('title-reset');
    const descReset = document.getElementById('desc-reset');
    const colorReset = document.getElementById('color-reset');
    
    titleReset.style.display = titleInput.value !== titleInput.dataset.default ? 'block' : 'none';
    descReset.style.display = descInput.value !== descInput.dataset.default ? 'block' : 'none';
    colorReset.style.display = colorInput.value !== colorInput.dataset.default ? 'block' : 'none';
}

export function resetTitle() {
    const input = document.getElementById('node-form-title');
    input.value = input.dataset.default;
    updateResetButtons();
}

export function resetDescription() {
    const input = document.getElementById('node-form-description');
    input.value = input.dataset.default;
    updateResetButtons();
}

export function resetColor() {
    const input = document.getElementById('node-form-color');
    input.value = input.dataset.default;
    updateResetButtons();
}

export function renderConfigOptions(node) {
    const container = document.getElementById('node-options');
    
    if (!node.configurable || Object.keys(node.configurable).length === 0) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #e5e5e5;"><h4>Node Configuration</h4>';
    
    for (const [key, config] of Object.entries(node.configurable)) {
        const savedValue = node.saved_config && node.saved_config[key];
        const defaultValue = config.default || '';
        const value = savedValue !== undefined ? savedValue : defaultValue;
        
        html += `<div style="margin-bottom: 1rem;">`;
        html += `<label>${config.description || key}:</label>`;
        
        if (config.type === 'number') {
            const min = config.min !== undefined ? `min="${config.min}"` : '';
            const max = config.max !== undefined ? `max="${config.max}"` : '';
            html += `<input type="number" data-config-key="${key}" value="${value}" ${min} ${max} style="width: 100%; padding: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px;">`;
        } else {
            html += `<input type="text" data-config-key="${key}" value="${value}" style="width: 100%; padding: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px;">`;
        }
        
        html += `</div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

export function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    if (tabName === 'metadata') window.loadMetadataDocs?.();
    else if (tabName === 'actions') window.loadActions?.();
    else if (tabName === 'graze') window.loadGrazeDocs?.();
    else if (tabName === 'reference') window.loadReferenceDocs?.();
}

export async function updateTabVisibility() {
    const session = await fetch('/api/session').then(r => r.json());
    const referenceTab = document.querySelector('.tab[onclick*="reference"]');
    if (referenceTab) {
        referenceTab.style.display = session.logged_in ? 'block' : 'none';
    }
}

export function filterCards(searchTerm, contentId) {
    const content = document.getElementById(contentId);
    const cards = content.querySelectorAll('.doc-card');
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm.toLowerCase()) ? 'block' : 'none';
    });
}

export function searchContent(searchTerm, contentId, docType) {
    const content = document.getElementById(contentId);
    const categories = content.querySelectorAll('.doc-category');
    
    if (!searchTerm) {
        categories.forEach(cat => cat.style.display = 'block');
        return;
    }
    
    categories.forEach(cat => {
        const text = cat.textContent.toLowerCase();
        cat.style.display = text.includes(searchTerm.toLowerCase()) ? 'block' : 'none';
    });
}
