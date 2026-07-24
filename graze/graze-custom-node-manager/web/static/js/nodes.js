// Nodes module
import { api } from './api.js';

let currentSort = 'popularity'; // 'popularity', 'name', 'recent'
let isLoggedIn = false;

export function setLoggedIn(loggedIn) {
    isLoggedIn = loggedIn;
}

export async function loadNodes() {
    // Check session status
    const session = await api.get('/api/session');
    isLoggedIn = session.logged_in;
    
    const nodes = await api.get('/api/nodes');
    
    sortNodes(nodes);
    renderNodes(nodes);
}

function sortNodes(nodes) {
    if (currentSort === 'popularity') {
        // Count nodes per color
        const colorCounts = {};
        nodes.forEach(node => {
            const color = node.custom_color || node.color;
            colorCounts[color] = (colorCounts[color] || 0) + 1;
        });
        
        // Sort by color frequency (desc), then by color name for consistency, then by node name (asc)
        nodes.sort((a, b) => {
            const colorA = a.custom_color || a.color;
            const colorB = b.custom_color || b.color;
            const countDiff = colorCounts[colorB] - colorCounts[colorA];
            
            if (countDiff !== 0) {
                return countDiff;
            }
            
            // If same count, group by color name
            const colorCompare = colorA.localeCompare(colorB);
            if (colorCompare !== 0) {
                return colorCompare;
            }
            
            // Within same color, sort by name
            return a.name.localeCompare(b.name);
        });
    } else if (currentSort === 'name') {
        nodes.sort((a, b) => a.name.localeCompare(b.name));
    } else if (currentSort === 'recent') {
        nodes.sort((a, b) => {
            const timeA = a.last_pushed || 0;
            const timeB = b.last_pushed || 0;
            return timeB - timeA;
        });
    }
}

function renderNodes(nodes) {
    const grid = document.getElementById('nodes-grid');
    grid.innerHTML = '';
    
    nodes.forEach(node => {
        const card = document.createElement('div');
        card.className = 'node-card' + (node.pushed ? ' pushed' : '');
        const nodeColor = node.custom_color || node.color;
        card.dataset.color = nodeColor;
        
        // Build badges
        const badges = [];
        
        // Type badge based on color
        if (nodeColor === 'yellow') {
            badges.push('<span class="badge">Moderation</span>');
        } else if (nodeColor === 'green') {
            badges.push('<span class="badge">Feature</span>');
        } else if (nodeColor === 'brown') {
            badges.push('<span class="badge">Utility</span>');
        } else if (nodeColor === 'jade') {
            badges.push('<span class="badge">Mini Feature</span>');
        } else if (nodeColor === 'amber') {
            badges.push('<span class="badge">Mini Mod</span>');
        }
        
        // Manageable/Configurable badges
        if (node.manageable) {
            badges.push('<span class="badge">Manageable</span>');
        }
        if (node.configurable && Object.keys(node.configurable).some(k => k !== 'title' && k !== 'description')) {
            badges.push('<span class="badge">Configurable</span>');
        }
        
        // Pushed status
        if (node.pushed) {
            badges.push('<span class="badge pushed">✓ Pushed</span>');
        }
        
        // Gear icon for manageable OR configurable nodes (only if logged in)
        let gearIcon = '';
        if (isLoggedIn) {
            if (node.manageable) {
                gearIcon = `<button class="gear-btn" onclick="event.stopPropagation(); showNodeSettings('${node.id}')" title="Manage Terms">⚙</button>`;
            } else if (node.configurable && Object.keys(node.configurable).some(k => k !== 'title' && k !== 'description')) {
                gearIcon = `<button class="gear-btn" onclick="event.stopPropagation(); showNodeSettings('${node.id}')" title="Configure Node">⚙</button>`;
            }
        }
        
        card.innerHTML = `
            ${gearIcon}
            <div onclick="showNodeDetail('${node.id}')">
                <h3>${node.name}</h3>
                <p>${node.description}</p>
                <div class="node-meta">
                    ${badges.join('')}
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

export function setSortMode(mode) {
    currentSort = mode;
    loadNodes();
}
