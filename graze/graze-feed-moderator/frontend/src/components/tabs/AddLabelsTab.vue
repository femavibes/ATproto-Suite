<template>
  <div class="card">
    <div class="card-header">
      <div class="card-title">
        <div class="card-title-left">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          <h3>Add Labels</h3>
        </div>
      </div>
      <p class="card-description">Personal Ozone label support coming soon</p>
    </div>
    <div class="card-content">
      <div class="placeholder-content">
        <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
          <line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>
        <h4>Coming Soon</h4>
        <p>Personal Ozone label support will be available here.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.card {
  background: var(--bg-card, white);
  border-radius: 2px;
  box-shadow: 0 1px 3px var(--shadow, rgba(0,0,0,0.1));
  margin-bottom: 1.5rem;
  overflow: hidden;
  border: 1px solid var(--border-primary, transparent);
}

.card-header {
  padding: 1.5rem 2rem 1rem 2rem;
  border-bottom: 1px solid #f1f5f9;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.card-title-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.card-header h3 {
  margin: 0;
  color: var(--text-primary, #1e293b);
  font-size: 1.25rem;
  font-weight: 600;
}

.icon {
  width: 24px;
  height: 24px;
  color: #64748b;
}

.card-description {
  margin: 0;
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
}

.card-content {
  padding: 3rem 2rem;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 1rem;
  color: #6b7280;
}

.placeholder-icon {
  width: 64px;
  height: 64px;
  color: #d1d5db;
}

.placeholder-content h4 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
}

.placeholder-content p {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
}
</style>
