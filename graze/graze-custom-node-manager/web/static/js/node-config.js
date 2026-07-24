// Node configuration module
import { api } from './api.js';

let currentConfigNode = null;
const loadedManagers = {};

export async function showNodeSettings(nodeId) {
    const node = await api.get(`/api/nodes/${nodeId}`);
    
    const hasManageable = node.manageable;
    const hasConfigurable = node.configurable && Object.keys(node.configurable).some(k => k !== 'title' && k !== 'description');
    
    // If has both, show tabbed modal
    if (hasManageable && hasConfigurable) {
        showTabbedModal(node);
        return;
    }
    
    // If only manageable, dynamically load manager
    if (hasManageable) {
        await loadAndShowManager(node.id);
        return;
    }
    
    // If only configurable, show config modal
    if (hasConfigurable) {
        showConfigModal(node);
    }
}

async function loadAndShowManager(nodeId) {
    // Try to load manager module dynamically
    if (!loadedManagers[nodeId]) {
        try {
            // Try convention: js/{nodeId}.js with showManager function
            const managerModule = await import(`./${nodeId}.js`);
            loadedManagers[nodeId] = managerModule;
        } catch (e) {
            console.error(`No manager found for ${nodeId}:`, e);
            alert(`No manager UI found for ${nodeId}. Create web/static/js/${nodeId}.js with a showManager() function.`);
            return;
        }
    }
    
    // Call the showManager function
    const managerModule = loadedManagers[nodeId];
    
    if (managerModule.showManager) {
        managerModule.showManager();
    } else {
        console.error(`Manager module loaded but showManager() function not found`);
        alert(`Manager for ${nodeId} is missing showManager() export`);
    }
}

function toCamelCase(str) {
    return str.split(/[-_]/).map((word, i) => 
        i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
}

function showTabbedModal(node) {
    currentConfigNode = node;
    
    document.getElementById('unified-settings-title').textContent = node.name;
    document.getElementById('unified-settings-description').textContent = node.description;
    
    const tabsContainer = document.getElementById('unified-settings-tabs');
    const contentContainer = document.getElementById('unified-settings-content');
    
    tabsContainer.innerHTML = `
        <button class="tab active" onclick="switchUnifiedTab('manage')">Manage Terms</button>
        <button class="tab" onclick="switchUnifiedTab('config')">Configuration</button>
    `;
    
    let configHtml = '';
    for (const [key, config] of Object.entries(node.configurable || {})) {
        if (key === 'title' || key === 'description') continue;
        
        const savedValue = node.saved_config && node.saved_config[key];
        const defaultValue = config.default || '';
        const value = savedValue !== undefined ? savedValue : defaultValue;
        
        configHtml += `<div style="margin-bottom: 1rem;">`;
        configHtml += `<label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">${config.description || key}:</label>`;
        
        if (config.type === 'number') {
            const min = config.min !== undefined ? `min="${config.min}"` : '';
            const max = config.max !== undefined ? `max="${config.max}"` : '';
            configHtml += `<input type="number" data-config-key="${key}" value="${value}" ${min} ${max} style="width: 100%; padding: 0.75rem; border: 1px solid #e5e5e5; border-radius: 4px;">`;
        } else {
            configHtml += `<input type="text" data-config-key="${key}" value="${value}" style="width: 100%; padding: 0.75rem; border: 1px solid #e5e5e5; border-radius: 4px;">`;
        }
        
        configHtml += `</div>`;
    }
    
    contentContainer.innerHTML = `
        <div id="manage-tab" class="tab-content active">
            <p>NSFW Manager will load here</p>
        </div>
        <div id="config-tab" class="tab-content">${configHtml}</div>
    `;
    
    document.getElementById('unified-settings-modal').classList.add('active');
}

function showConfigModal(node) {
    currentConfigNode = node;
    
    document.getElementById('node-config-title').textContent = node.name;
    document.getElementById('node-config-description').textContent = node.description;
    
    const container = document.getElementById('node-config-options');
    let html = '';
    
    for (const [key, config] of Object.entries(node.configurable || {})) {
        if (key === 'title' || key === 'description') continue;
        
        const savedValue = node.saved_config && node.saved_config[key];
        const defaultValue = config.default || '';
        const value = savedValue !== undefined ? savedValue : defaultValue;
        
        html += `<div style="margin-bottom: 1rem;">`;
        html += `<label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">${config.description || key}:</label>`;
        
        if (config.type === 'number') {
            const min = config.min !== undefined ? `min="${config.min}"` : '';
            const max = config.max !== undefined ? `max="${config.max}"` : '';
            html += `<input type="number" data-config-key="${key}" value="${value}" ${min} ${max} style="width: 100%; padding: 0.75rem; border: 1px solid #e5e5e5; border-radius: 4px;">`;
        } else {
            html += `<input type="text" data-config-key="${key}" value="${value}" style="width: 100%; padding: 0.75rem; border: 1px solid #e5e5e5; border-radius: 4px;">`;
        }
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
    document.getElementById('node-config-modal').classList.add('active');
}

export function closeNodeConfig() {
    document.getElementById('node-config-modal').classList.remove('active');
    document.getElementById('unified-settings-modal').classList.remove('active');
    currentConfigNode = null;
}

export function switchUnifiedTab(tabName) {
    document.querySelectorAll('#unified-settings-tabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#unified-settings-content .tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

export async function saveNodeConfig() {
    if (!currentConfigNode) return;
    
    const config = {};
    document.querySelectorAll('#node-config-options [data-config-key]').forEach(input => {
        const key = input.dataset.configKey;
        config[key] = input.type === 'number' ? parseInt(input.value) : input.value;
    });
    
    const result = await api.post(`/api/nodes/${currentConfigNode.id}/config`, config);
    
    if (result.success) {
        alert('Configuration saved!');
        closeNodeConfig();
        window.loadNodes();
    } else {
        alert('Error: ' + result.error);
    }
}
