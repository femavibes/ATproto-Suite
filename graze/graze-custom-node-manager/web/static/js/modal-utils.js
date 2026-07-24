// Modal utilities
export function setupModalClickAway(modalId, closeFunction) {
    const modal = document.getElementById(modalId);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeFunction();
        }
    });
}
