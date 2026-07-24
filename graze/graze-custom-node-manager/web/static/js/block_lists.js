/**
 * Block Lists Manager
 */

let currentLists = [];

export async function showManager() {
    const modal = document.getElementById('block-lists-modal');
    if (!modal) {
        console.error('Block lists modal not found');
        return;
    }

    await loadBlockLists();
    modal.classList.add('active');
}

async function loadBlockLists() {
    try {
        const response = await fetch('/api/block-lists');
        const data = await response.json();
        currentLists = data.lists || [];
        renderLists();
    } catch (error) {
        console.error('Failed to load block lists:', error);
        showNotification('Failed to load lists', 'error');
    }
}

function renderLists() {
    const container = document.getElementById('block-lists-container');
    if (!container) return;

    if (currentLists.length === 0) {
        container.innerHTML = '<p class="empty-state">No lists added yet. Click "Add List" to get started.</p>';
        return;
    }

    container.innerHTML = currentLists.map((list, index) => `
        <div class="block-list-item">
            <div class="block-list-header">
                <strong>${list.param_name}</strong>
                <button class="btn-icon" onclick="window.blockListsModule.removeList(${index})" title="Remove">
                    <span>×</span>
                </button>
            </div>
            <div class="block-list-url"><a href="${list.url}" target="_blank" rel="noopener noreferrer">${list.url}</a></div>
            <div class="block-list-description">${list.description}</div>
        </div>
    `).join('');
}

export function addList() {
    showAddListModal();
}

export function showAddListModal() {
    document.getElementById('add-list-param-name').value = '';
    document.getElementById('add-list-url').value = '';
    document.getElementById('add-list-description').value = '';
    document.getElementById('add-block-list-modal').classList.add('active');
}

export function closeAddListModal() {
    document.getElementById('add-block-list-modal').classList.remove('active');
}

export function confirmAddList() {
    const paramName = document.getElementById('add-list-param-name').value.trim();
    const url = document.getElementById('add-list-url').value.trim();
    const description = document.getElementById('add-list-description').value.trim();

    if (!paramName || !url || !description) {
        showNotification('All fields are required', 'error');
        return;
    }

    currentLists.push({
        param_name: paramName.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
        url: url,
        description: description
    });

    renderLists();
    closeAddListModal();
    showNotification('List added', 'success');
}

export function removeList(index) {
    if (confirm('Remove this list?')) {
        currentLists.splice(index, 1);
        renderLists();
    }
}

export async function saveBlockLists() {
    try {
        const response = await fetch('/api/block-lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lists: currentLists })
        });

        if (response.ok) {
            showNotification('Lists saved successfully', 'success');
            closeBlockListsModal();
        } else {
            throw new Error('Save failed');
        }
    } catch (error) {
        console.error('Failed to save lists:', error);
        showNotification('Failed to save lists', 'error');
    }
}

export function closeBlockListsModal() {
    const modal = document.getElementById('block-lists-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function showNotification(message, type) {
    const event = new CustomEvent('show-notification', {
        detail: { message, type }
    });
    window.dispatchEvent(event);
}

// Export for global access
window.blockListsModule = {
    showManager,
    addList,
    showAddListModal,
    closeAddListModal,
    confirmAddList,
    removeList,
    saveBlockLists,
    closeBlockListsModal
};
