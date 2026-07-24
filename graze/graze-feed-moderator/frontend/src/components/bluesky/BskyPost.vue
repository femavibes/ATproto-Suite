<template>
  <div v-if="!isFiltered">
    <!-- Reply Context -->
    <div v-if="isReply && parentPost && !props.isContext" class="reply-context">
      <div class="reply-context-label">Replying to @{{ parentPost.post?.author?.handle }}:</div>
      <div class="reply-context-text">{{ parentPost.post?.record?.text }}</div>
    </div>
    
    <div class="post-card" :class="{ moderated: post.moderated, 'is-reply': isReply, 'is-original': props.originalPostUri === post.post.uri, 'is-context': props.isContext }" :data-post-uri="post.post.uri" @click="handlePostClick">
      <div v-if="isReply" class="reply-connector"></div>
      <div class="post-content-wrapper">
    <div class="post-header">
      <img 
        :src="post.post.author.avatar || '/icon-192.svg'" 
        :alt="post.post.author.displayName || post.post.author.handle" 
        class="avatar" 
        @click.stop="viewProfile(post.post.author.handle)"
        @error="handleAvatarError"
        @load="handleAvatarLoad"
      >
      <div class="author-info" @click.stop="viewProfile(post.post.author.handle)">
        <div class="author-name-row">
          <div class="author-name">{{ post.post.author.displayName || post.post.author.handle }}</div>
        </div>
        <div class="author-handle">@{{ post.post.author.handle }}</div>
      </div>
      <div class="header-right">
        <div class="post-time-container">
          <span class="post-time">{{ formatTime(post.post.record.createdAt) }}</span>
          <a :href="getBlueskyUrl(post.post)" target="_blank" class="bluesky-link" title="View on Bluesky" @click.stop>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M7 17l10-10"/>
              <path d="M7 7h10v10"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
    
    <div v-if="!isCollapsed" class="post-content">
      <!-- Content Warning -->
      <BskyContentWarning 
        v-if="contentWarning && !showSensitiveContent"
        :warning="contentWarning"
        @show="showSensitiveContent = true"
      />
      
      <div v-show="!contentWarning || showSensitiveContent">
        <div class="post-text" v-html="formatPostText(post.post.record.text)"></div>
      
      <!-- Images (including recordWithMedia) -->
      <div v-if="post.post.embed?.images || post.post.embed?.media?.images" class="post-images" :class="`images-${(post.post.embed?.images || post.post.embed?.media?.images)?.length}`">
        <img v-for="(img, index) in (post.post.embed?.images || post.post.embed?.media?.images)" :key="img.alt" 
             :src="img.fullsize" :alt="img.alt" class="post-image" @click.stop="openImageModal(img, index, post.post.embed?.images || post.post.embed?.media?.images)">
      </div>
      
      <!-- Video (including recordWithMedia) -->
      <div v-if="post.post.embed?.$type === 'app.bsky.embed.video#view' || post.post.embed?.video || post.post.embed?.media?.video" class="post-video" @click.stop>
        <video 
          :src="getVideoUrl(post.post.embed?.$type === 'app.bsky.embed.video#view' ? post.post.embed : (post.post.embed?.video || post.post.embed?.media?.video))" 
          class="post-video-player"
          controls
          preload="metadata"
          :poster="post.post.embed?.$type === 'app.bsky.embed.video#view' ? post.post.embed.thumbnail : (post.post.embed?.video || post.post.embed?.media?.video)?.thumbnail"
          @click.stop
        >
          Your browser does not support the video tag.
        </video>
      </div>
      
      <!-- Quote post -->
      <div v-if="getQuotedPost(post.post.embed)" class="quote-post">
        <div class="quote-header">
          <img 
            :src="getQuotedPost(post.post.embed)?.author?.avatar || '/icon-192.svg'" 
            class="quote-avatar"
            @error="handleQuoteAvatarError"
            @load="handleQuoteAvatarLoad"
          >
          <span class="quote-author">{{ getQuotedPost(post.post.embed)?.author?.displayName || getQuotedPost(post.post.embed)?.author?.handle }}</span>
          <span class="quote-handle">@{{ getQuotedPost(post.post.embed)?.author?.handle }}</span>
        </div>
        <p class="quote-text">{{ getQuotedPost(post.post.embed)?.value?.text }}</p>
        
        <!-- Media in quoted post -->
        <div v-if="getQuotedPost(post.post.embed)?.embeds?.[0]?.images" class="quote-images" :class="`images-${getQuotedPost(post.post.embed).embeds[0].images.length}`">
          <img v-for="(img, index) in getQuotedPost(post.post.embed).embeds[0].images" :key="img.alt" 
               :src="img.fullsize" :alt="img.alt" class="quote-image" @click.stop="openImageModal(img, index, getQuotedPost(post.post.embed).embeds[0].images)">
        </div>
        
        <div v-if="getQuotedPost(post.post.embed)?.embeds?.[0]?.video || getQuotedPost(post.post.embed)?.embeds?.[0]?.$type === 'app.bsky.embed.video#view'" class="quote-video" @click.stop>
          <video 
            :src="getVideoUrl(getQuotedPost(post.post.embed).embeds[0]?.$type === 'app.bsky.embed.video#view' ? getQuotedPost(post.post.embed).embeds[0] : getQuotedPost(post.post.embed).embeds[0].video)" 
            class="quote-video-player"
            controls
            preload="metadata"
            :poster="getQuotedPost(post.post.embed).embeds[0]?.$type === 'app.bsky.embed.video#view' ? getQuotedPost(post.post.embed).embeds[0].thumbnail : getQuotedPost(post.post.embed).embeds[0].video.thumbnail"
            @click.stop
          >
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
      
      <!-- External link (including GIFs and YouTube) -->
      <div v-if="post.post.embed?.external" class="external-link">
        <!-- YouTube embed -->
        <div v-if="isYouTubeUrl(post.post.embed.external.uri)" class="youtube-embed" @click.stop>
          <iframe 
            :src="getYouTubeEmbedUrl(post.post.embed.external.uri)"
            class="youtube-player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            @click.stop
          ></iframe>
        </div>
        <!-- Regular external link -->
        <div v-else>
          <img v-if="post.post.embed.external.thumb" :src="post.post.embed.external.thumb" class="link-thumb">
          <div class="link-info">
            <h4>{{ post.post.embed.external.title }}</h4>
            <p>{{ post.post.embed.external.description }}</p>
            <a :href="post.post.embed.external.uri" target="_blank">{{ post.post.embed.external.uri }}</a>
          </div>
        </div>
      </div>
      
        <!-- Link Previews -->
        <div v-if="extractedUrls.length > 0 && !post.post.embed?.external" class="link-previews">
          <BskyLinkPreview 
            v-for="url in extractedUrls.slice(0, 1)" 
            :key="url" 
            :url="url"
          />
        </div>
        
        <!-- Debug: Post Record -->
        <div v-if="props.showDebug" class="post-debug" @click.stop>
          <details>
            <summary>Post Record</summary>
            <pre>{{ JSON.stringify(post.post, null, 2) }}</pre>
          </details>
        </div>
      </div>
    </div>
    
    <div v-if="!isCollapsed" class="post-actions" @click.stop>
      <button @click="toggleReplies" class="action-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/>
        </svg>
        {{ post.post.replyCount || 0 }}
      </button>
      <div class="repost-container">
        <button @click="showRepostMenu = !showRepostMenu" class="action-btn" :class="{ active: showRepostMenu }">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
          </svg>
          {{ post.post.repostCount || 0 }}
        </button>
        
        <!-- Repost Menu -->
        <div v-if="showRepostMenu" class="repost-menu" @click.stop>
          <button @click="handleRepost" class="repost-option">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
            </svg>
            Repost
          </button>
          <button @click="handleQuote" class="repost-option">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 17h3l2-4V7h-6v6h3M6 17h3l2-4V7H5v6h3l-2 4z"/>
            </svg>
            Quote Post
          </button>
        </div>
      </div>
      <button @click="$emit('like', post)" class="action-btn" :class="{ liked: post.post.viewer?.like }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
        {{ post.post.likeCount || 0 }}
      </button>
      <button disabled class="action-btn disabled">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
        </svg>
      </button>
    </div>
    
    <!-- Collapse and moderation controls -->
    <div class="collapse-button-container" @click.stop>
      <button @click="toggleCollapse" class="collapse-toggle-btn" :title="isCollapsed ? 'Expand post' : 'Collapse post'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path v-if="isCollapsed" d="M7 14l5-5 5 5z"/>
          <path v-else d="M7 10l5 5 5-5z"/>
        </svg>
        {{ isCollapsed ? 'Expand' : 'Collapse' }}
      </button>
      <div class="moderation-actions">
        <button @click="showRemoveModal = true" class="mod-btn remove">Remove</button>
        <button @click="openBulkRemoveModal" class="mod-btn bulk-remove">Bulk Remove</button>
        <button @click="showBanModal = true" class="mod-btn ban">Ban</button>
      </div>
    </div>
    
    </div>

  </div>
    
    <!-- Replies Thread -->
    <div v-if="showReplies" class="replies-thread" @click.stop>
      <!-- Main Reply Composer at top -->
      <div class="thread-reply-composer">
        <BskyComposer 
          :reply-to="post"
          :user-avatar="props.userProfile?.avatar"
          @post="handleThreadReply"
          @cancel="() => {}"
          compact
        />
      </div>
      
      <div v-if="loadingReplies" class="loading-replies">Loading replies...</div>
      <div v-else-if="flattenedReplies.length === 0" class="no-replies">No replies yet</div>
      <div v-else class="replies-list">
        <div 
          v-for="(reply, index) in flattenedReplies" 
          :key="reply.post.uri"
          class="reply-item-flat"
          :class="`depth-${Math.min(reply.depth, 3)}`"
        >
          <div class="reply-connector" v-if="reply.depth > 0"></div>
          <div class="reply-content-wrapper">
            <div class="reply-header">
              <img 
                :src="reply.post.author.avatar || '/icon-192.svg'" 
                class="reply-avatar"
                @error="handleReplyAvatarError"
                @load="handleReplyAvatarLoad"
              >
              <div class="reply-author-info">
                <div class="reply-author-name">{{ reply.post.author.displayName || reply.post.author.handle }}</div>
                <div class="reply-handle">@{{ reply.post.author.handle }}</div>
              </div>
              <div class="reply-header-right">
                <div class="reply-time-container">
                  <span class="reply-time">{{ formatTime(reply.post.record.createdAt) }}</span>
                  <a :href="getBlueskyUrl(reply.post)" target="_blank" class="bluesky-link" title="View on Bluesky">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M7 17l10-10"/>
                      <path d="M7 7h10v10"/>
                    </svg>
                  </a>
                </div>
                <div class="reply-moderation-actions">
                  <button @click="handleReplyRemove(reply)" class="reply-mod-btn remove">Remove</button>
                  <button @click="handleReplyBan(reply)" class="reply-mod-btn ban">Ban</button>
                </div>
              </div>
            </div>
            <div class="reply-text" v-html="formatPostText(reply.post.record.text)"></div>
            
            <div class="reply-actions">
              <button @click="showReplyComposer(reply)" class="action-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/>
                </svg>
                {{ reply.post.replyCount || 0 }}
              </button>
              <button @click="handleReplyRepost(reply)" class="action-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                </svg>
                {{ reply.post.repostCount || 0 }}
              </button>
              <button @click="handleReplyQuote(reply)" class="action-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 17h3l2-4V7h-6v6h3M6 17h3l2-4V7H5v6h3l-2 4z"/>
                </svg>
              </button>
              <button @click="handleReplyLike(reply)" class="action-btn" :class="{ liked: reply.post.viewer?.like }">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                {{ reply.post.likeCount || 0 }}
              </button>
            </div>
            
            <!-- Inline Reply Composer -->
            <div v-if="activeReplyComposer === reply.post.uri" class="inline-reply-composer">
              <BskyComposer 
                :reply-to="reply"
                :user-avatar="props.userProfile?.avatar"
                @post="handleInlineReply"
                @cancel="activeReplyComposer = null"
                compact
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Modals moved outside post-card to avoid opacity inheritance -->
  <Teleport to="body">
    <!-- Remove Modal -->
    <div v-if="showRemoveModal" class="modal-overlay" @click="showRemoveModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
          <h3>Remove Post</h3>
        </div>
        <p>Choose where to remove this post:</p>
        <div class="modal-actions">
          <button @click="handleRemove('current')" :disabled="!isCurrentFeedOwned" class="modal-btn" :class="isCurrentFeedOwned ? 'primary' : 'disabled'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            Current Feed
          </button>
          <button @click="handleRemove('configured')" class="modal-btn primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </svg>
            All Configured Feeds
          </button>
          <button @click="showFeedSelector = true" class="modal-btn primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2z"/>
              <path d="M21 11h-4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2z"/>
              <path d="M3 3h6v6H3z"/>
              <path d="M15 3h6v6h-6z"/>
            </svg>
            Specific Feeds
          </button>
          <button @click="showGroupSelector = true" class="modal-btn primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Group
          </button>
          <button @click="handleRemove('all')" class="modal-btn danger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            All Feeds
          </button>
        </div>
        <div class="modal-footer">
          <button @click="showRemoveModal = false" class="modal-btn secondary">Cancel</button>
        </div>
      </div>
    </div>
    
    <!-- Bulk Remove Modal -->
    <div v-if="showBulkRemoveModal" class="modal-overlay" @click="showBulkRemoveModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
          <h3>Bulk Remove Posts</h3>
        </div>
        <p>Remove multiple posts by <strong>@{{ post.post.author.handle }}</strong> from:</p>
        
        <div class="bulk-form">
          <div class="form-row">
            <label>Post Count:</label>
            <select v-model="bulkRemoveForm.postCount" class="post-count-select">
              <option value="25">25 posts</option>
              <option value="50">50 posts</option>
              <option value="100">100 posts</option>
            </select>
          </div>
        </div>
        
        <div class="modal-actions">
          <button @click="handleBulkRemove('current')" :disabled="!isCurrentFeedOwned" class="modal-btn" :class="isCurrentFeedOwned ? 'primary' : 'disabled'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            Current Feed
          </button>
          <button @click="handleBulkRemove('configured')" class="modal-btn primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </svg>
            All Configured Feeds
          </button>
          <button @click="showBulkFeedSelector = true" class="modal-btn primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2z"/>
              <path d="M21 11h-4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2z"/>
              <path d="M3 3h6v6H3z"/>
              <path d="M15 3h6v6h-6z"/>
            </svg>
            Specific Feeds
          </button>
          <button @click="showBulkGroupSelector = true" class="modal-btn primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Group
          </button>
          <button @click="handleBulkRemove('all')" class="modal-btn danger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            All Feeds
          </button>
        </div>
        
        <div class="modal-footer">
          <button @click="showBulkRemoveModal = false" class="modal-btn secondary">Cancel</button>
        </div>
      </div>
    </div>
    
    <!-- Bulk Feed Selector Modal -->
    <div v-if="showBulkFeedSelector" class="modal-overlay" @click="showBulkFeedSelector = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2z"/>
            <path d="M21 11h-4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2z"/>
            <path d="M3 3h6v6H3z"/>
            <path d="M15 3h6v6h-6z"/>
          </svg>
          <h3>Select Feeds for Bulk Remove</h3>
        </div>
        <div class="feed-selector-list">
          <label v-for="feed in userFeeds" :key="feed.feed_id" class="feed-selector-item">
            <input type="checkbox" v-model="selectedBulkFeeds" :value="feed.feed_id">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span class="feed-name">{{ feed.feed_name }}</span>
          </label>
        </div>
        <div class="modal-footer">
          <button @click="showBulkFeedSelector = false" class="modal-btn secondary">Cancel</button>
          <button @click="handleBulkRemoveFromFeeds" :disabled="selectedBulkFeeds.length === 0" class="modal-btn primary">Bulk Remove from Selected</button>
        </div>
      </div>
    </div>
    
    <!-- Bulk Group Selector Modal -->
    <div v-if="showBulkGroupSelector" class="modal-overlay" @click="showBulkGroupSelector = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <h3>Select Group for Bulk Remove</h3>
        </div>
        <div class="group-list">
          <button v-for="group in userGroups" :key="group.id" 
                  @click="handleBulkRemove('group', group.group_name)" class="group-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {{ group.group_name }}
          </button>
        </div>
        <div class="modal-footer">
          <button @click="showBulkGroupSelector = false" class="modal-btn secondary">Cancel</button>
        </div>
      </div>
    </div>
    
    <!-- Ban Modal -->
    <div v-if="showBanModal" class="modal-overlay" @click="showBanModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M4.93 4.93l14.14 14.14"/>
          </svg>
          <h3>Ban User</h3>
        </div>
        <p>Ban <strong>@{{ post.post.author.handle }}</strong> from:</p>
        <div class="modal-actions">
          <button @click="handleBan('current')" :disabled="!isCurrentFeedOwned" class="modal-btn" :class="isCurrentFeedOwned ? 'primary' : 'disabled'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            Current Feed
          </button>
          <button @click="handleBan('configured')" class="modal-btn primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </svg>
            All Configured Lists
          </button>
          <button @click="showBanFeedSelector = true" class="modal-btn primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2z"/>
              <path d="M21 11h-4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2z"/>
              <path d="M3 3h6v6H3z"/>
              <path d="M15 3h6v6h-6z"/>
            </svg>
            Specific Feeds
          </button>
          <button @click="showBanGroupSelector = true" class="modal-btn primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Group
          </button>
          <button @click="handleBan('global')" class="modal-btn danger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            Global
          </button>
        </div>
        <div class="modal-footer">
          <button @click="showBanModal = false" class="modal-btn secondary">Cancel</button>
        </div>
      </div>
    </div>
    
    <!-- Feed Selector Modal for Remove -->
    <div v-if="showFeedSelector" class="modal-overlay" @click="showFeedSelector = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2z"/>
            <path d="M21 11h-4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2z"/>
            <path d="M3 3h6v6H3z"/>
            <path d="M15 3h6v6h-6z"/>
          </svg>
          <h3>Select Feeds to Remove From</h3>
        </div>
        <div class="feed-selector-list">
          <label v-for="feed in userFeeds" :key="feed.feed_id" class="feed-selector-item">
            <input type="checkbox" v-model="selectedFeeds" :value="feed.feed_id">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span class="feed-name">{{ feed.feed_name }}</span>
          </label>
        </div>
        <div class="modal-footer">
          <button @click="showFeedSelector = false" class="modal-btn secondary">Cancel</button>
          <button @click="handleRemoveFromFeeds" :disabled="selectedFeeds.length === 0" class="modal-btn primary">Remove from Selected</button>
        </div>
      </div>
    </div>
    
    <!-- Feed Selector Modal for Ban -->
    <div v-if="showBanFeedSelector" class="modal-overlay" @click="showBanFeedSelector = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M4.93 4.93l14.14 14.14"/>
          </svg>
          <h3>Select Feeds to Ban From</h3>
        </div>
        <div class="feed-selector-list">
          <label v-for="feed in userFeeds.filter(f => f.feed_ban_list)" :key="feed.feed_id" class="feed-selector-item">
            <input type="checkbox" v-model="selectedBanFeeds" :value="feed.feed_id">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span class="feed-name">{{ feed.feed_name }}</span>
          </label>
        </div>
        <div v-if="userFeeds.filter(f => f.feed_ban_list).length === 0" class="no-feeds-message">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>No feeds with ban lists configured.</p>
        </div>
        <div class="modal-footer">
          <button @click="showBanFeedSelector = false" class="modal-btn secondary">Cancel</button>
          <button @click="handleBanFromFeeds" :disabled="selectedBanFeeds.length === 0" class="modal-btn primary">Ban from Selected</button>
        </div>
      </div>
    </div>
    
    <!-- Group Selector Modal for Remove -->
    <div v-if="showGroupSelector" class="modal-overlay" @click="showGroupSelector = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <h3>Select Group to Remove From</h3>
        </div>
        <div class="group-list">
          <button v-for="group in userGroups" :key="group.id" 
                  @click="handleRemove('group', group.group_name)" class="group-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {{ group.group_name }}
          </button>
        </div>
        <div class="modal-footer">
          <button @click="showGroupSelector = false" class="modal-btn secondary">Cancel</button>
        </div>
      </div>
    </div>
    
    <!-- Group Selector Modal for Ban -->
    <div v-if="showBanGroupSelector" class="modal-overlay" @click="showBanGroupSelector = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <h3>Select Group to Ban From</h3>
        </div>
        <div class="group-list">
          <button v-for="group in userGroups" :key="group.id" 
                  @click="handleBan('group', group.group_name)" class="group-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {{ group.group_name }}
          </button>
        </div>
        <div class="modal-footer">
          <button @click="showBanGroupSelector = false" class="modal-btn secondary">Cancel</button>
        </div>
      </div>
    </div>
  </Teleport>
  
  <!-- Image Modal -->
  <Teleport to="body">
    <div v-if="showImageModal" class="image-modal-overlay" @click="closeImageModal">
      <div class="image-modal-content" @click.stop>
        <button @click="closeImageModal" class="image-modal-close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <img :src="currentImage?.fullsize" :alt="currentImage?.alt" class="image-modal-img">
        <div v-if="currentImage?.alt" class="image-modal-alt">{{ currentImage.alt }}</div>
        <div v-if="imageGallery.length > 1" class="image-modal-nav">
          <button @click="prevImage" class="nav-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>
          <span class="image-counter">{{ currentImageIndex + 1 }} / {{ imageGallery.length }}</span>
          <button @click="nextImage" class="nav-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Thread Modal -->
  <Teleport to="body">
    <div v-if="showThreadModal" class="thread-modal-overlay" @click="closeThreadModal">
      <div class="thread-modal-content" @click.stop @touchstart="handleTouchStart" @touchend="handleTouchEnd">
        <div class="thread-modal-header">
          <h3>Thread</h3>
          <button @click="closeThreadModal" class="thread-modal-close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="thread-modal-body">
          <div v-if="loadingThread" class="thread-loading">Loading thread...</div>
          <div v-else-if="!threadData" class="thread-error">Failed to load thread</div>
          <div v-else class="thread-content">
            <BskyPost 
              :post="threadData"
              :current-feed="props.currentFeed"
              :user-feeds="props.userFeeds"
              :user-groups="props.userGroups"
              :user-profile="props.userProfile"
              :force-show-replies="true"
              :original-post-uri="originalPostUri"
              @moderate="$emit('moderate', $event[0], $event[1], $event[2])"
              @view-profile="$emit('viewProfile', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { blueskyService } from '../../services/bluesky'
import { linkPreviewService } from '../../services/linkPreview'
import { useContentFilterStore } from '../../stores/contentFilter'
import BskyComposer from './BskyComposer.vue'
import BskyReply from './BskyReply.vue'
import BskyLinkPreview from './BskyLinkPreview.vue'
import BskyContentWarning from './BskyContentWarning.vue'

interface Props {
  post: any
  currentFeed?: string
  userFeeds?: any[]
  userGroups?: any[]
  userProfile?: any
  replyingTo?: any
  forceShowReplies?: boolean
  isContext?: boolean
  originalPostUri?: string
  showDebug?: boolean
}

const props = defineProps<Props>()

const contentFilterStore = useContentFilterStore()

// Initialize following state from post data
const isFollowing = ref(props.post.post.author.viewer?.following ? true : false)
const showSensitiveContent = ref(false)
const isCollapsed = ref(false)

// Load collapsed state from localStorage
const loadCollapsedState = () => {
  const collapsed = JSON.parse(localStorage.getItem('collapsed-posts') || '[]')
  isCollapsed.value = collapsed.includes(props.post.post.uri)
}

// Save collapsed state to localStorage
const saveCollapsedState = () => {
  const collapsed = JSON.parse(localStorage.getItem('collapsed-posts') || '[]')
  if (isCollapsed.value) {
    if (!collapsed.includes(props.post.post.uri)) {
      collapsed.push(props.post.post.uri)
    }
  } else {
    const index = collapsed.indexOf(props.post.post.uri)
    if (index > -1) {
      collapsed.splice(index, 1)
    }
  }
  localStorage.setItem('collapsed-posts', JSON.stringify(collapsed))
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  saveCollapsedState()
}

const isFiltered = computed(() => {
  return contentFilterStore.shouldHidePost(props.post.post)
})

const contentWarning = computed(() => {
  return contentFilterStore.getContentWarning(props.post.post)
})

const isCurrentFeedOwned = computed(() => {
  if (!props.currentFeed || !props.userFeeds) return false
  if (props.currentFeed === 'timeline' || props.currentFeed === 'discover') return false
  const feed = props.userFeeds.find(feed => feed.feed_uri === props.currentFeed)
  return feed && feed.feed_ban_list // Only show as owned if it has a ban list configured
})

const canBulkRemove = computed(() => {
  return bulkRemoveForm.value.userHandle
})

const emit = defineEmits<{
  reply: [post: any]
  repost: [post: any]
  quote: [post: any]
  like: [post: any]
  moderate: [post: any, action: string, target?: string]
  viewProfile: [handle: string]
}>()

const showRemoveModal = ref(false)
const showBulkRemoveModal = ref(false)
const showBulkFeedSelector = ref(false)
const showBulkGroupSelector = ref(false)
const showBanModal = ref(false)
const showGroupSelector = ref(false)
const showBanGroupSelector = ref(false)
const showFeedSelector = ref(false)
const showBanFeedSelector = ref(false)
const selectedFeeds = ref<string[]>([])
const selectedBanFeeds = ref<string[]>([])
const selectedBulkFeeds = ref<string[]>([])
const bulkRemoveForm = ref({
  userHandle: '',
  postCount: '25'
})
const showReplies = ref(false)
const replies = ref([])
const loadingReplies = ref(false)
const activeReplyComposer = ref<string | null>(null)
const avatarLoaded = ref(false)
const quoteAvatarLoaded = ref(false)
const replyAvatarLoaded = ref(false)
const showRepostMenu = ref(false)
const extractedUrls = ref<string[]>([])
const showImageModal = ref(false)
const currentImage = ref<any>(null)
const currentImageIndex = ref(0)
const imageGallery = ref<any[]>([])
const showThreadModal = ref(false)
const threadData = ref<any>(null)
const loadingThread = ref(false)
const touchStartX = ref(0)
const touchEndX = ref(0)
const parentPost = ref<any>(null)
const loadingParent = ref(false)
const originalPostUri = ref<string | null>(null)

const flattenedReplies = computed(() => {
  const flatten = (replyList: any[], depth = 0): any[] => {
    const result: any[] = []
    for (const reply of replyList) {
      result.push({ ...reply, depth })
      if (reply.replies && reply.replies.length > 0) {
        result.push(...flatten(reply.replies, depth + 1))
      }
    }
    return result
  }
  
  const flattened = flatten(replies.value)
  
  // If we have an original post URI, find and prioritize its conversation branch
  if (originalPostUri.value && originalPostUri.value !== props.post.post.uri) {
    const originalReplyIndex = flattened.findIndex(reply => reply.post.uri === originalPostUri.value)
    if (originalReplyIndex > -1) {
      const originalReply = flattened[originalReplyIndex]
      
      // If it's a direct reply to root (depth 0), just move it to the top
      if (originalReply.depth === 0) {
        // Find the end of this top-level conversation branch
        let branchEndIndex = originalReplyIndex
        for (let i = originalReplyIndex + 1; i < flattened.length; i++) {
          if (flattened[i].depth === 0) {
            break
          }
          branchEndIndex = i
        }
        
        // Extract this conversation branch
        const conversationBranch = flattened.splice(originalReplyIndex, branchEndIndex - originalReplyIndex + 1)
        
        // Add it at the beginning
        flattened.unshift(...conversationBranch)
      } else {
        // For nested replies, find the root of this conversation branch
        let branchStartIndex = originalReplyIndex
        
        // Walk backwards to find the start of this conversation branch
        for (let i = originalReplyIndex - 1; i >= 0; i--) {
          if (flattened[i].depth === 0) {
            branchStartIndex = i
            break
          }
        }
        
        // Find the end of this conversation branch
        let branchEndIndex = branchStartIndex
        for (let i = branchStartIndex + 1; i < flattened.length; i++) {
          if (flattened[i].depth === 0) {
            break
          }
          branchEndIndex = i
        }
        
        // Extract the entire conversation branch
        const conversationBranch = flattened.splice(branchStartIndex, branchEndIndex - branchStartIndex + 1)
        
        // Add the conversation branch at the beginning
        flattened.unshift(...conversationBranch)
      }
    }
  }
  
  return flattened
})

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString()
}

const getBlueskyUrl = (post: any) => {
  return blueskyService.getPostUrl(post)
}

const isOwnPost = computed(() => {
  return props.userProfile && props.post.post.author.handle === props.userProfile.handle
})

const isReply = computed(() => {
  return props.post.post.record.reply !== undefined
})

const viewProfile = (handle: string) => {
  // Navigate to profile view - emit event to parent
  emit('viewProfile', handle)
}

const handlePostClick = () => {
  // Only open thread modal if not a context post
  if (!props.isContext) {
    openThreadModal()
  }
}

const handleRemove = (target: string, groupName?: string) => {
  emit('moderate', props.post, 'remove', groupName ? `group:${groupName}` : target)
  showRemoveModal.value = false
  showGroupSelector.value = false
}

const handleRemoveFromFeeds = () => {
  if (selectedFeeds.value.length > 0) {
    emit('moderate', props.post, 'remove', `feeds:${selectedFeeds.value.join(',')}`)
    showFeedSelector.value = false
    showRemoveModal.value = false
    selectedFeeds.value = []
  }
}

const handleBanFromFeeds = () => {
  if (selectedBanFeeds.value.length > 0) {
    emit('moderate', props.post, 'ban', `feeds:${selectedBanFeeds.value.join(',')}`)
    showBanFeedSelector.value = false
    showBanModal.value = false
    selectedBanFeeds.value = []
  }
}

const handleBan = (target: string, groupName?: string) => {
  emit('moderate', props.post, 'ban', groupName ? `group:${groupName}` : target)
  showBanModal.value = false
  showBanGroupSelector.value = false
}

const handleBulkRemove = (target: string, groupName?: string) => {
  const userHandle = bulkRemoveForm.value.userHandle.replace('@', '')
  let feedIds
  
  if (target === 'current') {
    // Use current feed if it's owned, otherwise fallback to configured feeds
    if (props.currentFeed && props.currentFeed !== 'timeline' && props.currentFeed !== 'discover') {
      const currentFeed = props.userFeeds?.find(f => f.feed_uri === props.currentFeed)
      if (currentFeed) {
        feedIds = [currentFeed.feed_id]
      } else {
        feedIds = props.userFeeds?.map(f => f.feed_id) || []
      }
    } else {
      feedIds = props.userFeeds?.map(f => f.feed_id) || []
    }
  } else if (target === 'all') {
    feedIds = ['all']
  } else if (target === 'configured') {
    feedIds = props.userFeeds?.map(f => f.feed_id) || []
  } else if (target === 'feeds') {
    feedIds = selectedBulkFeeds.value
  } else if (target === 'group') {
    // Handle group selection - get all feeds in the group
    const group = props.userGroups?.find(g => g.group_name === groupName)
    if (group && group.feeds) {
      feedIds = group.feeds.map(f => f.feed_id)
    } else {
      feedIds = props.userFeeds?.map(f => f.feed_id) || []
    }
  } else {
    feedIds = props.userFeeds?.map(f => f.feed_id) || []
  }
  
  emit('moderate', props.post, 'bulk-remove', {
    userHandle,
    postCount: parseInt(bulkRemoveForm.value.postCount),
    feedIds
  })
  
  showBulkRemoveModal.value = false
  showBulkFeedSelector.value = false
  showBulkGroupSelector.value = false
  bulkRemoveForm.value.userHandle = ''
  selectedBulkFeeds.value = []
}

const handleBulkRemoveFromFeeds = () => {
  if (selectedBulkFeeds.value.length > 0) {
    handleBulkRemove('feeds')
  }
}

const openBulkRemoveModal = () => {
  bulkRemoveForm.value.userHandle = props.post.post.author.handle
  showBulkRemoveModal.value = true
}

const handleReplyPost = () => {
  emit('reply', null) // Clear reply state after posting
}

const toggleReplies = async () => {
  if (!showReplies.value) {
    loadingReplies.value = true
    try {
      const result = await blueskyService.getPostThread(props.post.post.uri)
      console.log('Thread result:', result)
      if (result.success && result.thread) {
        console.log('Thread data:', result.thread)
        // The thread structure might be different - check for replies in the thread
        if (result.thread.replies && result.thread.replies.length > 0) {
          replies.value = result.thread.replies
        } else if (result.thread.post && result.thread.post.replies) {
          replies.value = result.thread.post.replies
        } else {
          replies.value = []
        }
        console.log('Set replies:', replies.value)
      } else {
        replies.value = []
      }
    } catch (error) {
      console.error('Failed to load replies:', error)
      replies.value = []
    } finally {
      loadingReplies.value = false
    }
  }
  showReplies.value = !showReplies.value
}

const handleThreadReply = () => {
  // Refresh replies after posting
  if (showReplies.value) {
    toggleReplies()
  }
}

const handleRefreshReplies = () => {
  // Refresh replies when nested reply is posted
  if (showReplies.value) {
    toggleReplies()
  }
}

const showReplyComposer = (reply: any) => {
  activeReplyComposer.value = activeReplyComposer.value === reply.post.uri ? null : reply.post.uri
}

const handleInlineReply = () => {
  activeReplyComposer.value = null
  handleRefreshReplies()
}

const handleReplyRepost = (reply: any) => {
  emit('repost', reply)
}

const handleReplyQuote = (reply: any) => {
  emit('quote', reply)
}

const handleReplyLike = (reply: any) => {
  emit('like', reply)
}

const handleReplyRemove = (reply: any) => {
  emit('moderate', reply, 'remove')
}

const handleReplyBan = (reply: any) => {
  emit('moderate', reply, 'ban')
}

const handleRepost = () => {
  emit('repost', props.post)
  showRepostMenu.value = false
}

const handleQuote = () => {
  emit('quote', props.post)
  showRepostMenu.value = false
}

onMounted(async () => {
  // Load collapsed state
  loadCollapsedState()
  
  // Extract URLs from post text for link previews
  if (props.post.post.record.text) {
    extractedUrls.value = linkPreviewService.extractUrls(props.post.post.record.text)
  }
  
  // Auto-expand replies if forced
  if (props.forceShowReplies) {
    await toggleReplies()
  }
  
  // Load parent post context for replies
  if (isReply.value && props.post.post.record.reply?.parent?.uri) {
    loadingParent.value = true
    try {
      const result = await blueskyService.getPostThread(props.post.post.record.reply.parent.uri)
      if (result.success && result.thread) {
        parentPost.value = result.thread
      }
    } catch (error) {
      console.error('Failed to load parent post:', error)
    } finally {
      loadingParent.value = false
    }
  }
})

const handleAvatarError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = '/icon-192.svg'
  avatarLoaded.value = true
}

const handleAvatarLoad = () => {
  avatarLoaded.value = true
}

const handleQuoteAvatarError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = '/icon-192.svg'
  quoteAvatarLoaded.value = true
}

const handleQuoteAvatarLoad = () => {
  quoteAvatarLoaded.value = true
}

const handleReplyAvatarError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = '/icon-192.svg'
  replyAvatarLoaded.value = true
}

const handleReplyAvatarLoad = () => {
  replyAvatarLoaded.value = true
}

const formatPostText = (text: string) => {
  if (!text) return ''
  
  return text
    // Convert URLs to links
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="post-link">$1</a>')
    // Convert @mentions to links
    .replace(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="https://bsky.app/profile/$1" target="_blank" class="post-mention">@$1</a>')
    // Convert hashtags to links
    .replace(/#([a-zA-Z0-9_]+)/g, '<a href="https://bsky.app/hashtag/$1" target="_blank" class="post-hashtag">#$1</a>')
    // Preserve line breaks
    .replace(/\n/g, '<br>')
}

const openImageModal = (image: any, index: number, gallery: any[]) => {
  currentImage.value = image
  currentImageIndex.value = index
  imageGallery.value = gallery
  showImageModal.value = true
}

const closeImageModal = () => {
  showImageModal.value = false
  currentImage.value = null
  imageGallery.value = []
}

const nextImage = () => {
  if (currentImageIndex.value < imageGallery.value.length - 1) {
    currentImageIndex.value++
    currentImage.value = imageGallery.value[currentImageIndex.value]
  }
}

const openThreadModal = async () => {
  showThreadModal.value = true
  loadingThread.value = true
  originalPostUri.value = props.post.post.uri
  
  try {
    // Get the full thread from root
    const targetUri = props.post.post.record.reply?.root?.uri || props.post.post.uri
    const result = await blueskyService.getPostThread(targetUri)
    
    if (result.success && result.thread) {
      threadData.value = result.thread
    } else {
      threadData.value = null
    }
  } catch (error) {
    console.error('Failed to load thread:', error)
    threadData.value = null
  } finally {
    loadingThread.value = false
  }
}

const closeThreadModal = () => {
  showThreadModal.value = false
  threadData.value = null
  originalPostUri.value = null
}

const handleTouchStart = (e: TouchEvent) => {
  touchStartX.value = e.changedTouches[0].screenX
}

const handleTouchEnd = (e: TouchEvent) => {
  touchEndX.value = e.changedTouches[0].screenX
  handleSwipe()
}

const handleSwipe = () => {
  const swipeDistance = touchEndX.value - touchStartX.value
  if (swipeDistance > 100) { // Swipe right to close
    closeThreadModal()
  }
}

const prevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
    currentImage.value = imageGallery.value[currentImageIndex.value]
  }
}

const getVideoUrl = (videoEmbed: any) => {
  if (!videoEmbed) return ''
  
  // Handle app.bsky.embed.video#view format with playlist
  if (videoEmbed.$type === 'app.bsky.embed.video#view' && videoEmbed.playlist) {
    return videoEmbed.playlist
  }
  
  // Handle playlist URL (HLS)
  if (videoEmbed.playlist) {
    return videoEmbed.playlist
  }
  
  // Handle blob reference - construct proper CDN URL
  if (videoEmbed.ref?.$link) {
    return `https://bsky.social/xrpc/com.atproto.sync.getBlob?cid=${videoEmbed.ref.$link}`
  }
  
  // Handle nested blob reference
  if (videoEmbed.blob?.ref?.$link) {
    return `https://bsky.social/xrpc/com.atproto.sync.getBlob?cid=${videoEmbed.blob.ref.$link}`
  }
  
  // Fallback to other formats
  return videoEmbed.ref?.link || videoEmbed.blob?.ref?.link || ''
}

const isYouTubeUrl = (url: string) => {
  if (!url) return false
  return url.includes('youtube.com/watch') || url.includes('youtu.be/')
}

const getYouTubeEmbedUrl = (url: string) => {
  if (!url) return ''
  
  // Extract video ID from different YouTube URL formats
  let videoId = ''
  
  if (url.includes('youtube.com/watch')) {
    const urlParams = new URLSearchParams(url.split('?')[1])
    videoId = urlParams.get('v') || ''
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0] || ''
  }
  
  if (!videoId) return ''
  
  return `https://www.youtube.com/embed/${videoId}`
}

const getQuotedPost = (embed: any) => {
  if (!embed) return null
  
  // Direct quote (no media)
  if (embed.$type === 'app.bsky.embed.record#view') {
    return embed.record
  }
  
  // Quote with media (recordWithMedia)
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    return embed.record?.record
  }
  
  // Legacy fallback
  return embed.record || embed.media?.record || null
}


</script>

<style scoped>
.collapse-button-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.125rem 0;
}

.collapse-button-container .moderation-actions {
  display: flex;
  gap: 0.25rem;
}

.collapse-toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.collapse-toggle-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.collapse-action-btn {
  color: var(--text-secondary) !important;
}

.collapse-action-btn:hover {
  color: var(--text-primary) !important;
  background: var(--bg-primary) !important;
}

.collapse-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.collapse-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.post-card {
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
}

.post-card.is-reply {
  display: flex;
  position: relative;
}

.post-card.is-reply .reply-connector {
  height: calc(100% - 2rem);
}

.reply-connector {
  width: 1px;
  background: var(--border-primary);
  margin-right: 0.75rem;
  flex-shrink: 0;
  margin-top: 0;
  margin-bottom: 0;
}

.post-content-wrapper {
  flex: 1;
}

.parent-context {
  margin-bottom: 1rem;
  position: relative;
}

.parent-post {
  opacity: 0.8;
  transform: scale(0.95);
}

.parent-post .post-card {
  pointer-events: none;
  cursor: default;
}

.context-arrow {
  text-align: center;
  color: var(--text-secondary);
  font-size: 1.2rem;
  margin: 0.5rem 0;
}

.post-card.is-context {
  cursor: default;
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
}

.post-card.is-context:hover {
  background: var(--bg-secondary);
}

.post-card.is-original {
  border: 2px solid #3b82f6;
  background: rgba(59, 130, 246, 0.05);
  animation: highlight 2s ease-out;
}

.reply-context {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-card);
  border-radius: 6px;
  border: none;
  margin-left: 0;
  width: 100%;
  clear: both;
  display: block;
  position: relative;
  float: none;
}

.reply-context-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.reply-context-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.4;
}

@keyframes highlight {
  0% {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
  }
  100% {
    box-shadow: none;
  }
}

.post-card:hover {
  background: var(--bg-primary);
}

@media (max-width: 768px) {
  .post-card {
    margin: 0;
    border-radius: 8px;
  }
}

.post-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.post-header .post-time {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.post-time-container {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bluesky-link {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bluesky-link:hover {
  color: #3b82f6;
  background: var(--bg-primary);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  transition: opacity 0.2s;
  background: var(--bg-secondary);
}

.avatar:hover {
  opacity: 0.8;
}

.author-info {
  flex: 1;
  line-height: 1;
  cursor: pointer;
  transition: opacity 0.2s;
}

.author-info:hover {
  opacity: 0.8;
}

.author-name {
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.author-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 2px;
}

.reply-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 0.125rem 0.375rem;
  border-radius: 12px;
  border: 1px solid var(--border-primary);
}

.reply-indicator svg {
  opacity: 0.7;
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  margin-left: auto;
}

.post-time-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.moderation-actions {
  display: flex;
  gap: 0.25rem;
}

.mod-btn {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: none;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
}

.mod-btn:hover {
  background: var(--bg-primary);
  transform: translateY(-1px);
}

.mod-btn:focus {
  outline: none;
  box-shadow: none;
}

.mod-btn.remove:hover {
  background: #fef2f2;
  color: #dc2626;
}

.mod-btn.ban:hover {
  background: #fef2f2;
  color: #991b1b;
}

.post-time-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.moderation-actions {
  display: flex;
  gap: 0.25rem;
}

.mod-btn {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: none;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
}

.mod-btn:hover {
  background: var(--bg-primary);
  transform: translateY(-1px);
}

.mod-btn:focus {
  outline: none;
  box-shadow: none;
}

.mod-btn.remove:hover {
  background: #fef2f2;
  color: #dc2626;
}

.mod-btn.ban:hover {
  background: #fef2f2;
  color: #991b1b;
}

.post-time {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.author-handle {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin: 0;
  line-height: 1.2;
}

.post-content {
  margin-bottom: 0.75rem;
  line-height: 1.5;
}

.post-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.5;
}

.post-text :deep(.post-link) {
  color: #3b82f6;
  text-decoration: none;
}

.post-text :deep(.post-link:hover) {
  text-decoration: underline;
}

.post-text :deep(.post-mention) {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.post-text :deep(.post-mention:hover) {
  text-decoration: underline;
}

.post-text :deep(.post-hashtag) {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.post-text :deep(.post-hashtag:hover) {
  text-decoration: underline;
}

.post-images {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
  border-radius: 8px;
  overflow: hidden;
}

.post-images.images-1 {
  grid-template-columns: 1fr;
}

.post-images.images-2 {
  grid-template-columns: 1fr 1fr;
}

.post-images.images-3 {
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.post-images.images-3 .post-image:first-child {
  grid-row: 1 / 3;
}

.post-images.images-3 .post-image:nth-child(2) {
  grid-column: 2;
  grid-row: 1;
}

.post-images.images-3 .post-image:nth-child(3) {
  grid-column: 2;
  grid-row: 2;
}

.post-images.images-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.post-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  cursor: pointer;
  transition: opacity 0.2s;
}

.post-images.images-1 .post-image {
  height: 300px;
}

.post-image:hover {
  opacity: 0.9;
}

.post-video {
  margin-top: 0.75rem;
  border-radius: 8px;
  overflow: hidden;
}

.post-video-player {
  width: 100%;
  max-height: 400px;
  background: #000;
  border-radius: 8px;
}

.quote-post {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 0.75rem;
  margin-top: 0.75rem;
  background: var(--bg-primary);
}

.quote-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.quote-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bg-secondary);
}

.quote-author {
  font-weight: 600;
  font-size: 0.875rem;
}

.quote-handle {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.quote-text {
  margin: 0;
  font-size: 0.875rem;
}

.quote-images {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.5rem;
  border-radius: 6px;
  overflow: hidden;
}

.quote-images.images-1 {
  grid-template-columns: 1fr;
}

.quote-images.images-2 {
  grid-template-columns: 1fr 1fr;
}

.quote-images.images-3 {
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.quote-images.images-3 .quote-image:first-child {
  grid-row: 1 / 3;
}

.quote-images.images-3 .quote-image:nth-child(2) {
  grid-column: 2;
  grid-row: 1;
}

.quote-images.images-3 .quote-image:nth-child(3) {
  grid-column: 2;
  grid-row: 2;
}

.quote-images.images-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.quote-image {
  width: 100%;
  height: 120px;
  object-fit: cover;
  cursor: pointer;
  transition: opacity 0.2s;
}

.quote-images.images-1 .quote-image {
  height: 150px;
}

.quote-image:hover {
  opacity: 0.9;
}

.quote-video {
  margin-top: 0.5rem;
  border-radius: 6px;
  overflow: hidden;
}

.quote-video-player {
  width: 100%;
  max-height: 250px;
  background: #000;
  border-radius: 6px;
}

.external-link {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  overflow: hidden;
  margin-top: 0.75rem;
}

.youtube-embed {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
}

.youtube-player {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 8px;
}

.link-thumb {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.link-info {
  padding: 0.75rem;
}

.link-info h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
}

.link-info p {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.link-info a {
  font-size: 0.75rem;
  color: #3b82f6;
  text-decoration: none;
}

.link-info a:hover {
  text-decoration: underline;
}

.post-actions {
  display: flex;
  justify-content: center;
  gap: 2rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--border-primary);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.action-btn.liked {
  color: #e91e63;
}

.repost-container {
  position: relative;
}

.repost-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 0.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 140px;
}

.repost-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: background-color 0.2s;
}

.repost-option:hover {
  background: var(--bg-primary);
}

.repost-option:first-child {
  border-radius: 8px 8px 0 0;
}

.repost-option:last-child {
  border-radius: 0 0 8px 8px;
}

.action-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-btn.active {
  background: #f0f9ff;
  color: #3b82f6;
}

.repost-menu {
  position: absolute;
  top: -80px;
  left: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 140px;
}

.repost-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: background-color 0.2s;
}

.repost-option:hover {
  background: var(--bg-primary);
}

.repost-option:first-child {
  border-radius: 8px 8px 0 0;
}

.repost-option:last-child {
  border-radius: 0 0 8px 8px;
}

.action-btn.bookmarked {
  color: #f59e0b;
}

.moderated-badge {
  text-align: center;
  padding: 0.25rem 0.5rem;
  background: #6b7280;
  color: white;
  border-radius: 4px;
  font-size: 0.75rem;
  margin-top: 0.5rem;
}

.replies-thread {
  margin-top: 1rem;
  padding-top: 1rem;
}

.replies-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.reply-item-flat {
  display: flex;
  position: relative;
}

.reply-connector {
  width: 1px;
  background: var(--border-primary);
  margin-right: 0.75rem;
  flex-shrink: 0;
}

.reply-item-flat.depth-0 .reply-connector {
  display: none;
}

.reply-content-wrapper {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 0.75rem;
}

.reply-header {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.reply-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--bg-secondary);
}

.reply-author-info {
  flex: 1;
  min-width: 0;
  line-height: 1;
}

.reply-author-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.reply-handle {
  color: var(--text-secondary);
  font-size: 0.75rem;
  margin: 0;
  line-height: 1.2;
}

.reply-header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  margin-left: auto;
}

.reply-time-container {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.reply-moderation-actions {
  display: flex;
  gap: 0.25rem;
}

.reply-mod-btn {
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  border: none;
  font-size: 0.625rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
}

.reply-mod-btn:hover {
  background: var(--bg-primary);
  transform: translateY(-1px);
}

.reply-mod-btn:focus {
  outline: none;
  box-shadow: none;
}

.reply-mod-btn.remove:hover {
  background: #fef2f2;
  color: #dc2626;
}

.reply-mod-btn.ban:hover {
  background: #fef2f2;
  color: #991b1b;
}

.reply-text {
  font-size: 0.875rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin-bottom: 0.5rem;
}

.reply-text :deep(.post-link) {
  color: #3b82f6;
  text-decoration: none;
}

.reply-text :deep(.post-link:hover) {
  text-decoration: underline;
}

.reply-text :deep(.post-mention) {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.reply-text :deep(.post-mention:hover) {
  text-decoration: underline;
}

.reply-text :deep(.post-hashtag) {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.reply-text :deep(.post-hashtag:hover) {
  text-decoration: underline;
}

.reply-actions {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  padding: 0.5rem 0;
  border-top: 1px solid var(--border-primary);
  margin-top: 0.5rem;
}

.reply-actions .action-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.reply-actions .action-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.reply-actions .action-btn.liked {
  color: #e91e63;
}

.inline-reply-composer {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-primary);
}

.loading-replies {
  text-align: center;
  padding: 1rem;
  color: var(--text-secondary);
  font-style: italic;
}

.no-replies {
  text-align: center;
  padding: 1rem;
  color: var(--text-secondary);
  font-style: italic;
}

.thread-reply-composer {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary);
}

.post-card.moderated {
  opacity: 0.6;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  opacity: 1 !important;
}

.modal-content {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 0;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border-primary);
  overflow: hidden;
  opacity: 1 !important;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1.5rem 1rem 1.5rem;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-primary);
}

.modal-header svg {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.modal-content h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.125rem;
  font-weight: 600;
}

.modal-content p {
  margin: 0 0 1.5rem 0;
  color: var(--text-secondary);
  line-height: 1.4;
  padding: 0 1.5rem;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding: 0 1.5rem;
}

.modal-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  text-align: left;
  outline: none;
}

.modal-btn svg {
  flex-shrink: 0;
}

.modal-btn:focus {
  outline: none;
  box-shadow: none;
}

.modal-btn.primary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.modal-btn.primary:hover {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
  transform: translateY(-1px);
}

.modal-btn.danger {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.modal-btn.danger:hover {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
  transform: translateY(-1px);
}

.modal-btn.secondary {
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
}

.modal-btn.secondary:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.modal-btn.disabled {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: not-allowed;
  opacity: 0.5;
}

.modal-btn.disabled:hover {
  background: var(--bg-secondary);
  transform: none;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.5rem 1.5rem;
  border-top: 1px solid var(--border-primary);
  background: var(--bg-primary);
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.group-item {
  padding: 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  font-weight: 500;
}

.group-item:hover {
  background: var(--bg-secondary);
  border-color: #3b82f6;
  color: #3b82f6;
  transform: translateY(-1px);
}

.feed-selector-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  max-height: 300px;
  overflow-y: auto;
}

.feed-selector-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.feed-selector-item:hover {
  background: var(--bg-secondary);
  border-color: #3b82f6;
}

.feed-selector-item input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}

.feed-selector-item .feed-name {
  font-weight: 500;
  color: var(--text-primary);
}

.no-feeds-message {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  font-style: italic;
}

.no-feeds-message p {
  margin: 0;
}

.link-previews {
  margin-top: 0.75rem;
}

.image-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.image-modal-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.image-modal-close {
  position: absolute;
  top: -50px;
  right: 0;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  padding: 0.5rem;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s;
  z-index: 1;
}

.image-modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.image-modal-img {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 8px;
}

.image-modal-alt {
  color: white;
  background: rgba(0, 0, 0, 0.7);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  margin-top: 1rem;
  max-width: 80%;
  text-align: center;
  font-size: 0.875rem;
}

.image-modal-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  color: white;
}

.nav-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  padding: 0.5rem;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.image-counter {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
}

.thread-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.thread-modal-content {
  background: var(--bg-card);
  border-radius: 12px;
  max-width: 95vw;
  max-height: 95vh;
  width: 95vw;
  height: 95vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-primary);
  touch-action: pan-x;
}

.thread-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-primary);
}

.thread-modal-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.125rem;
  font-weight: 600;
}

.thread-modal-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  transition: background 0.2s;
}

.thread-modal-close:hover {
  background: var(--bg-secondary);
}

.thread-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.thread-loading,
.thread-error {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.thread-content {
  /* Remove post card styling in modal */
}

.thread-content .post-card {
  cursor: default;
  border: none;
  padding: 0;
  background: transparent;
}

.thread-content .post-card:hover {
  background: transparent;
}

.post-debug {
  margin-top: 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: var(--bg-secondary);
}

.post-debug details {
  padding: 0.5rem;
}

.post-debug summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--text-secondary);
  padding: 0.25rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.post-debug summary:hover {
  background: var(--bg-primary);
}

.post-debug pre {
  margin: 0.5rem 0 0 0;
  padding: 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  overflow-y: auto;
}

.mod-btn.bulk-remove:hover {
  background: #fef3c7;
  color: #d97706;
}

.bulk-form {
  padding: 0 1.5rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.form-row label {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.post-count-select {
  padding: 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.875rem;
}
</style>