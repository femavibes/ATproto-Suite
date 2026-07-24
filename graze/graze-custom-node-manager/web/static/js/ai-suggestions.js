// AI Suggestion module
import { api } from './api.js';

let currentSuggestions = [];
let currentCategory = null;
let currentFilename = null;
let currentFieldType = null;
let currentCategoryName = null;

export async function checkAIConfig() {
    try {
        const config = await api.get('/api/ai/config');
        return config.has_api_key;
    } catch {
        return false;
    }
}

export async function showAIConfig() {
    const modal = document.getElementById('ai-config-modal');
    if (!modal) {
        createAIConfigModal();
    }
    
    try {
        const config = await api.get('/api/ai/config');
        if (config.has_api_key) {
            document.getElementById('ai-api-key-input').placeholder = `Current: ${config.api_key_preview}`;
        }
    } catch {}
    
    document.getElementById('ai-config-modal').classList.add('active');
}

export function closeAIConfig() {
    document.getElementById('ai-config-modal').classList.remove('active');
    document.getElementById('ai-api-key-input').value = '';
}

export async function saveAIConfig() {
    const apiKey = document.getElementById('ai-api-key-input').value.trim();
    
    if (!apiKey) {
        alert('Please enter an API key');
        return;
    }
    
    try {
        await api.post('/api/ai/config', { api_key: apiKey });
        alert('API key saved!');
        closeAIConfig();
    } catch (e) {
        alert('Error saving API key: ' + e.message);
    }
}

export async function showAISuggestions(category, filename, categoryName = null, forceFieldType = null) {
    // Check if API key is configured
    const hasKey = await checkAIConfig();
    if (!hasKey) {
        if (confirm('No Gemini API key configured. Configure now?')) {
            showAIConfig();
        }
        return;
    }
    
    console.log('showAISuggestions called with forceFieldType:', forceFieldType);
    
    currentCategory = category;
    currentFilename = filename;
    currentSuggestions = [];
    currentCategoryName = categoryName || filename.replace(/_/g, ' ').replace('.json', '');
    
    const modal = document.getElementById('ai-suggestions-modal');
    if (!modal) {
        createAISuggestionsModal();
    }
    
    // Update modal title with category name
    const modalTitle = document.getElementById('ai-suggestions-title');
    if (modalTitle) {
        modalTitle.textContent = `AI Suggestions - ${currentCategoryName}`;
    }
    
    document.getElementById('ai-suggestions-modal').classList.add('active');
    document.getElementById('ai-suggestions-list').innerHTML = '<div style="text-align: center; padding: 2rem;">Generating suggestions...</div>';
    
    try {
        const payload = {
            category: category,
            filename: filename
        };
        
        if (forceFieldType) {
            payload.force_field_type = forceFieldType;
            console.log('Sending force_field_type:', forceFieldType);
        }
        
        const result = await api.post('/api/ai/suggest', payload);
        
        currentSuggestions = result.suggestions || [];
        currentFieldType = result.field_type;
        
        console.log('API Response:', result);
        console.log('Received field_type from API:', currentFieldType);
        console.log('Current suggestions:', currentSuggestions);
        
        renderSuggestions();
    } catch (e) {
        let errorMsg = e.message || 'Unknown error';
        
        // Check for rate limit error
        if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
            errorMsg = 'Rate limit exceeded. Please wait 60 seconds and try again. (Free tier: 15 requests/minute)';
        }
        
        document.getElementById('ai-suggestions-list').innerHTML = `<div style="color: #dc2626; padding: 1rem;">Error: ${errorMsg}</div>`;
    }
}

function renderSuggestions() {
    const list = document.getElementById('ai-suggestions-list');
    
    if (!currentSuggestions || currentSuggestions.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;">No new suggestions generated</div>';
        return;
    }
    
    // Add field type indicator
    const fieldIndicator = `<div style="background: #e0e7ff; padding: 0.5rem 1rem; border-radius: 4px; margin-bottom: 1rem; text-align: center; font-weight: 500; color: #4338ca;">Generating for: ${currentFieldType}</div>`;
    
    list.innerHTML = fieldIndicator + currentSuggestions.map((term, index) => `
        <div id="suggestion-${index}" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f9fafb; margin-bottom: 0.5rem; border-radius: 4px;">
            <span>${escapeHtml(term)}</span>
            <div>
                <button onclick="window.approveSuggestion(${index})" style="background: #10b981; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; margin-right: 0.5rem;">✓ Approve</button>
                <button onclick="window.denySuggestion(${index})" style="background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">✗ Deny</button>
            </div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function approveSuggestion(index) {
    const term = currentSuggestions[index];
    
    console.log('Approving term:', term, 'for field:', currentFieldType);
    
    // Add to current data based on manager type
    if (currentCategory === 'nsfw') {
        // Call NSFW manager's add function
        if (window.addNSFWTermFromAI) {
            window.addNSFWTermFromAI(currentFieldType, term);
        }
        // Auto-save for NSFW
        if (window.saveNSFWCategory) {
            window.saveNSFWCategory();
        }
    } else if (currentCategory === 'adblocker') {
        // Call AdBlocker manager's add function
        if (window.addAdBlockerTermFromAI) {
            window.addAdBlockerTermFromAI(currentFieldType, term);
        }
        // Auto-save for AdBlocker
        if (window.adBlockerSaveChanges) {
            window.adBlockerSaveChanges();
        }
    }
    
    // Remove from suggestions
    removeSuggestion(index);
}

export async function denySuggestion(index) {
    const term = currentSuggestions[index];
    
    try {
        await api.post('/api/ai/deny', {
            category: currentCategory,
            filename: currentFilename,
            term: term
        });
        
        removeSuggestion(index);
    } catch (e) {
        alert('Error saving denied term: ' + e.message);
    }
}

function removeSuggestion(index) {
    const element = document.getElementById(`suggestion-${index}`);
    if (element) {
        element.style.opacity = '0';
        element.style.transition = 'opacity 0.3s';
        setTimeout(() => {
            if (currentSuggestions && currentSuggestions.length > index) {
                currentSuggestions.splice(index, 1);
            }
            renderSuggestions();
        }, 300);
    }
}

export function closeAISuggestions() {
    document.getElementById('ai-suggestions-modal').classList.remove('active');
    currentSuggestions = [];
    currentCategory = null;
    currentFilename = null;
    currentFieldType = null;
    currentCategoryName = null;
}

function createAIConfigModal() {
    const modal = document.createElement('div');
    modal.id = 'ai-config-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <h2>AI Configuration</h2>
            <p style="color: #666; margin-bottom: 1rem;">Enter your Google Gemini API key. Get one at <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>.</p>
            <input type="password" id="ai-api-key-input" placeholder="Enter Gemini API key" style="width: 100%; padding: 0.75rem; border: 1px solid #e5e5e5; border-radius: 4px; margin-bottom: 1rem;">
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button onclick="window.closeAIConfig()" style="padding: 0.75rem 1.5rem; background: #e5e5e5; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button onclick="window.saveAIConfig()" style="padding: 0.75rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function createAISuggestionsModal() {
    const modal = document.createElement('div');
    modal.id = 'ai-suggestions-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px; max-height: 80vh; overflow-y: auto;">
            <h2 id="ai-suggestions-title">AI Suggestions</h2>
            <p style="color: #666; margin-bottom: 1rem;">Review and approve/deny AI-generated suggestions</p>
            <div id="ai-suggestions-list"></div>
            <div style="margin-top: 1rem; text-align: right;">
                <button onclick="window.closeAISuggestions()" style="padding: 0.75rem 1.5rem; background: #e5e5e5; border: none; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Expose functions globally
window.showAIConfig = showAIConfig;
window.closeAIConfig = closeAIConfig;
window.saveAIConfig = saveAIConfig;
window.showAISuggestions = showAISuggestions;
window.closeAISuggestions = closeAISuggestions;
window.approveSuggestion = approveSuggestion;
window.denySuggestion = denySuggestion;
