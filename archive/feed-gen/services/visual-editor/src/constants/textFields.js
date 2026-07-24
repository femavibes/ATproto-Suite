/**
 * Text Field Definitions for Text Contains Block
 * Maps raw field names to friendly display names
 */

export const TEXT_FIELDS = {
  // Core post text
  'text': {
    label: 'Post Text',
    description: 'Main post text content',
    category: 'Core',
  },
  
  // Image alt text
  'embed.images[*].alt': {
    label: 'Image Alt Text',
    description: 'Alt text from all images in post',
    category: 'Media',
  },
  
  // Video alt text
  'embed.alt': {
    label: 'Video Alt Text',
    description: 'Alt text from video embeds',
    category: 'Media',
  },
  
  // External link fields
  'embed.external.uri': {
    label: 'Link URL',
    description: 'URL from link cards',
    category: 'Links',
  },
  'embed.external.title': {
    label: 'Link Title',
    description: 'Title from link cards',
    category: 'Links',
  },
  'embed.external.description': {
    label: 'Link Description',
    description: 'Description from link cards',
    category: 'Links',
  },
  
  // Quote with media - image alt text
  'embed.media.images[*].alt': {
    label: 'Quote Media Image Alt Text',
    description: 'Alt text from images in quote posts with media',
    category: 'Media',
  },
  
  // Quote with media - link fields
  'embed.media.external.uri': {
    label: 'Quote Media Link URL',
    description: 'URL from link cards in quote posts with media',
    category: 'Links',
  },
  'embed.media.external.title': {
    label: 'Quote Media Link Title',
    description: 'Title from link cards in quote posts with media',
    category: 'Links',
  },
  'embed.media.external.description': {
    label: 'Quote Media Link Description',
    description: 'Description from link cards in quote posts with media',
    category: 'Links',
  },
  
  // Link URLs in facets (links in post text)
  'facets[*].features[*].uri': {
    label: 'Link URLs in Text',
    description: 'URLs from links embedded in post text',
    category: 'Links',
  },
  
  // Hashtags
  'facets[*].features[*].tag': {
    label: 'Hashtags',
    description: 'Hashtags in post text (including hidden hashtags)',
    category: 'Tags',
  },
  
  // Outline tags
  'tags[*]': {
    label: 'Outline Tags',
    description: 'Bluesky outline tags or bridged platform tags',
    category: 'Tags',
  },
  
  // Bridged content
  'bridgyOriginalText': {
    label: 'Bridged Original Text',
    description: 'Original text from bridged platforms (Mastodon, web, etc.)',
    category: 'Bridged',
  },
  'bridgyOriginalUrl': {
    label: 'Bridged Original URL',
    description: 'Original URL from bridged platform (Mastodon, web, etc.)',
    category: 'Bridged',
  },

  // Reply thread URIs (niche — use for thread-specific filtering)
  'reply.parent.uri': {
    label: 'Reply Parent URI',
    description: 'AT-URI of the direct parent post this is replying to',
    category: 'Reply',
  },
  'reply.root.uri': {
    label: 'Reply Root URI',
    description: 'AT-URI of the root/top post of the thread',
    category: 'Reply',
  },
}

/**
 * Get all fields grouped by category
 */
export const getFieldsByCategory = () => {
  const categories = {}
  Object.entries(TEXT_FIELDS).forEach(([field, config]) => {
    if (!categories[config.category]) {
      categories[config.category] = []
    }
    categories[config.category].push({
      field,
      ...config,
    })
  })
  return categories
}

/**
 * Get friendly label for a field
 */
export const getFieldLabel = (field) => {
  return TEXT_FIELDS[field]?.label || field
}

/**
 * Get all field options for multiselect
 */
export const getFieldOptions = () => {
  return Object.entries(TEXT_FIELDS).map(([field, config]) => ({
    value: field,
    label: config.label,
    description: config.description,
    category: config.category,
  }))
}
