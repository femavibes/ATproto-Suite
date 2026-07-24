// State
const GRID_SIZE = 20;
let nodeIdCounter = 0;
let nodes = [];
let connections = [];
let selectedNode = null;
let connectingFrom = null;
let draggedNode = null;
let offsetX = 0;
let offsetY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panScrollLeft = 0;
let panScrollTop = 0;
let previewLine = null;
let expandedGroups = new Set();
let mouseDownTime = 0;
let mouseDownPos = { x: 0, y: 0 };
let mouseDownShift = false;
let selectedNodes = new Set();

// Initialize sidebar
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const categories = {
        'Flow Control': ['start', 'end', 'group'],
        'Logic Nodes': ['or', 'and', 'nof'],
        'Native Conditions': ['text', 'language', 'posttype', 'likes', 'score', 'age', 'author', 'followers', 'media'],
        'Enrichment Modules 🔌': ['sentiment', 'toxicity', 'topic', 'imageanalysis'],
        'Source Modules 🔌': ['rssfeed', 'manualpost'],
        'Scoring Modules 🔌': ['personalization', 'engagement', 'recency', 'authorquality', 'topicrelevance', 'viralityscore', 'customscoring'],
        'Injection Modules 🔌': ['ads', 'sponsored', 'recommendfollows', 'trendingtopics', 'custominjection', 'carouselposts', 'communityhighlights', 'pollinjection', 'breakingnews', 'usersuggestions'],
        'Sorting Nodes': ['chronological', 'byscore', 'mostlikes', 'mostengagement', 'weightedrandom', 'clustered', 'diversity', 'customsort', 'random']
    };

    Object.entries(categories).forEach(([title, types]) => {
        const category = document.createElement('div');
        category.className = 'node-category';
        category.innerHTML = `<h3>${title}</h3>`;
        
        types.forEach(type => {
            const nodeType = NODE_TYPES[type];
            if (!nodeType) return;
            const item = document.createElement('div');
            item.className = `node-item ${nodeType.category}`;
            item.draggable = true;
            item.dataset.type = type;
            if (['start', 'end', 'pinnedposts', 'rotatingposts', 'rssfeed', 'manualpost', 'personalization', 'engagement', 'recency', 'authorquality', 'topicrelevance', 'viralityscore', 'customscoring', 'ads', 'sponsored', 'recommendfollows', 'trendingtopics', 'custominjection', 'carouselposts', 'communityhighlights', 'pollinjection', 'breakingnews', 'usersuggestions', 'chronological', 'byscore', 'mostlikes', 'mostengagement', 'weightedrandom', 'clustered', 'diversity', 'customsort', 'random'].includes(type)) {
                const colors = {start: '#51cf66', end: '#51cf66', pinnedposts: '#ffd43b', rotatingposts: '#ffd43b', rssfeed: '#ffa94d', manualpost: '#ffa94d', personalization: '#748ffc', engagement: '#748ffc', recency: '#748ffc', authorquality: '#748ffc', topicrelevance: '#748ffc', viralityscore: '#748ffc', customscoring: '#748ffc', ads: '#ff6b6b', sponsored: '#ff6b6b', recommendfollows: '#ff6b6b', trendingtopics: '#ff6b6b', custominjection: '#ff6b6b', carouselposts: '#ff6b6b', communityhighlights: '#ff6b6b', pollinjection: '#ff6b6b', breakingnews: '#ff6b6b', usersuggestions: '#ff6b6b', chronological: '#9775fa', byscore: '#9775fa', mostlikes: '#9775fa', mostengagement: '#9775fa', weightedrandom: '#9775fa', clustered: '#9775fa', diversity: '#9775fa', customsort: '#9775fa', random: '#9775fa'};
                item.style.borderLeft = `4px solid ${colors[type]}`;
            }
            item.innerHTML = `<div class="node-title">${nodeType.name}</div><div class="node-desc">${nodeType.title}</div>`;
            item.addEventListener('dragstart', (e) => e.dataTransfer.setData('nodeType', type));
            category.appendChild(item);
        });
        
        sidebar.appendChild(category);
    });
}

// Canvas drag and drop
const canvas = document.getElementById('canvas');
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    
    // Prevent adding duplicate START or END nodes
    if (nodeType === 'start' && nodes.some(n => n.type === 'start')) {
        alert('⚠️ Only one START node is allowed per feed.');
        return;
    }
    if (nodeType === 'end' && nodes.some(n => n.type === 'end')) {
        alert('⚠️ Only one END node is allowed per feed.');
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left + canvas.scrollLeft) / GRID_SIZE) * GRID_SIZE;
    const y = Math.round((e.clientY - rect.top + canvas.scrollTop) / GRID_SIZE) * GRID_SIZE;
    createNode(nodeType, x, y);
});

// Canvas panning with click+drag on empty space
canvas.addEventListener('mousedown', (e) => {
    // Only pan if clicking on canvas background (not on nodes)
    if (e.target === canvas || e.target.id === 'canvasInner' || e.target.id === 'connectionsSvg') {
        e.preventDefault();
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panScrollLeft = canvas.scrollLeft;
        panScrollTop = canvas.scrollTop;
        canvas.style.cursor = 'grabbing';
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (isPanning) {
        const dx = panStartX - e.clientX;
        const dy = panStartY - e.clientY;
        canvas.scrollLeft = panScrollLeft + dx;
        canvas.scrollTop = panScrollTop + dy;
    }
    
    // Update preview line when connecting
    if (connectingFrom && previewLine) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left + canvas.scrollLeft;
        const y = e.clientY - rect.top + canvas.scrollTop;
        
        const fromNode = document.getElementById(`node-${connectingFrom.nodeId}`);
        const fromRect = fromNode.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        
        const fromNodeData = nodes.find(n => n.id === connectingFrom.nodeId);
        const fromIsCondition = fromNodeData && (NODE_TYPES[fromNodeData.type].category === 'condition' || NODE_TYPES[fromNodeData.type].category === 'module');
        
        let x1, y1;
        if (connectingFrom.port === 4) {
            x1 = fromRect.left - canvasRect.left + canvas.scrollLeft;
            y1 = fromRect.top + fromRect.height * 0.3 - canvasRect.top + canvas.scrollTop;
        } else if (connectingFrom.port === 5) {
            x1 = fromRect.right - fromRect.width * 0.3 - canvasRect.left + canvas.scrollLeft;
            y1 = fromRect.top - canvasRect.top + canvas.scrollTop;
        } else if (connectingFrom.port === 6) {
            x1 = fromRect.right - fromRect.width * 0.3 - canvasRect.left + canvas.scrollLeft;
            y1 = fromRect.bottom - canvasRect.top + canvas.scrollTop;
        } else if (connectingFrom.port === 7) {
            x1 = fromRect.right - canvasRect.left + canvas.scrollLeft;
            y1 = fromRect.top + fromRect.height * (fromIsCondition ? 0.3 : 0.5) - canvasRect.top + canvas.scrollTop;
        } else {
            x1 = fromRect.right - canvasRect.left + canvas.scrollLeft;
            y1 = fromRect.top + fromRect.height * 0.5 - canvasRect.top + canvas.scrollTop;
        }
        
        const midX = (x1 + x) / 2;
        const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y}, ${x} ${y}`;
        previewLine.setAttribute('d', d);
    }
});

canvas.addEventListener('mouseup', (e) => {
    isPanning = false;
    canvas.style.cursor = '';
});

canvas.addEventListener('mouseleave', () => {
    isPanning = false;
    canvas.style.cursor = '';
});

// Right-click or Escape to cancel connection
canvas.addEventListener('contextmenu', (e) => {
    if (connectingFrom) {
        e.preventDefault();
        connectingFrom.point.style.opacity = '';
        connectingFrom = null;
        if (previewLine) {
            previewLine.remove();
            previewLine = null;
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && connectingFrom) {
        connectingFrom.point.style.opacity = '';
        connectingFrom = null;
        if (previewLine) {
            previewLine.remove();
            previewLine = null;
        }
    }
});

function createNode(type, x, y) {
    const node = { id: nodeIdCounter++, type, x, y, config: {} };
    nodes.push(node);
    renderNode(node);
    updatePreview();
    saveToLocalStorage();
}

function renderNode(node) {
    const nodeType = NODE_TYPES[node.type];
    if (!nodeType) {
        console.warn(`Unknown node type: ${node.type}, skipping render`);
        return;
    }
    
    const isGroupNode = node.type === 'group';
    const isExpanded = expandedGroups.has(node.id);
    
    // If this is a child of a collapsed group, don't render it
    if (!isGroupNode) {
        const parentGroup = nodes.find(n => n.type === 'group' && n.config?.children?.includes(node.id));
        if (parentGroup && !expandedGroups.has(parentGroup.id)) {
            return; // Skip rendering children of collapsed groups
        }
    }
    
    // Check for snapped connections
    const snappedRight = connections.some(c => c.snapped && ((c.from === node.id && c.fromPort === 7) || (c.to === node.id && c.toPort === 3)));
    const snappedLeft = connections.some(c => c.snapped && ((c.to === node.id && c.toPort === 0) || (c.from === node.id && c.fromPort === 4)));
    const snappedTop = connections.some(c => c.snapped && ((c.to === node.id && c.toPort === 1) || (c.from === node.id && c.fromPort === 5)));
    const snappedBottom = connections.some(c => c.snapped && ((c.from === node.id && c.fromPort === 6) || (c.to === node.id && c.toPort === 2)));
    
    const nodeEl = document.createElement('div');
    nodeEl.className = `canvas-node ${nodeType.category}`;
    if (snappedRight) nodeEl.classList.add('snapped-right');
    if (snappedLeft) nodeEl.classList.add('snapped-left');
    if (snappedTop) nodeEl.classList.add('snapped-top');
    if (snappedBottom) nodeEl.classList.add('snapped-bottom');
    
    // Preserve selected state from tracking set
    if (selectedNodes.has(node.id)) {
        nodeEl.classList.add('selected');
    }
    
    nodeEl.id = `node-${node.id}`;
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';

    const inputCount = connections.filter(c => c.to === node.id).length;
    const hasMerge = inputCount > 1;
    const hasOutputs = connections.some(c => c.from === node.id);
    const isExpensive = MODULE_COSTS[node.type]?.cost === 'high';
    const hasCostWarning = isExpensive && hasOutputs;
    const isContinueOnly = nodeType.category === 'scoring' || nodeType.category === 'sorting' || nodeType.category === 'injection';
    const isAndNode = node.type === 'and';
    const isOrNode = node.type === 'or';
    const isNofNode = node.type === 'nof';
    const nofBranchCount = isNofNode ? connections.filter(c => c.from === node.id && c.fromPort !== 0).length : 0;
    const isEndNode = node.type === 'end';
    const isStartNode = node.type === 'start';
    const isSourceNode = node.type === 'manualpost' || node.type === 'rssfeed';
    const isSortingNode = nodeType.category === 'sorting';
    const isInjectionNode = nodeType.category === 'injection';
    const isFeedConfigNode = nodeType.category === 'feed-config';
    const isConditionNode = nodeType.category === 'condition' || nodeType.category === 'module';
    const hasContinueOutputs = isContinueOnly || nodeType.category === 'source' || isStartNode || isSourceNode;
    
    // END node has two distinct input zones
    const endTopInput = isEndNode ? connections.filter(c => c.to === node.id && c.toPort === 1).length : 0;
    const endBottomInput = isEndNode ? connections.filter(c => c.to === node.id && c.toPort === 2).length : 0;
    
    if (hasMerge) nodeEl.classList.add('has-multiple-inputs');
    if (hasCostWarning) nodeEl.classList.add('has-cost-warning');
    
    // Group node special rendering
    if (isGroupNode) {
        const childCount = node.config?.children?.length || 0;
        const groupName = node.config?.name || 'Unnamed Group';
        nodeEl.innerHTML = `
            <div class="node-header">
                <div class="node-type">${nodeType.name}</div>
                <button class="node-delete" onclick="deleteNode(${node.id})">×</button>
            </div>
            <div class="node-content" style="font-weight: 600; margin-bottom: 8px;">${groupName}</div>
            <div style="font-size: 11px; color: #888; margin-bottom: 8px;">${childCount} blocks inside</div>
            <button onclick="toggleGroup(${node.id})" style="width: 100%; background: #3a3a3a; border: 1px solid #555; color: white; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 11px; margin-bottom: 6px;">
                ${isExpanded ? '📦 Collapse' : '📂 Expand'}
            </button>
            <button onclick="addToGroup(${node.id})" style="width: 100%; background: #4a9eff; border: 1px solid #4a9eff; color: white; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                ➕ Add Selected Nodes
            </button>
            <div class="node-config" style="margin-top: 8px;">${nodeType.config}</div>
            <div class="connection-point input-left" data-node="${node.id}" data-type="input" data-port="0"></div>
            <div class="connection-point output-right continue-output" data-node="${node.id}" data-type="output" data-port="7"></div>
        `;
    } else {
        nodeEl.innerHTML = `
        ${!isConditionNode && !isStartNode && !isSourceNode && !snappedLeft && !isEndNode && !isSortingNode && !isInjectionNode ? `<div class="connection-point input-left ${isContinueOnly || isEndNode ? 'continue-input' : ''}" data-node="${node.id}" data-type="input" data-port="0"></div>` : ''}
        ${isEndNode && !snappedLeft ? `<div class="connection-point input-left continue-input" data-node="${node.id}" data-type="input" data-port="0"></div>` : ''}
        ${isSortingNode && !snappedTop ? `<div class="connection-point output-top continue-output" data-node="${node.id}" data-type="output" data-port="5" style="left: 50%; transform: translateX(-50%);"></div>` : ''}
        ${isConditionNode && !snappedLeft ? `<div class="connection-point input-left or-port" data-node="${node.id}" data-type="input" data-port="0"></div>` : ''}
        ${isConditionNode && !snappedLeft ? `<div class="connection-point output-left or-port" data-node="${node.id}" data-type="output" data-port="4"></div>` : ''}
        ${!isEndNode && !isStartNode && !isSourceNode && !snappedTop && !isSortingNode && !isInjectionNode ? `<div class="connection-point input-top ${isContinueOnly || isEndNode ? 'continue-input' : ''} ${isAndNode ? 'and-input' : ''} ${isOrNode ? 'or-input' : ''} ${isNofNode ? 'nof-input' : ''} ${isConditionNode ? 'and-port' : ''}" data-node="${node.id}" data-type="input" data-port="1"></div>` : ''}
        ${isEndNode && !snappedTop ? `<div class="connection-point input-top injection-input" data-node="${node.id}" data-type="input" data-port="1" title="INJECT: Connect injection nodes here"></div>` : ''}
        ${!isEndNode && !isStartNode && !isSourceNode && !snappedBottom && !isSortingNode && !isInjectionNode ? `<div class="connection-point input-bottom ${isContinueOnly || isEndNode ? 'continue-input' : ''} ${isAndNode ? 'and-input' : ''} ${isOrNode ? 'or-input' : ''} ${isNofNode ? 'nof-input' : ''} ${isConditionNode ? 'and-port' : ''}" data-node="${node.id}" data-type="input" data-port="2"></div>` : ''}
        ${isEndNode && !snappedBottom ? `<div class="connection-point input-bottom sorting-input" data-node="${node.id}" data-type="input" data-port="2" title="SORT: Connect sorting nodes here"></div>` : ''}
        ${isConditionNode && !snappedRight ? `<div class="connection-point input-right or-port" data-node="${node.id}" data-type="input" data-port="3"></div>` : ''}
        ${isConditionNode && !snappedRight ? `<div class="connection-point output-right or-port" data-node="${node.id}" data-type="output" data-port="7"></div>` : ''}
        ${isSortingNode && !snappedBottom ? `<div class="connection-point input-bottom continue-input" data-node="${node.id}" data-type="input" data-port="2" style="left: 50%; transform: translateX(-50%);"></div>` : ''}
        ${isInjectionNode && !snappedBottom ? `<div class="connection-point output-bottom continue-output" data-node="${node.id}" data-type="output" data-port="6" style="left: 50%; transform: translateX(-50%);"></div>` : ''}
        ${!isEndNode && !isConditionNode && !snappedRight && !isSortingNode && !isInjectionNode ? `<div class="connection-point output-right continue-output" data-node="${node.id}" data-type="output" data-port="7"></div>` : ''}
        ${!isEndNode && !snappedTop && !isSortingNode && !isInjectionNode ? `<div class="connection-point output-top ${hasContinueOutputs ? 'continue-output' : ''} ${isAndNode ? 'and-output' : ''} ${isOrNode ? 'or-output' : ''} ${isNofNode ? 'nof-output' : ''} ${isConditionNode ? 'and-port' : ''}" data-node="${node.id}" data-type="output" data-port="5"></div>` : ''}
        ${!isEndNode && !snappedBottom && !isSortingNode && !isInjectionNode ? `<div class="connection-point output-bottom ${hasContinueOutputs ? 'continue-output' : ''} ${isAndNode ? 'and-output' : ''} ${isOrNode ? 'or-output' : ''} ${isNofNode ? 'nof-output' : ''} ${isConditionNode ? 'and-port' : ''}" data-node="${node.id}" data-type="output" data-port="6"></div>` : ''}
        ${hasMerge ? '<div class="node-merge-badge">OR</div>' : ''}
        ${hasCostWarning ? '<div class="node-cost-warning">💰 EXPENSIVE</div>' : ''}
        <div class="node-header">
            <div class="node-type">${nodeType.name}</div>
            ${node.type !== 'start' && node.type !== 'end' ? `<button class="node-delete" onclick="deleteNode(${node.id})">×</button>` : ''}
        </div>
        <div class="node-content">${nodeType.title}</div>
        ${isNofNode ? `<div style="font-size: 10px; color: #888; margin-top: 4px;">${nofBranchCount} branches connected</div>` : ''}
        <div class="node-config">${nodeType.config}</div>
    `;
    }
    
    // Set dropdown value for AND/OR nodes
    if (node.type === 'and' || node.type === 'or') {
        setTimeout(() => {
            const select = nodeEl.querySelector('select');
            if (select) select.value = node.type;
        }, 0);
    }

    nodeEl.addEventListener('mousedown', startDrag);
    nodeEl.addEventListener('click', (e) => {
        // Don't handle clicks on interactive elements
        if (e.target.classList.contains('node-delete') || 
            e.target.classList.contains('connection-point') ||
            e.target.tagName === 'BUTTON' || 
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.tagName === 'SELECT') {
            return;
        }
        
        e.stopPropagation();
        
        if (e.shiftKey) {
            e.preventDefault();
            nodeEl.classList.toggle('selected');
        } else {
            document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
            nodeEl.classList.add('selected');
            selectedNode = node.id;
        }
    });

    nodeEl.querySelectorAll('.connection-point').forEach(point => {
        point.addEventListener('click', (e) => {
            e.stopPropagation();
            handleConnectionClick(point);
        });
    });

    document.getElementById('canvasInner').appendChild(nodeEl);
}

function startDrag(e) {
    if (e.target.classList.contains('connection-point') || e.target.classList.contains('node-delete') || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.shiftKey) {
        e.preventDefault(); // Prevent text selection
    }
    e.stopPropagation();
    
    mouseDownTime = Date.now();
    mouseDownPos = { x: e.clientX, y: e.clientY };
    mouseDownShift = e.shiftKey;
    
    draggedNode = e.currentTarget;
    const rect = draggedNode.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
}

function drag(e) {
    if (!draggedNode) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left + canvas.scrollLeft - offsetX) / GRID_SIZE) * GRID_SIZE;
    const y = Math.round((e.clientY - rect.top + canvas.scrollTop - offsetY) / GRID_SIZE) * GRID_SIZE;
    draggedNode.style.left = x + 'px';
    draggedNode.style.top = y + 'px';
    const nodeId = parseInt(draggedNode.id.split('-')[1]);
    const node = nodes.find(n => n.id === nodeId);
    if (node) { node.x = x; node.y = y; }
    drawConnections();
}

function stopDrag(e) {
    if (draggedNode) {
        const timeDiff = Date.now() - mouseDownTime;
        const distMoved = Math.sqrt(Math.pow(e.clientX - mouseDownPos.x, 2) + Math.pow(e.clientY - mouseDownPos.y, 2));
        
        // If it was a quick click (< 200ms) and didn't move much (< 5px), treat as selection
        if (timeDiff < 200 && distMoved < 5) {
            const nodeId = parseInt(draggedNode.id.split('-')[1]);
            if (mouseDownShift) {
                if (selectedNodes.has(nodeId)) {
                    selectedNodes.delete(nodeId);
                    draggedNode.classList.remove('selected');
                } else {
                    selectedNodes.add(nodeId);
                    draggedNode.classList.add('selected');
                }
            } else {
                selectedNodes.clear();
                selectedNodes.add(nodeId);
                document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
                draggedNode.classList.add('selected');
                selectedNode = nodeId;
            }
        } else {
            checkForSnap();
            saveToLocalStorage();
        }
    }
    draggedNode = null;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
}

function checkForSnap() {
    const nodeId = parseInt(draggedNode.id.split('-')[1]);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const SNAP_DISTANCE = 20;
    const ALIGNMENT_TOLERANCE = 20; // How aligned nodes need to be on the perpendicular axis
    const nodeWidth = 200;
    const nodeHeight = 200;
    
    console.log('Checking snap for node', node.id, 'at', node.x, node.y);
    
    // First, remove any snapped connections involving this node that are no longer valid
    connections = connections.filter(conn => {
        if (!conn.snapped) return true;
        if (conn.from !== node.id && conn.to !== node.id) return true;
        
        const otherNodeId = conn.from === node.id ? conn.to : conn.from;
        const otherNode = nodes.find(n => n.id === otherNodeId);
        if (!otherNode) return false;
        
        const dx = node.x - otherNode.x;
        const dy = node.y - otherNode.y;
        
        // Check if still in snap range
        if (conn.fromPort === 7 || conn.fromPort === 4) {
            // Horizontal connection
            if (Math.abs(dy) < ALIGNMENT_TOLERANCE) {
                const distance = Math.abs(Math.abs(dx) - nodeWidth);
                if (distance < SNAP_DISTANCE) return true;
            }
        } else if (conn.fromPort === 6 || conn.fromPort === 5) {
            // Vertical connection
            if (Math.abs(dx) < ALIGNMENT_TOLERANCE) {
                const distance = Math.abs(Math.abs(dy) - nodeHeight);
                if (distance < SNAP_DISTANCE) return true;
            }
        }
        
        console.log('Removing snapped connection', conn);
        return false;
    });
    
    nodes.forEach(otherNode => {
        if (otherNode.id === node.id) return;
        
        const dx = node.x - otherNode.x;
        const dy = node.y - otherNode.y;
        
        console.log('  vs node', otherNode.id, 'dx:', dx, 'dy:', dy);
        
        // Horizontal snap (side by side, same Y)
        if (Math.abs(dy) < ALIGNMENT_TOLERANCE) {
            console.log('    Y aligned!');
            const distance = Math.abs(Math.abs(dx) - nodeWidth);
            console.log('    Distance from nodeWidth:', distance);
            if (distance < SNAP_DISTANCE) {
                if (dx > 0) {
                    console.log('    HORIZONTAL SNAP: otherNode left, node right');
                    const existing = connections.find(c => 
                        c.from === otherNode.id && c.fromPort === 7 && c.to === node.id && c.toPort === 0
                    );
                    if (!existing) {
                        connections.push({ 
                            from: otherNode.id, 
                            fromPort: 7, 
                            to: node.id, 
                            toPort: 0, 
                            logic: 'OR',
                            snapped: true 
                        });
                        console.log('    Created connection!');
                    }
                } else {
                    console.log('    HORIZONTAL SNAP: node left, otherNode right');
                    const existing = connections.find(c => 
                        c.from === node.id && c.fromPort === 7 && c.to === otherNode.id && c.toPort === 0
                    );
                    if (!existing) {
                        connections.push({ 
                            from: node.id, 
                            fromPort: 7, 
                            to: otherNode.id, 
                            toPort: 0, 
                            logic: 'OR',
                            snapped: true 
                        });
                        console.log('    Created connection!');
                    }
                }
            }
        }
        
        // Vertical snap (stacked, same X)
        if (Math.abs(dx) < ALIGNMENT_TOLERANCE) {
            console.log('    X aligned!');
            const distance = Math.abs(Math.abs(dy) - nodeHeight);
            console.log('    Distance from nodeHeight:', distance);
            if (distance < SNAP_DISTANCE) {
                if (dy > 0) {
                    console.log('    VERTICAL SNAP: otherNode top, node bottom');
                    const existing = connections.find(c => 
                        c.from === otherNode.id && c.fromPort === 6 && c.to === node.id && c.toPort === 1
                    );
                    if (!existing) {
                        connections.push({ 
                            from: otherNode.id, 
                            fromPort: 6, 
                            to: node.id, 
                            toPort: 1, 
                            logic: 'AND',
                            snapped: true 
                        });
                        console.log('    Created connection!');
                    }
                } else {
                    console.log('    VERTICAL SNAP: node top, otherNode bottom');
                    const existing = connections.find(c => 
                        c.from === node.id && c.fromPort === 6 && c.to === otherNode.id && c.toPort === 1
                    );
                    if (!existing) {
                        connections.push({ 
                            from: node.id, 
                            fromPort: 6, 
                            to: otherNode.id, 
                            toPort: 1, 
                            logic: 'AND',
                            snapped: true 
                        });
                        console.log('    Created connection!');
                    }
                }
            }
        }
    });
    
    document.querySelectorAll('.canvas-node').forEach(n => n.remove());
    nodes.forEach(node => renderNode(node));
    drawConnections();
}

function hasCycle(fromNodeId, toNodeId) {
    const visited = new Set();
    const queue = [toNodeId];
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === fromNodeId) return true;
        if (visited.has(current)) continue;
        visited.add(current);
        connections.forEach(conn => {
            if (conn.from === current) queue.push(conn.to);
        });
    }
    return false;
}

function handleConnectionClick(point) {
    const nodeId = parseInt(point.dataset.node);
    const type = point.dataset.type;
    const port = parseInt(point.dataset.port);

    if (!connectingFrom) {
        if (type === 'output') {
            connectingFrom = { nodeId, point, port };
            point.style.opacity = '0.7';
            
            // Create preview line
            const svg = document.getElementById('connectionsSvg');
            previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            previewLine.setAttribute('class', 'connection-line preview-line');
            previewLine.setAttribute('stroke-dasharray', '5,5');
            svg.appendChild(previewLine);
        }
    } else {
        if (type === 'input' && nodeId !== connectingFrom.nodeId) {
            const fromNode = nodes.find(n => n.id === connectingFrom.nodeId);
            const toNode = nodes.find(n => n.id === nodeId);
            const fromCategory = NODE_TYPES[fromNode.type].category;
            const toCategory = NODE_TYPES[toNode.type].category;
            
            // For condition nodes, validate port compatibility
            const fromIsCondition = fromCategory === 'condition' || fromCategory === 'module';
            const toIsCondition = toCategory === 'condition' || toCategory === 'module';
            
            // CONTINUE connections: right output (port 7) on non-condition nodes can ONLY connect to left input (port 0)
            if (!fromIsCondition && connectingFrom.port === 7 && port !== 0) {
                alert('⚠️ CONTINUE connections (right arrow) must connect to left input (left arrow).\n\nUse top/bottom arrows for conditional branches.');
                connectingFrom.point.style.opacity = '';
                connectingFrom = null;
                if (previewLine) {
                    previewLine.remove();
                    previewLine = null;
                }
                return;
            }
            
            // Conditional connections: top/bottom outputs (ports 5/6) can ONLY connect to top/bottom inputs (ports 1/2)
            if ((connectingFrom.port === 5 || connectingFrom.port === 6) && port === 0) {
                alert('⚠️ Conditional branches (top/bottom arrows) cannot connect to left input.\n\nUse right arrow → left arrow for CONTINUE connections.');
                connectingFrom.point.style.opacity = '';
                connectingFrom = null;
                if (previewLine) {
                    previewLine.remove();
                    previewLine = null;
                }
                return;
            }
            
            // CONTINUE connections can only go to logic/scoring/sorting/injection/end (not condition/module nodes)
            if (!fromIsCondition && connectingFrom.port === 7) {
                if (toCategory === 'condition' || toCategory === 'module') {
                    alert('⚠️ CONTINUE connections can only connect to:\n- Logic nodes (AND/OR)\n- Scoring nodes\n- Sorting nodes\n- Injection nodes\n- END node\n\nUse top/bottom arrows to connect to condition nodes.');
                    connectingFrom.point.style.opacity = '';
                    connectingFrom = null;
                    if (previewLine) {
                        previewLine.remove();
                        previewLine = null;
                    }
                    return;
                }
            }
            
            // Scoring/sorting/injection nodes can ONLY accept CONTINUE connections (left input) OR sorting accepts ports 1,2
            if ((toCategory === 'scoring' || toCategory === 'injection') && port !== 0) {
                alert('⚠️ Scoring/Injection nodes can only accept CONTINUE connections.\n\nConnect to the left input (left arrow) using a right output (right arrow).');
                connectingFrom.point.style.opacity = '';
                connectingFrom = null;
                if (previewLine) {
                    previewLine.remove();
                    previewLine = null;
                }
                return;
            }
            
            if (toCategory === 'sorting' && port !== 0 && port !== 2) {
                alert('⚠️ Sorting nodes accept:\n- Left input (port 0)\n- Bottom input (port 2)');
                connectingFrom.point.style.opacity = '';
                connectingFrom = null;
                if (previewLine) {
                    previewLine.remove();
                    previewLine = null;
                }
                return;
            }
            
            // Injection nodes can ONLY connect to END node's top input (port 1)
            if (fromCategory === 'injection') {
                if (toNode.type !== 'end') {
                    alert('⚠️ Injection nodes can only connect to END node.');
                    connectingFrom.point.style.opacity = '';
                    connectingFrom = null;
                    if (previewLine) {
                        previewLine.remove();
                        previewLine = null;
                    }
                    return;
                }
                if (port !== 1) {
                    alert('⚠️ Injection nodes must connect to END node\'s TOP input (orange port).\n\nInjection happens AFTER sorting.');
                    connectingFrom.point.style.opacity = '';
                    connectingFrom = null;
                    if (previewLine) {
                        previewLine.remove();
                        previewLine = null;
                    }
                    return;
                }
            }
            
            // Sorting nodes can ONLY connect to END node's bottom input (port 2) or other sorting nodes
            if (fromCategory === 'sorting') {
                if (toNode.type !== 'end' && toCategory !== 'sorting' && toCategory !== 'injection') {
                    alert('⚠️ Sorting nodes can only connect to:\n- END node\'s BOTTOM input (purple port)\n- Other Sorting nodes (linear pipeline)\n- Injection nodes (chain before END)');
                    connectingFrom.point.style.opacity = '';
                    connectingFrom = null;
                    if (previewLine) {
                        previewLine.remove();
                        previewLine = null;
                    }
                    return;
                }
                if (toNode.type === 'end' && port !== 2) {
                    alert('⚠️ Sorting nodes must connect to END node\'s BOTTOM input (purple port).\n\nSorting happens BEFORE injection.');
                    connectingFrom.point.style.opacity = '';
                    connectingFrom = null;
                    if (previewLine) {
                        previewLine.remove();
                        previewLine = null;
                    }
                    return;
                }
            }
            
            // END node can connect to sorting nodes (port 2 → port 1)
            if (fromNode.type === 'end' && connectingFrom.port === 2) {
                if (toCategory !== 'sorting') {
                    alert('⚠️ END node\'s BOTTOM output must connect to Sorting nodes.');
                    connectingFrom.point.style.opacity = '';
                    connectingFrom = null;
                    if (previewLine) {
                        previewLine.remove();
                        previewLine = null;
                    }
                    return;
                }
            }
            
            // END node top output (port 1) should not exist, but just in case
            if (fromNode.type === 'end' && connectingFrom.port === 1) {
                alert('⚠️ END node\'s TOP port is an INPUT only, not an output.');
                connectingFrom.point.style.opacity = '';
                connectingFrom = null;
                if (previewLine) {
                    previewLine.remove();
                    previewLine = null;
                }
                return;
            }
            
            if (fromCategory === 'scoring' || fromCategory === 'sorting') {
                if (toNode.type !== 'end' && toCategory !== 'scoring' && toCategory !== 'sorting' && toCategory !== 'injection') {
                    alert('⚠️ Scoring/Sorting nodes can only connect to:\n- END node\n- Other Scoring/Sorting nodes\n- Injection nodes');
                    connectingFrom.point.style.opacity = '';
                    connectingFrom = null;
                    if (previewLine) {
                        previewLine.remove();
                        previewLine = null;
                    }
                    return;
                }
            }
            
            if (hasCycle(connectingFrom.nodeId, nodeId)) {
                alert('⚠️ Cannot create connection: This would create a cycle (infinite loop)!');
                connectingFrom.point.style.opacity = '';
                connectingFrom = null;
                if (previewLine) {
                    previewLine.remove();
                    previewLine = null;
                }
                return;
            }
            
            connections.push({ from: connectingFrom.nodeId, fromPort: connectingFrom.port, to: nodeId, toPort: port, logic: 'AND' });
            document.querySelectorAll('.canvas-node').forEach(n => n.remove());
            nodes.forEach(node => renderNode(node));
            drawConnections();
            updatePreview();
            saveToLocalStorage();
        }
        connectingFrom.point.style.opacity = '';
        connectingFrom = null;
        
        // Remove preview line
        if (previewLine) {
            previewLine.remove();
            previewLine = null;
        }
    }
}

function drawConnections() {
    const svg = document.getElementById('connectionsSvg');
    svg.innerHTML = '';

    connections.forEach(conn => {
        const fromNode = document.getElementById(`node-${conn.from}`);
        const toNode = document.getElementById(`node-${conn.to}`);
        if (!fromNode || !toNode) return;

        const fromRect = fromNode.getBoundingClientRect();
        const toRect = toNode.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();

        let x1, y1, x2, y2;
        const connFromNode = nodes.find(n => n.id === conn.from);
        const connToNode = nodes.find(n => n.id === conn.to);
        const fromIsCondition = connFromNode && (NODE_TYPES[connFromNode.type].category === 'condition' || NODE_TYPES[connFromNode.type].category === 'module');
        const toIsCondition = connToNode && (NODE_TYPES[connToNode.type].category === 'condition' || NODE_TYPES[connToNode.type].category === 'module');
        
        // Calculate FROM position
        if (conn.fromPort === 4) {
            // Port 4 = output-left (30%)
            x1 = fromRect.left - canvasRect.left + canvas.scrollLeft;
            y1 = fromRect.top + fromRect.height * 0.3 - canvasRect.top + canvas.scrollTop;
        } else if (conn.fromPort === 5) {
            // Port 5 = output-top (centered for sorting nodes)
            const fromIsSorting = connFromNode && NODE_TYPES[connFromNode.type].category === 'sorting';
            if (fromIsSorting) {
                x1 = fromRect.left + fromRect.width * 0.5 - canvasRect.left + canvas.scrollLeft;
            } else {
                x1 = fromRect.right - fromRect.width * 0.3 - canvasRect.left + canvas.scrollLeft;
            }
            y1 = fromRect.top - canvasRect.top + canvas.scrollTop;
        } else if (conn.fromPort === 6) {
            // Port 6 = output-bottom (centered for injection nodes)
            const fromIsInjection = connFromNode && NODE_TYPES[connFromNode.type].category === 'injection';
            if (fromIsInjection) {
                x1 = fromRect.left + fromRect.width * 0.5 - canvasRect.left + canvas.scrollLeft;
            } else {
                x1 = fromRect.right - fromRect.width * 0.3 - canvasRect.left + canvas.scrollLeft;
            }
            y1 = fromRect.bottom - canvasRect.top + canvas.scrollTop;
        } else if (conn.fromPort === 7) {
            // Port 7 = output-right (30% for condition, 50% for non-condition)
            x1 = fromRect.right - canvasRect.left + canvas.scrollLeft;
            y1 = fromRect.top + fromRect.height * (fromIsCondition ? 0.3 : 0.5) - canvasRect.top + canvas.scrollTop;
        } else {
            // Fallback for invalid ports
            x1 = fromRect.right - canvasRect.left + canvas.scrollLeft;
            y1 = fromRect.top + fromRect.height * 0.5 - canvasRect.top + canvas.scrollTop;
        }

        // Calculate TO position
        if (conn.toPort === 0) {
            // Port 0 = input-left (70% for condition, 50% for non-condition)
            x2 = toRect.left - canvasRect.left + canvas.scrollLeft;
            y2 = toRect.top + toRect.height * (toIsCondition ? 0.7 : 0.5) - canvasRect.top + canvas.scrollTop;
        } else if (conn.toPort === 1) {
            // Port 1 = input-top
            x2 = toRect.left + toRect.width * 0.3 - canvasRect.left + canvas.scrollLeft;
            y2 = toRect.top - canvasRect.top + canvas.scrollTop;
        } else if (conn.toPort === 2) {
            // Port 2 = input-bottom (centered for sorting nodes)
            const toIsSorting = connToNode && NODE_TYPES[connToNode.type].category === 'sorting';
            if (toIsSorting) {
                x2 = toRect.left + toRect.width * 0.5 - canvasRect.left + canvas.scrollLeft;
            } else {
                x2 = toRect.left + toRect.width * 0.3 - canvasRect.left + canvas.scrollLeft;
            }
            y2 = toRect.bottom - canvasRect.top + canvas.scrollTop;
        } else if (conn.toPort === 3) {
            // Port 3 = input-right (70%)
            x2 = toRect.right - canvasRect.left + canvas.scrollLeft;
            y2 = toRect.top + toRect.height * 0.7 - canvasRect.top + canvas.scrollTop;
        } else {
            // Fallback for invalid ports
            x2 = toRect.left - canvasRect.left + canvas.scrollLeft;
            y2 = toRect.top + toRect.height * 0.5 - canvasRect.top + canvas.scrollTop;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midX = (x1 + x2) / 2;
        const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
        
        const isFromOrNode = connFromNode && connFromNode.type === 'or';
        const isFromNofNode = connFromNode && connFromNode.type === 'nof';
        const isOrPort = (conn.fromPort === 4 || conn.fromPort === 7) && fromIsCondition;
        const isContinue = (conn.fromPort === 7 && conn.toPort === 0 && !fromIsCondition && !toIsCondition) || 
                          (conn.fromPort === 5 && conn.toPort === 2 && connFromNode && NODE_TYPES[connFromNode.type].category === 'sorting') || 
                          (conn.fromPort === 6 && conn.toPort === 1 && connFromNode && NODE_TYPES[connFromNode.type].category === 'injection');
        const hasOrLogic = conn.logic === 'OR' || isFromOrNode || (isOrPort && !isContinue);
        const isMainFlow = isContinue;
        
        // Don't draw line for snapped connections
        if (conn.snapped) {
            return;
        }
        
        // Calculate branch number for N-OF nodes
        let branchNumber = 0;
        if (isFromNofNode && !isContinue) {
            const nofBranches = connections.filter(c => c.from === conn.from && c.fromPort !== 0);
            branchNumber = nofBranches.indexOf(conn) + 1;
        }
        
        path.setAttribute('d', d);
        path.setAttribute('class', `connection-line ${isContinue ? 'continue-logic' : (hasOrLogic ? 'or-logic' : 'and-logic')}`);
        path.style.pointerEvents = 'stroke';
        path.style.strokeWidth = '10';
        path.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleConnectionLogic(connections.indexOf(conn));
        });
        path.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Delete this connection?')) {
                connections.splice(connections.indexOf(conn), 1);
                document.querySelectorAll('.canvas-node').forEach(n => n.remove());
                nodes.forEach(node => renderNode(node));
                drawConnections();
                saveToLocalStorage();
            }
        });
        svg.appendChild(path);
        
        // Add label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX);
        text.setAttribute('y', (y1 + y2) / 2 - 5);
        text.setAttribute('class', `connection-label ${isContinue ? 'continue-label' : (hasOrLogic ? 'or-label' : 'and-label')} ${isFromNofNode ? 'branch-label' : ''}`);
        text.textContent = isFromNofNode ? `BRANCH ${branchNumber}` : (isContinue ? 'CONTINUE' : (hasOrLogic ? 'OR' : 'AND'));
        svg.appendChild(text);
    });
}

function toggleConnectionLogic(connIndex) {
    const conn = connections[connIndex];
    if (!conn) return;
    const fromNode = nodes.find(n => n.id === conn.from);
    const toNode = nodes.find(n => n.id === conn.to);
    if (!fromNode || !toNode) return;
    const fromIsLogic = NODE_TYPES[fromNode.type].category === 'logic';
    const toIsLogic = NODE_TYPES[toNode.type].category === 'logic';
    if (fromIsLogic || toIsLogic) {
        alert('⚠️ Cannot toggle logic on connections to/from AND/OR nodes.\nLogic nodes already define the relationship.');
        return;
    }
    conn.logic = conn.logic === 'AND' ? 'OR' : 'AND';
    drawConnections();
    saveToLocalStorage();
}

function changeLogicType(selectEl, event) {
    event.stopPropagation();
    const nodeEl = selectEl.closest('.canvas-node');
    const nodeId = parseInt(nodeEl.id.split('-')[1]);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const newType = selectEl.value;
    if (node.type !== newType) {
        node.type = newType;
        document.querySelectorAll('.canvas-node').forEach(n => n.remove());
        nodes.forEach(n => renderNode(n));
        drawConnections();
        saveToLocalStorage();
    }
}

function selectNode(nodeId) {
    document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
    document.getElementById(`node-${nodeId}`).classList.add('selected');
    selectedNode = nodeId;
}

function deleteNode(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (node && (node.type === 'start' || node.type === 'end')) {
        alert('⚠️ Cannot delete START or END nodes. They are required for every feed.');
        return;
    }
    nodes = nodes.filter(n => n.id !== nodeId);
    connections = connections.filter(c => c.from !== nodeId && c.to !== nodeId);
    document.getElementById(`node-${nodeId}`).remove();
    document.querySelectorAll('.canvas-node').forEach(n => n.remove());
    nodes.forEach(node => renderNode(node));
    drawConnections();
    updatePreview();
    saveToLocalStorage();
}

function clearCanvas() {
    if (confirm('Clear all nodes?')) {
        nodes = [];
        connections = [];
        document.querySelectorAll('.canvas-node').forEach(n => n.remove());
        drawConnections();
        updatePreview();
        saveToLocalStorage();
    }
}

function updatePreview() {
    const count = 234 - (nodes.length * 15);
    document.getElementById('matchCount').textContent = Math.max(50, count);
    let totalCost = 0;
    const estimatedPosts = 10000;
    nodes.forEach(node => {
        if (MODULE_COSTS[node.type]) {
            totalCost += (MODULE_COSTS[node.type].costPerK * estimatedPosts) / 1000;
        }
    });
    document.getElementById('costValue').textContent = `$${totalCost.toFixed(2)}/day`;
    
    // Validation: Check if scoring modules are used without "By Score" sorting
    const hasScoringModules = nodes.some(n => NODE_TYPES[n.type]?.category === 'scoring');
    const hasByScoreSorting = nodes.some(n => n.type === 'byscore');
    const warningEl = document.getElementById('validationWarning');
    
    if (hasScoringModules && !hasByScoreSorting) {
        if (warningEl) {
            warningEl.textContent = '⚠️ You have scoring modules but no "By Score" sorting. Scores will be ignored!';
            warningEl.style.display = 'block';
        }
    } else {
        if (warningEl) warningEl.style.display = 'none';
    }
}

function exportJSON() {
    const json = { nodes: nodes.map(n => ({ id: n.id, type: n.type, x: n.x, y: n.y })), connections };
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000;';
    const content = document.createElement('div');
    content.style.cssText = 'background: #2a2a2a; padding: 30px; border-radius: 12px; max-width: 600px; max-height: 80vh; overflow: auto; border: 2px solid #4a9eff;';
    content.innerHTML = `<h3 style="margin: 0 0 20px 0; color: #4a9eff;">Exported JSON</h3><textarea readonly style="width: 100%; height: 400px; background: #1a1a1a; color: #fff; border: 1px solid #444; border-radius: 6px; padding: 15px; font-family: 'Courier New', monospace; font-size: 12px; resize: vertical;">${JSON.stringify(json, null, 2)}</textarea><div style="margin-top: 20px; display: flex; gap: 10px;"><button onclick="this.parentElement.parentElement.parentElement.remove()" style="flex: 1; background: #4a9eff; border: none; color: white; padding: 12px; border-radius: 6px; cursor: pointer; font-size: 14px;">Close</button></div>`;
    modal.appendChild(content);
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function saveRules() {
    alert('Rules saved! (This is a mockup - no actual saving happens)');
}

function togglePortNumbers() {
    document.body.classList.toggle('show-port-numbers');
}

function groupSelected() {
    const nodesToGroup = nodes.filter(n => selectedNodes.has(n.id) && n.type !== 'group');
    
    if (nodesToGroup.length < 2) {
        alert('⚠️ Select at least 2 blocks to group (Shift+Click to multi-select)');
        return;
    }
    
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodesToGroup.forEach(n => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + 200);
        maxY = Math.max(maxY, n.y + 100);
    });
    
    // Create group node
    const groupNode = {
        id: nodeIdCounter++,
        type: 'group',
        x: minX - 20,
        y: minY - 40,
        config: { name: 'New Group', children: nodesToGroup.map(n => n.id) }
    };
    
    nodes.push(groupNode);
    
    // Clear selections
    selectedNodes.clear();
    document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
    
    // Re-render all
    document.querySelectorAll('.canvas-node').forEach(n => n.remove());
    nodes.forEach(node => renderNode(node));
    drawConnections();
    saveToLocalStorage();
}

function toggleGroup(groupId) {
    if (expandedGroups.has(groupId)) {
        expandedGroups.delete(groupId);
    } else {
        expandedGroups.add(groupId);
    }
    
    // Re-render all nodes
    document.querySelectorAll('.canvas-node').forEach(n => n.remove());
    nodes.forEach(node => renderNode(node));
    drawConnections();
}

function addToGroup(groupId) {
    const groupNode = nodes.find(n => n.id === groupId);
    if (!groupNode) return;
    
    const nodesToAdd = nodes.filter(n => selectedNodes.has(n.id) && n.type !== 'group' && n.id !== groupId);
    
    if (nodesToAdd.length === 0) {
        alert('⚠️ Select nodes first (click nodes to select, shift-click for multi-select)');
        return;
    }
    
    if (!groupNode.config) groupNode.config = {};
    if (!groupNode.config.children) groupNode.config.children = [];
    
    nodesToAdd.forEach(n => {
        if (!groupNode.config.children.includes(n.id)) {
            groupNode.config.children.push(n.id);
        }
    });
    
    // Clear selections
    selectedNodes.clear();
    
    // Re-render
    document.querySelectorAll('.canvas-node').forEach(n => n.remove());
    nodes.forEach(node => renderNode(node));
    drawConnections();
    saveToLocalStorage();
}

function saveToLocalStorage() {
    const data = { nodes, connections, nodeIdCounter };
    localStorage.setItem('feedBuilderState', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('feedBuilderState');
    if (saved) {
        const data = JSON.parse(saved);
        nodes = (data.nodes || []).filter(n => NODE_TYPES[n.type]); // Filter out invalid node types
        connections = data.connections || [];
        nodeIdCounter = data.nodeIdCounter || 0;
        document.querySelectorAll('.canvas-node').forEach(n => n.remove());
        nodes.forEach(node => renderNode(node));
        drawConnections();
        updatePreview();
    }
}

// Initialize
initSidebar();
loadFromLocalStorage();

// Center viewport - scroll to middle of canvas
setTimeout(() => {
    canvas.scrollLeft = (canvas.scrollWidth - canvas.clientWidth) / 2;
    canvas.scrollTop = (canvas.scrollHeight - canvas.clientHeight) / 2;
}, 150);

// Demo mode - only if no saved state
if (nodes.length === 0) {
setTimeout(() => {
    // Position nodes in center of 10000x10000 canvas
    const centerX = 4500;
    const centerY = 4500;
    nodes = [
        { id: 0, type: 'start', x: centerX, y: centerY, config: {} },
        { id: 1, type: 'and', x: centerX + 307, y: centerY + 166, config: {} },
        { id: 2, type: 'text', x: centerX + 303, y: centerY - 18, config: {} },
        { id: 3, type: 'language', x: centerX + 308, y: centerY - 187, config: {} },
        { id: 4, type: 'likes', x: centerX + 324, y: centerY + 311, config: {} },
        { id: 5, type: 'sentiment', x: centerX + 325, y: centerY + 522, config: {} },
        { id: 6, type: 'manualpost', x: centerX + 327, y: centerY + 769, config: {} },
        { id: 7, type: 'personalization', x: centerX + 1074, y: centerY + 92, config: {} },
        { id: 8, type: 'end', x: centerX + 1416, y: centerY + 158, config: {} }
    ];
    nodeIdCounter = 9;
    
    connections = [
        { from: 0, fromPort: 7, to: 1, toPort: 0, logic: 'AND' },
        { from: 6, fromPort: 7, to: 7, toPort: 0, logic: 'AND' },
        { from: 1, fromPort: 5, to: 2, toPort: 2, logic: 'AND' },
        { from: 2, fromPort: 5, to: 3, toPort: 2, logic: 'AND' },
        { from: 1, fromPort: 6, to: 4, toPort: 1, logic: 'AND' },
        { from: 4, fromPort: 6, to: 5, toPort: 1, logic: 'AND' },
        { from: 7, fromPort: 7, to: 8, toPort: 0, logic: 'AND' },
        { from: 1, fromPort: 7, to: 7, toPort: 0, logic: 'AND' }
    ];
    
    nodes.forEach(node => renderNode(node));
    drawConnections();
    updatePreview();
    saveToLocalStorage();
}, 100);
}
