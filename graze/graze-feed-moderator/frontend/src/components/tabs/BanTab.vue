<template>
  <div class="ban-tab">
    <!-- Sub-tab Navigation -->
    <div class="sub-tab-navigation">
      <button 
        @click="banSubTab = 'ban'" 
        :class="{ active: banSubTab === 'ban' }"
        class="sub-tab-btn"
      >
        <svg class="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="m4.9 4.9 14.2 14.2"/>
        </svg>
        <span class="sub-tab-label">Ban</span>
      </button>
      <button 
        @click="banSubTab = 'users'" 
        :class="{ active: banSubTab === 'users' }"
        class="sub-tab-btn"
      >
        <svg class="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="8.5" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          <line x1="22" y1="2" x2="2" y2="22"/>
        </svg>
        <span class="sub-tab-label">Banned</span>
      </button>
      <button 
        @click="banSubTab = 'trending'" 
        :class="{ active: banSubTab === 'trending' }"
        class="sub-tab-btn"
      >
        <svg class="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span class="sub-tab-label">Trending</span>
      </button>
    </div>
    
    <!-- Ban Users Sub-tab -->
    <div v-if="banSubTab === 'ban'" class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-left">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="m4.9 4.9 14.2 14.2"/>
            </svg>
            <h3>Ban Users</h3>
          </div>
          <button @click="$emit('show-info', 'banUsers')" class="info-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </button>
        </div>
        <p class="card-description">Adds user to ban list and sends removal requests for their 10 most recent posts (without checking if posts are actually on your feeds). Your Bluesky lists are the source of truth - use Sync to keep your local database in sync with any manual changes made on Bluesky.</p>
      </div>
      <div class="card-content">
        <div class="form-row">
          <input 
            v-model="banForm.userHandle" 
            type="text" 
            placeholder="@username.bsky.social"
            class="post-url-input"
          >
        </div>
        
        <div class="form-row">
          <select v-model="banForm.reportType" class="report-type-select">
            <optgroup v-for="(category, categoryKey) in reportTypes" :key="categoryKey" :label="category.name">
              <option v-for="(subName, subKey) in category.subcategories" :key="subKey" :value="subKey">
                {{ subName }}
              </option>
            </optgroup>
          </select>
        </div>
        
        <div class="form-row">
          <input 
            v-model="banForm.reason" 
            type="text" 
            placeholder="Reason for ban (optional)"
            class="post-url-input"
          >
        </div>
        
        <div class="list-selection">
          <h4>Select Ban Lists:</h4>
          <label class="global-list-chip" :class="{ disabled: !props.globalSettings?.global_ban_list }">
            <input type="checkbox" v-model="banForm.useGlobal" :disabled="!props.globalSettings?.global_ban_list">
            <span>Global Ban List (all my feeds)</span>
            <span v-if="!props.globalSettings?.global_ban_list" class="no-list-text">(No list configured)</span>
            <div class="list-actions">
              <button v-if="props.globalSettings?.global_ban_list" @click.stop="viewGlobalBanList" class="view-text">View</button>
              <button @click.stop="editGlobalBanList" class="edit-text">{{ props.globalSettings?.global_ban_list ? 'Edit' : 'Setup' }}</button>
              <button v-if="props.globalSettings?.global_ban_list" @click.stop="syncGlobalList" class="sync-text" :disabled="syncing">{{ syncing ? 'Syncing...' : 'Sync' }}</button>
            </div>
          </label>
          <div class="feed-chips">
            <div v-if="feeds.length > 0" class="feed-section">
              <div class="section-label">My Feeds:</div>
              <label v-for="feed in feeds" :key="feed.id" class="feed-chip" :class="{ disabled: !feed.feed_ban_list }">
                <input 
                  type="checkbox" 
                  :value="feed.feed_id" 
                  v-model="banForm.selectedFeeds"
                  :disabled="!feed.feed_ban_list"
                >
                <span>{{ feed.feed_name }} Ban List</span>
                <span v-if="!feed.feed_ban_list" class="no-list-text">(No list configured)</span>
                <div class="list-actions">
                  <button v-if="feed.feed_ban_list" @click.stop="viewFeedBanList(feed)" class="view-text">View</button>
                  <button @click.stop="editFeedBanList(feed)" class="edit-text">{{ feed.feed_ban_list ? 'Edit' : 'Setup' }}</button>
                  <button v-if="feed.feed_ban_list" @click.stop="syncFeedList(feed.feed_id)" class="sync-text" :disabled="syncing">{{ syncing ? 'Syncing...' : 'Sync' }}</button>
                </div>
              </label>
            </div>
            <div v-if="ownedGroups.length > 0" class="feed-section">
              <div class="section-label">My Groups:</div>
              <label v-for="group in ownedGroups" :key="'owned-' + group.id" class="feed-chip group-chip">
                <input 
                  type="checkbox" 
                  :value="group.group_name" 
                  v-model="banForm.selectedFeeds"
                >
                <span>📁 {{ group.group_name }} ({{ group.feed_count }} feeds)</span>
              </label>
            </div>
            <div v-if="moderatedGroups.length > 0" class="feed-section">
              <div class="section-label">Groups I Moderate:</div>
              <label v-for="group in moderatedGroups" :key="'mod-' + group.id" class="feed-chip moderated-chip">
                <input 
                  type="checkbox" 
                  :value="group.group_name" 
                  v-model="banForm.selectedFeeds"
                >
                <span>👤 {{ group.group_name }} ({{ group.feed_count }} feeds)</span>
                <small class="owner-label">Owner: {{ group.owner_handle }}</small>
              </label>
            </div>
          </div>
        </div>
        
        <div class="ban-action">
          <button 
            @click="banUser" 
            :disabled="!canBanUser || banning"
            class="ban-btn"
          >
            {{ banning ? 'Banning...' : 'Ban User' }}
          </button>
        </div>
        
        <div v-if="banResults.length > 0" class="results">
          <div v-for="result in banResults" :key="result.listUri || 'error'" class="result-item">
            <span :class="result.success ? 'success' : 'error'">
              {{ result.success ? '✓ User banned via POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list)' : '✗ ' + result.error + ' (Bluesky API)' }}
            </span>
            <div v-if="result.success" class="ban-details">
              <small>
                <button 
                  v-if="result.attemptedPosts && result.attemptedPosts.length > 0"
                  @click="showAttemptedPosts(result.attemptedPosts)"
                  class="attempted-posts-btn"
                >
                  {{ result.postsRemoved || 0 }} recent posts removed automatically
                </button>
                <span v-else>{{ result.postsRemoved || 0 }} recent posts removed automatically</span>
              </small>
              <div class="bluesky-list-status">
                <span v-if="result.blueskyListSuccess" class="success">
                  ✓ Added to 
                  <a v-if="result.blueskyListUrl" :href="result.blueskyListUrl" target="_blank" class="list-link">
                    {{ result.blueskyListName }}
                  </a>
                  <span v-else>{{ result.blueskyListName }}</span>
                </span>
                <span v-else-if="result.blueskyListError" class="error">✗ Bluesky list failed: {{ result.blueskyListError }}</span>
                <span v-else class="warning">⚠ No Bluesky list configured</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Banned Users List Sub-tab -->
    <div v-if="banSubTab === 'users'" class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-left">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              <line x1="22" y1="2" x2="2" y2="22"/>
            </svg>
            <h3>Banned Users</h3>
          </div>
          <button @click="$emit('show-info', 'bannedUsers')" class="info-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </button>
        </div>
        <p class="card-description">Manage your banned users and unban them if needed. Sync keeps database and Bluesky lists in sync.</p>
      </div>
      <div class="card-content">
        <div class="list-filter">
          <div class="filter-row">
            <label>Filter by list:</label>
            <select :value="selectedListFilter" @change="$emit('update:selectedListFilter', $event.target.value)" class="list-dropdown">
              <option v-for="list in availableLists" :key="list.value" :value="list.value">
                {{ list.label }}
              </option>
            </select>
          </div>
          <div class="filter-row">
            <label>Search users:</label>
            <input v-model="searchQuery" type="text" placeholder="Search by handle or display name..." class="search-input">
          </div>
          <div class="sync-actions">
            <button 
              v-if="selectedListFilter === 'all' || selectedListFilter === 'history'" 
              @click="syncAllLists" 
              :disabled="syncing"
              class="sync-btn"
            >
              {{ syncing ? 'Syncing...' : 'Sync All Lists' }}
            </button>
            <button 
              v-if="selectedListFilter !== 'all' && selectedListFilter !== 'history'" 
              @click="syncSpecificList(selectedListFilter)" 
              :disabled="syncing"
              class="sync-btn sync-btn-small"
            >
              {{ syncing ? 'Syncing...' : 'Sync ' + (availableLists.find(l => l.value === selectedListFilter)?.label || 'List') }}
            </button>
            
            <div v-if="lastSyncResult" class="sync-result">
              <span class="sync-success">
                ✓ {{ lastSyncResult.added }} added, {{ lastSyncResult.removed }} removed
                <span v-if="lastSyncResult.deduplicated > 0">, {{ lastSyncResult.deduplicated }} duplicates cleaned</span>
              </span>
              <small>{{ formatTime(lastSyncResult.timestamp) }}</small>
              <div v-if="lastSyncResult.errors && lastSyncResult.errors.length > 0" class="sync-errors">
                <small v-for="error in lastSyncResult.errors" :key="error" class="sync-error">⚠ {{ error }}</small>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="filteredBannedUsers.length === 0" class="empty-state">
          <p v-if="bannedUsers.length === 0">No banned users yet.</p>
          <p v-else>No users in selected list.</p>
        </div>
        <div v-else class="banned-users-list">
          <div v-for="user in filteredBannedUsers" :key="user.handle" class="banned-user-item">
            <div class="user-details">
              <div class="user-header">
                <div class="user-id-section">
                  <button v-if="user.banned_did" @click="showUserHistory(user.banned_handle)" class="user-did-btn">{{ truncateDid(user.banned_did) }}</button>
                  <button v-else @click="showUserHistory(user.banned_handle)" class="user-handle-btn">{{ user.banned_handle }}</button>
                  <button v-if="user.banned_did" @click="copyToClipboard(user.banned_did)" class="copy-btn" title="Copy DID">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                  <a :href="`https://bsky.app/profile/${user.banned_handle}`" target="_blank" class="bluesky-icon" title="View profile on Bluesky">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M7 17L17 7M17 7H7M17 7V17"/>
                    </svg>
                  </a>
                </div>
                <small class="ban-date">{{ formatTime(user.banned_at) }}</small>
              </div>
              <div class="user-profile-info">
                <img v-if="user.avatar_url" :src="user.avatar_url" :alt="user.display_name || user.banned_handle" class="user-avatar-small">
                <div class="user-names">
                  <div v-if="user.display_name" class="user-display-name-large">{{ user.display_name }}</div>
                  <div class="user-handle-small">@{{ user.banned_handle }}</div>
                </div>
              </div>
              <div class="consolidated-bans">
                <div class="ban-method-group">
                  <div class="ban-method-header">
                    <span class="ban-method-label">{{ props.selectedListFilter === 'history' ? 'Unbanned from:' : 'Banned from:' }}</span>
                  </div>
                  <div class="banned-feeds">
                    <template v-for="ban in user.bans" :key="ban.list_type + (ban.feed_name || 'global') + (ban.id || ban.banned_at)">
                      <div class="feed-ban-item" v-if="props.selectedListFilter === 'history' ? ban.list_type === 'history' : ban.list_type !== 'history'">
                        <div class="feed-ban-row">
                          <button 
                            v-if="ban.list_type !== 'history'"
                            @click="showUnbanConfirm(ban)"
                            class="combined-feed-btn unban-feed-btn"
                          >
                            {{ ban.feed_name || (ban.list_type === 'global' ? 'Global Ban List' : ban.list_type) }}
                            <svg class="restore-icon" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                            </svg>
                          </button>
                          <div v-else class="feed-name-static history-feed">
                            {{ ban.feed_name || (ban.list_type === 'global' ? 'Global Ban List' : ban.list_type) }}
                          </div>
                          <span class="ban-method">via {{ getBanMethodPlain(ban) }}</span>
                          <button 
                            v-if="ban.sync_failed && ban.list_type !== 'history'"
                            @click="retryBanSync(user.banned_handle, ban.list_type)"
                            class="retry-sync-btn"
                            title="Retry adding to Bluesky list"
                          >
                            ⟳ Retry Sync
                          </button>
                        </div>
                        <small v-if="ban.sync_failed" class="sync-failed-notice">⚠ Failed to sync to Bluesky</small>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
              <div class="report-sources">
                <span class="reports-label">Reports:</span>
                <template v-if="user.user_reports && user.user_reports.length > 0">
                  <button 
                    v-for="report in groupReports(user.user_reports)" 
                    :key="report.key" 
                    @click="showUserHistory(user.banned_handle)"
                    class="report-badge" 
                    :class="'source-' + report.source"
                  >
                    {{ report.source.charAt(0).toUpperCase() + report.source.slice(1) }}: {{ report.report_type }}{{ report.count > 1 ? ` (${report.count})` : '' }}
                  </button>
                </template>
                <span v-else class="no-reports">None</span>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Trending Banned Users Sub-tab -->
    <div v-if="banSubTab === 'trending'" class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-left">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <h3>Trending Banned Users</h3>
          </div>
          <button @click="$emit('show-info', 'communalModeration')" class="info-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </button>
        </div>
        <p class="card-description">Users being banned by multiple moderators</p>
      </div>
      <div class="card-content">
        <TrendingControls 
          v-model:timeframe="banTrendingTimeframe"
          v-model:showHidden="showHiddenBannedUsers"
          v-model:showRemoved="showRemovedBannedUsers"
          v-model:sortBy="banTrendingSortBy"
          rateLabel="User bans/day"
          totalLabel="Total user bans"
          @update:timeframe="(value) => $emit('trending-params-changed', { timeframe: value, showHidden: showHiddenBannedUsers, showRemoved: showRemovedBannedUsers, sortBy: banTrendingSortBy })"
          @update:showHidden="(value) => $emit('trending-params-changed', { timeframe: banTrendingTimeframe, showHidden: value, showRemoved: showRemovedBannedUsers, sortBy: banTrendingSortBy })"
          @update:showRemoved="(value) => $emit('trending-params-changed', { timeframe: banTrendingTimeframe, showHidden: showHiddenBannedUsers, showRemoved: value, sortBy: banTrendingSortBy })"
          @update:sortBy="(value) => $emit('trending-params-changed', { timeframe: banTrendingTimeframe, showHidden: showHiddenBannedUsers, showRemoved: showRemovedBannedUsers, sortBy: value })"
        />
        
        <div v-if="trendingBannedUsers.length === 0" class="empty-state">
          <p>No trending banned users found.</p>
        </div>
        <div v-else class="trending-list">
          <div v-for="user in trendingBannedUsers" :key="user.banned_handle" class="trending-item">
            <div class="trending-details">
              <div class="trending-header">
                <div class="user-id-section">
                  <button v-if="user.banned_did" @click="showUserHistory(user.banned_handle)" class="user-did-btn">{{ truncateDid(user.banned_did) }}</button>
                  <button v-else @click="showUserHistory(user.banned_handle)" class="user-handle-btn">{{ user.banned_handle }}</button>
                  <button v-if="user.banned_did" @click="copyToClipboard(user.banned_did)" class="copy-btn" title="Copy DID">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                  <a :href="`https://bsky.app/profile/${user.banned_handle}`" target="_blank" class="bluesky-icon" title="View profile on Bluesky">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M7 17L17 7M17 7H7M17 7V17"/>
                    </svg>
                  </a>
                </div>
                <div class="header-right">
                  <div class="timestamp-section">
                    <small class="ban-date">{{ formatDate(user.first_ban) }}</small>
                    <small class="ban-date">{{ formatDate(user.last_ban) }}</small>
                  </div>
                  <div class="right-actions">
                    <span v-if="user.is_hidden" class="status-badge hidden">Hidden</span>
                    <button 
                      v-if="!user.is_hidden"
                      @click="hideTrendingBannedUser(user.banned_handle)"
                      class="hide-trending-btn-inline"
                      title="Hide this trending user"
                    >
                      Hide
                    </button>
                    <span v-if="user.ban_status && user.ban_status.not_banned_from.length === 0" class="status-badge removed">Removed</span>
                  </div>
                </div>
              </div>
              <div class="user-profile-info">
                <img v-if="user.avatar_url" :src="user.avatar_url" :alt="user.display_name || user.banned_handle" class="user-avatar-small">
                <div class="user-names">
                  <div v-if="user.display_name" class="user-display-name-large">{{ user.display_name }}</div>
                  <div class="user-handle-small">@{{ user.banned_handle }}</div>
                </div>
              </div>
              <div class="trending-stats">
                <span class="velocity">{{ user.velocity.toFixed(1) }} user ban{{ user.velocity.toFixed(1) === '1.0' ? '' : 's' }}/day</span>
                <span class="removers">{{ user.unique_banners }} total user ban{{ user.unique_banners === 1 ? '' : 's' }}</span>
              </div>
              <div class="threshold-proximity">
                <div class="global-thresholds">
                  <span class="threshold-label">Global:</span>
                  <div class="threshold-display">
                    <span v-html="getClosestThresholdDisplayHTML(user)"></span>
                    <button @click="showThresholdDetails(user.banned_handle, 'global')" class="threshold-plus-btn">+</button>
                  </div>
                </div>
                <div v-for="feed in feeds" :key="feed.id" class="feed-threshold-row">
                  <span class="threshold-label">{{ feed.feed_name }}:</span>
                  <div class="threshold-display">
                    <span v-html="getClosestThresholdDisplayHTML(user, feed)"></span>
                    <button @click="showThresholdDetails(user.banned_handle, feed.feed_id)" class="threshold-plus-btn">+</button>
                  </div>
                </div>
              </div>
              <div class="trending-status">
                <div v-if="user.ban_status" class="feed-status-container">
                  <div class="feed-status-section">
                    <span class="feed-status-label">Banned from:</span>
                    <div class="feed-status-chips">
                      <span v-for="feedId in user.ban_status.banned_from" :key="feedId" class="feed-status-chip removed">
                        {{ getFeedName(feedId) }}
                      </span>
                      <span v-if="user.ban_status.banned_from.length === 0" class="no-feeds">None</span>
                    </div>
                  </div>
                  <div v-if="user.ban_status.not_banned_from.length > 0" class="feed-status-section">
                    <span class="feed-status-label">Still exists on:</span>
                    <div class="feed-status-chips">
                      <button 
                        v-for="feedId in user.ban_status.not_banned_from" 
                        :key="feedId" 
                        @click="confirmBanFromFeed(user.banned_handle, feedId)"
                        class="feed-status-chip exists clickable"
                        title="Click to ban from this feed"
                      >
                        {{ getFeedName(feedId) }} ✕
                      </button>
                    </div>
                    <button 
                      @click="confirmBanFromAllFeeds(user.banned_handle)"
                      class="remove-all-feeds-btn"
                      title="Ban from all remaining feeds"
                    >
                      Ban from All Feeds
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Threshold Details Modal -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Threshold Details</h3>
          <button @click="closeModal" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="threshold-section">
            <h4>{{ modalData.feed ? modalData.feed.feed_name : 'Global' }} Thresholds</h4>
            <div class="threshold-config">
              <small class="config-label">Configuration:</small>
              <span class="config-item">Same-category: {{ getSameCategoryPercentage(modalData.feed) }}%</span>
              <span class="config-item">Cross-type: {{ getCrossTypePercentage(modalData.feed) }}%</span>
            </div>
            <div class="threshold-grid">
              <template v-for="type in getReportTypesToShow(modalData.item)" :key="type">
                <div v-if="type.startsWith('HEADER_')" class="category-header">
                  {{ type.replace('HEADER_', '').charAt(0).toUpperCase() + type.replace('HEADER_', '').slice(1) }}
                </div>
                <div v-else class="threshold-row">
                  <span class="threshold-type-label">{{ type }}:</span>
                  <span v-html="getFullThresholdDisplay(modalData.item, type, modalData.feed)"></span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Feed Ban List Modal -->
    <div v-if="showFeedModal" class="modal-overlay" @click="closeFeedModal">
      <div class="feed-modal-content" @click.stop>
        <div class="feed-modal-header">
          <div class="feed-modal-title">
            <svg class="feed-modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4"/>
              <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
              <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
              <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"/>
              <path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3"/>
            </svg>
            <h3>{{ feedModalData.feed?.feed_ban_list ? 'Edit' : 'Setup' }} Ban List</h3>
          </div>
          <button @click="closeFeedModal" class="feed-modal-close">×</button>
        </div>
        <div class="feed-modal-body">
          <div class="feed-info-card">
            <div class="feed-info-header">
              <h4>{{ feedModalData.feed?.feed_name }}</h4>
              <span class="feed-id">{{ feedModalData.feed?.feed_id }}</span>
            </div>
            <p class="feed-description">Configure the Bluesky list used for banning users from this feed</p>
          </div>
          
          <div class="form-section">
            <label class="form-label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              </svg>
              Bluesky List URI
            </label>
            <input 
              v-model="feedModalData.listUri" 
              type="text" 
              placeholder="at://did:plc:example/app.bsky.graph.list/example"
              class="form-input"
            >
            <small class="form-help">The AT Protocol URI of your Bluesky moderation list</small>
          </div>
          
          <div class="form-section">
            <label class="form-label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              List Name
            </label>
            <input 
              v-model="feedModalData.listName" 
              type="text" 
              placeholder="My Feed Ban List"
              class="form-input"
            >
            <small class="form-help">Display name for this ban list</small>
          </div>
          
          <div class="modal-actions">
            <button @click="closeFeedModal" class="btn-secondary">
              Cancel
            </button>
            <button @click="saveFeedBanList" class="btn-primary" :disabled="!canSaveFeedList">
              <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17,21 17,13 7,13 7,21"/>
                <polyline points="7,3 7,8 15,8"/>
              </svg>
              {{ feedModalData.feed?.feed_ban_list ? 'Update' : 'Create' }} List
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- View Ban List Modal -->
    <div v-if="showViewModal" class="modal-overlay" @click="closeViewModal">
      <div class="view-modal-content" @click.stop>
        <div class="view-modal-header">
          <div class="view-modal-title">
            <h3>{{ viewModalData.feed?.feed_name }} Ban List</h3>
          </div>
          <div class="view-modal-actions">
            <a :href="viewModalData.blueskyUrl || '#'" target="_blank" class="bluesky-header-btn" title="View on Bluesky">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M7 17L17 7M17 7H7M17 7V17"/>
              </svg>
              View on Bluesky
            </a>
            <button @click="closeViewModal" class="view-modal-close">×</button>
          </div>
        </div>
        <div class="view-modal-body">
          <div class="list-info">
            <div class="list-info-header">
              <p><strong>{{ viewModalData.users.length }}</strong> users on this ban list</p>
            </div>

            <input v-model="viewModalSearch" type="text" placeholder="Search users..." class="modal-search-input">
          </div>
          
          <div v-if="viewModalData.users.length === 0" class="empty-list">
            <p>No users on this ban list yet.</p>
          </div>
          
          <div v-else class="ban-list-users">
            <div v-for="user in filteredViewUsers" :key="user.banned_handle" class="ban-list-user">
              <img v-if="user.avatar_url" :src="user.avatar_url" :alt="user.display_name || user.banned_handle" class="user-avatar-tiny">
              <div v-else class="user-avatar-placeholder">{{ (user.display_name || user.banned_handle).charAt(0).toUpperCase() }}</div>
              <div class="user-details">
                <div v-if="user.display_name" class="user-name">{{ user.display_name }}</div>
                <div class="user-handle">@{{ user.banned_handle }}</div>
              </div>
              <div class="ban-info">
                <small class="ban-date">{{ formatTime(user.banned_at) }}</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Global Ban List Modal -->
    <div v-if="showGlobalModal" class="modal-overlay" @click="closeGlobalModal">
      <div class="feed-modal-content" @click.stop>
        <div class="feed-modal-header">
          <div class="feed-modal-title">
            <svg class="feed-modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 12h8"/>
              <path d="M12 8v8"/>
            </svg>
            <h3>{{ props.globalSettings?.global_ban_list ? 'Edit' : 'Setup' }} Global Ban List</h3>
          </div>
          <button @click="closeGlobalModal" class="feed-modal-close">×</button>
        </div>
        <div class="feed-modal-body">
          <div class="feed-info-card">
            <div class="feed-info-header">
              <h4>Global Ban List</h4>
              <span class="feed-id">All Feeds</span>
            </div>
            <p class="feed-description">Configure the Bluesky list used for banning users from all your feeds</p>
          </div>
          
          <div class="form-section">
            <label class="form-label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              </svg>
              Bluesky List URI
            </label>
            <input 
              v-model="globalModalData.listUri" 
              type="text" 
              placeholder="at://did:plc:example/app.bsky.graph.list/example"
              class="form-input"
            >
            <small class="form-help">The AT Protocol URI of your global Bluesky moderation list</small>
          </div>
          
          <div class="form-section">
            <label class="form-label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              List Name
            </label>
            <input 
              v-model="globalModalData.listName" 
              type="text" 
              placeholder="My Global Ban List"
              class="form-input"
            >
            <small class="form-help">Display name for this global ban list</small>
          </div>
          
          <div class="modal-actions">
            <button @click="closeGlobalModal" class="btn-secondary">
              Cancel
            </button>
            <button @click="saveGlobalBanList" class="btn-primary" :disabled="!canSaveGlobalList">
              <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17,21 17,13 7,13 7,21"/>
                <polyline points="7,3 7,8 15,8"/>
              </svg>
              {{ props.globalSettings?.global_ban_list ? 'Update' : 'Create' }} List
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import TrendingControls from '../shared/TrendingControls.vue'

const props = defineProps<{
  feeds: any[]
  reportTypes: any
  bannedUsers: any[]
  trendingBannedUsers: any[]
  availableLists: any[]
  selectedListFilter: string
  userTier: string
  globalSettings?: any
}>()

interface FeedGroup {
  id: number
  group_name: string
  feed_count: number
}

interface ModeratedGroup {
  id: number
  group_name: string
  owner_handle: string
  permissions: string[]
  feed_count: number
}

const emit = defineEmits<{
  'show-info': [topic: string]
  'user-banned': []
  'user-unbanned': []
  'trending-updated': []
  'trending-params-changed': [params: any]
  'edit-global-ban-list': []
  'edit-feed-ban-list': [feed: any]
  'show-attempted-posts': [posts: any[]]
  'show-user-history': [handle: string]
  'show-user-reports': [handle: string]
  'show-unban-confirm': [user: any]
  'sync-all-lists': []
  'sync-specific-list': [listType: string]
  'ban-trending-user': [handle: string]
  'hide-trending-banned-user': [handle: string]
  'update:selectedListFilter': [value: string]
}>()

const banSubTab = ref('ban')
const searchQuery = ref('')
const banForm = ref({
  userHandle: '',
  reportType: 'misleading-spam',
  reason: '',
  useGlobal: false,
  selectedFeeds: []
})
const banning = ref(false)
const banResults = ref([])
const banTrendingTimeframe = ref('7d')
const showHiddenBannedUsers = ref(false)
const showRemovedBannedUsers = ref(false)
const banTrendingSortBy = ref('rate')
const expandedThresholds = ref({})
const showModal = ref(false)
const modalData = ref({ item: null, feed: null })
const showFeedModal = ref(false)
const feedModalData = ref({ feed: null, listUri: '', listName: '' })
const showGlobalModal = ref(false)
const globalModalData = ref({ listUri: '', listName: '' })
const showViewModal = ref(false)
const viewModalData = ref({ feed: null, users: [] })
const viewModalSearch = ref('')
const ownedGroups = ref<FeedGroup[]>([])
const moderatedGroups = ref<ModeratedGroup[]>([])

const loadGroups = async () => {
  try {
    const [ownedResponse, moderatedResponse] = await Promise.all([
      axios.get('/api/feed-groups'),
      axios.get('/api/feed-groups/moderated')
    ])
    
    ownedGroups.value = ownedResponse.data.groups.map((g: any) => ({
      id: g.id,
      group_name: g.group_name,
      feed_count: Object.keys(ownedResponse.data.memberships[g.id] || {}).length
    }))
    
    moderatedGroups.value = moderatedResponse.data.map((g: any) => ({
      id: g.id,
      group_name: g.group_name,
      owner_handle: g.owner_handle,
      permissions: g.permissions,
      feed_count: g.feed_count
    }))
  } catch (error) {
    console.error('Failed to load groups:', error)
  }
}

import { onMounted } from 'vue'
onMounted(() => {
  loadGroups()
  // Load initial trending data
  emit('trending-params-changed', { 
    timeframe: banTrendingTimeframe.value, 
    showHidden: showHiddenBannedUsers.value, 
    showRemoved: showRemovedBannedUsers.value, 
    sortBy: banTrendingSortBy.value 
  })
})

const canBanUser = computed(() => {
  return banForm.value.userHandle && (banForm.value.useGlobal || banForm.value.selectedFeeds.length > 0)
})

const filteredBannedUsers = computed(() => {
  // Group users by DID/handle to consolidate duplicates
  const userGroups = new Map()
  
  props.bannedUsers.forEach(user => {
    const key = user.banned_did || user.banned_handle
    if (!userGroups.has(key)) {
      userGroups.set(key, {
        banned_handle: user.banned_handle,
        banned_did: user.banned_did,
        banned_at: user.banned_at,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        user_reports: user.user_reports,
        bans: []
      })
    }
    userGroups.get(key).bans.push(user)
    // Update to most recent ban date
    if (new Date(user.banned_at) > new Date(userGroups.get(key).banned_at)) {
      userGroups.get(key).banned_at = user.banned_at
    }
  })
  
  // Filter based on selected list and search query
  return Array.from(userGroups.values())
    .filter(user => {
      // List filter
      let matchesList = false
      if (props.selectedListFilter === 'all') {
        matchesList = user.bans.some(ban => ban.list_type !== 'history')
      } else if (props.selectedListFilter === 'history') {
        matchesList = user.bans.some(ban => ban.list_type === 'history')
      } else {
        matchesList = user.bans.some(ban => ban.list_type === props.selectedListFilter)
      }
      
      // Search filter
      let matchesSearch = true
      if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase()
        matchesSearch = user.banned_handle.toLowerCase().includes(query) ||
                      (user.display_name && user.display_name.toLowerCase().includes(query))
      }
      
      return matchesList && matchesSearch
    })
    .sort((a, b) => new Date(b.banned_at).getTime() - new Date(a.banned_at).getTime())
})

// Reactive global settings to ensure updates are reflected immediately
const reactiveGlobalSettings = computed(() => props.globalSettings || {})

const banUser = async () => {
  banning.value = true
  banResults.value = []
  
  try {
    const userHandle = banForm.value.userHandle.replace('@', '')
    
    console.log('API Call: POST /api/moderation/ban-user')
    console.log('Request payload:', {
      userHandle,
      reportType: banForm.value.reportType,
      useGlobal: banForm.value.useGlobal,
      selectedFeeds: banForm.value.selectedFeeds,
      reason: banForm.value.reason
    })
    
    const response = await axios.post('/api/moderation/ban-user', {
      userHandle,
      reportType: banForm.value.reportType,
      useGlobal: banForm.value.useGlobal,
      selectedFeeds: banForm.value.selectedFeeds,
      reason: banForm.value.reason
    })
    
    console.log('API Response:', response.data)
    
    if (response.data.success) {
      banResults.value = [{ 
        success: true, 
        listUri: response.data.listUri,
        postsRemoved: response.data.postsRemoved,
        blueskyListSuccess: response.data.blueskyListSuccess,
        blueskyListError: response.data.blueskyListError,
        blueskyListName: response.data.blueskyListName,
        blueskyListUrl: response.data.blueskyListUrl,
        attemptedPosts: response.data.attemptedPosts
      }]
      // Reset form on success
      banForm.value.userHandle = ''
      banForm.value.reason = ''
      banForm.value.useGlobal = false
      banForm.value.selectedFeeds = []
      emit('user-banned')
    } else {
      banResults.value = [{ success: false, error: response.data.error || `Ban failed (${response.status})` }]
      // Show alert for group ban failures
      if (response.data.error && response.data.error.includes('No feeds in the selected group')) {
        alert(response.data.error)
      }
    }
    
  } catch (error) {
    console.error('Failed to ban user:', error)
    const errorMsg = error.response?.data?.error || error.message || 'Failed to ban user'
    banResults.value = [{ success: false, error: errorMsg }]
    // Show alert for group ban failures
    if (errorMsg && errorMsg.includes('No feeds in the selected group')) {
      alert(errorMsg)
    }
  } finally {
    banning.value = false
  }
}

const editGlobalBanList = () => {
  globalModalData.value = {
    listUri: props.globalSettings?.global_ban_list || '',
    listName: props.globalSettings?.global_ban_list_name || ''
  }
  showGlobalModal.value = true
}

const editFeedBanList = (feed: any) => {
  feedModalData.value = {
    feed,
    listUri: feed.feed_ban_list || '',
    listName: feed.feed_ban_list_name || ''
  }
  showFeedModal.value = true
}

const viewGlobalBanList = async () => {
  try {
    console.log('API Call: GET /api/user/global-ban-list-users')
    
    const response = await axios.get('/api/user/global-ban-list-users')
    console.log('API Response:', response.data)
    
    console.log('Global ban list URI:', props.globalSettings?.global_ban_list)
    const globalBlueskyUrl = convertAtUriToBskyUrl(props.globalSettings?.global_ban_list)
    console.log('Converted global Bluesky URL:', globalBlueskyUrl)
    
    viewModalData.value = {
      feed: { feed_name: 'Global', feed_id: 'global' },
      users: response.data.users || [],
      blueskyUrl: globalBlueskyUrl || props.globalSettings?.global_ban_list
    }
    showViewModal.value = true
  } catch (error) {
    console.error('Failed to load global ban list users:', error)
    alert('✗ GET https://bsky.social/xrpc/com.atproto.repo.listRecords (Bluesky list) failed')
  }
}

const viewFeedBanList = async (feed: any) => {
  try {
    console.log(`API Call: GET /api/feeds/${feed.feed_id}/ban-list-users`)
    
    const response = await axios.get(`/api/feeds/${feed.feed_id}/ban-list-users`)
    console.log('API Response:', response.data)
    
    const users = response.data.users || []
    
    // For users without avatars, try to get them from the main banned users list
    const usersWithAvatars = users.map(user => {
      if (!user.avatar_url) {
        const mainListUser = props.bannedUsers.find(bu => bu.banned_handle === user.banned_handle)
        if (mainListUser?.avatar_url) {
          return { ...user, avatar_url: mainListUser.avatar_url, display_name: mainListUser.display_name || user.display_name }
        }
      }
      return user
    })
    
    console.log('Feed ban list URI:', feed.feed_ban_list)
    const blueskyUrl = convertAtUriToBskyUrl(feed.feed_ban_list)
    console.log('Converted Bluesky URL:', blueskyUrl)
    
    viewModalData.value = {
      feed,
      users: usersWithAvatars,
      blueskyUrl: blueskyUrl || feed.feed_ban_list
    }
    showViewModal.value = true
  } catch (error) {
    console.error('Failed to load ban list users:', error)
    alert('✗ GET https://bsky.social/xrpc/com.atproto.repo.listRecords (Bluesky list) failed')
  }
}

const showAttemptedPosts = (posts: any[]) => {
  emit('show-attempted-posts', posts)
}

const showUserHistory = (handle: string) => {
  emit('show-user-history', handle)
}

const showUserReports = (handle: string) => {
  emit('show-user-reports', handle)
}

const showUnbanConfirm = (user: any) => {
  emit('show-unban-confirm', user)
}

const syncing = ref(false)
const lastSyncResult = ref(null)

const syncAllLists = async () => {
  syncing.value = true
  lastSyncResult.value = null
  
  try {
    console.log('API Call: POST /api/moderation/sync-ban-lists')
    const response = await axios.post('/api/moderation/sync-ban-lists', {})
    console.log('API Response:', response.data)
    
    if (response.data.success) {
      lastSyncResult.value = {
        ...response.data,
        timestamp: new Date()
      }
      emit('user-banned') // Refresh the banned users list
    } else {
      alert('Sync failed: ' + (response.data.error || 'Unknown error'))
    }
  } catch (error) {
    console.error('Sync failed:', error)
    const errorMsg = error.response?.data?.error || error.message || 'Sync failed'
    alert('Sync failed: ' + errorMsg)
  } finally {
    syncing.value = false
  }
}

const syncSpecificList = async (listType: string) => {
  syncing.value = true
  lastSyncResult.value = null
  
  try {
    console.log('API Call: POST /api/moderation/sync-ban-lists')
    console.log('Request payload:', { listType })
    
    const response = await axios.post('/api/moderation/sync-ban-lists', { listType })
    console.log('API Response:', response.data)
    
    if (response.data.success) {
      lastSyncResult.value = {
        ...response.data,
        timestamp: new Date()
      }
      emit('user-banned') // Refresh the banned users list
    } else {
      alert('Sync failed: ' + (response.data.error || 'Unknown error'))
    }
  } catch (error) {
    console.error('Sync failed:', error)
    const errorMsg = error.response?.data?.error || error.message || 'Sync failed'
    alert('Sync failed: ' + errorMsg)
  } finally {
    syncing.value = false
  }
}

const syncGlobalList = async () => {
  await syncSpecificList('global')
}

const syncFeedList = async (feedId: string) => {
  await syncSpecificList(feedId)
}

const banTrendingUser = (handle: string) => {
  emit('ban-trending-user', handle)
}

const hideTrendingBannedUser = (handle: string) => {
  emit('hide-trending-banned-user', handle)
}

const confirmBanFromFeed = (handle: string, feedId: string) => {
  const feedName = getFeedName(feedId)
  if (confirm(`Ban ${handle} from ${feedName}?`)) {
    banFromSpecificFeed(handle, feedId)
  }
}

const confirmBanFromAllFeeds = (handle: string) => {
  if (confirm(`Ban ${handle} from all remaining feeds?`)) {
    banFromAllFeeds(handle)
  }
}

const banFromSpecificFeed = async (handle: string, feedId: string) => {
  try {
    console.log('API Call: POST /api/moderation/ban-user (specific feed)')
    console.log('Request payload:', { userHandle: handle, selectedFeeds: [feedId] })
    
    const response = await axios.post('/api/moderation/ban-user', {
      userHandle: handle,
      selectedFeeds: [feedId]
    })
    
    console.log('API Response:', response.data)
    
    if (response.data.success) {
      alert(`✓ Successfully banned ${handle} from ${getFeedName(feedId)} via POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list)`)
      emit('trending-updated')
      emit('user-banned')
    } else {
      alert('✗ Failed POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list). Check console for details.')
    }
  } catch (error) {
    console.error('Failed to ban user from feed:', error)
    alert('✗ Error POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list). Check console for details.')
  }
}

const banFromAllFeeds = async (handle: string) => {
  try {
    console.log('API Call: POST /api/moderation/ban-user (all feeds)')
    console.log('Request payload:', { userHandle: handle, useGlobal: true })
    
    const response = await axios.post('/api/moderation/ban-user', {
      userHandle: handle,
      useGlobal: true
    })
    
    console.log('API Response:', response.data)
    
    if (response.data.success) {
      alert(`✓ Successfully banned ${handle} from all feeds via POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list)`)
      emit('trending-updated')
      emit('user-banned')
    } else {
      alert('✗ Failed POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list) for some feeds. Check console for details.')
    }
  } catch (error) {
    console.error('Failed to ban user from all feeds:', error)
    alert('✗ Error POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list). Check console for details.')
  }
}

const getFeedName = (feedId: string): string => {
  const feed = props.feeds.find(f => f.feed_id === feedId)
  return feed ? feed.feed_name : feedId
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

const calculateThresholdDisplay = (item: any, type: string): string => {
  const baseThreshold = getUserBanGlobalThreshold(type)
  const sameCategoryPercentage = 50
  const globalCrossPercentage = 20
  
  if (item.report_types && Array.isArray(item.report_types)) {
    const reportTypes = item.report_types
    
    // Count exact type reports
    const exactCount = reportTypes.filter(rt => rt === type).length
    
    // Count same category reports (including exact)
    const sameCategoryCount = reportTypes.filter(rt => 
      rt === type || rt.startsWith(type + '-')
    ).length
    
    // Count cross-type reports
    const otherCategoryCount = reportTypes.filter(rt => {
      if (rt === type || rt.startsWith(type + '-')) return false
      return true
    }).length
    
    // Calculate effective counts toward the SAME base threshold
    const exactEffective = exactCount
    const categoryEffective = exactCount + Math.floor((sameCategoryCount - exactCount) * (sameCategoryPercentage / 100))
    const crossEffective = exactCount + Math.floor((sameCategoryCount - exactCount) * (sameCategoryPercentage / 100)) + Math.floor(otherCategoryCount * (globalCrossPercentage / 100))
    
    return `${exactEffective}/${baseThreshold} | ${categoryEffective}/${baseThreshold} | ${crossEffective}/${baseThreshold}`
  }
  
  const reportCount = item[`${type.replace('-', '_')}_reports`] || 0
  return `${reportCount}/${baseThreshold} | ${reportCount}/${baseThreshold} | ${reportCount}/${baseThreshold}`
}

const calculateUserFeedThresholdDisplay = (item: any, type: string, feed: any): string => {
  const baseThreshold = getFeedUserBanThreshold(type, feed.feed_id)
  const sameCategoryPercentage = feed.user_ban_same_category_cross_percentage || feed.global_user_ban_same_category_cross_percentage || 50
  const globalCrossTypePercentage = feed.user_ban_cross_type_percentage || feed.global_user_ban_cross_type_percentage || 20
  
  if (item.report_types && Array.isArray(item.report_types)) {
    const reportTypes = item.report_types || []
    
    // Count exact type reports
    const exactCount = reportTypes.filter(rt => rt === type).length
    
    // Count same category reports (including exact)
    const sameCategoryCount = reportTypes.filter(rt => {
      if (rt === type) return true
      const mainCategory = type
      return rt.startsWith(mainCategory + '-')
    }).length
    
    // Count cross-type reports
    const otherCategoryCount = reportTypes.filter(rt => {
      if (rt === type) return false
      const mainCategory = type
      if (rt.startsWith(mainCategory + '-')) return false
      return true
    }).length
    
    // Calculate effective counts toward the SAME base threshold
    const exactEffective = exactCount
    const categoryEffective = exactCount + Math.floor((sameCategoryCount - exactCount) * (sameCategoryPercentage / 100))
    const crossEffective = exactCount + Math.floor((sameCategoryCount - exactCount) * (sameCategoryPercentage / 100)) + Math.floor(otherCategoryCount * (globalCrossTypePercentage / 100))
    
    return `${exactEffective}/${baseThreshold} | ${categoryEffective}/${baseThreshold} | ${crossEffective}/${baseThreshold}`
  }
  
  const reportCount = item[`${type}_reports`] || 0
  return `${reportCount}/${baseThreshold} | ${reportCount}/${baseThreshold} | ${reportCount}/${baseThreshold}`
}

const getGlobalThreshold = (type: string): number => {
  const fallbacks = {
    misleading: 10,
    harassment: 5,
    violence: 3,
    sexual: 5,
    'child-safety': 2,
    'self-harm': 3,
    rule: 5
  }
  return fallbacks[type as keyof typeof fallbacks] || 10
}

const getUserBanGlobalThreshold = (type: string): number => {
  const typeKey = type.replace(/-/g, '_')
  const settings = reactiveGlobalSettings.value
  
  // Check user's global settings first - only if value exists and is not null
  if (settings && settings[`global_user_ban_threshold_${typeKey}`] !== null && settings[`global_user_ban_threshold_${typeKey}`] !== undefined) {
    return settings[`global_user_ban_threshold_${typeKey}`]
  }
  
  // For subcategories, check if main category has a global threshold
  if (type.includes('-')) {
    const mainCategory = type.split('-')[0]
    const mainCategoryKey = mainCategory.replace(/-/g, '_')
    if (settings && settings[`global_user_ban_threshold_${mainCategoryKey}`] !== null && settings[`global_user_ban_threshold_${mainCategoryKey}`] !== undefined) {
      return settings[`global_user_ban_threshold_${mainCategoryKey}`]
    }
  }
  
  // Fallback to hardcoded defaults
  const fallbacks = {
    misleading: 15,
    harassment: 8,
    violence: 5,
    sexual: 8,
    'child-safety': 3,
    'self-harm': 5,
    rule: 8
  }
  
  if (type.includes('-')) {
    const mainCategory = type.split('-')[0]
    return fallbacks[mainCategory as keyof typeof fallbacks] || 3
  }
  
  return fallbacks[type as keyof typeof fallbacks] || 3
}

const getFeedUserBanThreshold = (type: string, feedId: string): number => {
  const feed = props.feeds.find(f => f.feed_id === feedId)
  if (!feed) return getUserBanGlobalThreshold(type)
  
  const typeKey = type.replace(/-/g, '_')
  return feed[`user_ban_threshold_${typeKey}`] || getUserBanGlobalThreshold(type)
}

const getFeedThreshold = (type: string, feedId: string): number => {
  const feed = props.feeds.find(f => f.feed_id === feedId)
  if (!feed) return getGlobalThreshold(type)
  
  const typeKey = type.replace(/-/g, '_')
  return feed[`threshold_${typeKey}`] || getGlobalThreshold(type)
}

const getFeedBanThreshold = (type: string, feedId: string): number => {
  const feed = props.feeds.find(f => f.feed_id === feedId)
  if (!feed) return getUserBanGlobalThreshold(type)
  
  const typeKey = type.replace(/-/g, '_')
  return getFeedUserBanThreshold(type, feedId)
}

const getClosestThresholdDisplayHTML = (item: any, feed?: any) => {
  const reportTypes = ['misleading', 'harassment', 'violence', 'sexual', 'child-safety', 'self-harm', 'rule']
  let bestThreshold = { reportType: '', current: 0, max: 1, percent: 0 }
  
  for (const type of reportTypes) {
    const baseThreshold = feed ? getFeedUserBanThreshold(type, feed.feed_id) : getUserBanGlobalThreshold(type)
    if (!baseThreshold || baseThreshold === 0) continue
    
    const sameCategoryPercentage = feed ? (feed.user_ban_same_category_cross_percentage || 50) : 50
    const globalCrossPercentage = feed ? (feed.user_ban_cross_type_percentage || 20) : 20
    
    // Check if cross-type is eligible (threshold allows at least 1 cross-type contribution)
    const maxCrossTypeContributions = Math.floor(baseThreshold * (globalCrossPercentage / 100))
    const crossTypeEligible = maxCrossTypeContributions > 0
    
    let crossEffective = 0
    
    if (item.report_types && Array.isArray(item.report_types)) {
      const reportTypes = item.report_types
      const mainCategory = type
      
      // Filter out excluded types from frontend calculations too
      const excludedFromCommunal = [
        'misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other'
      ]
      const filteredReportTypes = reportTypes.filter(rt => !excludedFromCommunal.includes(rt))
      
      // Calculate cross-effective using same logic as detailed modal
      const exactCount = filteredReportTypes.filter(rt => rt === type).length
      let categoryEffective = exactCount
      
      // Add same-category contributions
      let sameCategoryContributions = 0
      filteredReportTypes.forEach(rt => {
        if (rt !== type && rt.startsWith(mainCategory)) {
          sameCategoryContributions += sameCategoryPercentage / 100
        }
      })
      categoryEffective += sameCategoryContributions > 0 ? Math.ceil(sameCategoryContributions) : 0
      
      // Add cross-type contributions only if eligible
      if (crossTypeEligible) {
        let crossTypeContributions = 0
        filteredReportTypes.forEach(rt => {
          if (!rt.startsWith(mainCategory)) {
            crossTypeContributions += globalCrossPercentage / 100
          }
        })
        crossEffective = categoryEffective + (crossTypeContributions > 0 ? Math.ceil(crossTypeContributions) : 0)
      } else {
        // If cross-type not eligible, only use category effective
        crossEffective = categoryEffective
      }
    } else {
      // Fallback: use the aggregated count
      const typeKey = type.replace(/-/g, '_')
      crossEffective = item[`${typeKey}_reports`] || 0
    }
    
    const percent = (crossEffective / baseThreshold) * 100
    if (percent > bestThreshold.percent) {
      bestThreshold = {
        reportType: type,
        current: crossEffective,
        max: baseThreshold,
        percent: percent
      }
    }
  }
  
  if (bestThreshold.max === 1) {
    // Check if there are any qualifying reports
    if (item.report_types && Array.isArray(item.report_types)) {
      const excludedFromCommunal = [
        'misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other'
      ]
      const hasQualifyingReports = item.report_types.some(rt => !excludedFromCommunal.includes(rt))
      if (!hasQualifyingReports) {
        return `<span style="color: #6b7280; font-size: 12px;">No qualifying reports</span>`
      }
    }
    return `<span style="color: #6b7280; font-size: 12px;">No thresholds set</span>`
  }
  
  const percent = Math.min(bestThreshold.percent, 100)
  
  return `
    <div style="display: flex; align-items: center; gap: 6px;">
      <span style="font-size: 11px; color: #374151; font-weight: 500; min-width: 80px;">${bestThreshold.reportType}:</span>
      <div style="position: relative; width: 60px; height: 18px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 2px; overflow: hidden;">
        <div style="height: 100%; background: linear-gradient(90deg, #10b981 0%, #dc2626 100%); width: ${percent === 0 ? '2px' : percent + '%'};"></div>
        <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 9px; font-weight: 600; color: #374151; font-family: monospace; text-shadow: 0 0 2px rgba(255,255,255,0.8);">${bestThreshold.current}/${bestThreshold.max}</span>
      </div>
    </div>
  `
}

const toggleFeedThreshold = (itemId: string, feedId: number) => {
  const key = itemId + '_' + feedId
  
  Object.keys(expandedThresholds.value).forEach(k => {
    if (k.startsWith(itemId + '_') && k !== key) {
      delete expandedThresholds.value[k]
    }
  })
  
  if (expandedThresholds.value[key]) {
    delete expandedThresholds.value[key]
  } else {
    expandedThresholds.value[key] = props.feeds.find(f => f.id === feedId)
  }
}

const getExpandedFeedThreshold = (itemId: string) => {
  const expandedKey = Object.keys(expandedThresholds.value).find(k => k.startsWith(itemId + '_'))
  return expandedKey ? expandedThresholds.value[expandedKey] : null
}

const showThresholdDetails = (itemId: string, feedId: string) => {
  const item = props.trendingBannedUsers.find(u => u.banned_handle === itemId)
  const feed = feedId === 'global' ? null : props.feeds.find(f => f.feed_id === feedId)
  
  modalData.value = { item, feed }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  modalData.value = { item: null, feed: null }
}

const closeFeedModal = () => {
  showFeedModal.value = false
  feedModalData.value = { feed: null, listUri: '', listName: '' }
}

const closeGlobalModal = () => {
  showGlobalModal.value = false
  globalModalData.value = { listUri: '', listName: '' }
}

const canSaveGlobalList = computed(() => {
  return globalModalData.value.listUri.trim() && globalModalData.value.listName.trim()
})

const saveGlobalBanList = async () => {
  try {
    console.log('API Call: POST /api/user/update-global-ban-list')
    console.log('Request payload:', {
      listUri: globalModalData.value.listUri.trim(),
      listName: globalModalData.value.listName.trim()
    })
    
    const response = await axios.post('/api/user/update-global-ban-list', {
      listUri: globalModalData.value.listUri.trim(),
      listName: globalModalData.value.listName.trim()
    })
    
    console.log('API Response:', response.data)
    
    if (response.data.success) {
      // Update global settings locally
      if (props.globalSettings) {
        props.globalSettings.global_ban_list = globalModalData.value.listUri.trim()
        props.globalSettings.global_ban_list_name = globalModalData.value.listName.trim()
      }
      
      alert('✓ Global ban list saved successfully via POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list)!')
      closeGlobalModal()
      emit('user-banned') // Refresh data
    } else {
      alert('✗ POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list) failed: ' + response.data.error)
    }
  } catch (error) {
    console.error('Failed to save global ban list:', error)
    alert('✗ Error POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list)')
  }
}

const closeViewModal = () => {
  showViewModal.value = false
  viewModalData.value = { feed: null, users: [], blueskyUrl: null }
  viewModalSearch.value = ''
}

const convertAtUriToBskyUrl = (atUri: string): string | null => {
  if (!atUri || !atUri.startsWith('at://')) return null
  const match = atUri.match(/^at:\/\/(did:[^/]+)\/app\.bsky\.graph\.list\/(.+)$/)
  if (match) {
    const [, did, listId] = match
    return `https://bsky.app/profile/${did}/lists/${listId}`
  }
  return null
}

const filteredViewUsers = computed(() => {
  if (!viewModalSearch.value.trim()) {
    return viewModalData.value.users
  }
  const query = viewModalSearch.value.toLowerCase()
  return viewModalData.value.users.filter(user => 
    user.banned_handle.toLowerCase().includes(query) ||
    (user.display_name && user.display_name.toLowerCase().includes(query))
  )
})

const canSaveFeedList = computed(() => {
  return feedModalData.value.listUri.trim() && feedModalData.value.listName.trim()
})

const saveFeedBanList = async () => {
  try {
    console.log('API Call: POST /api/feeds/update-ban-list')
    console.log('Request payload:', {
      feedId: feedModalData.value.feed.feed_id,
      listUri: feedModalData.value.listUri.trim(),
      listName: feedModalData.value.listName.trim()
    })
    
    const response = await axios.post('/api/feeds/update-ban-list', {
      feedId: feedModalData.value.feed.feed_id,
      listUri: feedModalData.value.listUri.trim(),
      listName: feedModalData.value.listName.trim()
    })
    
    console.log('API Response:', response.data)
    
    if (response.data.success) {
      // Update the feed object locally
      if (feedModalData.value.feed) {
        feedModalData.value.feed.feed_ban_list = feedModalData.value.listUri.trim()
        feedModalData.value.feed.feed_ban_list_name = feedModalData.value.listName.trim()
      }
      
      alert('✓ Ban list saved successfully via POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list)!')
      closeFeedModal()
      emit('user-banned') // Refresh data
    } else {
      alert('✗ POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list) failed: ' + response.data.error)
    }
  } catch (error) {
    console.error('Failed to save ban list:', error)
    alert('✗ Error POST https://bsky.social/xrpc/com.atproto.repo.applyWrites (Bluesky list)')
  }
}

const getSameCategoryPercentage = (feed?: any) => {
  if (feed) {
    return feed.user_ban_same_category_cross_percentage || 50
  }
  // Use global settings for global thresholds
  const settings = reactiveGlobalSettings.value
  return settings?.global_user_ban_same_category_cross_percentage || 50
}

const getCrossTypePercentage = (feed?: any) => {
  if (feed) {
    return feed.user_ban_cross_type_percentage || 20
  }
  // Use global settings for global thresholds
  const settings = reactiveGlobalSettings.value
  return settings?.global_user_ban_cross_type_percentage || 20
}

const getFullThresholdDisplay = (item: any, type: string, feed?: any) => {
  const baseThreshold = feed ? getFeedUserBanThreshold(type, feed.feed_id) : getUserBanGlobalThreshold(type)
  const sameCategoryPercentage = feed ? (feed.user_ban_same_category_cross_percentage || 50) : 50
  const globalCrossPercentage = feed ? (feed.user_ban_cross_type_percentage || 20) : 20
  
  if (baseThreshold === 0) {
    return `<span style="color: #6b7280; font-size: 12px;">No threshold</span>`
  }
  
  let exactCount = 0, categoryEffective = 0, crossEffective = 0
  
  if (item.report_types && Array.isArray(item.report_types)) {
    // Filter out excluded types from frontend calculations
    const excludedFromCommunal = [
      'misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other'
    ]
    const reportTypes = item.report_types.filter(rt => !excludedFromCommunal.includes(rt))
    const mainCategory = type.includes('-') ? type.split('-')[0] : type
    
    // Exact count: reports of this exact type
    exactCount = reportTypes.filter(rt => rt === type).length
    
    // Category effective: exact + contributions from same-category reports
    let sameCategoryContributions = 0
    reportTypes.forEach(rt => {
      if (rt !== type && rt.startsWith(mainCategory)) {
        sameCategoryContributions += sameCategoryPercentage / 100
      }
    })
    categoryEffective = exactCount + (sameCategoryContributions > 0 ? Math.ceil(sameCategoryContributions) : 0)
    
    // Cross-type effective: category + contributions from all other categories  
    let crossTypeContributions = 0
    reportTypes.forEach(rt => {
      if (!rt.startsWith(mainCategory)) {
        crossTypeContributions += globalCrossPercentage / 100
      }
    })
    crossEffective = categoryEffective + (crossTypeContributions > 0 ? Math.ceil(crossTypeContributions) : 0)
  } else {
    // Fallback: use the aggregated count for all three types
    const typeKey = type.replace(/-/g, '_')
    const reportCount = item[`${typeKey}_reports`] || 0
    exactCount = categoryEffective = crossEffective = reportCount
  }
  
  // Check if cross-type is eligible (threshold allows at least 1 cross-type contribution)
  const maxCrossTypeContributions = Math.floor(baseThreshold * (globalCrossPercentage / 100))
  const crossTypeEligible = maxCrossTypeContributions > 0
  
  const exactPercent = Math.min((exactCount / baseThreshold) * 100, 100)
  const categoryPercent = Math.min((categoryEffective / baseThreshold) * 100, 100)
  const crossPercent = Math.min((crossEffective / baseThreshold) * 100, 100)
  
  return `
    <div style="display: flex; flex-direction: column; gap: 4px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 10px; color: #6b7280; min-width: 50px;">Exact:</span>
        <div style="position: relative; width: 60px; height: 16px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; background: linear-gradient(90deg, #10b981 0%, #dc2626 100%); width: ${exactPercent === 0 ? '2px' : exactPercent + '%'};"></div>
          <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 8px; font-weight: 600; color: #374151; font-family: monospace; text-shadow: 0 0 2px rgba(255,255,255,0.8);">${exactCount}/${baseThreshold}</span>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 10px; color: #6b7280; min-width: 50px;">+Category:</span>
        <div style="position: relative; width: 60px; height: 16px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; background: linear-gradient(90deg, #10b981 0%, #dc2626 100%); width: ${categoryPercent === 0 ? '2px' : categoryPercent + '%'};"></div>
          <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 8px; font-weight: 600; color: #374151; font-family: monospace; text-shadow: 0 0 2px rgba(255,255,255,0.8);">${categoryEffective}/${baseThreshold}</span>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 10px; color: ${crossTypeEligible ? '#6b7280' : '#9ca3af'}; min-width: 50px; ${crossTypeEligible ? '' : 'text-decoration: line-through;'}">+Cross:</span>
        <div style="position: relative; width: 60px; height: 16px; background: #f3f4f6; border: 1px solid ${crossTypeEligible ? '#d1d5db' : '#e5e7eb'}; border-radius: 2px; overflow: hidden; ${crossTypeEligible ? '' : 'opacity: 0.5;'}">
          <div style="height: 100%; background: linear-gradient(90deg, #10b981 0%, #dc2626 100%); width: ${crossPercent === 0 ? '2px' : crossPercent + '%'};"></div>
          <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 8px; font-weight: 600; color: #374151; font-family: monospace; text-shadow: 0 0 2px rgba(255,255,255,0.8);">${crossTypeEligible ? crossEffective + '/' + baseThreshold : 'N/A'}</span>
        </div>
      </div>
    </div>
  `
}

const getBanMethod = (user: any): string => {
  // Check if it's from auto-block or manual ban
  if (user.reason === 'autoblock') {
    return 'autoblock'
  }
  if (user.reason && user.reason.includes('auto-block')) {
    return 'autoblock'
  }
  if (user.reason && user.reason.includes('communal')) {
    return 'communal-moderation'
  }
  return 'manual-ban'
}

const getBanMethodPlain = (ban: any): string => {
  if (!ban) return 'Manual Ban'
  
  // Check the action type first (most reliable)
  if (ban.action) {
    if (ban.action === 'modmaster_ban' || ban.action === 'modmaster_auto_ban') return 'ModMaster'
    if (ban.action === 'auto_ban') return 'AutoBlock'
    if (ban.action === 'communal_ban') return 'Communal Moderation'
  }
  
  // Check reason for autoblock (exact match)
  if (ban.reason === 'autoblock') return 'AutoBlock'
  
  // Check reason for legacy compatibility
  if (ban.reason) {
    if (ban.reason.includes('modmaster') || ban.reason.includes('ModMaster')) return 'ModMaster'
    if (ban.reason.includes('auto-block') || ban.reason.includes('Auto Block')) return 'AutoBlock'
    if (ban.reason.includes('communal') || ban.reason.includes('Communal')) return 'Communal Moderation'
  }
  
  // Check ban_type for legacy compatibility
  if (ban.ban_type) {
    if (ban.ban_type === 'auto') return 'AutoBlock'
    if (ban.ban_type === 'communal') return 'Communal Moderation'
  }
  
  return 'Manual Ban'
}

const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

const truncateDid = (did: string): string => {
  if (!did || !did.startsWith('did:plc:') || !isMobile.value) return did
  const afterPlc = did.substring(8) // Remove 'did:plc:'
  return `did:plc:${afterPlc.substring(0, 5)}...`
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

const copyToClipboard = async (text: string) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const retryBanSync = async (userHandle: string, listType: string) => {
  try {
    console.log('API Call: POST /api/moderation/retry-ban-sync')
    console.log('Request payload:', { userHandle, listType })
    
    const response = await axios.post('/api/moderation/retry-ban-sync', {
      userHandle,
      listType
    })
    
    console.log('API Response:', response.data)
    
    if (response.data.success) {
      alert(`✅ Successfully synced ${userHandle} to Bluesky list via POST https://bsky.social/xrpc/com.atproto.repo.applyWrites`)
      emit('user-banned') // Refresh the list
    } else {
      alert(`❌ POST https://bsky.social/xrpc/com.atproto.repo.applyWrites failed: ${response.data.error}`)
    }
  } catch (error) {
    console.error('Failed to retry ban sync:', error)
    alert('❌ POST https://bsky.social/xrpc/com.atproto.repo.applyWrites failed: Network error')
  }
}

const groupBansByMethod = (bans: any[]) => {
  const grouped = new Map()
  
  // Handle case where bans is undefined or null
  if (!bans || !Array.isArray(bans)) {
    return grouped
  }
  
  bans.forEach(ban => {
    const method = getBanMethodPlain(ban)
    if (!grouped.has(method)) {
      grouped.set(method, [])
    }
    grouped.get(method).push(ban)
  })
  
  return grouped
}

const getReportTypesToShow = (item: any) => {
  const categoryOrder = ['misleading', 'harassment', 'violence', 'sexual', 'child-safety', 'self-harm', 'rule']
  const excludedFromCommunal = ['misleading-other', 'harassment-other', 'violence-other', 'sexual-other', 'self-harm-other', 'rule-other', 'other']
  const organizedTypes = []
  
  // Organize by main categories in proper order
  if (props.reportTypes) {
    categoryOrder.forEach(mainCategory => {
      const category = props.reportTypes[mainCategory]
      if (category && category.subcategories) {
        // Add category header
        organizedTypes.push(`HEADER_${mainCategory}`)
        
        // Add subcategories for this main category
        Object.keys(category.subcategories).forEach(subKey => {
          if (!excludedFromCommunal.includes(subKey)) {
            organizedTypes.push(subKey)
          }
        })
      }
    })
  }
  
  return organizedTypes.length > 0 ? organizedTypes : ['misleading', 'harassment', 'violence', 'sexual', 'child-safety', 'self-harm', 'rule']
}

const groupReports = (reports: any[]) => {
  if (!reports || !Array.isArray(reports)) return []
  
  const grouped = new Map()
  
  reports.forEach(report => {
    const key = `${report.source}:${report.report_type}`
    if (grouped.has(key)) {
      grouped.get(key).count++
    } else {
      grouped.set(key, {
        key,
        source: report.source,
        report_type: report.report_type,
        count: 1
      })
    }
  })
  
  return Array.from(grouped.values())
}
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
  padding: 0.75rem 0.75rem 0.5rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
}

@media (min-width: 640px) {
  .card-header {
    padding: 1rem 1rem 0.75rem 1rem;
  }
}

@media (min-width: 768px) {
  .card-header {
    padding: 1.5rem 2rem 1rem 2rem;
  }
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
  padding: 0.75rem;
}

@media (min-width: 640px) {
  .card-content {
    padding: 1rem;
  }
}

@media (min-width: 768px) {
  .card-content {
    padding: 1.5rem 2rem;
  }
}

.sub-tab-navigation {
  display: flex;
  gap: 0;
  margin: -1.5rem 0 1.5rem 0;
  background: var(--bg-primary, #f8fafc);
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.sub-tab-btn {
  flex: 1;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
  border-right: 1px solid var(--border-primary, #e5e7eb);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.sub-tab-btn:last-child {
  border-right: none;
}

.sub-tab-icon {
  width: 18px;
  height: 18px;
}

.sub-tab-label {
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1;
}

.sub-tab-btn.active {
  background: #3b82f6;
  color: white;
}

.sub-tab-btn:hover:not(.active) {
  background: var(--bg-tertiary, #f1f5f9);
  color: var(--text-primary, #334155);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

@media (min-width: 640px) {
  .form-row {
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
}

@media (min-width: 768px) {
  .form-row {
    flex-direction: row;
    gap: 1rem;
  }
}

.post-url-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s;
  min-width: 0;
  box-sizing: border-box;
  min-height: 44px;
}

@media (min-width: 640px) {
  .post-url-input {
    padding: 0.75rem 1rem;
  }
}

.post-url-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.report-type-select {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 0.5rem;
  background: var(--bg-primary, white);
  color: var(--text-primary, #374151);
  min-height: 44px;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.report-type-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.list-selection {
  margin-bottom: 1.5rem;
}

.list-selection h4 {
  margin: 0 0 0.75rem 0;
  color: var(--text-primary, #374151);
  font-size: 1rem;
}

.global-list-chip {
  background: #374151;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 2px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #374151;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  width: 100%;
  font-weight: 500;
}

.global-list-chip:hover {
  background: #4b5563;
  border-color: #4b5563;
}

.global-list-chip input[type="checkbox"] {
  display: none;
}

.global-list-chip:has(input:checked) {
  background: #3b82f6;
  border-color: #3b82f6;
}

.global-list-chip.disabled {
  background: #f3f4f6;
  color: #9ca3af;
  border-color: #e5e7eb;
  cursor: not-allowed;
}

.global-list-chip.disabled:hover {
  background: #f3f4f6;
  border-color: #e5e7eb;
}

.chip-text {
  flex: 1;
}

.edit-text {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
  font-weight: 500;
  margin-left: 0.5rem;
}

.edit-text:hover {
  background: #4b5563;
}

.sync-text {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
  font-weight: 500;
  margin-left: 0.5rem;
}

.sync-text:hover:not(:disabled) {
  background: #2563eb;
}

.sync-text:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.feed-chips {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.feed-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-left: 0.25rem;
}

.feed-chip {
  background: #374151;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 2px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #374151;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  font-weight: 500;
}

.feed-chip:hover {
  background: #4b5563;
  border-color: #4b5563;
}

.feed-chip input[type="checkbox"] {
  display: none;
}

.feed-chip:has(input:checked) {
  background: #3b82f6;
  border-color: #3b82f6;
}

.group-chip {
  background: #10b981;
  border-color: #10b981;
}

.group-chip:hover {
  background: #059669;
  border-color: #059669;
}

.group-chip:has(input:checked) {
  background: #047857;
  border-color: #047857;
}

.moderated-chip {
  background: #6366f1;
  border-color: #6366f1;
  flex-direction: column;
  align-items: flex-start;
}

.moderated-chip:hover {
  background: #4f46e5;
  border-color: #4f46e5;
}

.moderated-chip:has(input:checked) {
  background: #4338ca;
  border-color: #4338ca;
}

.owner-label {
  font-size: 0.6875rem;
  opacity: 0.9;
  margin-top: 0.125rem;
}

.feed-chip.disabled {
  background: #f3f4f6;
  color: #9ca3af;
  border-color: #e5e7eb;
  cursor: not-allowed;
}

.feed-chip.disabled:hover {
  background: #f3f4f6;
  border-color: #e5e7eb;
}

.no-list-text {
  font-size: 0.75rem;
  color: #9ca3af;
  font-style: italic;
}

.upgrade-notice {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #f1f5f9;
  border-radius: 8px;
  text-align: center;
  color: #374151;
  border: 1px solid #e2e8f0;
}

.ban-action {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.ban-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
  font-size: 0.875rem;
  min-height: 44px;
}

.ban-btn:hover:not(:disabled) {
  background: #dc2626;
}

.ban-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.results {
  background: var(--bg-secondary, #f8fafc);
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
}

.result-item {
  padding: 0.75rem;
  background: var(--bg-primary, white);
  border-radius: 6px;
  margin-bottom: 0.5rem;
  border-left: 4px solid var(--border-primary, #e5e7eb);
}

.result-item:last-child {
  margin-bottom: 0;
}

.results .success {
  color: #10b981;
  font-weight: 600;
}

.results .error {
  color: #ef4444;
  font-weight: 600;
}

.results .warning {
  color: #f59e0b;
  font-weight: 600;
}

.ban-details {
  margin-top: 0.25rem;
  color: #6b7280;
}

.bluesky-list-status {
  margin-top: 0.25rem;
  font-size: 0.75rem;
}

.bluesky-list-status .success {
  color: #10b981;
  font-weight: 500;
}

.bluesky-list-status .error {
  color: #ef4444;
  font-weight: 500;
}

.bluesky-list-status .warning {
  color: #f59e0b;
  font-weight: 500;
}

.list-link {
  color: #3b82f6;
  text-decoration: underline;
  font-weight: 600;
}

.list-link:hover {
  color: #2563eb;
}

.attempted-posts-btn {
  background: none;
  border: none;
  color: #3b82f6;
  text-decoration: underline;
  cursor: pointer;
  font-size: inherit;
  padding: 0;
}

.attempted-posts-btn:hover {
  color: #2563eb;
}

.info-btn {
  background: #374151;
  color: white;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  transition: all 0.2s;
}

.info-btn svg {
  width: 16px;
  height: 16px;
}

.info-btn:hover {
  background: #4b5563;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.list-filter {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-row label {
  font-weight: 500;
  color: var(--text-primary, #374151);
  white-space: nowrap;
}

.list-dropdown {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 8px;
  background: var(--bg-primary, white);
  color: var(--text-primary, #374151);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.list-dropdown:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 8px;
  background: var(--bg-primary, white);
  color: var(--text-primary, #374151);
  font-size: 0.875rem;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-input::placeholder {
  color: #9ca3af;
}

.sync-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sync-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  white-space: nowrap;
  position: relative;
}

.sync-btn:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.sync-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.sync-result {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 4px;
  font-size: 0.75rem;
}

.sync-success {
  color: #059669;
  font-weight: 500;
  display: block;
  margin-bottom: 0.25rem;
}

.sync-result small {
  color: #6b7280;
}

.sync-errors {
  margin-top: 0.25rem;
}

.sync-error {
  color: #dc2626;
  display: block;
  margin-bottom: 0.125rem;
}

.sync-btn-small {
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
}

.empty-state {
  text-align: center;
  color: #6b7280;
  padding: 2rem;
}

.banned-users-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.banned-user-item {
  position: relative;
  padding: 1rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 2px;
  border: 1px solid var(--border-primary, #e2e8f0);
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e5e7eb;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.user-display-name {
  font-weight: 600;
  color: var(--text-primary, #374151);
  font-size: 0.875rem;
}

.user-profile-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.user-avatar-small {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.user-names {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.user-display-name-large {
  font-size: 0.875rem;
  color: var(--text-primary, #374151);
  font-weight: 600;
}

.user-handle-small {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  font-weight: 400;
}

.ban-date {
  color: #6b7280;
  font-size: 0.75rem;
  text-align: right;
  white-space: nowrap;
}

.user-handle-btn {
  font-family: monospace;
  font-size: 0.75rem;
  color: #3b82f6;
  background: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 2px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.user-handle-btn:hover {
  background: #e5e7eb;
  text-decoration: underline;
}

.user-did-btn {
  font-family: monospace;
  font-size: 0.65rem;
  color: #3b82f6;
  background: var(--bg-tertiary, #f3f4f6);
  padding: 0.125rem 0.25rem;
  border-radius: 2px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-did-btn:hover {
  background: var(--bg-secondary, #e5e7eb);
  text-decoration: underline;
}

.user-id-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.copy-btn {
  background: none;
  border: none;
  width: 16px;
  height: 16px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copy-btn:hover {
  color: #374151;
  transform: scale(1.1);
}

.copy-btn svg {
  width: 100%;
  height: 100%;
}

.bluesky-icon {
  width: 16px;
  height: 16px;
  color: #0085ff;
  transition: all 0.2s;
}

.bluesky-icon:hover {
  color: #0066cc;
  transform: scale(1.1);
}

.bluesky-icon svg {
  width: 100%;
  height: 100%;
}



.feed-action-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.feed-action-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.combined-feed-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  transition: all 0.2s;
  max-width: 200px;
}

.combined-feed-btn:hover:not(:disabled) {
  background: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.unban-feed-btn {
  background: #ef4444 !important;
  color: white !important;
}

.unban-feed-btn:hover {
  background: #dc2626 !important;
}

.history-user {
  background: #3b82f6 !important;
  color: white !important;
}

.restore-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.feed-name-static {
  background: #e0e7ff;
  color: #3730a3;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-size: 0.75rem;
  font-weight: 500;
  display: inline-block;
  max-width: 200px;
}

.history-feed {
  background: #f3f4f6 !important;
  color: #6b7280 !important;
}

.ban-reason {
  color: #ef4444;
  font-size: 0.75rem;
  font-style: italic;
}

.report-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
  margin-top: 0.25rem;
}

.ban-method {
  font-size: 0.75rem;
  color: #6b7280;
}

.no-reports {
  color: #9ca3af;
  font-size: 0.75rem;
  font-style: italic;
}

.reports-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.report-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-weight: 500;
  margin-right: 0.25rem;
  margin-bottom: 0.25rem;
  display: inline-block;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.report-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.report-badge.source-app {
  background: #3b82f6;
  color: white;
}

.report-badge.source-communal {
  background: #10b981;
  color: white;
}

.report-badge.source-ozone {
  background: #8b5cf6;
  color: white;
}

.consolidated-bans {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.ban-method-group {
  border: 1px solid var(--border-primary, #e5e7eb);
  border-radius: 6px;
  padding: 0.75rem;
  background: var(--bg-tertiary, #f8fafc);
}

.ban-method-header {
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.ban-method-label {
  font-size: 0.875rem;
  color: var(--text-primary, #374151);
  font-weight: 500;
}

.banned-feeds {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feed-ban-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.feed-ban-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.retry-sync-btn {
  background: #f59e0b;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.retry-sync-btn:hover {
  background: #d97706;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.sync-failed-notice {
  color: #dc2626;
  font-size: 0.75rem;
  font-weight: 500;
  font-style: italic;
}

.trending-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.trending-item {
  background: var(--bg-secondary, #f8fafc);
  border-radius: 2px;
  padding: 1rem;
  border: 1px solid var(--border-primary, #e2e8f0);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.trending-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.trending-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

.trending-user-profile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.trending-user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e5e7eb;
}

.trending-user-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.trending-user-display-name {
  font-weight: 600;
  color: var(--text-primary, #374151);
  font-size: 0.875rem;
}

.user-handle {
  font-weight: 600;
  color: var(--text-primary, #374151);
}

.trending-stats {
  display: flex;
  gap: 0.5rem;
}

.velocity {
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-size: 0.75rem;
  font-weight: 500;
}

.removers {
  background: #10b981;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-size: 0.75rem;
  font-weight: 500;
}

.threshold-proximity {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.global-thresholds {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.threshold-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  font-weight: 600;
}

.threshold-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.threshold-type {
  color: var(--text-secondary, #6b7280);
  font-weight: 500;
}

.threshold-count {
  background: var(--bg-tertiary, #f3f4f6);
  color: var(--text-primary, #374151);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-weight: 600;
}

.threshold-count-dual {
  font-size: 0.75rem;
  line-height: 1.3;
  white-space: normal;
  max-width: 180px;
  text-align: center;
  padding: 0.25rem 0.375rem;
}

.feed-threshold-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.threshold-display {
  display: flex;
  align-items: center;
  gap: 6px;
}

.threshold-plus-btn {
  background: #6b7280;
  color: white;
  border: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.threshold-plus-btn:hover {
  background: #4b5563;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 900px;
  width: 95%;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  color: #374151;
}

.modal-body {
  padding: 1.5rem;
}

.threshold-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #374151);
}

.communal-explanation {
  margin: 1.5rem 0;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.communal-explanation h5 {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.explanation-section {
  margin-bottom: 1rem;
}

.explanation-section:last-child {
  margin-bottom: 0;
}

.explanation-section strong {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.explanation-section ul,
.explanation-section ol {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.75rem;
  color: #4b5563;
  line-height: 1.4;
}

.explanation-section li {
  margin-bottom: 0.25rem;
}

.explanation-section li:last-child {
  margin-bottom: 0;
}

.explanation-section li strong {
  display: inline;
  margin: 0;
  font-size: inherit;
  text-transform: none;
  letter-spacing: normal;
  color: #1f2937;
}

.threshold-config {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: #f8fafc;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.config-label {
  font-weight: 600;
  color: #6b7280;
}

.config-item {
  font-size: 0.75rem;
  color: var(--text-primary, #374151);
  background: var(--bg-primary, white);
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  border: 1px solid var(--border-primary, #d1d5db);
}

.threshold-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.threshold-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.category-header {
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 1rem 0 0.5rem 0;
  padding-bottom: 0.25rem;
  border-bottom: 2px solid #e5e7eb;
  text-transform: capitalize;
}

.category-header:first-child {
  margin-top: 0;
}

.threshold-type-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #374151);
  min-width: 100px;
  text-transform: capitalize;
}

.feed-name {
  background: #6b7280;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-weight: 500;
  font-size: 0.875rem;
}

.trending-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.status-badge {
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.removed {
  background: #6b7280;
  color: white;
}

.status-badge.hidden {
  background: #6b7280;
  color: white;
}

.time-span {
  color: #6b7280;
  font-size: 0.75rem;
}

.trending-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.trending-btn {
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.remove-trending-btn {
  background: #ef4444;
  color: white;
}

.remove-trending-btn:hover {
  background: #dc2626;
}

.hide-trending-btn {
  background: #6b7280;
  color: white;
}

.hide-trending-btn:hover {
  background: #4b5563;
}

.feed-status-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.feed-status-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.feed-status-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

.feed-status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.feed-status-chip {
  padding: 0.125rem 0.375rem;
  border-radius: 2px;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  cursor: default;
}

.feed-status-chip.removed {
  background: #ef4444;
  color: white;
}

.feed-status-chip.exists {
  background: #10b981;
  color: white;
}

.feed-status-chip.clickable {
  cursor: pointer;
  transition: all 0.2s;
}

.feed-status-chip.clickable:hover {
  background: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);
}

.no-feeds {
  color: #9ca3af;
  font-size: 0.75rem;
  font-style: italic;
}

.remove-all-feeds-btn {
  background: #dc2626;
  color: white;
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 2px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.5rem;
  transition: all 0.2s;
}

.remove-all-feeds-btn:hover {
  background: #b91c1c;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);
}

.hide-trending-btn-inline {
  background: #6b7280;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
}

.hide-trending-btn-inline:hover {
  background: #4b5563;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(107, 114, 128, 0.3);
}

.header-right {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.timestamp-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.right-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.status-badges {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.threshold-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  font-size: 0.75rem;
}

.threshold-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.threshold-line.primary {
  color: #374151;
  font-weight: 600;
}

.threshold-line.secondary {
  color: #059669;
  font-weight: 500;
}

.threshold-line.tertiary {
  color: #6b7280;
  font-weight: 500;
}

.threshold-bars {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.threshold-bar {
  position: relative;
  height: 20px;
  width: 60px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 50%, #dc2626 100%);
  transition: width 0.3s ease;
}

.bar-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.6rem;
  font-weight: 600;
  color: #374151;
  font-family: monospace;
  text-shadow: 0 0 2px rgba(255,255,255,0.8);
}

/* Feed Modal Styles */
.feed-modal-content {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  width: 95%;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid #e5e7eb;
}

.feed-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem 1rem 2rem;
  border-bottom: 1px solid #f1f5f9;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.feed-modal-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.feed-modal-icon {
  width: 24px;
  height: 24px;
  color: #3b82f6;
}

.feed-modal-header h3 {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 600;
  color: #1e293b;
}

.feed-modal-close {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  font-size: 1.25rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0.5rem;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s;
}

.feed-modal-close:hover {
  background: #e5e7eb;
  color: #374151;
  transform: scale(1.05);
}

.feed-modal-body {
  padding: 2rem;
}

.feed-info-card {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.feed-info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.feed-info-header h4 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e40af;
}

.feed-id {
  font-family: monospace;
  font-size: 0.75rem;
  color: #6b7280;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #d1d5db;
}

.feed-description {
  margin: 0;
  color: #1e40af;
  font-size: 0.875rem;
  opacity: 0.8;
}

.form-section {
  margin-bottom: 1.5rem;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.label-icon {
  width: 16px;
  height: 16px;
  color: #6b7280;
}

.form-input {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s;
  background: white;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  background: #fefefe;
}

.form-input::placeholder {
  color: #9ca3af;
}

.form-help {
  display: block;
  margin-top: 0.5rem;
  color: #6b7280;
  font-size: 0.75rem;
  line-height: 1.4;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #f1f5f9;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 2px solid #d1d5db;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  transform: translateY(-1px);
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.list-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.view-text {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
  font-weight: 500;
}

.view-text:hover {
  background: #2563eb;
}

.view-text-spacer {
  width: 42px;
  height: 28px;
}

/* View Modal Styles */
.view-modal-content {
  background: white;
  border-radius: 12px;
  max-width: 700px;
  width: 95%;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid #e5e7eb;
}

.view-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem 1rem 2rem;
  border-bottom: 1px solid #f1f5f9;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
}

.view-modal-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.view-modal-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.bluesky-header-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #0085ff;
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 2px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.bluesky-header-btn:hover {
  background: #0066cc;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 133, 255, 0.3);
}

.bluesky-header-btn svg {
  width: 16px;
  height: 16px;
}

.bluesky-list-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #0085ff;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.bluesky-list-link:hover {
  color: #0066cc;
  text-decoration: underline;
}

.bluesky-list-link svg {
  width: 16px;
  height: 16px;
}

.view-modal-icon {
  width: 24px;
  height: 24px;
  color: #3b82f6;
}

.view-modal-header h3 {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 600;
  color: #1e293b;
}

.view-modal-close {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  font-size: 1.25rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0.5rem;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s;
}

.view-modal-close:hover {
  background: #e5e7eb;
  color: #374151;
}

.view-modal-body {
  padding: 2rem;
}

.list-info {
  margin-bottom: 1.5rem;
}

.list-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.list-info p {
  margin: 0;
  font-size: 1.125rem;
  color: #374151;
}

.bluesky-list-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #0085ff;
  color: white;
  text-decoration: none;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.bluesky-list-btn:hover {
  background: #0066cc;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 133, 255, 0.3);
}

.bluesky-list-btn svg {
  width: 16px;
  height: 16px;
}

.bluesky-button-prominent {
  display: flex;
  justify-content: center;
  margin: 1rem 0;
}

.bluesky-list-btn-large {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #0085ff;
  color: white;
  text-decoration: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(0, 133, 255, 0.3);
}

.bluesky-list-btn-large:hover {
  background: #0066cc;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 133, 255, 0.4);
}

.bluesky-list-btn-large svg {
  width: 20px;
  height: 20px;
}

.list-info small {
  color: #6b7280;
  font-style: italic;
}

.empty-list {
  text-align: center;
  color: #6b7280;
  padding: 2rem;
}

.ban-list-users {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
}

.ban-list-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 8px;
  border: 1px solid var(--border-primary, #e2e8f0);
}

.user-details {
  flex: 1;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.user-avatar-container {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.user-avatar-tiny {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #e5e7eb;
}

.user-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #6b7280;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  border: 1px solid #e5e7eb;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.user-name {
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
}

.user-handle {
  font-size: 0.75rem;
  color: #6b7280;
}

.ban-info {
  text-align: right;
}

.ban-date {
  color: #6b7280;
  font-size: 0.75rem;
}

.modal-search-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  margin-top: 0.75rem;
  transition: all 0.2s;
}

.modal-search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal-search-input::placeholder {
  color: #9ca3af;
}
</style>