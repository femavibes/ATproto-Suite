<template>
  <div class="remove-tab">
    <!-- Sub-tab Navigation -->
    <div class="sub-tab-navigation">
      <button 
        @click="activeSubTab = 'remove'" 
        :class="{ active: activeSubTab === 'remove' }"
        class="sub-tab-btn"
      >
        <svg class="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"/>
          <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
        <span class="sub-tab-label">Remove</span>
      </button>
      <button 
        @click="activeSubTab = 'history'" 
        :class="{ active: activeSubTab === 'history' }"
        class="sub-tab-btn"
      >
        <svg class="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v5h5"/>
          <path d="M6 17a9 9 0 0 1 9-9 9 9 0 0 1 9 9"/>
          <path d="M12 12l4 4"/>
        </svg>
        <span class="sub-tab-label">History</span>
      </button>
      <button 
        @click="activeSubTab = 'trending'" 
        :class="{ active: activeSubTab === 'trending' }"
        class="sub-tab-btn"
      >
        <svg class="sub-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span class="sub-tab-label">Trending</span>
      </button>
    </div>
    
    <!-- Remove Posts Sub-tab -->
    <div v-if="activeSubTab === 'remove'" class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-left">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
            <h3>Remove Posts</h3>
          </div>
          <button @click="showInfoModal = true" class="info-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </button>
        </div>
        <p class="card-description">Manually remove specific posts from your feeds</p>
      </div>
      <div class="card-content">
        <!-- Removal Mode Toggle -->
        <div class="removal-mode-toggle">
          <button 
            @click="removalMode = 'single'" 
            :class="{ active: removalMode === 'single' }"
            class="mode-btn"
          >
            Single Post
          </button>
          <button 
            @click="removalMode = 'bulk'" 
            :class="{ active: removalMode === 'bulk' }"
            class="mode-btn"
          >
            Bulk by User
          </button>
        </div>

        <!-- Single Post Removal -->
        <div v-if="removalMode === 'single'">
          <div class="form-row">
            <input 
              v-model="form.postUrl" 
              type="text" 
              placeholder="https://bsky.app/profile/user/post/abc123"
              class="post-url-input"
            >
          </div>
        
        <div class="form-row">
          <select v-model="form.reportType" class="report-type-select">
            <optgroup v-for="(category, categoryKey) in reportTypes" :key="categoryKey" :label="category.name">
              <option v-for="(subName, subKey) in category.subcategories" :key="subKey" :value="subKey">
                {{ subName }}
              </option>
            </optgroup>
          </select>
        </div>
        
        <div class="feed-selection">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.removeFromAll">
            <span>All Feeds on Account</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.removeFromConfigured">
            <span>All Configured Feeds</span>
          </label>
          <div v-if="!form.removeFromAll" class="feed-chips">
            <div v-if="form.removeFromConfigured" class="selected-preview">
              <div class="feed-section">
                <div class="section-label">Auto-Selected Feeds:</div>
                <label v-for="feed in feeds" :key="feed.id" class="feed-chip auto-selected">
                  <input 
                    type="checkbox" 
                    :value="feed.feed_id" 
                    checked
                    disabled
                  >
                  <span>{{ feed.feed_name }}</span>
                </label>
              </div>
            </div>
            <div v-if="feeds.length > 0 && !form.removeFromConfigured" class="feed-section">
              <div class="section-label">My Feeds:</div>
              <label v-for="feed in feeds" :key="feed.id" class="feed-chip">
                <input 
                  type="checkbox" 
                  :value="feed.feed_id" 
                  v-model="form.selectedFeeds"
                >
                <span>{{ feed.feed_name }}</span>
              </label>
            </div>
            <div v-if="ownedGroups.length > 0" class="feed-section">
              <div class="section-label">{{ form.removeFromConfigured ? 'Additional Groups:' : 'My Groups:' }}</div>
              <label v-for="group in ownedGroups" :key="'owned-' + group.id" class="feed-chip group-chip">
                <input 
                  type="checkbox" 
                  :value="group.group_name" 
                  v-model="form.selectedFeeds"
                >
                <span>📁 {{ group.group_name }} ({{ group.feed_count }} feeds)</span>
              </label>
            </div>
            <div v-if="moderatedGroups.length > 0" class="feed-section">
              <div class="section-label">{{ form.removeFromConfigured ? 'Additional Moderated Groups:' : 'Groups I Moderate:' }}</div>
              <label v-for="group in moderatedGroups" :key="'mod-' + group.id" class="feed-chip moderated-chip">
                <input 
                  type="checkbox" 
                  :value="group.group_name" 
                  v-model="form.selectedFeeds"
                >
                <span>👤 {{ group.group_name }} ({{ group.feed_count }} feeds)</span>
                <small class="owner-label">Owner: {{ group.owner_handle }}</small>
              </label>
            </div>
          </div>
        </div>
        
          <div class="remove-action">
            <button 
              @click="removePost" 
              :disabled="!canRemovePost || processing"
              class="remove-btn"
            >
              {{ processing ? 'Removing...' : 'Remove Post' }}
            </button>
          </div>
        </div>

        <!-- Bulk User Removal -->
        <div v-if="removalMode === 'bulk'">
          <div class="form-row">
            <input 
              v-model="bulkForm.userHandle" 
              type="text" 
              placeholder="@username.bsky.social"
              class="post-url-input"
            >
          </div>

          <div class="form-row">
            <div class="bulk-count-container">
              <select v-model="bulkForm.postCount" class="report-type-select">
                <option value="25">25 posts</option>
                <option value="50">50 posts</option>
                <option value="100">100 posts</option>
              </select>
              <button @click="showInfoModal = true" class="info-btn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="bulk-limits-toggle">
            <button @click="showBulkLimits = !showBulkLimits" class="limits-toggle-btn">
              {{ showBulkLimits ? '▼' : '▶' }} Monthly Limits
            </button>
            <div v-if="showBulkLimits" class="limits-display">
              <span class="limit-item">25: {{ backfillLimits?.['25']?.remaining || 20 }}/20</span>
              <span class="limit-item">50: {{ backfillLimits?.['50']?.remaining || 10 }}/10</span>
              <span class="limit-item">100: {{ backfillLimits?.['100']?.remaining || 5 }}/5</span>
            </div>
          </div>

          <div class="feed-selection">
            <label class="checkbox-label">
              <input type="checkbox" v-model="bulkForm.removeFromAll">
              <span>All Feeds on Account</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="bulkForm.removeFromConfigured">
              <span>All Configured Feeds</span>
            </label>
            <div v-if="!bulkForm.removeFromAll" class="feed-chips">
              <div v-if="bulkForm.removeFromConfigured" class="selected-preview">
                <div class="feed-section">
                  <div class="section-label">Auto-Selected Feeds:</div>
                  <label v-for="feed in feeds" :key="feed.id" class="feed-chip auto-selected">
                    <input 
                      type="checkbox" 
                      :value="feed.feed_id" 
                      checked
                      disabled
                    >
                    <span>{{ feed.feed_name }}</span>
                  </label>
                </div>
              </div>
              <div v-if="feeds.length > 0 && !bulkForm.removeFromConfigured" class="feed-section">
                <div class="section-label">My Feeds:</div>
                <label v-for="feed in feeds" :key="feed.id" class="feed-chip">
                  <input 
                    type="checkbox" 
                    :value="feed.feed_id" 
                    v-model="bulkForm.selectedFeeds"
                  >
                  <span>{{ feed.feed_name }}</span>
                </label>
              </div>
              <div v-if="ownedGroups.length > 0" class="feed-section">
                <div class="section-label">{{ bulkForm.removeFromConfigured ? 'Additional Groups:' : 'My Groups:' }}</div>
                <label v-for="group in ownedGroups" :key="'owned-' + group.id" class="feed-chip group-chip">
                  <input 
                    type="checkbox" 
                    :value="group.group_name" 
                    v-model="bulkForm.selectedFeeds"
                  >
                  <span>📁 {{ group.group_name }} ({{ group.feed_count }} feeds)</span>
                </label>
              </div>
              <div v-if="moderatedGroups.length > 0" class="feed-section">
                <div class="section-label">{{ bulkForm.removeFromConfigured ? 'Additional Moderated Groups:' : 'Groups I Moderate:' }}</div>
                <label v-for="group in moderatedGroups" :key="'mod-' + group.id" class="feed-chip moderated-chip">
                  <input 
                    type="checkbox" 
                    :value="group.group_name" 
                    v-model="bulkForm.selectedFeeds"
                  >
                  <span>👤 {{ group.group_name }} ({{ group.feed_count }} feeds)</span>
                  <small class="owner-label">Owner: {{ group.owner_handle }}</small>
                </label>
              </div>
            </div>
          </div>

          <div class="remove-action">
            <button 
              @click="handleBulkRemoval" 
              :disabled="!canBulkRemove || processing"
              class="remove-btn"
            >
              {{ processing ? 'Removing...' : 'Remove Posts by User' }}
            </button>
          </div>
        </div>
        
        <div v-if="results.length > 0" class="results">
          <div v-for="(result, idx) in results" :key="idx" class="result-item">
            <span :class="result.success ? 'success' : 'error'">
              {{ result.feedName || (result.feedId === 'all' ? 'All feeds' : getFeedName(result.feedId)) }}
              {{ result.success ? '✓ ' + (result.postsProcessed ? `Removed ${result.removalsAttempted} posts (${result.postsProcessed} processed) via POST https://api.graze.social/app/hide_post` : `Removed via POST https://api.graze.social/app/hide_post${result.feedId !== 'all' ? ' {"algo_id": ' + result.feedId + '}' : ''}`) : '✗ ' + result.error }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Recent Removals Sub-tab -->
    <div v-if="activeSubTab === 'history'" class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-left">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v5h5"/>
              <path d="M6 17a9 9 0 0 1 9-9 9 9 0 0 1 9 9"/>
              <path d="M12 12l4 4"/>
            </svg>
            <h3>Recent Removals</h3>
          </div>
        </div>
        <p class="card-description">Your recent post removal history</p>
      </div>
      <div class="card-content">
        <div class="search-filter">
          <div class="filter-row">
            <label>Search removals:</label>
            <input v-model="searchQuery" type="text" placeholder="Search by post content, author, or handle..." class="search-input">
          </div>
        </div>
        
        <div v-if="userActivity.length === 0" class="empty-state">
          <p>No removal history yet.</p>
        </div>
        <div v-else-if="filteredUserActivity.length === 0" class="empty-state">
          <p>No removals match your search.</p>
        </div>
        <div v-else class="activity-list">
          <div v-for="activity in filteredUserActivity" :key="activity.id" class="activity-item">
            <div class="activity-details">
              <div class="activity-header">
                <div class="activity-header-line">
                  <div class="post-id-section">
                    <button v-if="activity.post_uri" @click="$emit('show-post-history', activity.post_uri, activity.feed_id)" class="post-id-btn">{{ activity.post_uri.split('/').pop() }}</button>
                    <span v-else-if="activity.target_handle" class="bulk-action-label">Bulk Action</span>
                    <a v-if="activity.post_uri" :href="convertUriToUrl(activity.post_uri)" target="_blank" class="bluesky-icon" title="View on Bluesky">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 17L17 7M17 7H7M17 7V17"/>
                      </svg>
                    </a>
                    <a v-else-if="activity.target_handle" :href="`https://bsky.app/profile/${activity.target_handle}`" target="_blank" class="bluesky-icon" title="View profile on Bluesky">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 17L17 7M17 7H7M17 7V17"/>
                      </svg>
                    </a>
                  </div>
                  <div class="activity-center">
                    <span v-if="hasAnyRestoredFeeds(activity)" class="restoration-indicator" title="Some feeds have been restored">↻</span>
                  </div>
                  <span class="activity-time">{{ formatTime(activity.created_at) }}</span>
                </div>
              </div>
              <div v-if="getActivityAuthor(activity)" class="user-profile-info">
                <img v-if="getActivityAuthor(activity).avatar" :src="getActivityAuthor(activity).avatar" class="user-avatar-small">
                <div class="user-names">
                  <div v-if="getActivityAuthor(activity).displayName" class="user-display-name-large">{{ getActivityAuthor(activity).displayName }}</div>
                  <div class="user-handle-small">@{{ getActivityAuthor(activity).handle }}</div>
                </div>
              </div>
              <div v-if="activity.post_details && activity.post_details.text" class="post-preview">
                <div class="post-text">{{ activity.post_details.text }}</div>
              </div>
              <div class="removal-info">
                <div class="removal-action-container">
                  <span class="removal-action-label">Removed from:</span>
                  <div class="feed-list">
                    <template v-for="feed in activity.feeds" :key="feed.feed_id">
                      <div class="feed-removal-item">
                        <template v-if="canShowReverseButtons(activity)">
                          <button 
                            @click="isPostProtectedInFeed(activity, feed.feed_id) ? null : $emit('show-restore-confirm', { ...activity, feed_id: feed.feed_id, feed_name: feed.feed_name })"
                            class="combined-feed-btn"
                            :class="{ 'protected': isPostProtectedInFeed(activity, feed.feed_id) }"
                            :disabled="isPostProtectedInFeed(activity, feed.feed_id)"
                          >
                            {{ feed.feed_name || getFeedName(feed.feed_id) || 'All feeds' }}
                            <svg v-if="!isPostProtectedInFeed(activity, feed.feed_id)" class="restore-icon" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                            </svg>
                            <svg v-if="isPostProtectedInFeed(activity, feed.feed_id)" @click.stop="$emit('show-protection-info')" class="protection-icon-inline" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10.1V11.1C15.4,11.4 16,12 16,12.8V16.2C16,17.1 15.1,18 14.2,18H9.8C8.9,18 8,17.1 8,16.2V12.8C8,12 8.6,11.4 9.2,11.1V10.1C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.5,8.7 10.5,10.1V11.1H13.5V10.1C13.5,8.7 12.8,8.2 12,8.2Z"/>
                            </svg>
                          </button>
                        </template>
                        <template v-else>
                          <button 
                            @click="$emit('show-reverse-info')"
                            class="removal-feed-name-btn"
                            title="Why can't I reverse this?"
                          >
                            {{ feed.feed_name || getFeedName(feed.feed_id) || 'All feeds' }}
                            <svg class="info-icon-small" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                            </svg>
                          </button>
                        </template>
                        <span class="removal-method">via <strong>{{ formatActivityActionPlain(feed.action, feed.reason) }}</strong></span>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
              <div v-if="activity.post_reports && activity.post_reports.length > 0" class="report-sources">
                <span class="reports-label">Reports:</span>
                <button v-for="report in groupReports(activity.post_reports)" :key="report.key" @click="$emit('show-post-reports', activity.post_uri)" class="report-badge" :class="'source-' + report.source">
                  {{ report.source.charAt(0).toUpperCase() + report.source.slice(1) }}: {{ report.report_type }}{{ report.count > 1 ? ` (${report.count})` : '' }}
                </button>
              </div>
            </div>
            <div class="activity-actions">
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Trending Removals Sub-tab -->
    <div v-if="activeSubTab === 'trending'" class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="card-title-left">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <h3>Trending Removals</h3>
          </div>
        </div>
        <p class="card-description">Posts being removed by multiple users</p>
      </div>
      <div class="card-content">
        <TrendingControls 
          v-model:timeframe="trendingTimeframe"
          v-model:showHidden="showHiddenTrending"
          v-model:showRemoved="showRemovedTrending"
          v-model:sortBy="trendingSortBy"
          rateLabel="Removals/day"
          totalLabel="Total removers"
          @update:timeframe="loadTrendingRemovals"
          @update:showHidden="loadTrendingRemovals"
          @update:showRemoved="loadTrendingRemovals"
          @update:sortBy="loadTrendingRemovals"
        />
        
        <div v-if="trendingRemovals.length === 0" class="empty-state">
          <p>No trending removals found.</p>
        </div>
        <div v-else class="trending-list">
          <div v-for="post in trendingRemovals" :key="post.post_uri" class="trending-item">
            <div class="trending-details">
              <div class="trending-header">
                <div class="post-id-section">
                  <button @click="$emit('show-post-history', post.post_uri, null)" class="post-id-btn">
                    {{ post.post_uri.split('/').pop() }}
                  </button>
                  <a :href="convertUriToUrl(post.post_uri)" target="_blank" class="bluesky-icon" title="View on Bluesky">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M7 17L17 7M17 7H7M17 7V17"/>
                    </svg>
                  </a>
                </div>
                <div class="header-right">
                  <div class="timestamp-section">
                    <small class="removal-date">{{ formatDate(post.first_removal) }}</small>
                    <small class="removal-date">{{ formatDate(post.last_removal) }}</small>
                  </div>
                  <div class="right-actions">
                    <span v-if="post.is_hidden" class="status-badge hidden">Hidden</span>
                    <button 
                      v-if="!post.is_hidden"
                      @click="hideTrendingPost(post.post_uri)"
                      class="hide-trending-btn-inline"
                      title="Hide this trending post"
                    >
                      Hide
                    </button>
                    <span v-if="isFullyRemoved(post)" class="status-badge removed">Removed</span>
                  </div>
                </div>
              </div>
              <div v-if="post.post_details" class="post-preview">
                <div class="post-author" v-if="post.post_details.author">
                  <img v-if="post.post_details.author.avatar" :src="post.post_details.author.avatar" class="author-avatar">
                  <div class="author-info">
                    <div class="author-name">{{ post.post_details.author.displayName || post.post_details.author.handle }}</div>
                    <div class="author-handle">@{{ post.post_details.author.handle }}</div>
                  </div>
                </div>
                <div class="post-text">{{ post.post_details.text }}</div>
              </div>
              <div class="trending-stats">
                <span class="velocity">{{ post.velocity.toFixed(1) }}/day</span>
                <span class="removers">{{ post.unique_removers }} users</span>
              </div>
              <div class="threshold-proximity">
                <div class="global-thresholds">
                  <span class="threshold-label">Global:</span>
                  <div class="threshold-display">
                    <span v-html="getClosestThresholdDisplayHTML(post)"></span>
                    <button @click="showThresholdDetails(post.post_uri, 'global')" class="threshold-plus-btn">+</button>
                  </div>
                </div>
                <div v-for="feed in feeds" :key="feed.id" class="feed-threshold-row">
                  <span class="threshold-label">{{ feed.feed_name }}:</span>
                  <div class="threshold-display">
                    <span v-html="getClosestThresholdDisplayHTML(post, feed)"></span>
                    <button @click="showThresholdDetails(post.post_uri, feed.feed_id)" class="threshold-plus-btn">+</button>
                  </div>
                </div>
              </div>
              <div class="trending-status">
                <div v-if="post.feed_status" class="feed-status-container">
                  <div class="feed-status-section">
                    <span class="feed-status-label">Removed from:</span>
                    <div class="feed-status-chips">
                      <span v-for="feedId in post.feed_status.removed_from" :key="feedId" class="feed-status-chip removed">
                        {{ getFeedName(feedId) }}
                      </span>
                      <span v-if="post.feed_status.removed_from.length === 0" class="no-feeds">None</span>
                    </div>
                  </div>
                  <div v-if="post.feed_status.exists_on.length > 0" class="feed-status-section">
                    <span class="feed-status-label">Still exists on:</span>
                    <div class="feed-status-chips">
                      <button 
                        v-for="feedId in post.feed_status.exists_on" 
                        :key="feedId" 
                        @click="confirmRemoveFromFeed(post.post_uri, feedId)"
                        class="feed-status-chip exists clickable"
                        title="Click to remove from this feed"
                      >
                        {{ getFeedName(feedId) }} ✕
                      </button>
                    </div>
                    <button 
                      @click="confirmRemoveFromAllFeeds(post.post_uri)"
                      class="remove-all-feeds-btn"
                      title="Remove from all remaining feeds"
                    >
                      Remove from All Feeds
                    </button>
                  </div>
                </div>

              </div>
            </div>
            <div class="trending-actions">
              <!-- Actions moved to feed status section -->
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Info Modal -->
    <div v-if="showInfoModal" class="modal-overlay" @click="closeInfoModal">
      <div class="info-modal" @click.stop>
        <div class="info-header">
          <h3>Remove Posts</h3>
          <button @click="closeInfoModal" class="modal-close">×</button>
        </div>
        <div class="info-body">
          <div class="info-section">
            <h4>Single Post Removal</h4>
            <p>Remove individual posts by pasting Bluesky post URLs. Posts are removed from your selected feeds only.</p>
          </div>
          <div class="info-section">
            <h4>Bulk User Removal</h4>
            <p>Quickly remove up to 100 posts from any user from your feeds! Great for spam removal. We poll the Bluesky API for the user's last posts and send a removal request. We don't validate if the posts actually exist on any of your feeds, but if they do, they'll be removed. Currently we don't have a way to view a list of posts from a specific feed by a specific user, but assuming you use this feature in a reasonable timeframe, it should work extremely well--unless the spammer posts hundreds of posts an hour. Banning that user of course will remove all of their posts from your feeds too, but the cached lists can make this take quite a bit of time, 10+ minutes sometimes, so this feature is pretty useful.</p>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import axios from 'axios'
import TrendingControls from '../shared/TrendingControls.vue'

interface Feed {
  id: number
  feed_id: string
  feed_name: string
}

interface Activity {
  id: number
  post_uri: string
  feed_id: string
  feed_name?: string
  action: string
  reason?: string
  created_at: string
  target_handle?: string
  target_display_name?: string
  target_avatar?: string
  post_details?: any
  post_reports?: any[]
  protected_feeds?: any[]
}

interface BulkRemovalResult {
  success: boolean
  userHandle?: string
  postsProcessed?: number
  removalsAttempted?: number
  error?: string
}

interface TrendingPost {
  post_uri: string
  velocity: number
  unique_removers: number
  is_hidden: boolean
  already_removed: boolean
  first_removal: string
  last_removal: string
  post_details?: any
  feed_status?: {
    removed_from: string[]
    exists_on: string[]
  }
}

const props = defineProps<{
  feeds: Feed[]
  reportTypes: any
  userActivity: Activity[]
  trendingRemovals: TrendingPost[]
  globalSettings?: any
  backfillLimits?: any
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
  'show-post-history': [postUri: string, feedId: string | null]
  'show-restore-confirm': [activity: Activity]
  'show-protection-info': []
  'show-reverse-info': []
  'show-post-reports': [postUri: string]
  'post-removed': []
  'trending-updated': []
}>()

const activeSubTab = ref('remove')
const removalMode = ref('single')
const showBulkLimits = ref(false)
const searchQuery = ref('')
const userProfiles = ref({})
const form = ref({
  postUrl: '',
  reportType: 'other',
  removeFromAll: false,
  removeFromConfigured: false,
  selectedFeeds: []
})
const bulkForm = ref({
  userHandle: '',
  postCount: '25',
  removeFromAll: false,
  removeFromConfigured: false,
  selectedFeeds: []
})
const processing = ref(false)
const results = ref([])
const trendingTimeframe = ref('7d')
const showHiddenTrending = ref(false)
const showRemovedTrending = ref(false)
const trendingSortBy = ref('rate')
const expandedThresholds = ref({})
const showModal = ref(false)
const modalData = ref({ item: null, feed: null })
const showInfoModal = ref(false)
const ownedGroups = ref<FeedGroup[]>([])
const moderatedGroups = ref<ModeratedGroup[]>([])

const canRemovePost = computed(() => {
  return form.value.postUrl && 
    (form.value.removeFromAll || form.value.removeFromConfigured || form.value.selectedFeeds.length > 0)
})

const canBulkRemove = computed(() => {
  return bulkForm.value.userHandle && 
    (bulkForm.value.removeFromAll || bulkForm.value.removeFromConfigured || bulkForm.value.selectedFeeds.length > 0)
})

// Load groups on mount
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

const groupedUserActivity = computed(() => {
  const grouped = new Map()
  
  props.userActivity.forEach(activity => {
    const key = activity.post_uri || activity.target_handle || activity.id
    
    if (grouped.has(key)) {
      grouped.get(key).feeds.push({
        feed_id: activity.feed_id,
        feed_name: activity.feed_name,
        action: activity.action,
        reason: activity.reason,
        created_at: activity.created_at,
        protected_feeds: activity.protected_feeds
      })
    } else {
      grouped.set(key, {
        ...activity,
        feeds: [{
          feed_id: activity.feed_id,
          feed_name: activity.feed_name,
          action: activity.action,
          reason: activity.reason,
          created_at: activity.created_at,
          protected_feeds: activity.protected_feeds
        }]
      })
    }
  })
  
  return Array.from(grouped.values()).sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
})

const filteredUserActivity = computed(() => {
  if (!searchQuery.value.trim()) {
    return groupedUserActivity.value
  }
  
  const query = searchQuery.value.toLowerCase()
  return groupedUserActivity.value.filter(activity => {
    // Search by post URI
    if (activity.post_uri && activity.post_uri.toLowerCase().includes(query)) {
      return true
    }
    
    // Search by target handle
    if (activity.target_handle && activity.target_handle.toLowerCase().includes(query)) {
      return true
    }
    
    // Search by post content
    if (activity.post_details && activity.post_details.text && 
        activity.post_details.text.toLowerCase().includes(query)) {
      return true
    }
    
    // Search by author handle or display name
    if (activity.post_details && activity.post_details.author) {
      const author = activity.post_details.author
      if (author.handle && author.handle.toLowerCase().includes(query)) {
        return true
      }
      if (author.displayName && author.displayName.toLowerCase().includes(query)) {
        return true
      }
    }
    
    return false
  })
})

const getActivityAuthor = (activity: Activity) => {
  // For regular post removals, use post_details.author
  if (activity.post_details && activity.post_details.author) {
    return activity.post_details.author
  }
  
  // For backfill removals, use target profile data from database
  if (activity.target_handle) {
    return {
      handle: activity.target_handle,
      displayName: activity.target_display_name || activity.target_handle,
      avatar: activity.target_avatar || null
    }
  }
  
  return null
}

const removePost = async () => {
  processing.value = true
  results.value = []
  
  try {
    const postUri = form.value.postUrl
    let feedIds
    
    if (form.value.removeFromAll) {
      feedIds = ['all']
    } else if (form.value.removeFromConfigured) {
      // Get only configured feed IDs, plus any manually selected groups
      feedIds = [
        ...props.feeds.map(f => f.feed_id),
        ...form.value.selectedFeeds.filter(id => 
          ownedGroups.value.some(g => g.group_name === id) || 
          moderatedGroups.value.some(g => g.group_name === id)
        )
      ]
    } else {
      feedIds = form.value.selectedFeeds
    }
    
    console.log('API Call: POST /api/moderation/remove-post')
    console.log('Request payload:', { postUri, feedIds, reportType: form.value.reportType })
    
    const response = await axios.post('/api/moderation/remove-post', {
      postUri,
      feedIds,
      reportType: form.value.reportType
    })
    
    console.log('API Response:', response.data)
    results.value = response.data.results
    
    if (response.data.results.every(r => r.success)) {
      form.value.postUrl = ''
      form.value.removeFromAll = false
      form.value.removeFromConfigured = false
      form.value.selectedFeeds = []
      emit('post-removed')
    }
    
  } catch (error) {
    console.error('Failed to remove post:', error)
    alert('✗ Failed POST https://api.graze.social/app/hide_post. Check console for details.')
  } finally {
    processing.value = false
  }
}

const handleBulkRemoval = async () => {
  processing.value = true
  results.value = []
  
  try {
    const userHandle = bulkForm.value.userHandle.replace('@', '')
    let feedIds
    
    if (bulkForm.value.removeFromAll) {
      feedIds = ['all']
    } else if (bulkForm.value.removeFromConfigured) {
      // Get only configured feed IDs, plus any manually selected groups
      feedIds = [
        ...props.feeds.map(f => f.feed_id),
        ...bulkForm.value.selectedFeeds.filter(id => 
          ownedGroups.value.some(g => g.group_name === id) || 
          moderatedGroups.value.some(g => g.group_name === id)
        )
      ]
    } else {
      feedIds = bulkForm.value.selectedFeeds
    }
    
    console.log('API Call: POST /api/moderation/backfill-removal')
    console.log('Request payload:', { userHandle, postCount: parseInt(bulkForm.value.postCount), feedIds })
    
    const response = await axios.post('/api/moderation/backfill-removal', {
      userHandle,
      postCount: parseInt(bulkForm.value.postCount),
      feedIds
    })
    
    console.log('API Response:', response.data)
    
    if (response.data.success) {
      results.value = [{ 
        success: true, 
        userHandle,
        postsProcessed: response.data.postsProcessed,
        removalsAttempted: response.data.removalsAttempted,
        isAllFeeds: bulkForm.value.removeFromAll
      }]
      bulkForm.value.userHandle = ''
      bulkForm.value.removeFromAll = false
      bulkForm.value.removeFromConfigured = false
      bulkForm.value.selectedFeeds = []
      emit('post-removed')
    } else {
      results.value = [{ success: false, error: response.data.error }]
    }
    
  } catch (error) {
    console.error('Failed bulk removal:', error)
    results.value = [{ success: false, error: 'POST https://api.graze.social/app/hide_post failed' }]
  } finally {
    processing.value = false
  }
}

const loadTrendingRemovals = async () => {
  emit('trending-updated', {
    timeframe: trendingTimeframe.value,
    showHidden: showHiddenTrending.value,
    showRemoved: showRemovedTrending.value,
    sortBy: trendingSortBy.value
  })
}

const hideTrendingPost = async (postUri: string) => {
  try {
    console.log('API Call: POST /api/moderation/hide-trending-post')
    console.log('Request payload:', { postUri })
    
    const response = await axios.post('/api/moderation/hide-trending-post', { postUri })
    console.log('API Response:', response.data)
    
    emit('trending-updated')
  } catch (error) {
    console.error('Failed to hide trending post:', error)
  }
}

const confirmRemoveFromFeed = (postUri: string, feedId: string) => {
  const feedName = getFeedName(feedId)
  if (confirm(`Remove this post from ${feedName}?`)) {
    removeFromSpecificFeed(postUri, feedId)
  }
}

const confirmRemoveFromAllFeeds = (postUri: string) => {
  if (confirm('Remove this post from all remaining feeds?')) {
    removeFromAllFeeds(postUri)
  }
}

const removeFromSpecificFeed = async (postUri: string, feedId: string) => {
  try {
    console.log('API Call: POST /api/moderation/remove-post (specific feed)')
    console.log('Request payload:', { postUri, feedIds: [feedId] })
    
    const response = await axios.post('/api/moderation/remove-post', {
      postUri,
      feedIds: [feedId]
    })
    
    console.log('API Response:', response.data)
    
    if (response.data.results.every(r => r.success)) {
      alert(`✓ Successfully removed post from ${getFeedName(feedId)} via POST https://api.graze.social/app/hide_post`)
      
      // Auto-hide if removed from all feeds
      const post = props.trendingRemovals.find(p => p.post_uri === postUri)
      if (post && post.feed_status && post.feed_status.exists_on.length === 1 && post.feed_status.exists_on[0] === feedId) {
        await autoHideRemovedPost(postUri)
      }
      
      emit('trending-updated')
      emit('post-removed')
    } else {
      alert('✗ Failed POST https://api.graze.social/app/hide_post. Check console for details.')
    }
  } catch (error) {
    console.error('Failed to remove post from feed:', error)
    alert('Error removing post. Check console for details.')
  }
}

const removeFromAllFeeds = async (postUri: string) => {
  try {
    console.log('API Call: POST /api/moderation/remove-post (all feeds)')
    console.log('Request payload:', { postUri, feedIds: ['all'] })
    
    const response = await axios.post('/api/moderation/remove-post', {
      postUri,
      feedIds: ['all']
    })
    
    console.log('API Response:', response.data)
    
    if (response.data.results.every(r => r.success)) {
      alert('✓ Successfully removed post from all feeds via POST https://api.graze.social/app/hide_post')
      await autoHideRemovedPost(postUri)
      emit('trending-updated')
      emit('post-removed')
    } else {
      alert('✗ Failed POST https://api.graze.social/app/hide_post for some feeds. Check console for details.')
    }
  } catch (error) {
    console.error('Failed to remove post from all feeds:', error)
    alert('Error removing post. Check console for details.')
  }
}

const autoHideRemovedPost = async (postUri: string) => {
  try {
    console.log('API Call: POST /api/moderation/hide-trending-post (auto-hide)')
    console.log('Request payload:', { postUri })
    
    const response = await axios.post('/api/moderation/hide-trending-post', { postUri })
    console.log('API Response:', response.data)
  } catch (error) {
    console.error('Failed to auto-hide removed post:', error)
  }
}

const getFeedName = (feedId: string): string => {
  const feed = props.feeds.find(f => f.feed_id === feedId)
  return feed ? feed.feed_name : feedId
}

const convertUriToUrl = (uri: string): string => {
  const match = uri.match(/at:\/\/([^/]+)\/app\.bsky\.feed\.post\/(.+)/)
  if (match) {
    const [, did, postId] = match
    return `https://bsky.app/profile/${did}/post/${postId}`
  }
  return uri
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

const formatActivityAction = (action: string): string => {
  if (action === 'manual_removal') return 'Manual Post Removal'
  if (action === 'backfill_removal') return 'Backfill Post Removal'
  if (action === 'ban_removal') return 'Post Removed During Ban'
  if (action === 'communal_removal') return 'Communal Post Removal'
  if (action === 'remove_post') return 'Post Removal'
  if (action === 'auto_ban') return 'User Banned (Auto)'
  if (action === 'manual_ban') return 'User Banned (Manual)'
  if (action === 'unban') return 'User Unbanned'
  if (action === 'reverse_removal') return 'Post Restoration'
  return action.replace('_', ' ').toUpperCase()
}

const formatActivityActionPlain = (action: string, reason?: string): string => {
  if (action === 'manual_removal') return 'Manual Removal'
  if (action === 'backfill_removal') return 'Backfill Removal'
  if (action === 'ban_removal') return 'Ban Removal'
  if (action === 'communal_removal') return 'Communal Removal'
  if (action === 'remove_post') {
    if (reason === 'modmaster_browser') return 'ModMaster Browser'
    return 'ModMaster Labeler'
  }
  if (action === 'auto_ban') return 'Auto Ban'
  if (action === 'manual_ban') return 'Manual Ban'
  if (action === 'modmaster_ban') return 'ModMaster Labeler'
  if (action === 'modmaster_auto_ban') return 'ModMaster Labeler'
  if (action === 'unban') return 'Unban'
  if (action === 'reverse_removal') return 'Restoration'
  return action.replace('_', ' ')
}

const canShowReverseButtons = (activity: Activity) => {
  return activity.action !== 'reverse_removal' && activity.feed_id
}

const isPostProtectedInFeed = (activity: Activity, feedId: string) => {
  if (!activity.protected_feeds) return false
  return activity.protected_feeds.some(pf => pf.feed_id === feedId)
}

const hasAnyRestoredFeeds = (activity: Activity) => {
  return activity.protected_feeds && activity.protected_feeds.length > 0
}

const isFullyRemoved = (post: TrendingPost) => {
  return post.feed_status && post.feed_status.exists_on.length === 0
}

const calculateThresholdDisplay = (item: any, type: string): string => {
  const baseThreshold = getGlobalThreshold(type)
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

const calculatePostFeedThresholdDisplay = (item: any, type: string, feed: any): string => {
  const typeKey = type.replace('-', '_')
  const baseThreshold = feed[`threshold_${typeKey}`] || getGlobalThreshold(type)
  const sameCategoryPercentage = feed.same_category_cross_percentage || 50
  const globalCrossTypePercentage = feed.cross_type_percentage || 20
  
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

// Reactive global settings to ensure updates are reflected immediately
const reactiveGlobalSettings = computed(() => props.globalSettings || {})

const getGlobalThreshold = (type: string): number => {
  const typeKey = type.replace(/-/g, '_')
  const settings = reactiveGlobalSettings.value
  
  // Check user's global settings first - only if value exists and is not null
  if (settings && settings[`global_threshold_${typeKey}`] !== null && settings[`global_threshold_${typeKey}`] !== undefined) {
    return settings[`global_threshold_${typeKey}`]
  }
  
  // For subcategories, check if main category has a global threshold
  if (type.includes('-')) {
    const mainCategory = type.split('-')[0]
    const mainCategoryKey = mainCategory.replace(/-/g, '_')
    if (settings && settings[`global_threshold_${mainCategoryKey}`] !== null && settings[`global_threshold_${mainCategoryKey}`] !== undefined) {
      return settings[`global_threshold_${mainCategoryKey}`]
    }
  }
  
  // Fallback to hardcoded defaults
  const fallbacks = {
    misleading: 10,
    harassment: 5,
    violence: 3,
    sexual: 5,
    'child-safety': 2,
    'self-harm': 3,
    rule: 5
  }
  
  if (type.includes('-')) {
    const mainCategory = type.split('-')[0]
    return fallbacks[mainCategory as keyof typeof fallbacks] || 3
  }
  
  return fallbacks[type as keyof typeof fallbacks] || 3
}

const getFeedThreshold = (type: string, feedId: string): number => {
  const feed = props.feeds.find(f => f.feed_id === feedId)
  if (!feed) return getGlobalThreshold(type)
  
  const typeKey = type.replace(/-/g, '_')
  return feed[`threshold_${typeKey}`] || getGlobalThreshold(type)
}

const getClosestThresholdDisplayHTML = (item: any, feed?: any) => {
  const reportTypes = ['misleading', 'harassment', 'violence', 'sexual', 'child-safety', 'self-harm', 'rule']
  let bestThreshold = { reportType: '', current: 0, max: 1, percent: 0 }
  
  for (const type of reportTypes) {
    const baseThreshold = feed ? getFeedThreshold(type, feed.feed_id) : getGlobalThreshold(type)
    if (!baseThreshold || baseThreshold === 0) continue
    
    const sameCategoryPercentage = feed ? (feed.same_category_cross_percentage || 50) : 50
    const globalCrossPercentage = feed ? (feed.cross_type_percentage || 20) : 20
    
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
  const item = props.trendingRemovals.find(p => p.post_uri === itemId)
  const feed = feedId === 'global' ? null : props.feeds.find(f => f.feed_id === feedId)
  
  modalData.value = { item, feed }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  modalData.value = { item: null, feed: null }
}

const closeInfoModal = () => {
  showInfoModal.value = false
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

const getSameCategoryPercentage = (feed?: any) => {
  if (feed) {
    return feed.same_category_cross_percentage || 50
  }
  // Use global settings for post removal thresholds
  const settings = reactiveGlobalSettings.value
  return settings?.global_same_category_cross_percentage || 50
}

const getCrossTypePercentage = (feed?: any) => {
  if (feed) {
    return feed.cross_type_percentage || 20
  }
  // Use global settings for post removal thresholds
  const settings = reactiveGlobalSettings.value
  return settings?.global_cross_type_percentage || 20
}

// Load groups when component mounts
import { onMounted } from 'vue'
onMounted(() => {
  loadGroups()
  // Load initial trending data
  loadTrendingRemovals()
})

const getFullThresholdDisplay = (item: any, type: string, feed?: any) => {
  const typeKey = type.replace('-', '_')
  const baseThreshold = feed ? (feed[`threshold_${typeKey}`] || getGlobalThreshold(type)) : getGlobalThreshold(type)
  const sameCategoryPercentage = feed ? (feed.same_category_cross_percentage || 50) : 50
  const globalCrossPercentage = feed ? (feed.cross_type_percentage || 20) : 20
  
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
  font-family: monospace;
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

.report-type-select optgroup {
  font-weight: 600;
  color: var(--text-primary, #374151);
  background: var(--bg-secondary, #f8fafc);
}

.report-type-select option {
  padding: 0.5rem;
  color: var(--text-secondary, #6b7280);
}

.report-type-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.feed-selection {
  margin-bottom: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  background: #374151;
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 2px;
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

.auto-selected {
  background: #3b82f6 !important;
  border-color: #3b82f6 !important;
  opacity: 0.8;
}

.auto-selected input[type="checkbox"]:disabled {
  cursor: not-allowed;
}

.selected-preview {
  border: 2px solid #3b82f6;
  border-radius: 4px;
  padding: 0.5rem;
  background: rgba(59, 130, 246, 0.05);
}

.remove-action {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.remove-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 2px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  min-height: 44px;
  font-size: 0.875rem;
}

.remove-btn:hover:not(:disabled) {
  background: #dc2626;
}

.remove-btn:disabled {
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

.success {
  color: #10b981;
  font-weight: 600;
}

.error {
  color: #ef4444;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  color: #6b7280;
  padding: 2rem;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.activity-item {
  background: var(--bg-secondary, #f8fafc);
  border-radius: 2px;
  padding: 1rem;
  border: 1px solid var(--border-primary, #e2e8f0);
}

.activity-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.activity-header {
  margin-bottom: 0.5rem;
}

.activity-header-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.post-id-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.post-id-btn {
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

.post-id-btn:hover {
  background: #e5e7eb;
  text-decoration: underline;
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

.activity-center {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.activity-action {
  font-weight: 600;
  color: white;
  background: #3b82f6;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-size: 0.75rem;
}

.restoration-indicator {
  font-size: 0.875rem;
  color: #ef4444;
  font-weight: bold;
}

.activity-time {
  color: #6b7280;
  font-size: 0.75rem;
}

.activity-info {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.bulk-action-label {
  font-family: monospace;
  font-size: 0.75rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 2px;
  font-weight: 500;
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

.combined-feed-btn.protected {
  background: #fbbf24;
  color: #92400e;
  cursor: default;
}

.combined-feed-btn.protected:hover {
  background: #fbbf24;
  transform: none;
  box-shadow: none;
}

.restore-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.protection-icon-inline {
  width: 14px;
  height: 14px;
  cursor: pointer;
  flex-shrink: 0;
}

.protection-icon-inline:hover {
  opacity: 0.8;
}

.feed-name-static {
  background: #6b7280;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-size: 0.75rem;
  font-weight: 500;
  display: inline-block;
  max-width: 200px;
}

.removal-method {
  font-size: 0.75rem;
  color: #6b7280;
  margin-left: 0.5rem;
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
  color: #374151;
  font-weight: 600;
}

.user-handle-small {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 400;
}

.post-preview {
  background: var(--bg-primary, white) !important;
  border: 1px solid var(--border-primary, #e2e8f0);
  border-radius: 6px;
  padding: 0.75rem;
  margin-top: 0.5rem;
}

.post-author {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.author-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.author-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.author-name {
  font-size: 0.75rem;
  color: var(--text-primary, #374151) !important;
  font-weight: 600;
}

.author-handle {
  font-size: 0.6875rem;
  color: var(--text-secondary, #6b7280);
  font-weight: 400;
}

.post-text {
  font-size: 0.875rem;
  color: var(--text-primary, #374151) !important;
  line-height: 1.5;
  white-space: pre-wrap;
  margin: 0;
}

.removal-info {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.feed-removal-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.removal-action-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.removal-action-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.removal-feed-name {
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-size: 0.875rem;
  font-weight: 600;
}

.removal-feed-name-btn {
  background: #6b7280;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.2s;
}

.removal-feed-name-btn:hover {
  background: #4b5563;
}

.removal-feed-name-btn .info-icon-small {
  width: 14px;
  height: 14px;
}

.removal-method {
  font-size: 0.875rem;
  color: #6b7280;
}

.removal-method.strikethrough {
  text-decoration: line-through;
  opacity: 0.7;
}



.report-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
  margin-top: 0.25rem;
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

.activity-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
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
  align-items: center;
  gap: 1rem;
}

.trending-item .post-id-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
}

.trending-item .post-id-btn {
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

.trending-item .post-id-btn:hover {
  background: #e5e7eb;
  text-decoration: underline;
}

.trending-item .bluesky-icon {
  width: 16px;
  height: 16px;
  color: #0085ff;
  transition: all 0.2s;
}

.trending-item .bluesky-icon:hover {
  color: #0066cc;
  transform: scale(1.1);
}

.trending-item .bluesky-icon svg {
  width: 100%;
  height: 100%;
}

.post-link {
  font-family: monospace;
  font-size: 0.875rem;
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.post-link:hover {
  text-decoration: underline;
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

.status-badge.hidden {
  background: #6b7280;
  color: white;
}

.status-badge.removed {
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

.removal-date {
  color: #6b7280;
  font-size: 0.75rem;
  text-align: right;
}

.trending-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.header-right {
  display: flex;
  align-items: flex-start;
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
  color: #6b7280;
  font-weight: 600;
}

.threshold-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.threshold-type {
  color: #6b7280;
  font-weight: 500;
}

.threshold-count {
  background: #f3f4f6;
  color: #374151;
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
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
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
  color: #1e293b;
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
  color: #374151;
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
  color: #374151;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
  border: 1px solid #d1d5db;
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
  color: #374151;
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

.search-filter {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.search-filter .filter-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.search-filter .filter-row label {
  font-weight: 500;
  color: var(--text-primary, #374151);
  white-space: nowrap;
}

.search-filter .search-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-primary, #d1d5db);
  border-radius: 8px;
  background: var(--bg-primary, white);
  color: var(--text-primary, #374151);
  font-size: 0.875rem;
  transition: all 0.2s;
}

.search-filter .search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-filter .search-input::placeholder {
  color: #9ca3af;
}

.removal-mode-toggle {
  display: flex;
  gap: 0;
  margin-bottom: 1.5rem;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-primary, #e5e7eb);
  border-radius: 2px;
  overflow: hidden;
}

.mode-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  font-size: 0.875rem;
}

.mode-btn.active {
  background: #3b82f6;
  color: white;
}

.mode-btn:hover:not(.active) {
  background: var(--bg-tertiary, #f1f5f9);
  color: var(--text-primary, #334155);
}

.bulk-limits-toggle {
  margin-bottom: 1rem;
}

.limits-toggle-btn {
  background: var(--bg-secondary, #f3f4f6);
  border: 1px solid var(--border-primary, #d1d5db);
  padding: 0.5rem 0.75rem;
  border-radius: 2px;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--text-primary, #374151);
  font-weight: 500;
  transition: all 0.2s;
  width: 100%;
  text-align: left;
}

.limits-toggle-btn:hover {
  background: var(--bg-tertiary, #e5e7eb);
}

.limits-display {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary, #f8fafc);
  border-radius: 2px;
  border: 1px solid var(--border-primary, #e5e7eb);
}

.limit-item {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  font-weight: 500;
}

.bulk-count-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.bulk-count-container .report-type-select {
  flex: 1;
  margin-bottom: 0;
}

.bulk-count-container .info-btn {
  flex-shrink: 0;
}

.info-modal {
  background: var(--bg-card, white);
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-primary, #e5e7eb);
}

.info-header h3 {
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
  color: var(--text-secondary, #6b7280);
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  color: var(--text-primary, #374151);
}

.info-body {
  padding: 1.5rem;
}

.info-section {
  margin-bottom: 1.5rem;
}

.info-section:last-child {
  margin-bottom: 0;
}

.info-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #374151);
}

.info-section p {
  margin: 0;
  line-height: 1.6;
  color: var(--text-secondary, #6b7280);
  font-size: 0.875rem;
}

</style>