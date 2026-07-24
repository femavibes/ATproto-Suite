<template>
  <div class="reply-item" :style="{ marginLeft: `${depth * 20}px` }">
    <div class="reply-header">
      <img :src="reply.post.author.avatar || '/icon-192.svg'" class="reply-avatar">
      <div class="reply-author-info">
        <span class="reply-author">{{ reply.post.author.displayName || reply.post.author.handle }}</span>
        <span class="reply-handle">@{{ reply.post.author.handle }}</span>
        <span class="reply-time">{{ formatTime(reply.post.record.createdAt) }}</span>
      </div>
    </div>
    <div class="reply-content">
      <div class="reply-text" v-html="formatPostText(reply.post.record.text)"></div>
    </div>
    
    <div class="reply-actions">
      <button @click="showReplyComposer = !showReplyComposer" class="action-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/>
        </svg>
        {{ reply.post.replyCount || 0 }}
      </button>
      <button @click="handleRepost" class="action-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
        </svg>
        {{ reply.post.repostCount || 0 }}
      </button>
      <button @click="handleQuote" class="action-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 17h3l2-4V7h-6v6h3M6 17h3l2-4V7H5v6h3l-2 4z"/>
        </svg>
      </button>
      <button @click="handleLike" class="action-btn" :class="{ liked: reply.post.viewer?.like }">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
        {{ reply.post.likeCount || 0 }}
      </button>
    </div>
    
    <!-- Reply Composer -->
    <div v-if="showReplyComposer" class="reply-composer">
      <BskyComposer 
        :reply-to="reply"
        :user-avatar="props.userProfile?.avatar"
        @post="handleReplyPost"
        @cancel="showReplyComposer = false"
        compact
      />
    </div>
    
    <!-- Nested replies -->
    <div v-if="reply.replies && reply.replies.length > 0" class="nested-replies">
      <BskyReply 
        v-for="nestedReply in reply.replies" 
        :key="nestedReply.post.uri"
        :reply="nestedReply"
        :depth="depth + 1"
        :user-profile="props.userProfile"
        @refresh-replies="$emit('refreshReplies')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BskyComposer from './BskyComposer.vue'
interface Props {
  reply: any
  depth: number
  userProfile?: any
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refreshReplies: []
}>()

const showReplyComposer = ref(false)

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatPostText = (text: string) => {
  if (!text) return ''
  
  return text
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="post-link">$1</a>')
    .replace(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="https://bsky.app/profile/$1" target="_blank" class="post-mention">@$1</a>')
    .replace(/#([a-zA-Z0-9_]+)/g, '<a href="https://bsky.app/hashtag/$1" target="_blank" class="post-hashtag">#$1</a>')
    .replace(/\n/g, '<br>')
}

const handleReplyPost = () => {
  showReplyComposer.value = false
  emit('refreshReplies')
}

const handleRepost = () => {
  // TODO: Implement repost functionality
  console.log('Repost reply:', props.reply.post.uri)
}

const handleQuote = () => {
  // TODO: Implement quote functionality
  console.log('Quote reply:', props.reply.post.uri)
}

const handleLike = () => {
  // TODO: Implement like functionality
  console.log('Like reply:', props.reply.post.uri)
}
</script>

<style scoped>
.reply-item {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
}

.reply-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.reply-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.reply-author-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.reply-author {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.reply-handle {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.reply-time {
  color: var(--text-secondary);
  font-size: 0.75rem;
  margin-left: auto;
}

.reply-content {
  margin-left: 32px;
}

.reply-text {
  font-size: 0.875rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
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

.nested-replies {
  margin-top: 0.5rem;
}

.reply-composer {
  margin-top: 0.5rem;
  margin-left: 32px;
}

.reply-actions {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  padding: 0.5rem 0;
  border-top: 1px solid var(--border-primary);
  margin-top: 0.5rem;
}

.action-btn {
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

.action-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.action-btn.liked {
  color: #e91e63;
}
</style>