let actionsData = [];
let filteredActions = [];

export async function loadActions() {
    try {
        const response = await fetch('/docs/GRAZE_ACTIONS.json');
        actionsData = await response.json();
        filteredActions = [...actionsData];
        renderActions();
    } catch (error) {
        console.error('Failed to load actions:', error);
        document.getElementById('actions-content').innerHTML = '<p style="color: #ef4444;">Failed to load actions data.</p>';
    }
}

export function searchActions(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
        filteredActions = [...actionsData];
    } else {
        filteredActions = actionsData.filter(action => 
            action.title.toLowerCase().includes(q) || 
            action.description.toLowerCase().includes(q)
        );
    }
    renderActions();
}

function renderActions() {
    const container = document.getElementById('actions-content');
    const tocList = document.getElementById('actions-toc-list');
    
    if (filteredActions.length === 0) {
        container.innerHTML = '<p style="color: #666;">No actions found.</p>';
        if (tocList) tocList.innerHTML = '';
        return;
    }
    
    // Sort by difficulty
    const difficultyOrder = { beginner: 0, basic: 1, intermediate: 2, advanced: 3 };
    const sorted = [...filteredActions].sort((a, b) => 
        difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
    );
    
    // Render TOC
    if (tocList) {
        tocList.innerHTML = sorted.map(action => `
            <a href="#action-${action.id}" class="toc-item" style="display: block; padding: 0.5rem; margin-bottom: 0.25rem; border-radius: 4px; text-decoration: none; color: #666; font-size: 0.9rem; transition: all 0.2s;">
                <div style="font-weight: 500; color: #333;">${action.title}</div>
                <div style="font-size: 0.75rem; color: #999; text-transform: uppercase;">${action.difficulty}</div>
            </a>
        `).join('');
    }
    
    // Check if admin
    const isAdmin = window.isAdminUser || false;
    
    container.innerHTML = sorted.map(action => `
        <div id="action-${action.id}" class="action-card" style="margin-bottom: 2rem; border: 1px solid #e5e5e5; border-radius: 8px; padding: 1.5rem; background: white; scroll-margin-top: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <h3 style="margin: 0;">${action.title}</h3>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span class="difficulty-badge difficulty-${action.difficulty}">${action.difficulty}</span>
                    ${isAdmin ? `<button onclick="window.editAction('${action.id}')" style="padding: 0.25rem 0.5rem; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">Edit</button>` : ''}
                </div>
            </div>
            <p style="color: #666; margin-bottom: 1rem;">${action.description}</p>
            ${action.notes ? `<div class="action-notes">${action.notes.replace(/\n/g, '<br>')}</div>` : ''}
            <div class="logic-container">
                ${renderLogicNode(action.logic)}
            </div>
        </div>
    `).join('');
}

function renderLogicNode(node, depth = 0) {
    if (typeof node !== 'object' || node === null) {
        return '';
    }
    
    const keys = Object.keys(node);
    if (keys.length === 0) return '';
    
    const key = keys[0];
    const value = node[key];
    
    // Logic node (and/or)
    if (key === 'and' || key === 'or') {
        const logicType = key === 'and' ? 'All of these' : 'Any of these';
        return `
            <div style="background: #2d2d2d; border: 2px solid #a855f7; border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem;">
                <div style="margin-bottom: 1rem;">
                    <strong style="color: #a78bfa; font-size: 1rem;">Logic</strong>
                </div>
                <div style="margin-bottom: 1rem;">
                    <div style="padding: 0.5rem; background: #1e1e1e; color: white; border: 1px solid #404040; border-radius: 4px;">${logicType}</div>
                </div>
                <div style="padding-left: 1rem; margin-left: 0.5rem;">
                    ${Array.isArray(value) ? value.map(child => renderLogicNode(child, depth + 1)).join('') : ''}
                </div>
            </div>
        `;
    }
    
    // Member of List
    if (key === 'list_member') {
        const listUrl = value[0] || '';
        const mode = value[1] === 'in' ? 'Include' : 'Exclude';
        return `
            <div style="background: #2d2d2d; border: 2px solid #f59e0b; border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem;">
                <div style="margin-bottom: 1rem;">
                    <strong style="color: #fbbf24; font-size: 1rem;">Member of List</strong>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <div style="padding: 0.5rem; background: #1e1e1e; color: white; border: 1px solid #404040; border-radius: 4px; width: 120px;">${mode}</div>
                    <div style="flex: 1; padding: 0.5rem; background: #1e1e1e; color: #86efac; border: 1px solid #404040; border-radius: 4px; font-family: monospace; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${listUrl || 'https://bsky.app/profile/.../lists/...'}</div>
                </div>
            </div>
        `;
    }
    
    // Social Graph
    if (key === 'social_graph') {
        const handle = value[0] || '';
        const mode = value[1] === 'in' ? 'Include' : 'Exclude';
        const relation = value[2] === 'follows' ? 'Follows' : 'Followers';
        return `
            <div style="background: #2d2d2d; border: 2px solid #f59e0b; border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem;">
                <div style="margin-bottom: 1rem;">
                    <strong style="color: #fbbf24; font-size: 1rem;">Social Graph</strong>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <div style="padding: 0.5rem; background: #1e1e1e; color: white; border: 1px solid #404040; border-radius: 4px; width: 120px;">${mode}</div>
                    <div style="flex: 1; padding: 0.5rem; background: #1e1e1e; color: #86efac; border: 1px solid #404040; border-radius: 4px;">${handle || 'user.bsky.social'}</div>
                    <div style="padding: 0.5rem; background: #1e1e1e; color: white; border: 1px solid #404040; border-radius: 4px; width: 120px;">${relation}</div>
                </div>
            </div>
        `;
    }
    
    // Social List (DIDs)
    if (key === 'social_list') {
        const dids = Array.isArray(value[0]) ? value[0] : [];
        const mode = value[1] === 'in' ? 'Include' : 'Exclude';
        return `
            <div style="background: #2d2d2d; border: 2px solid #f59e0b; border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem;">
                <div style="margin-bottom: 1rem;">
                    <strong style="color: #fbbf24; font-size: 1rem;">Direct DIDs</strong>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <div style="padding: 0.5rem; background: #1e1e1e; color: white; border: 1px solid #404040; border-radius: 4px; width: 120px;">${mode}</div>
                    <div style="flex: 1; padding: 0.5rem; background: #1e1e1e; color: #86efac; border: 1px solid #404040; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">${dids.length} DIDs</div>
                </div>
            </div>
        `;
    }
    
    return '';
}


// Initialize search
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('actions-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => searchActions(e.target.value));
    }
});
