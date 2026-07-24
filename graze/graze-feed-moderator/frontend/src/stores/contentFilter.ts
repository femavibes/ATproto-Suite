import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export const useContentFilterStore = defineStore('contentFilter', () => {
  const hideNSFW = ref(true)
  const hideSensitive = ref(false)
  const hideSpam = ref(true)
  const showContentWarnings = ref(true)

  const initializeFilters = async () => {
    try {
      const response = await axios.get('/api/user/preferences')
      const prefs = response.data
      
      hideNSFW.value = prefs.hide_nsfw ?? true
      hideSensitive.value = prefs.hide_sensitive ?? false
      hideSpam.value = prefs.hide_spam ?? true
      showContentWarnings.value = prefs.show_content_warnings ?? true
    } catch (error) {
      // Use defaults
      hideNSFW.value = true
      hideSensitive.value = false
      hideSpam.value = true
      showContentWarnings.value = true
    }
  }

  const updateFilter = async (key: string, value: boolean) => {
    try {
      await axios.put('/api/user/preferences', {
        [key]: value
      })
    } catch (error) {
      console.error('Failed to save content filter preference:', error)
    }
  }

  const setHideNSFW = (value: boolean) => {
    hideNSFW.value = value
    updateFilter('hide_nsfw', value)
  }

  const setHideSensitive = (value: boolean) => {
    hideSensitive.value = value
    updateFilter('hide_sensitive', value)
  }

  const setHideSpam = (value: boolean) => {
    hideSpam.value = value
    updateFilter('hide_spam', value)
  }

  const setShowContentWarnings = (value: boolean) => {
    showContentWarnings.value = value
    updateFilter('show_content_warnings', value)
  }

  const shouldHidePost = (post: any): boolean => {
    if (!post?.labels) return false

    const labels = Array.isArray(post.labels) ? post.labels : []
    
    for (const label of labels) {
      const labelValue = label.val || label
      
      if (hideNSFW.value && (labelValue === 'porn' || labelValue === 'sexual' || labelValue === 'nudity')) {
        return true
      }
      
      if (hideSensitive.value && (labelValue === 'graphic-media' || labelValue === 'violence')) {
        return true
      }
      
      if (hideSpam.value && labelValue === 'spam') {
        return true
      }
    }
    
    return false
  }

  const getContentWarning = (post: any): string | null => {
    if (!showContentWarnings.value || !post?.labels) return null

    const labels = Array.isArray(post.labels) ? post.labels : []
    
    for (const label of labels) {
      const labelValue = label.val || label
      
      if (labelValue === 'porn' || labelValue === 'sexual') {
        return 'Sexual Content'
      }
      if (labelValue === 'nudity') {
        return 'Nudity'
      }
      if (labelValue === 'graphic-media' || labelValue === 'violence') {
        return 'Graphic Content'
      }
      if (labelValue === 'spam') {
        return 'Potential Spam'
      }
    }
    
    return null
  }

  return {
    hideNSFW,
    hideSensitive,
    hideSpam,
    showContentWarnings,
    initializeFilters,
    setHideNSFW,
    setHideSensitive,
    setHideSpam,
    setShowContentWarnings,
    shouldHidePost,
    getContentWarning
  }
})