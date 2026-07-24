<template>
  <div class="admin-users">
    <div class="page-header">
      <h1>👥 User Management</h1>
      <router-link to="/dashboard" class="back-btn">← Back to Dashboard</router-link>
    </div>

    <div class="users-table">
      <table>
        <thead>
          <tr>
            <th>Handle</th>
            <th>DID</th>
            <th>Subscription</th>
            <th>Feeds</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>
              <div class="user-info">
                <span class="handle">{{ user.handle }}</span>
                <span v-if="user.is_admin" class="admin-badge">ADMIN</span>
              </div>
            </td>
            <td class="did">{{ user.did.substring(0, 20) }}...</td>
            <td>
              <select 
                :value="user.subscription_tier" 
                @change="updateSubscription(user.id, $event.target.value)"
                class="tier-select"
              >
                <option value="free">Free</option>
                <option value="paid">Paid</option>
                <option value="premium">Premium</option>
              </select>
            </td>
            <td class="feed-count">{{ user.feed_count }}</td>
            <td class="date">{{ formatDate(user.created_at) }}</td>
            <td>
              <button 
                @click="viewUserDetails(user)" 
                class="action-btn view-btn"
              >
                View
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- User Details Modal -->
    <div v-if="selectedUser" class="modal-overlay" @click="selectedUser = null">
      <div class="modal" @click.stop>
        <h3>User Details</h3>
        <div class="user-details">
          <div class="detail-row">
            <strong>Handle:</strong> {{ selectedUser.handle }}
          </div>
          <div class="detail-row">
            <strong>DID:</strong> {{ selectedUser.did }}
          </div>
          <div class="detail-row">
            <strong>Subscription:</strong> 
            <span :class="`tier-${selectedUser.subscription_tier}`">
              {{ selectedUser.subscription_tier }}
            </span>
          </div>
          <div class="detail-row">
            <strong>Feeds:</strong> {{ selectedUser.feed_count }}
          </div>
          <div class="detail-row">
            <strong>Joined:</strong> {{ formatDate(selectedUser.created_at) }}
          </div>
        </div>
        <div class="modal-actions">
          <button @click="selectedUser = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'

const users = ref([])
const selectedUser = ref(null)

onMounted(async () => {
  await loadUsers()
})

const loadUsers = async () => {
  try {
    const response = await axios.get('/api/admin/users')
    users.value = response.data
  } catch (error) {
    console.error('Failed to load users:', error)
  }
}

const updateSubscription = async (userId: number, tier: string) => {
  try {
    await axios.put(`/api/admin/users/${userId}/subscription`, {
      subscription_tier: tier
    })
    await loadUsers() // Refresh the list
  } catch (error) {
    console.error('Failed to update subscription:', error)
    alert('Failed to update subscription')
  }
}

const viewUserDetails = (user: any) => {
  selectedUser.value = user
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.back-btn {
  background: #6b7280;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  text-decoration: none;
}

.users-table {
  background: white;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  background: #f9fafb;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
}

td {
  padding: 1rem;
  border-bottom: 1px solid #f3f4f6;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.admin-badge {
  background: #fbbf24;
  color: #92400e;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.did {
  font-family: monospace;
  font-size: 0.875rem;
  color: #6b7280;
}

.tier-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  background: white;
}

.feed-count {
  text-align: center;
  font-weight: 600;
}

.date {
  color: #6b7280;
  font-size: 0.875rem;
}

.action-btn {
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.view-btn {
  background: #1d4ed8;
  color: white;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  width: 90%;
  max-width: 500px;
}

.user-details {
  margin: 1rem 0;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.tier-free {
  color: #6b7280;
}

.tier-paid {
  color: #059669;
  font-weight: 600;
}

.tier-premium {
  color: #d97706;
  font-weight: 600;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.modal-actions button {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  cursor: pointer;
}
</style>