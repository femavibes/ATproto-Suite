// Promotional Footer Management

let currentPromoFooter = { footer: '', enabled: true };

export async function loadPromoFooter() {
    try {
        const response = await fetch('/api/user/promo-footer');
        if (response.ok) {
            currentPromoFooter = await response.json();
        }
    } catch (error) {
        console.error('Failed to load promo footer:', error);
    }
    updatePromoFooterButtonVisibility();
}

export async function updatePromoFooterButtonVisibility() {
    const session = await fetch('/api/session').then(r => r.json());
    const promoBtn = document.querySelector('button[onclick="showPromoFooterModal()"]');
    if (promoBtn) {
        promoBtn.style.display = session.logged_in ? 'inline-block' : 'none';
    }
}

export function showPromoFooterModal() {
    const modal = document.getElementById('promo-footer-modal');
    const input = document.getElementById('promo-footer-input');
    const enabled = document.getElementById('promo-footer-enabled');
    const preview = document.getElementById('promo-footer-preview');
    
    input.value = currentPromoFooter.footer || '';
    enabled.checked = currentPromoFooter.enabled !== false;
    updatePromoFooterPreview();
    
    modal.style.display = 'flex';
    
    // Add input listener for live preview
    input.oninput = updatePromoFooterPreview;
}

function updatePromoFooterPreview() {
    const input = document.getElementById('promo-footer-input');
    const preview = document.getElementById('promo-footer-preview');
    
    if (input.value.trim()) {
        preview.textContent = input.value;
        preview.style.color = '#374151';
    } else {
        preview.textContent = 'No content yet...';
        preview.style.color = '#9ca3af';
    }
}

export function closePromoFooterModal() {
    document.getElementById('promo-footer-modal').style.display = 'none';
}

export async function savePromoFooter() {
    const input = document.getElementById('promo-footer-input');
    const enabled = document.getElementById('promo-footer-enabled');
    
    try {
        const response = await fetch('/api/user/promo-footer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                footer: input.value,
                enabled: enabled.checked
            })
        });
        
        if (response.ok) {
            currentPromoFooter = { footer: input.value, enabled: enabled.checked };
            alert('Promotional footer saved! It will be added to all nodes you push.');
            closePromoFooterModal();
        } else {
            alert('Failed to save promotional footer');
        }
    } catch (error) {
        console.error('Error saving promo footer:', error);
        alert('Error saving promotional footer');
    }
}

// Make functions globally available
window.showPromoFooterModal = showPromoFooterModal;
window.closePromoFooterModal = closePromoFooterModal;
window.savePromoFooter = savePromoFooter;
