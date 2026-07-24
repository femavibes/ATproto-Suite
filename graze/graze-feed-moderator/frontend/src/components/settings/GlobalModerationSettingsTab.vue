<template>
  <div class="moderation-tab">
    <div class="section">
      <h2>Global Communal Moderation</h2>
      <p class="section-desc">Default thresholds applied to all feeds (can be overridden per-feed)</p>
      
      <div class="card">
        <div class="sync-section">
          <h4>Admin Sync Settings</h4>
          <p class="sync-section-desc">Automatically sync your thresholds with admin-recommended values when they're updated.</p>
          
          <div class="toggle-item">
            <label class="toggle-switch">
              <input type="checkbox" v-model="globalSettings.sync_global_post_thresholds" @change="updateSyncSettings">
              <span class="toggle-slider"></span>
            </label>
            <div class="toggle-content">
              <div class="toggle-title">Sync Global Post Removal Thresholds</div>
              <div class="toggle-description">Automatically sync your global post removal thresholds with admin-recommended values. When enabled, your thresholds will match admin defaults and update dynamically when admins change the recommendations.</div>
            </div>
          </div>
          
          <div class="toggle-item">
            <label class="toggle-switch">
              <input type="checkbox" v-model="globalSettings.sync_global_ban_thresholds" @change="updateSyncSettings">
              <span class="toggle-slider"></span>
            </label>
            <div class="toggle-content">
              <div class="toggle-title">Sync Global User Ban Thresholds</div>
              <div class="toggle-description">Automatically sync your global user ban thresholds with admin-recommended values. When enabled, your thresholds will match admin defaults and update dynamically when admins change the recommendations.</div>
            </div>
          </div>
        </div>
        
        <div class="toggle-item">
          <label class="toggle-switch">
            <input type="checkbox" v-model="globalSettings.global_communal_enabled" @change="updateGlobalSettings">
            <span class="toggle-slider"></span>
          </label>
          <div class="toggle-content">
            <div class="toggle-title">Enable Global Communal Moderation</div>
            <div class="toggle-description">When enabled, uses global thresholds with per-feed settings as fallback. When disabled, completely excludes all feeds from global communal moderation.</div>
          </div>
        </div>
        
        <div v-if="globalSettings.global_communal_enabled" class="threshold-sections">
          <!-- Sub-tabs -->
          <div class="sub-tabs">
            <button 
              @click="activeSubTab = 'post-removal'"
              :class="['sub-tab', { active: activeSubTab === 'post-removal' }]"
            >
              Post Removal
            </button>
            <button 
              @click="activeSubTab = 'user-ban'"
              :class="['sub-tab', { active: activeSubTab === 'user-ban' }]"
            >
              User Ban
            </button>
          </div>
          
          <div class="sub-tab-content">
          <!-- Post Removal Thresholds -->
          <div v-if="activeSubTab === 'post-removal'" class="threshold-section">
            <h4>Global Post Removal Thresholds</h4>
            <p class="communal-description">Global thresholds that work alongside per-feed settings. When both are enabled, whichever threshold is hit first triggers the action.</p>
            
            <div v-for="(category, categoryKey) in reportTypes" :key="categoryKey" class="category-section" v-if="categoryKey !== 'other'">
              <h5 class="category-title">{{ category.name }} ({{ categoryKey }})</h5>
              <div class="category-threshold">
                <label class="main-threshold-label">
                  <span>Default {{ category.name }} Threshold:</span>
                  <input 
                    type="number" 
                    :value="globalSettings[`global_threshold_${categoryKey.replace('-', '_')}`] ?? getDefaultThreshold(categoryKey)" 
                    @input="updateMainThreshold(categoryKey, $event.target.value)"
                    min="1" max="100" 
                    class="threshold-input"
                  >
                </label>
              </div>
              <div v-for="(subName, subKey) in category.subcategories" :key="subKey" class="threshold-setting" :class="{ 'disabled-setting': isExcludedFromCommunal(subKey) }">
                <label class="checkbox-label" :class="{ disabled: isExcludedFromCommunal(subKey) }">
                  <input 
                    type="checkbox" 
                    :checked="globalSettings[`global_opt_in_${subKey.replace('-', '_')}`] ?? true" 
                    @change="updateSubcategoryOptIn(subKey, $event.target.checked)"
                    :disabled="isExcludedFromCommunal(subKey)"
                  >
                  <div class="label-with-reset">
                    <span>{{ subName }} ({{ subKey }})</span>
                    <button 
                      v-if="globalSettings[`global_threshold_${subKey.replace('-', '_')}`] !== null && globalSettings[`global_threshold_${subKey.replace('-', '_')}`] !== undefined && !isExcludedFromCommunal(subKey)"
                      @click.stop="resetToInherit(subKey, 'global_threshold')"
                      class="reset-btn"
                      title="Reset to inherit from main category"
                    >↺</button>
                  </div>
                  <input 
                    v-if="(globalSettings[`global_opt_in_${subKey.replace('-', '_')}`] ?? true) && !isExcludedFromCommunal(subKey)" 
                    type="number" 
                    :value="getEffectiveThreshold(subKey, categoryKey)"
                    @input="updateSubcategoryThreshold(subKey, $event.target.value)"
                    :placeholder="`Inherits: ${getEffectiveThreshold(subKey, categoryKey)}`"
                    min="1" max="100" 
                    class="threshold-input"
                  >
                  <span v-if="isExcludedFromCommunal(subKey)" class="excluded-note">
                    (Excluded from communal moderation)
                  </span>
                </label>
              </div>
            </div>
            
            <div class="cross-type-setting">
              <label>Same-category: <span class="percentage">{{ globalSettings.global_same_category_cross_percentage || 50 }}%</span></label>
              <input type="range" v-model="globalSettings.global_same_category_cross_percentage" @change="updateGlobalSettings" min="0" max="50" class="percentage-slider">
              <small>Allow same main category subtypes to contribute (e.g., misleading-spam → misleading-bot)</small>
            </div>
            
            <div class="cross-type-setting">
              <label>Cross-type: <span class="percentage">{{ globalSettings.global_cross_type_percentage || 20 }}%</span></label>
              <input type="range" v-model="globalSettings.global_cross_type_percentage" @change="updateGlobalSettings" min="0" max="40" class="percentage-slider">
              <small>Allow different main categories to contribute (e.g., harassment → misleading)</small>
            </div>
          </div>
          
          <!-- User Ban Thresholds -->
          <div v-if="activeSubTab === 'user-ban'" class="threshold-section">
            <h4>Global User Ban Thresholds</h4>
            <p class="communal-description">Auto-ban users after X reports of each type. Uses same hierarchical structure as post removal.</p>
            
            <div v-for="(category, categoryKey) in reportTypes" :key="'ban_' + categoryKey" class="category-section" v-if="categoryKey !== 'other'">
              <h5 class="category-title">{{ category.name }} ({{ categoryKey }})</h5>
              <div class="category-threshold">
                <label class="main-threshold-label">
                  <span>Default {{ category.name }} User Ban Threshold:</span>
                  <input 
                    type="number" 
                    :value="globalSettings[`global_user_ban_threshold_${categoryKey.replace('-', '_')}`] ?? getUserBanDefaultThreshold(categoryKey)" 
                    @input="updateUserBanMainThreshold(categoryKey, $event.target.value)"
                    min="1" max="100" 
                    class="threshold-input"
                  >
                </label>
              </div>
              <div v-for="(subName, subKey) in category.subcategories" :key="'ban_' + subKey" class="threshold-setting" :class="{ 'disabled-setting': isExcludedFromCommunal(subKey) }">
                <label class="checkbox-label" :class="{ disabled: isExcludedFromCommunal(subKey) }">
                  <input 
                    type="checkbox" 
                    :checked="globalSettings[`global_user_ban_opt_in_${subKey.replace('-', '_')}`] ?? true" 
                    @change="updateUserBanSubcategoryOptIn(subKey, $event.target.checked)"
                    :disabled="isExcludedFromCommunal(subKey)"
                  >
                  <div class="label-with-reset">
                    <span>{{ subName }} ({{ subKey }})</span>
                    <button 
                      v-if="globalSettings[`global_user_ban_threshold_${subKey.replace('-', '_')}`] !== null && globalSettings[`global_user_ban_threshold_${subKey.replace('-', '_')}`] !== undefined && !isExcludedFromCommunal(subKey)"
                      @click.stop="resetToInherit(subKey, 'global_user_ban_threshold')"
                      class="reset-btn"
                      title="Reset to inherit from main category"
                    >↺</button>
                  </div>
                  <input 
                    v-if="(globalSettings[`global_user_ban_opt_in_${subKey.replace('-', '_')}`] ?? true) && !isExcludedFromCommunal(subKey)" 
                    type="number" 
                    :value="getEffectiveUserBanThreshold(subKey, categoryKey)"
                    @input="updateUserBanSubcategoryThreshold(subKey, $event.target.value)"
                    :placeholder="`Inherits: ${getEffectiveUserBanThreshold(subKey, categoryKey)}`"
                    min="1" max="100" 
                    class="threshold-input"
                  >
                  <span v-if="isExcludedFromCommunal(subKey)" class="excluded-note">
                    (Excluded from communal moderation)
                  </span>
                </label>
              </div>
            </div>
            
            <div class="cross-type-setting">
              <label>User ban same-category: <span class="percentage">{{ globalSettings.global_user_ban_same_category_cross_percentage || 50 }}%</span></label>
              <input type="range" v-model="globalSettings.global_user_ban_same_category_cross_percentage" @change="updateGlobalSettings" min="0" max="50" class="percentage-slider">
              <small>Allow same main category subtypes to contribute (e.g., misleading-spam → misleading-bot)</small>
            </div>
            
            <div class="cross-type-setting">
              <label>User ban cross-type: <span class="percentage">{{ globalSettings.global_user_ban_cross_type_percentage || 20 }}%</span></label>
              <input type="range" v-model="globalSettings.global_user_ban_cross_type_percentage" @change="updateGlobalSettings" min="0" max="40" class="percentage-slider">
              <small>Allow different main categories to contribute (e.g., harassment → misleading)</small>
            </div>
          </div>
          
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'

const activeSubTab = ref('post-removal')

const globalSettings = ref({
  global_communal_enabled: false,
  global_same_category_cross_percentage: 50,
  global_cross_type_percentage: 20,
  sync_global_post_thresholds: false,
  sync_global_ban_thresholds: false
})

const reportTypes = ref({})

const loadGlobalSettings = async () => {
  try {
    const response = await axios.get('/api/user/global-settings')
    if (response.data) {
      globalSettings.value = { ...globalSettings.value, ...response.data }
    }
  } catch (error) {
    console.error('Failed to load global settings:', error)
  }
}

const loadReportTypes = async () => {
  try {
    const response = await axios.get('/api/report-types/hierarchical')
    reportTypes.value = response.data.reportTypes
  } catch (error) {
    console.error('Failed to load report types:', error)
  }
}

const updateGlobalSettings = async () => {
  try {
    await axios.put('/api/user/global-settings', globalSettings.value)
    window.dispatchEvent(new CustomEvent('globalSettingsUpdated'))
  } catch (error) {
    console.error('Failed to update global settings:', error)
  }
}

const updateSyncSettings = async () => {
  try {
    await axios.put('/api/user/sync-settings', {
      sync_global_post_thresholds: globalSettings.value.sync_global_post_thresholds,
      sync_global_ban_thresholds: globalSettings.value.sync_global_ban_thresholds
    })
    // If user enables sync, their thresholds will be updated automatically by the backend
    if (globalSettings.value.sync_global_post_thresholds || globalSettings.value.sync_global_ban_thresholds) {
      // Reload settings to get updated thresholds
      await loadGlobalSettings()
    }
  } catch (error) {
    console.error('Failed to update sync settings:', error)
  }
}

const getDefaultThreshold = (category: string): number => {
  const defaults = { misleading: 10, harassment: 5, violence: 3, sexual: 5, child_safety: 2, self_harm: 3, rule: 5 }
  return defaults[category as keyof typeof defaults] || 5
}

const getUserBanDefaultThreshold = (category: string): number => {
  const defaults = { misleading: 15, harassment: 8, violence: 5, sexual: 8, child_safety: 3, self_harm: 5, rule: 8 }
  return defaults[category as keyof typeof defaults] || 15
}

const updateMainThreshold = async (categoryKey: string, value: string) => {
  const thresholdKey = `global_threshold_${categoryKey.replace(/-/g, '_')}`
  globalSettings.value[thresholdKey] = parseInt(value) || 3
  globalSettings.value = { ...globalSettings.value }
  await updateGlobalSettings()
}

const updateSubcategoryOptIn = async (subKey: string, checked: boolean) => {
  const optInKey = `global_opt_in_${subKey.replace(/-/g, '_')}`
  globalSettings.value[optInKey] = checked
  globalSettings.value = { ...globalSettings.value }
  await updateGlobalSettings()
}

const updateSubcategoryThreshold = async (subKey: string, value: string) => {
  const thresholdKey = `global_threshold_${subKey.replace(/-/g, '_')}`
  globalSettings.value[thresholdKey] = value ? parseInt(value) : null
  globalSettings.value = { ...globalSettings.value }
  await updateGlobalSettings()
}

const updateUserBanMainThreshold = async (categoryKey: string, value: string) => {
  const thresholdKey = `global_user_ban_threshold_${categoryKey.replace(/-/g, '_')}`
  globalSettings.value[thresholdKey] = parseInt(value) || getUserBanDefaultThreshold(categoryKey)
  globalSettings.value = { ...globalSettings.value }
  await updateGlobalSettings()
}

const updateUserBanSubcategoryOptIn = async (subKey: string, checked: boolean) => {
  const optInKey = `global_user_ban_opt_in_${subKey.replace(/-/g, '_')}`
  globalSettings.value[optInKey] = checked
  globalSettings.value = { ...globalSettings.value }
  await updateGlobalSettings()
}

const updateUserBanSubcategoryThreshold = async (subKey: string, value: string) => {
  const thresholdKey = `global_user_ban_threshold_${subKey.replace(/-/g, '_')}`
  globalSettings.value[thresholdKey] = value ? parseInt(value) : null
  globalSettings.value = { ...globalSettings.value }
  await updateGlobalSettings()
}

const resetToInherit = async (subKey: string, prefix: string) => {
  const thresholdKey = `${prefix}_${subKey.replace(/-/g, '_')}`
  globalSettings.value[thresholdKey] = null
  globalSettings.value = { ...globalSettings.value }
  await updateGlobalSettings()
}

const getEffectiveThreshold = (subKey: string, categoryKey: string): number => {
  const subThreshold = globalSettings.value[`global_threshold_${subKey.replace(/-/g, '_')}`]
  const mainThreshold = globalSettings.value[`global_threshold_${categoryKey.replace(/-/g, '_')}`]
  const defaultThreshold = getDefaultThreshold(categoryKey)
  return subThreshold !== null && subThreshold !== undefined ? subThreshold : (mainThreshold ?? defaultThreshold)
}

const getEffectiveUserBanThreshold = (subKey: string, categoryKey: string): number => {
  const subThreshold = globalSettings.value[`global_user_ban_threshold_${subKey.replace(/-/g, '_')}`]
  const mainThreshold = globalSettings.value[`global_user_ban_threshold_${categoryKey.replace(/-/g, '_')}`]
  const defaultThreshold = getUserBanDefaultThreshold(categoryKey)
  return subThreshold !== null && subThreshold !== undefined ? subThreshold : (mainThreshold || defaultThreshold)
}

const isExcludedFromCommunal = (subKey: string): boolean => {
  const excludedTypes = ['misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other']
  return excludedTypes.includes(subKey)
}

onMounted(() => {
  loadGlobalSettings()
  loadReportTypes()
})
</script>

<style scoped>
.moderation-tab {
  width: 100%;
}

.section {
  margin-bottom: 2rem;
}

.section h2 {
  margin: 0 0 0.5rem 0;
}

.section-desc {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin: 0 0 1rem 0;
}

.card {
  background: var(--bg-primary);
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px var(--shadow);
  border: 1px solid var(--border-primary);
}

.form-group {
  margin-bottom: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  background: #374151;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #374151;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.checkbox-label:hover {
  background: #4b5563;
  border-color: #4b5563;
}

.checkbox-label input[type="checkbox"] {
  display: none;
}

.checkbox-label:has(input:checked) {
  background: #3b82f6;
  border-color: #3b82f6;
}

.threshold-sections {
  margin-top: 1rem;
}

.threshold-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-primary);
}

.threshold-section:last-child {
  border-bottom: none;
}

.threshold-section h4 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
}

.communal-description {
  margin: 0 0 1rem 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-style: italic;
}

.category-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-primary);
}

.category-title {
  margin: 0 0 0.75rem 0;
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 600;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-primary);
}

.category-threshold {
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--border-primary);
}

.main-threshold-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #3b82f6;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #3b82f6;
  font-weight: 700;
}

.main-threshold-label:hover {
  background: #2563eb;
  border-color: #2563eb;
}

.threshold-input {
  width: 60px;
  padding: 0.25rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  text-align: center;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-weight: 600;
}

.threshold-setting {
  margin-bottom: 0.75rem;
}

.threshold-setting .checkbox-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.label-with-reset {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
}

.reset-btn {
  background: #6b7280;
  color: white;
  border: none;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: #4b5563;
  transform: scale(1.1);
}

.cross-type-setting {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary);
}

.cross-type-setting label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.percentage {
  font-weight: 600;
  color: #1d4ed8;
}

.percentage-slider {
  width: 100%;
  margin: 0.5rem 0;
}

.cross-type-setting small {
  display: block;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.disabled-setting {
  opacity: 0.6;
}

.checkbox-label.disabled {
  cursor: not-allowed;
  background: #6b7280 !important;
  border-color: #6b7280 !important;
}

.checkbox-label.disabled:hover {
  background: #6b7280 !important;
  border-color: #6b7280 !important;
}

.excluded-note {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
  margin-left: 0.5rem;
}

.sub-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-primary);
}

.sub-tab {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
  font-weight: 500;
}

.sub-tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.sub-tab:hover:not(.active) {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.sub-tab-content {
  min-height: 300px;
}



.toggle-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 6px;
  margin-bottom: 0.75rem;
  align-items: flex-start;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: 0.3s;
  border-radius: 26px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #3b82f6;
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(22px);
}

.toggle-content {
  flex: 1;
}

.toggle-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.toggle-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.sync-section {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-primary);
}

.sync-section h4 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
  font-size: 1.125rem;
}

.sync-section-desc {
  margin: 0 0 1rem 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .toggle-item {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
  }
}
</style>
