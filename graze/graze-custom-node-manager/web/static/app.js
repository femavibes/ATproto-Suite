// Main app entry point
import { checkSession, login, logout, showLoginModal, closeModal } from './js/auth.js';
import { loadNodes, setSortMode } from './js/nodes.js';
import { showNodeDetail, pushNode, closeNodeModal, copyManifest } from './js/modal.js';
import { toggleComponentIdOverride, updateResetButtons, resetTitle, resetDescription, resetColor, renderConfigOptions, showTab, filterCards, searchContent, updateTabVisibility } from './js/ui.js';
import { loadGrazeDocs, loadMetadataDocs, loadReferenceDocs } from './js/docs.js';
import { loadActions, searchActions } from './js/actions.js';
import { showActionEditor, closeActionEditor, addNode, showAddNodeMenu, deleteNode, updateNodeData, saveAction, deleteAction, setAdminStatus } from './js/action-editor.js';
import { setupModalClickAway } from './js/modal-utils.js';
import { showNodeSettings, closeNodeConfig, saveNodeConfig, switchUnifiedTab } from './js/node-config.js';
import { showManager as showNSFWManager } from './js/nsfw_filter.js';
import { showManager as showAdBlockerManager } from './js/adblocker.js';
import { loadPromoFooter, showPromoFooterModal, closePromoFooterModal, savePromoFooter, updatePromoFooterButtonVisibility } from './js/promo-footer.js';
import './js/ai-suggestions.js';
import { showManager as showTestFeedManager } from './js/test_feed.js';

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkSession();
    const isAdmin = session?.is_admin || false;
    window.isAdminUser = isAdmin;
    setAdminStatus(isAdmin);
    
    // Show/hide admin buttons
    const addActionBtn = document.getElementById('add-action-btn');
    if (addActionBtn) {
        addActionBtn.style.display = isAdmin ? 'block' : 'none';
    }
    
    loadNodes();
    loadPromoFooter();
    updateTabVisibility();
    loadMetadataDocs(); // Load metadata docs on initial load since it's the first tab
    
    // Setup click-away-to-close for modals
    setupModalClickAway('login-modal', closeModal);
    setupModalClickAway('node-modal', closeNodeModal);
    setupModalClickAway('node-config-modal', closeNodeConfig);
    setupModalClickAway('unified-settings-modal', closeNodeConfig);
    setupModalClickAway('promo-footer-modal', closePromoFooterModal);
    setupModalClickAway('hidden-hashtag-filter-modal', closeModal);
    setupModalClickAway('action-editor-modal', closeActionEditor);
});

// Expose functions globally for onclick handlers
window.checkSession = checkSession;
window.login = login;
window.logout = logout;
window.showLoginModal = showLoginModal;
window.closeModal = closeModal;
window.loadNodes = loadNodes;
window.showNodeDetail = showNodeDetail;
window.pushNode = pushNode;
window.closeNodeModal = closeNodeModal;
window.toggleComponentIdOverride = toggleComponentIdOverride;
window.updateResetButtons = updateResetButtons;
window.resetTitle = resetTitle;
window.resetDescription = resetDescription;
window.resetColor = resetColor;
window.renderConfigOptions = renderConfigOptions;
window.showTab = showTab;
window.filterCards = filterCards;
window.searchContent = searchContent;
window.loadGrazeDocs = loadGrazeDocs;
window.loadMetadataDocs = loadMetadataDocs;
window.loadReferenceDocs = loadReferenceDocs;
window.showNodeSettings = showNodeSettings;
window.closeNodeConfig = closeNodeConfig;
window.saveNodeConfig = saveNodeConfig;
window.switchUnifiedTab = switchUnifiedTab;
window.showNSFWManager = showNSFWManager;
window.showAdBlockerManager = showAdBlockerManager;
window.showPromoFooterModal = showPromoFooterModal;
window.closePromoFooterModal = closePromoFooterModal;
window.savePromoFooter = savePromoFooter;
window.showTestFeedManager = showTestFeedManager;
window.setSortMode = setSortMode;
window.copyManifest = copyManifest;
window.loadActions = loadActions;
window.searchActions = searchActions;
window.showActionEditor = showActionEditor;
window.closeActionEditor = closeActionEditor;
window.editAction = (id) => showActionEditor(id);
window.addNode = addNode;
window.showAddNodeMenu = showAddNodeMenu;
window.deleteNode = deleteNode;
window.updateNodeData = updateNodeData;
window.saveAction = saveAction;
window.deleteAction = deleteAction;
