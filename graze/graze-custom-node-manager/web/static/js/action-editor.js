// Visual Action Editor Module - Rebuilt
let currentAction = null;
let nodeIdCounter = 0;

export function setAdminStatus(admin) {
    // Not needed anymore, handled in auth
}

export function showActionEditor(actionId = null) {
    const modal = document.getElementById('action-editor-modal');
    
    if (actionId) {
        // Edit existing
        fetch('/docs/GRAZE_ACTIONS.json')
            .then(r => r.json())
            .then(actions => {
                currentAction = actions.find(a => a.id === actionId);
                renderEditor();
                modal.classList.add('active');
            });
    } else {
        // Create new
        currentAction = {
            id: '',
            title: '',
            description: '',
            difficulty: 'beginner',
            logic: null,
            notes: ''
        };
        renderEditor();
        modal.classList.add('active');
    }
}

export function closeActionEditor() {
    document.getElementById('action-editor-modal').classList.remove('active');
    currentAction = null;
    nodeIdCounter = 0;
}

function renderEditor() {
    document.getElementById('action-editor-id').value = currentAction.id;
    document.getElementById('action-editor-title').value = currentAction.title;
    document.getElementById('action-editor-description').value = currentAction.description;
    document.getElementById('action-editor-difficulty').value = currentAction.difficulty;
    document.getElementById('action-editor-notes').value = currentAction.notes || '';
    
    renderCanvas();
}

function renderCanvas() {
    const canvas = document.getElementById('action-editor-canvas');
    canvas.innerHTML = '';
    
    if (currentAction.logic) {
        const key = Object.keys(currentAction.logic)[0];
        
        // If root is already a logic node (and/or), use it
        if (key === 'and' || key === 'or') {
            const rootNode = createNodeFromLogic(currentAction.logic);
            canvas.appendChild(rootNode);
        } else {
            // Wrap non-logic root in a Logic node
            const rootNode = createLogicNode('all', [currentAction.logic]);
            canvas.appendChild(rootNode);
        }
    } else {
        // Always start with a Logic node as root
        const rootNode = createLogicNode('all', []);
        canvas.appendChild(rootNode);
    }
}

function createNodeFromLogic(logic) {
    const key = Object.keys(logic)[0];
    const value = logic[key];
    
    if (key === 'and' || key === 'or') {
        return createLogicNode(key === 'and' ? 'all' : 'any', value);
    } else if (key === 'list_member') {
        return createListMemberNode(value[1], value[0]);
    } else if (key === 'social_graph') {
        return createSocialGraphNode(value[1], value[0], value[2]);
    }
    
    return document.createElement('div');
}

function createLogicNode(type = 'all', children = []) {
    const nodeId = nodeIdCounter++;
    const node = document.createElement('div');
    node.className = 'logic-node';
    node.dataset.nodeId = nodeId;
    node.dataset.nodeType = 'logic';
    node.style.background = '#2d2d2d';
    node.style.border = '2px solid #a855f7';
    node.style.borderRadius = '8px';
    node.style.padding = '1rem';
    node.style.marginBottom = '0.5rem';
    
    node.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <strong style="color: #a78bfa; font-size: 1rem;">Logic</strong>
            <button onclick="window.deleteNode(${nodeId})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.5rem; line-height: 1;">×</button>
        </div>
        <div style="margin-bottom: 1rem;">
            <select onchange="window.updateNodeData(${nodeId}, 'logicType', this.value)" style="width: 100%; padding: 0.5rem; background: #1e1e1e; color: white; border: 1px solid #404040; border-radius: 4px;">
                <option value="all" ${type === 'all' ? 'selected' : ''}>All of these</option>
                <option value="any" ${type === 'any' ? 'selected' : ''}>Any of these</option>
            </select>
        </div>
        <div class="node-children" style="padding-left: 1rem; margin-left: 0.5rem;">
            ${children.length === 0 ? '<div style="color: #666; font-size: 0.9rem; padding: 0.5rem;">No children yet</div>' : ''}
        </div>
        <button onclick="window.showAddNodeMenu(${nodeId})" style="width: 100%; padding: 0.5rem; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 0.5rem;">+ Add Node</button>
    `;
    
    // Add existing children
    if (children.length > 0) {
        const childrenContainer = node.querySelector('.node-children');
        childrenContainer.innerHTML = '';
        children.forEach(child => {
            childrenContainer.appendChild(createNodeFromLogic(child));
        });
    }
    
    return node;
}

function createListMemberNode(mode = 'in', listUrl = '') {
    const nodeId = nodeIdCounter++;
    const node = document.createElement('div');
    node.className = 'logic-node';
    node.dataset.nodeId = nodeId;
    node.dataset.nodeType = 'list_member';
    node.style.background = '#2d2d2d';
    node.style.border = '2px solid #f59e0b';
    node.style.borderRadius = '8px';
    node.style.padding = '1rem';
    node.style.marginBottom = '0.5rem';
    
    node.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <strong style="color: #fbbf24; font-size: 1rem;">Member of List</strong>
            <button onclick="window.deleteNode(${nodeId})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.5rem; line-height: 1;">×</button>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
            <select onchange="window.updateNodeData(${nodeId}, 'mode', this.value)" style="padding: 0.5rem; background: #1e1e1e; color: white; border: 1px solid #404040; border-radius: 4px; width: 120px;">
                <option value="in" ${mode === 'in' ? 'selected' : ''}>Include</option>
                <option value="not_in" ${mode === 'not_in' ? 'selected' : ''}>Exclude</option>
            </select>
            <input type="text" value="${listUrl}" onchange="window.updateNodeData(${nodeId}, 'listUrl', this.value)" placeholder="https://bsky.app/profile/.../lists/..." style="flex: 1; padding: 0.5rem; background: #1e1e1e; color: white; border: 1px solid #404040; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">
        </div>
    `;
    
    return node;
}

function createSocialGraphNode(mode = 'not_in', handle = '', relation = 'follows') {
    const nodeId = nodeIdCounter++;
    const node = document.createElement('div');
    node.className = 'logic-node';
    node.dataset.nodeId = nodeId;
    node.dataset.nodeType = 'social_graph';
    node.style.background = '#2d2d2d';
    node.style.border = '2px solid #f59e0b';
    node.style.borderRadius = '8px';
    node.style.padding = '1rem';
    node.style.marginBottom = '0.5rem';
    
    node.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <strong style="color: #fbbf24; font-size: 1rem;">Social Graph</strong>
            <button onclick="window.deleteNode(${nodeId})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.5rem; line-height: 1;">×</button>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
            <select onchange="window.updateNodeData(${nodeId}, 'mode', this.value)" style="padding: 0.5rem; background: #1e1e1e; color: white; border: 1px solid #404040; border-radius: 4px; width: 120px;">
                <option value="in" ${mode === 'in' ? 'selected' : ''}>Include</option>
                <option value="not_in" ${mode === 'not_in' ? 'selected' : ''}>Exclude</option>
            </select>
            <input type="text" value="${handle}" onchange="window.updateNodeData(${nodeId}, 'handle', this.value)" placeholder="user.bsky.social" style="flex: 1; padding: 0.5rem; background: #1e1e1e; color: white; border: 1px solid #404040; border-radius: 4px;">
            <select onchange="window.updateNodeData(${nodeId}, 'relation', this.value)" style="padding: 0.5rem; background: #1e1e1e; color: white; border: 1px solid #404040; border-radius: 4px; width: 120px;">
                <option value="follows" ${relation === 'follows' ? 'selected' : ''}>Follows</option>
                <option value="followers" ${relation === 'followers' ? 'selected' : ''}>Followers</option>
            </select>
        </div>
    `;
    
    return node;
}

export function showAddNodeMenu(parentNodeId) {
    const menu = document.createElement('div');
    menu.style.position = 'fixed';
    menu.style.background = 'white';
    menu.style.border = '1px solid #e5e5e5';
    menu.style.borderRadius = '6px';
    menu.style.padding = '0.5rem';
    menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    menu.style.zIndex = '10000';
    menu.style.left = '50%';
    menu.style.top = '50%';
    menu.style.transform = 'translate(-50%, -50%)';
    
    menu.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.5rem; padding: 0.5rem; color: #333;">Add Node</div>
        <button onclick="window.addNode(${parentNodeId}, 'logic')" style="display: block; width: 100%; padding: 0.75rem; margin-bottom: 0.25rem; background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 4px; cursor: pointer; text-align: left; color: #333;">Logic</button>
        <button onclick="window.addNode(${parentNodeId}, 'list_member')" style="display: block; width: 100%; padding: 0.75rem; margin-bottom: 0.25rem; background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 4px; cursor: pointer; text-align: left; color: #333;">Member of List</button>
        <button onclick="window.addNode(${parentNodeId}, 'social_graph')" style="display: block; width: 100%; padding: 0.75rem; background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 4px; cursor: pointer; text-align: left; color: #333;">Social Graph</button>
    `;
    
    document.body.appendChild(menu);
    
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

export function addNode(parentNodeId, nodeType) {
    // Close menu
    document.querySelectorAll('div[style*="position: fixed"]').forEach(el => {
        if (el.textContent.includes('Add Node')) el.remove();
    });
    
    let newNode;
    if (nodeType === 'logic') {
        newNode = createLogicNode();
    } else if (nodeType === 'list_member') {
        newNode = createListMemberNode();
    } else if (nodeType === 'social_graph') {
        newNode = createSocialGraphNode();
    }
    
    // Always add as child to parent (no root replacement)
    const parentNode = document.querySelector(`[data-node-id="${parentNodeId}"]`);
    const childrenContainer = parentNode.querySelector('.node-children');
    
    // Remove "no children" message
    const noChildrenMsg = childrenContainer.querySelector('div[style*="color: #666"]');
    if (noChildrenMsg) noChildrenMsg.remove();
    
    childrenContainer.appendChild(newNode);
}

export function deleteNode(nodeId) {
    const node = document.querySelector(`[data-node-id="${nodeId}"]`);
    const parent = node.parentElement;
    
    // Don't allow deleting root node
    const canvas = document.getElementById('action-editor-canvas');
    if (node.parentElement === canvas) {
        alert('Cannot delete root Logic node');
        return;
    }
    
    node.remove();
    
    // If parent is now empty, show "no children" message
    if (parent.classList.contains('node-children') && parent.children.length === 0) {
        parent.innerHTML = '<div style="color: #666; font-size: 0.9rem; padding: 0.5rem;">No children yet</div>';
    }
}

export function updateNodeData(nodeId, field, value) {
    // Data is stored in the DOM, will be extracted on save
}

export async function saveAction() {
    // Collect metadata
    currentAction.id = document.getElementById('action-editor-id').value.trim();
    currentAction.title = document.getElementById('action-editor-title').value.trim();
    currentAction.description = document.getElementById('action-editor-description').value.trim();
    currentAction.difficulty = document.getElementById('action-editor-difficulty').value;
    currentAction.notes = document.getElementById('action-editor-notes').value.trim();
    
    if (!currentAction.id || !currentAction.title || !currentAction.description) {
        alert('Please fill in ID, Title, and Description');
        return;
    }
    
    // Extract logic from canvas
    const canvas = document.getElementById('action-editor-canvas');
    const rootNode = canvas.querySelector('.logic-node');
    
    if (!rootNode) {
        alert('Please add at least one node');
        return;
    }
    
    currentAction.logic = extractLogicFromNode(rootNode);
    
    // Save to server
    try {
        const response = await fetch('/api/actions/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentAction)
        });
        
        if (response.ok) {
            alert('Action saved!');
            closeActionEditor();
            window.loadActions?.();
        } else {
            alert('Failed to save');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function extractLogicFromNode(node) {
    const nodeType = node.dataset.nodeType;
    
    if (nodeType === 'logic') {
        const logicType = node.querySelector('select').value;
        const childrenContainer = node.querySelector('.node-children');
        const childNodes = Array.from(childrenContainer.querySelectorAll(':scope > .logic-node'));
        
        const children = childNodes.map(child => extractLogicFromNode(child));
        
        return {
            [logicType === 'all' ? 'and' : 'or']: children
        };
    } else if (nodeType === 'list_member') {
        const mode = node.querySelectorAll('select')[0].value;
        const listUrl = node.querySelector('input').value;
        
        return {
            list_member: [listUrl, mode]
        };
    } else if (nodeType === 'social_graph') {
        const mode = node.querySelectorAll('select')[0].value;
        const handle = node.querySelector('input').value;
        const relation = node.querySelectorAll('select')[1].value;
        
        return {
            social_graph: [handle, mode, relation]
        };
    }
    
    return {};
}

export async function deleteAction(actionId) {
    if (!confirm('Delete this action?')) return;
    
    try {
        const response = await fetch(`/api/actions/${actionId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            window.loadActions?.();
        } else {
            alert('Failed to delete');
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}
