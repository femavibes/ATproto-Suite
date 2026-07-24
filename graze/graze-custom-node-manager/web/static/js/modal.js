// Modal module
import { api } from './api.js';
import { getIsAdmin } from './auth.js';

let currentNode = null;

export async function showNodeDetail(nodeId) {
    const node = await api.get(`/api/nodes/${nodeId}`);
    currentNode = node;
    
    document.getElementById('node-title').textContent = node.name;
    document.getElementById('node-description').textContent = node.description;
    
    const session = await api.get('/api/session');
    const isLoggedIn = session.logged_in;
    
    // Handle Graze link display in header
    const grazeLink = document.getElementById('node-graze-link');
    const nodeMeta = document.querySelector('#node-modal .node-meta');
    const nodeVersion = document.getElementById('node-version');
    const nodeAuthor = document.getElementById('node-author');
    
    // Always hide version, author, and old status location
    if (nodeVersion) nodeVersion.style.display = 'none';
    if (nodeAuthor) nodeAuthor.style.display = 'none';
    if (nodeMeta) nodeMeta.style.display = 'none';
    
    // Show Graze link in header if node is pushed
    if (node.pushed && node.component_id) {
        const url = `https://www.graze.social/app/custom-nodes/${node.component_id}/view`;
        if (isLoggedIn) {
            grazeLink.innerHTML = `<a href="${url}" target="_blank" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-size: 0.9rem; font-weight: 500; white-space: nowrap;">View on Graze →</a>`;
        } else {
            grazeLink.innerHTML = `<a href="${url}" target="_blank" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-size: 0.9rem; font-weight: 500; white-space: nowrap;">View on Graze →</a>`;
        }
    } else {
        grazeLink.innerHTML = '';
    }
    
    // Show/hide form section based on login status
    const formSection = document.getElementById('node-form')?.closest('.form-section');
    if (formSection) {
        if (isLoggedIn) {
            formSection.style.display = 'block';
            
            const titleInput = document.getElementById('node-form-title');
            const descInput = document.getElementById('node-form-description');
            const colorInput = document.getElementById('node-form-color');
            
            titleInput.value = node.custom_title || node.name;
            descInput.value = node.custom_description || node.description;
            colorInput.value = node.custom_color || node.color;
            titleInput.dataset.default = node.name;
            descInput.dataset.default = node.description;
            colorInput.dataset.default = node.color;
            
            window.updateResetButtons?.();
            window.renderConfigOptions?.(node);
            
            const pushBtn = document.getElementById('push-btn');
            if (getIsAdmin()) {
                pushBtn.textContent = node.pushed ? 'Update on Graze' : 'Push to Graze';
                pushBtn.style.display = 'inline-block';
            } else {
                pushBtn.style.display = 'none';
            }
        } else {
            formSection.style.display = 'none';
        }
    }
    
    document.getElementById('manifest-preview').textContent = JSON.stringify(node.manifest, null, 2);
    document.getElementById('node-modal').classList.add('active');
}

export async function pushNode() {
    if (!currentNode) return;
    
    const title = document.getElementById('node-form-title').value;
    const description = document.getElementById('node-form-description').value;
    const color = document.getElementById('node-form-color').value;
    
    const overrideCheckbox = document.getElementById('override-component-id');
    const componentIdInput = document.getElementById('component-id-input');
    const overrideComponentId = overrideCheckbox.checked ? componentIdInput.value : null;
    
    const includeFooterCheckbox = document.getElementById('include-promo-footer');
    const includeFooter = includeFooterCheckbox ? includeFooterCheckbox.checked : true;
    
    const config = {};
    document.querySelectorAll('[data-config-key]').forEach(input => {
        const key = input.dataset.configKey;
        config[key] = input.type === 'number' ? (input.value ? parseInt(input.value) : null) : input.value;
    });
    
    const resultEl = document.getElementById('push-result');
    resultEl.textContent = 'Pushing...';
    resultEl.className = 'result active';
    
    try {
        const payload = {title, description, color, config, include_footer: includeFooter};
        if (overrideComponentId) payload.override_component_id = overrideComponentId;
        
        const data = await api.post(`/api/nodes/${currentNode.id}/push`, payload);
        
        if (data.success) {
            resultEl.textContent = `✓ Successfully ${data.action}! View at: ${data.url}`;
            resultEl.className = 'result active success';
            setTimeout(() => window.loadNodes(), 2000);
        } else {
            resultEl.textContent = `Error: ${data.error}`;
            resultEl.className = 'result active error';
        }
    } catch (error) {
        resultEl.textContent = `Error: ${error.message}`;
        resultEl.className = 'result active error';
    }
}

export function closeNodeModal() {
    document.getElementById('node-modal').classList.remove('active');
    document.getElementById('push-result').classList.remove('active');
    currentNode = null;
}

export function copyManifest() {
    const manifestText = document.getElementById('manifest-preview').textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(manifestText).then(() => {
            const btn = event.target.closest('button');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
            setTimeout(() => btn.innerHTML = originalHTML, 2000);
        });
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = manifestText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        const btn = event.target.closest('button');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
        setTimeout(() => btn.innerHTML = originalHTML, 2000);
    }
}
