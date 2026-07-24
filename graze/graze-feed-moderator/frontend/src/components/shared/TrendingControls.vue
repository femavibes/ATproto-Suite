<template>
  <div class="trending-controls">
    <div class="sort-controls">
      <select :value="sortBy" @change="$emit('update:sortBy', $event.target.value)" class="sort-select">
        <option value="rate">{{ rateLabel }}</option>
        <option value="total">{{ totalLabel }}</option>
      </select>
      <select :value="timeframe" @change="$emit('update:timeframe', $event.target.value)" class="timeframe-select">
        <option value="1d">Last 24 hours</option>
        <option value="7d">Last 7 days</option>
      </select>
    </div>
    <div class="filter-controls">
      <div class="toggle-container">
        <span class="toggle-label">Show hidden</span>
        <button 
          @click="$emit('update:showHidden', !showHidden)"
          :class="['toggle-switch', { active: showHidden }]"
        >
          <div class="toggle-slider"></div>
        </button>
      </div>
      <div class="toggle-container">
        <span class="toggle-label">Show removed</span>
        <button 
          @click="$emit('update:showRemoved', !showRemoved)"
          :class="['toggle-switch', { active: showRemoved }]"
        >
          <div class="toggle-slider"></div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  timeframe: string
  showHidden: boolean
  showRemoved: boolean
  sortBy: string
  rateLabel: string
  totalLabel: string
}>()

defineEmits<{
  'update:timeframe': [value: string]
  'update:showHidden': [value: boolean]
  'update:showRemoved': [value: boolean]
  'update:sortBy': [value: string]
}>()
</script>

<style scoped>
.trending-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

@media (max-width: 767px) {
  .trending-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
}

.sort-controls {
  display: flex;
  gap: 0.5rem;
}

@media (max-width: 767px) {
  .sort-controls {
    flex-direction: column;
    gap: 0.5rem;
  }
}

.sort-select,
.timeframe-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  color: #374151;
  font-size: 0.875rem;
}

.filter-controls {
  display: flex;
  gap: 1rem;
}

@media (max-width: 767px) {
  .filter-controls {
    justify-content: flex-start;
    gap: 1rem;
  }
}

.toggle-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle-label {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
}

@media (max-width: 767px) {
  .toggle-label {
    font-size: 0.8125rem;
  }
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background: #d1d5db;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  overflow: hidden;
  flex-shrink: 0;
}

@media (max-width: 767px) {
  .toggle-switch {
    width: 40px;
    height: 22px;
    border-radius: 11px;
  }
}

.toggle-switch.active {
  background: #3b82f6;
}

.toggle-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

@media (max-width: 767px) {
  .toggle-slider {
    width: 18px;
    height: 18px;
  }
}

.toggle-switch.active .toggle-slider {
  transform: translateX(20px);
}

@media (max-width: 767px) {
  .toggle-switch.active .toggle-slider {
    transform: translateX(18px);
  }
}
</style>