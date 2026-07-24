/**
 * Condition Evaluator
 * Evaluates individual conditions against a test post
 */

/**
 * Evaluate a text condition (Text Contains/Excludes)
 * Returns: { passed: boolean, reason: string, details: object }
 */
export function evaluateTextCondition(condition, post) {
  const keywords = (condition.keywords || []).map((k) =>
    typeof k === 'string' ? { value: k, wholeWord: false } : { value: String(k?.value || ''), wholeWord: !!k?.wholeWord }
  )
  const fields = condition.fields || ['text']
  const exclude = condition.exclude || false

  if (keywords.length === 0) {
    return { 
      passed: true, 
      reason: 'No keywords configured (always passes)',
      details: { keywords: [], fields, exclude }
    }
  }

  // Search in all specified fields
  let found = false
  let foundKeyword = null
  let foundField = null
  
  for (const field of fields) {
    const fieldValue = getFieldValue(post, field)
    if (fieldValue) {
      const text = String(fieldValue).toLowerCase()
      for (const keyword of keywords) {
        const value = String(keyword.value || '').toLowerCase()
        if (!value) continue
        const matched = keyword.wholeWord
          ? new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(String(fieldValue))
          : text.includes(value)
        if (matched) {
          found = true
          foundKeyword = keyword.value
          foundField = field
          break
        }
      }
      if (found) break
    }
  }

  const passed = exclude ? !found : found
  const reason = exclude
    ? (found 
        ? `Keyword "${foundKeyword}" found in ${foundField} (EXCLUDE mode = FAIL)`
        : `No keywords found in ${fields.join(', ')} (EXCLUDE mode = PASS)`)
    : (found
        ? `Keyword "${foundKeyword}" found in ${foundField}`
        : `No keywords found in ${fields.join(', ')}`)

  // Score modifier: only applies if post passed AND scoreModifier is set
  const scoreModifier = (passed && condition.scoreModifier !== undefined && condition.scoreModifier !== 0) 
    ? condition.scoreModifier 
    : 0

  return { 
    passed, 
    reason,
    scoreModifier,
    details: { keywords, fields, exclude, found, foundKeyword, foundField }
  }
}

/**
 * Evaluate a regex condition
 */
export function evaluateRegexCondition(condition, post) {
  const pattern = condition.pattern || ''
  const fields = condition.fields || ['text']
  const exclude = condition.exclude || false
  const flags = condition.flags || 'i'

  if (!pattern) {
    return { 
      passed: true, 
      reason: 'No regex pattern configured (always passes)',
      details: { pattern, fields, exclude }
    }
  }

  try {
    const regex = new RegExp(pattern, flags)
    let found = false
    let foundField = null

    for (const field of fields) {
      const fieldValue = getFieldValue(post, field)
      if (fieldValue) {
        if (regex.test(String(fieldValue))) {
          found = true
          foundField = field
          break
        }
      }
    }

    const passed = exclude ? !found : found
    const reason = exclude
      ? (found 
          ? `Pattern matched in ${foundField} (EXCLUDE mode = FAIL)`
          : `Pattern not found in ${fields.join(', ')} (EXCLUDE mode = PASS)`)
      : (found
          ? `Pattern matched in ${foundField}`
          : `Pattern not found in ${fields.join(', ')}`)

    // Score modifier: only applies if post passed AND scoreModifier is set
    const scoreModifier = (passed && condition.scoreModifier !== undefined && condition.scoreModifier !== 0) 
      ? condition.scoreModifier 
      : 0

    return { passed, reason, scoreModifier, details: { pattern, fields, exclude, found, foundField } }
  } catch (error) {
    return { 
      passed: false, 
      reason: `Invalid regex pattern: ${error.message}`,
      details: { pattern, error: error.message }
    }
  }
}

/**
 * Evaluate a language condition
 */
export function evaluateLanguageCondition(condition, post) {
  const languages = condition.languages || []
  const exclude = condition.exclude || false

  if (languages.length === 0) {
    return { 
      passed: true, 
      reason: 'No languages configured (always passes)',
      details: { languages, exclude }
    }
  }

  const postLangs = post.langs || []
  let matches = false
  let matchedLang = null

  for (const lang of languages) {
    // Match base language code (e.g., "en" matches "en" and "en-US")
    if (postLangs.some(postLang => postLang === lang || postLang.startsWith(lang + '-'))) {
      matches = true
      matchedLang = lang
      break
    }
  }

  const passed = exclude ? !matches : matches
  const reason = exclude
    ? (matches
        ? `Language "${matchedLang}" found (EXCLUDE mode = FAIL)`
        : `None of selected languages found in post (EXCLUDE mode = PASS)`)
    : (matches
        ? `Language "${matchedLang}" found in post`
        : `None of selected languages [${languages.join(', ')}] found in post [${postLangs.join(', ')}]`)

  // Score modifier: only applies if post passed AND scoreModifier is set
  const scoreModifier = (passed && condition.scoreModifier !== undefined && condition.scoreModifier !== 0) 
    ? condition.scoreModifier 
    : 0

  return { passed, reason, scoreModifier, details: { languages, postLangs, exclude, matches, matchedLang } }
}

/**
 * Evaluate a post type condition
 */
export function evaluatePostTypeCondition(condition, post) {
  const types = condition.types || []
  const exclude = condition.exclude || false
  const replyDepthEnabled = condition.replyDepthEnabled || false
  const replyDepthOperator = condition.replyDepthOperator || 'equals'
  const replyDepth = condition.replyDepth || 1

  // Check post type match
  let typeMatches = true
  if (types.length > 0) {
    const postType = post.post_type || 'post'
    const matches = types.includes(postType)
    typeMatches = exclude ? !matches : matches
  }

  // Check reply depth if enabled
  let depthMatches = true
  if (replyDepthEnabled) {
    const hasReply = !!(post.reply?.parent?.uri || post.reply?.root?.uri)
    if (!hasReply) {
      depthMatches = false
    } else {
      const parentUri = post.reply?.parent?.uri
      const rootUri = post.reply?.root?.uri
      // If parent equals root, it's depth 1, otherwise estimate depth 2+
      const estimatedDepth = (parentUri && rootUri && parentUri === rootUri) ? 1 : 2
      
      switch (replyDepthOperator) {
        case 'equals':
          depthMatches = estimatedDepth === replyDepth
          break
        case 'greater_than':
          depthMatches = estimatedDepth > replyDepth
          break
        case 'greater_equal':
          depthMatches = estimatedDepth >= replyDepth
          break
        case 'less_than':
          depthMatches = estimatedDepth < replyDepth
          break
        case 'less_equal':
          depthMatches = estimatedDepth <= replyDepth
          break
        default:
          depthMatches = false
      }
    }
  }

  // Both conditions must pass (AND logic)
  const passed = typeMatches && depthMatches
  
  let reason = ''
  if (types.length > 0 && replyDepthEnabled) {
    reason = passed
      ? `Post type matches AND reply depth matches`
      : `Post type ${typeMatches ? 'matches' : 'does not match'} AND reply depth ${depthMatches ? 'matches' : 'does not match'}`
  } else if (types.length > 0) {
    reason = typeMatches
      ? `Post type matches`
      : `Post type does not match`
  } else if (replyDepthEnabled) {
    reason = depthMatches
      ? `Reply depth matches`
      : `Reply depth does not match`
  } else {
    reason = 'No filters configured (always passes)'
  }

  // Score modifier: get the modifier for the post's actual type
  let scoreModifier = 0
  if (passed && condition.postTypeScores) {
    const postType = post.post_type || 'post'
    // Get the score for this specific post type
    scoreModifier = condition.postTypeScores[postType] !== undefined 
      ? condition.postTypeScores[postType] 
      : 0
  }

  return { 
    passed, 
    reason, 
    scoreModifier,
    details: { types, exclude, replyDepthEnabled, replyDepthOperator, replyDepth, typeMatches, depthMatches } 
  }
}

/**
 * Evaluate an author condition
 */
export function evaluateAuthorCondition(condition, post) {
  const authors = condition.authors || []
  const listUris = condition.listUris || []
  const exclude = condition.exclude || false

  // For now, only check individual authors (list support requires backend)
  if (authors.length === 0 && listUris.length === 0) {
    return { 
      passed: true, 
      reason: 'No authors configured (always passes)',
      scoreModifier: 0,
      details: { authors, listUris, exclude }
    }
  }

  const postAuthor = post.author_did || ''
  const matches = authors.includes(postAuthor)
  const passed = exclude ? !matches : matches
  
  const reason = exclude
    ? (matches
        ? `Author "${postAuthor}" found in list (EXCLUDE mode = FAIL)`
        : `Author not in excluded list (EXCLUDE mode = PASS)`)
    : (matches
        ? `Author "${postAuthor}" found in list`
        : `Author not in list`)

  // Score modifier: only applies if post passed AND scoreModifier is set
  const scoreModifier = (passed && condition.scoreModifier !== undefined && condition.scoreModifier !== 0) 
    ? condition.scoreModifier 
    : 0

  return { 
    passed, 
    reason,
    scoreModifier,
    details: { authors, listUris, exclude, matches, postAuthor }
  }
}

/**
 * Evaluate a links condition
 */
export function evaluateQuotePostCondition(condition, post) {
  const uris = condition.uris || []
  const dids = condition.dids || []
  const exclude = condition.exclude || false

  if (uris.length === 0 && dids.length === 0) {
    return { passed: true, reason: 'No quote targets configured (always passes)' }
  }

  const embed = post.embed || {}
  const record = embed.record || {}
  let quotedUri = ''
  if (record.record && typeof record.record === 'object') {
    quotedUri = record.record.uri || record.uri || ''
  } else {
    quotedUri = record.uri || ''
  }

  if (!quotedUri) {
    return { passed: exclude, reason: 'Post has no quote embed' }
  }

  let match = uris.length > 0 && uris.includes(quotedUri)
  if (!match && dids.length > 0) {
    // AT-URI: at://DID/collection/rkey
    const parts = quotedUri.split('/')
    if (parts.length >= 3 && parts[0] === 'at:') {
      const quotedDid = parts[2]
      match = dids.includes(quotedDid)
    }
  }

  const passed = exclude ? !match : match
  return { passed, reason: match ? 'Quoted post matched' : 'Quoted post not matched' }
}

export function evaluateLinksCondition(condition, post) {
  const urls = condition.urls || []
  const requireThumbnail = condition.requireThumbnail || false
  const exclude = condition.exclude || false

  const embed = post.embed || {}
  const external = embed.external || embed.media?.external || {}

  if (urls.length === 0 && !requireThumbnail) {
    return { 
      passed: true, 
      reason: 'No URLs configured (always passes)',
      details: { urls, exclude }
    }
  }

  // Thumbnail-only check (no URL filter)
  if (urls.length === 0 && requireThumbnail) {
    const hasThumb = !!external.thumb
    const passed = exclude ? !hasThumb : hasThumb
    return { passed, reason: hasThumb ? 'Link card has thumbnail' : 'Link card has no thumbnail' }
  }

  let found = false
  let foundUrl = null
  let foundLocation = null

  // Helper function to extract domain from URL
  const getDomain = (urlString) => {
    try {
      const url = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`)
      return url.hostname.replace(/^www\./, '') // Remove www. prefix
    } catch {
      return null
    }
  }

  // Helper function to check if two URLs match (exact match or same domain)
  const urlMatches = (postUrl, configUrl) => {
    if (!postUrl || !configUrl) return false
    
    // Exact match
    if (postUrl === configUrl) return true
    
    // Try to normalize both URLs for comparison
    try {
      const postDomain = getDomain(postUrl)
      const configDomain = getDomain(configUrl)
      
      if (postDomain && configDomain && postDomain === configDomain) {
        return true
      }
      
      // Check if postUrl starts with configUrl (for partial matches)
      if (postUrl.startsWith(configUrl)) return true
      
      // Check if configUrl is a domain and postUrl contains it
      if (postUrl.includes(configUrl)) return true
    } catch {
      // If URL parsing fails, just do string comparison
      return postUrl.includes(configUrl) || configUrl.includes(postUrl)
    }
    
    return false
  }

  // Check facets for links in text (facets[*].features[*].uri)
  const facets = post.facets || []
  for (const facet of facets) {
    const features = facet.features || []
    for (const feature of features) {
      // Check if feature is a link (#link type) and has a URI
      if (feature.$type === '#link' && feature.uri) {
        // Check if this URI matches any of our URLs
        for (const url of urls) {
          if (urlMatches(feature.uri, url)) {
            found = true
            foundUrl = feature.uri
            foundLocation = 'facets (text link)'
            break
          }
        }
        if (found) break
      }
    }
    if (found) break
  }

  // Check embed.external.uri for link cards
  if (!found && post.embed?.$type === 'app.bsky.embed.external' && post.embed.external?.uri) {
    const embedUri = post.embed.external.uri
    for (const url of urls) {
      if (urlMatches(embedUri, url)) {
        found = true
        foundUrl = embedUri
        foundLocation = 'embed.external (link card)'
        break
      }
    }
  }

  // Also check embed.media.external.uri for quote posts with media that have links
  if (!found && post.embed?.$type === 'app.bsky.embed.recordWithMedia') {
    const mediaExternal = post.embed.media?.external
    if (mediaExternal?.uri) {
      const mediaUri = mediaExternal.uri
      for (const url of urls) {
        if (urlMatches(mediaUri, url)) {
          found = true
          foundUrl = mediaUri
          foundLocation = 'embed.media.external (quote with media link)'
          break
        }
      }
    }
  }

  // If requireThumbnail, additionally check that the matched link card has a thumbnail
  if (found && requireThumbnail && !external.thumb) {
    found = false
    foundUrl = null
    foundLocation = null
  }

  const passed = exclude ? !found : found
  const reason = exclude
    ? (found
        ? `URL "${foundUrl}" found in ${foundLocation} (EXCLUDE mode = FAIL)`
        : `None of selected URLs found in post (EXCLUDE mode = PASS)`)
    : (found
        ? `URL "${foundUrl}" found in ${foundLocation}`
        : `None of selected URLs [${urls.join(', ')}] found in post`)

  // Score modifier: only applies if post passed AND scoreModifier is set
  const scoreModifier = (passed && condition.scoreModifier !== undefined && condition.scoreModifier !== 0) 
    ? condition.scoreModifier 
    : 0

  return { 
    passed, 
    reason,
    scoreModifier,
    details: { urls, exclude, found, foundUrl, foundLocation }
  }
}

/**
 * Evaluate a mentions condition
 */
export function evaluateMentionsCondition(condition, post) {
  const mentions = (condition.mentions || []).map((m) => String(m || '').trim().toLowerCase()).filter(Boolean)
  const listUris = condition.listUris || []
  const exclude = condition.exclude || false

  if (mentions.length === 0 && listUris.length === 0) {
    return { 
      passed: true, 
      reason: 'No mentions configured (always passes)',
      scoreModifier: 0,
      details: { mentions, listUris, exclude }
    }
  }

  const facets = post.facets || []
  let found = false
  let foundMention = null
  let unresolvedLists = listUris.length > 0

  // Check individual mentions by DID and/or handle.
  for (const facet of facets) {
    const features = facet.features || []
    for (const feature of features) {
      if (feature.$type !== '#mention') continue
      const did = String(feature.did || '').trim().toLowerCase()
      const handle = String(feature.handle || feature.displayHandle || '').trim().toLowerCase()
      if ((did && mentions.includes(did)) || (handle && mentions.includes(handle))) {
        found = true
        foundMention = did || handle
        break
      }
    }
    if (found) break
  }

  const passed = exclude ? !found : found
  const reason = exclude
    ? (found
        ? `Mention "${foundMention}" found (EXCLUDE mode = FAIL)`
        : `None of selected mentions found in post (EXCLUDE mode = PASS)`)
    : (found
        ? (found
            ? `Mention "${foundMention}" found in post`
            : '')
        : `None of selected mentions [${mentions.join(', ')}] found in post`)

  // Score modifier: only applies if post passed AND scoreModifier is set
  const scoreModifier = (passed && condition.scoreModifier !== undefined && condition.scoreModifier !== 0) 
    ? condition.scoreModifier 
    : 0

  return { 
    passed, 
    reason: unresolvedLists ? `${reason} (List URI matching not implemented yet)` : reason,
    scoreModifier,
    details: { mentions, listUris, exclude, found, foundMention, unresolvedLists }
  }
}

/**
 * Evaluate a media type condition
 */
export function evaluateMediaCondition(condition, post) {
  const types = condition.types || []
  const exclude = condition.exclude || false

  if (types.length === 0) {
    return { 
      passed: true, 
      reason: 'No media types configured (always passes)',
      scoreModifier: 0,
      details: { types, exclude }
    }
  }

  // Determine the post's actual media type
  let postMediaType = 'none'
  if (post.has_images) {
    postMediaType = 'images'
  } else if (post.has_video) {
    postMediaType = 'video'
  } else if (post.has_link) {
    postMediaType = 'link'
  } else if (post.post_type === 'quote' && (post.has_images || post.has_video)) {
    postMediaType = 'quote_with_media'
  } else if (post.post_type === 'quote') {
    postMediaType = 'quote'
  }

  let matches = false
  for (const type of types) {
    switch (type) {
      case 'images':
        if (post.has_images) matches = true
        break
      case 'video':
        if (post.has_video) matches = true
        break
      case 'link':
        if (post.has_link) matches = true
        break
      case 'quote':
        if (post.post_type === 'quote' && !post.has_images && !post.has_video) matches = true
        break
      case 'quote_with_media':
        if (post.post_type === 'quote' && (post.has_images || post.has_video)) matches = true
        break
      case 'none':
        if (!post.has_images && !post.has_video && !post.has_link && post.post_type !== 'quote') matches = true
        break
    }
    if (matches) break
  }

  const passed = exclude ? !matches : matches
  
  const reason = exclude
    ? (matches
        ? `Media type "${postMediaType}" found (EXCLUDE mode = FAIL)`
        : `Media type not in excluded list (EXCLUDE mode = PASS)`)
    : (matches
        ? `Media type "${postMediaType}" matches`
        : `Media type "${postMediaType}" does not match`)

  // Score modifier: get the modifier for the post's actual media type
  let scoreModifier = 0
  if (passed && condition.mediaTypeScores) {
    scoreModifier = condition.mediaTypeScores[postMediaType] !== undefined 
      ? condition.mediaTypeScores[postMediaType] 
      : 0
  }

  return { 
    passed, 
    reason,
    scoreModifier,
    details: { types, exclude, matches, postMediaType }
  }
}

/**
 * Evaluate a hashtag/tags condition
 */
export function evaluateHashtagCondition(condition, post) {
  const tags = condition.tags || []
  const fieldTypes = condition.fieldTypes || []
  const exclude = condition.exclude || false

  if (tags.length === 0) {
    return {
      passed: true,
      reason: 'No tags configured (always passes)',
      scoreModifier: 0,
      details: { tags, fieldTypes, exclude, found: false },
    }
  }

  let found = false

  // Check outline tags (tags[*])
  if (fieldTypes.includes('outline_tags') || fieldTypes.length === 0) {
    const postTags = post.tags || []
    for (const tag of tags) {
      if (postTags.includes(tag)) {
        found = true
        break
      }
    }
  }

  // Check hashtags in facets (facets[*].features[*].tag)
  if (!found && (fieldTypes.includes('hashtags') || fieldTypes.length === 0)) {
    const facets = post.facets || []
    for (const facet of facets) {
      const features = facet.features || []
      for (const feature of features) {
        if (feature.tag && tags.includes(feature.tag)) {
          found = true
          break
        }
      }
      if (found) break
    }
  }

  const passed = exclude ? !found : found
  const reason = exclude
    ? (found
        ? 'Matching tag found (EXCLUDE mode = FAIL)'
        : 'No matching tags found (EXCLUDE mode = PASS)')
    : (found
        ? 'Matching tag found in post'
        : `None of selected tags [${tags.join(', ')}] found in post`)

  const scoreModifier =
    passed && condition.scoreModifier !== undefined && condition.scoreModifier !== 0
      ? condition.scoreModifier
      : 0

  return {
    passed,
    reason,
    scoreModifier,
    details: { tags, fieldTypes, exclude, found },
  }
}

/**
 * Evaluate a labels condition
 */
export function evaluateLabelsCondition(condition, post) {
  const labels = condition.labels || []
  const exclude = condition.exclude || false

  if (labels.length === 0) {
    return {
      passed: true,
      reason: 'No labels configured (always passes)',
      scoreModifier: 0,
      details: { labels, exclude, matches: false },
    }
  }

  const postLabels = post.labels?.values?.map(l => l.val) || []
  let matches = false

  for (const label of labels) {
    if (postLabels.includes(label)) {
      matches = true
      break
    }
  }

  const passed = exclude ? !matches : matches
  const reason = exclude
    ? (matches
        ? 'Matching label found (EXCLUDE mode = FAIL)'
        : 'No matching labels found (EXCLUDE mode = PASS)')
    : (matches
        ? 'Matching label found on post'
        : `None of selected labels [${labels.join(', ')}] found on post`)

  const scoreModifier =
    passed && condition.scoreModifier !== undefined && condition.scoreModifier !== 0
      ? condition.scoreModifier
      : 0

  return {
    passed,
    reason,
    scoreModifier,
    details: { labels, exclude, matches },
  }
}

/**
 * Evaluate a post structure condition
 */
export function evaluatePostStructureCondition(condition, post) {
  const structureType = condition.structureType || 'is_reply'
  const operator = condition.operator || 'equals'
  const depth = condition.depth || 1

  let passed = false
  let reason = ''

  switch (structureType) {
    case 'is_reply':
      // Check if post is a reply (has reply.parent.uri or reply.root.uri)
      const isReply = !!(post.reply?.parent?.uri || post.reply?.root?.uri)
      passed = isReply
      reason = isReply
        ? 'Post is a reply (has reply.parent.uri or reply.root.uri)'
        : 'Post is not a reply (no reply.parent.uri or reply.root.uri)'
      break

    case 'is_quote':
      // Check if post is a quote post (embed.$type is app.bsky.embed.record or app.bsky.embed.recordWithMedia)
      const embedType = post.embed?.$type || ''
      const isQuote = embedType === 'app.bsky.embed.record' || embedType === 'app.bsky.embed.recordWithMedia'
      passed = isQuote
      reason = isQuote
        ? `Post is a quote post (embed.$type: ${embedType})`
        : `Post is not a quote post (embed.$type: ${embedType || 'none'})`
      break

    case 'has_quote':
      // Check if post contains a quoted post (has embed.record.uri)
      const hasQuote = !!(post.embed?.record?.uri || (post.embed?.record?.record?.uri))
      passed = hasQuote
      reason = hasQuote
        ? 'Post contains a quoted post (has embed.record.uri)'
        : 'Post does not contain a quoted post (no embed.record.uri)'
      break

    case 'reply_depth':
      // Check reply depth in thread
      // Note: Exact depth requires database traversal, but we can estimate:
      // - If reply.parent.uri === reply.root.uri, it's depth 1 (direct reply to root)
      // - Otherwise, it's depth 2+ (reply to a reply)
      // For now, we'll check if it's a reply and estimate depth
      const hasReply = !!(post.reply?.parent?.uri || post.reply?.root?.uri)
      if (!hasReply) {
        passed = false
        reason = 'Post is not a reply (depth = 0)'
        break
      }

      const parentUri = post.reply?.parent?.uri
      const rootUri = post.reply?.root?.uri
      
      // If parent equals root, it's depth 1
      // Otherwise, we estimate it's depth 2+ (actual depth would require DB lookup)
      const estimatedDepth = (parentUri && rootUri && parentUri === rootUri) ? 1 : 2
      
      // Perform comparison
      switch (operator) {
        case 'equals':
          passed = estimatedDepth === depth
          reason = passed
            ? `Reply depth (${estimatedDepth}) equals ${depth}`
            : `Reply depth (${estimatedDepth}) does not equal ${depth}`
          break
        case 'greater_than':
          passed = estimatedDepth > depth
          reason = passed
            ? `Reply depth (${estimatedDepth}) is greater than ${depth}`
            : `Reply depth (${estimatedDepth}) is not greater than ${depth}`
          break
        case 'greater_equal':
          passed = estimatedDepth >= depth
          reason = passed
            ? `Reply depth (${estimatedDepth}) is greater than or equal to ${depth}`
            : `Reply depth (${estimatedDepth}) is less than ${depth}`
          break
        case 'less_than':
          passed = estimatedDepth < depth
          reason = passed
            ? `Reply depth (${estimatedDepth}) is less than ${depth}`
            : `Reply depth (${estimatedDepth}) is not less than ${depth}`
          break
        case 'less_equal':
          passed = estimatedDepth <= depth
          reason = passed
            ? `Reply depth (${estimatedDepth}) is less than or equal to ${depth}`
            : `Reply depth (${estimatedDepth}) is greater than ${depth}`
          break
        default:
          passed = false
          reason = `Unknown operator: ${operator}`
      }
      break

    default:
      passed = false
      reason = `Unknown structure type: ${structureType}`
  }

  return { 
    passed, 
    reason,
    details: { structureType, operator, depth }
  }
}

/**
 * Evaluate an engagement condition
 */
export function evaluateEngagementCondition(condition, post) {
  const metricType = condition.metricType || 'likes'
  const operator = condition.operator || 'greater_than'
  const threshold = condition.threshold || 0
  const exclude = condition.exclude || false

  // Get the engagement value from the post
  // Note: These fields may need to be adjusted based on actual post structure
  let value = 0
  switch (metricType) {
    case 'likes':
      value = post.like_count || post.likes || 0
      break
    case 'replies':
      value = post.reply_count || post.replies || 0
      break
    case 'reposts':
      value = post.repost_count || post.reposts || 0
      break
    case 'quotes':
      value = post.quote_count || post.quotes || 0
      break
    case 'bookmarks':
      value = post.bookmark_count || post.bookmarks || 0
      break
    default:
      value = 0
  }

  // Perform comparison
  let passed = false
  let reason = ''
  
  switch (operator) {
    case 'greater_than':
      passed = value > threshold
      reason = passed
        ? `${metricType} count (${value}) is greater than ${threshold}`
        : `${metricType} count (${value}) is not greater than ${threshold}`
      break
    case 'greater_equal':
      passed = value >= threshold
      reason = passed
        ? `${metricType} count (${value}) is greater than or equal to ${threshold}`
        : `${metricType} count (${value}) is less than ${threshold}`
      break
    case 'equal':
      passed = value === threshold
      reason = passed
        ? `${metricType} count (${value}) equals ${threshold}`
        : `${metricType} count (${value}) does not equal ${threshold}`
      break
    case 'less_equal':
      passed = value <= threshold
      reason = passed
        ? `${metricType} count (${value}) is less than or equal to ${threshold}`
        : `${metricType} count (${value}) is greater than ${threshold}`
      break
    case 'less_than':
      passed = value < threshold
      reason = passed
        ? `${metricType} count (${value}) is less than ${threshold}`
        : `${metricType} count (${value}) is not less than ${threshold}`
      break
    default:
      passed = false
      reason = `Unknown operator: ${operator}`
  }

  const finalPassed = exclude ? !passed : passed
  const finalReason = exclude
    ? (passed
        ? `${reason} (EXCLUDE mode = FAIL)`
        : `Engagement value (${value}) does not satisfy ${operator} ${threshold} (EXCLUDE mode = PASS)`)
    : reason

  // Condition-node score modifiers are deprecated; scoring nodes own scoring.
  const scoreModifier = 0

  return { 
    passed: finalPassed, 
    reason: finalReason,
    scoreModifier,
    details: { metricType, operator, threshold, value }
  }
}

/**
 * Evaluate a post date condition
 */
export function evaluateDateCondition(condition, post) {
  const mode = condition.mode || 'newer_than'
  const value = condition.value || {}
  const timezone = value.timezone || 'UTC'

  if (!post.created_at) {
    return { 
      passed: false, 
      reason: 'Post has no created_at date',
      scoreModifier: 0,
      details: { mode, value, timezone }
    }
  }

  const postDate = new Date(post.created_at)
  const now = new Date()
  let passed = false
  let reason = ''

  switch (mode) {
    case 'newer_than':
      const newerValue = value.amount || 0
      const newerUnit = value.unit || 'hours'
      const newerThreshold = getDateThreshold(now, newerValue, newerUnit, timezone)
      passed = postDate > newerThreshold
      reason = passed
        ? `Post is newer than ${newerValue} ${newerUnit}`
        : `Post is not newer than ${newerValue} ${newerUnit}`
      break

    case 'older_than':
      const olderValue = value.amount || 0
      const olderUnit = value.unit || 'hours'
      const olderThreshold = getDateThreshold(now, olderValue, olderUnit, timezone)
      passed = postDate < olderThreshold
      reason = passed
        ? `Post is older than ${olderValue} ${olderUnit}`
        : `Post is not older than ${olderValue} ${olderUnit}`
      break

    case 'between_times':
      const start = value.start ? new Date(value.start) : null
      const end = value.end ? new Date(value.end) : null
      if (!start || !end) {
        passed = false
        reason = 'Invalid time range'
      } else {
        // For between_times, we need to check if current time is within the range
        // This is a simplified check - actual implementation would need timezone handling
        passed = postDate >= start && postDate <= end
        reason = passed
          ? `Post created between ${value.start} and ${value.end}`
          : `Post not created between ${value.start} and ${value.end}`
      }
      break

    default:
      passed = true
      reason = 'Unknown mode (always passes)'
  }

  // Score modifier: only applies if post passed AND scoreModifier is set
  const scoreModifier = (passed && condition.scoreModifier !== undefined && condition.scoreModifier !== 0) 
    ? condition.scoreModifier 
    : 0

  return { 
    passed, 
    reason,
    scoreModifier,
    details: { mode, value, timezone, postDate, now }
  }
}

/**
 * Get date threshold for time math
 */
function getDateThreshold(now, value, unit, timezone) {
  const threshold = new Date(now)
  switch (unit) {
    case 'seconds':
      threshold.setSeconds(threshold.getSeconds() - value)
      break
    case 'minutes':
      threshold.setMinutes(threshold.getMinutes() - value)
      break
    case 'hours':
      threshold.setHours(threshold.getHours() - value)
      break
    case 'days':
      threshold.setDate(threshold.getDate() - value)
      break
    case 'weeks':
      threshold.setDate(threshold.getDate() - value * 7)
      break
    case 'months':
      threshold.setMonth(threshold.getMonth() - value)
      break
    case 'years':
      threshold.setFullYear(threshold.getFullYear() - value)
      break
  }
  return threshold
}

/**
 * Evaluate an image condition
 */
export function evaluateImageCondition(condition, post) {
  const imageCount = condition.imageCount
  const minWidth = condition.minWidth
  const maxWidth = condition.maxWidth
  const minHeight = condition.minHeight
  const maxHeight = condition.maxHeight
  const aspectRatio = condition.aspectRatio
  const minFileSize = condition.minFileSize
  const maxFileSize = condition.maxFileSize
  const exclude = condition.exclude || false

  // Check if post has images
  const images = post.embed?.images || []
  const hasImages = images.length > 0

  if (!hasImages) {
    const passed = exclude ? true : false
    return {
      passed,
      reason: 'Post has no images',
      scoreModifier: 0,
      details: { imageCount, minWidth, maxWidth, minHeight, maxHeight, aspectRatio, minFileSize, maxFileSize, exclude, hasImages }
    }
  }

  // Check image count
  if (imageCount !== null && imageCount !== undefined) {
    if (images.length !== imageCount) {
      const passed = exclude ? true : false
      return {
        passed,
        reason: `Post has ${images.length} images, expected ${imageCount}`,
        scoreModifier: 0,
        details: { imageCount, imagesLength: images.length, exclude }
      }
    }
  }

  // Check resolution and other properties for each image
  let allImagesMatch = true
  let matchReason = 'All images match criteria'

  for (const image of images) {
    // Check width/height
    const width = image.aspectRatio?.width || image.width
    const height = image.aspectRatio?.height || image.height

    if (minWidth !== null && width < minWidth) {
      allImagesMatch = false
      matchReason = `Image width ${width} is less than min ${minWidth}`
      break
    }
    if (maxWidth !== null && width > maxWidth) {
      allImagesMatch = false
      matchReason = `Image width ${width} is greater than max ${maxWidth}`
      break
    }
    if (minHeight !== null && height < minHeight) {
      allImagesMatch = false
      matchReason = `Image height ${height} is less than min ${minHeight}`
      break
    }
    if (maxHeight !== null && height > maxHeight) {
      allImagesMatch = false
      matchReason = `Image height ${height} is greater than max ${maxHeight}`
      break
    }

    // Check aspect ratio
    if (aspectRatio && aspectRatio !== 'any' && width && height) {
      const ratio = width / height
      let matches = false
      switch (aspectRatio) {
        case 'square':
          matches = Math.abs(ratio - 1) < 0.01
          break
        case 'portrait':
          matches = ratio < 1
          break
        case 'landscape':
          matches = ratio > 1
          break
      }
      if (!matches) {
        allImagesMatch = false
        matchReason = `Image aspect ratio ${ratio.toFixed(2)} does not match ${aspectRatio}`
        break
      }
    }

    // Check file size (if available)
    const fileSize = image.size
    if (fileSize) {
      if (minFileSize !== null && fileSize < minFileSize) {
        allImagesMatch = false
        matchReason = `Image file size ${fileSize} is less than min ${minFileSize}`
        break
      }
      if (maxFileSize !== null && fileSize > maxFileSize) {
        allImagesMatch = false
        matchReason = `Image file size ${fileSize} is greater than max ${maxFileSize}`
        break
      }
    }
  }

  const passed = exclude ? !allImagesMatch : allImagesMatch
  const reason = exclude
    ? (allImagesMatch
        ? `Images match criteria (EXCLUDE mode = FAIL)`
        : `Images do not match criteria (EXCLUDE mode = PASS)`)
    : (allImagesMatch
        ? matchReason
        : matchReason)

  // Score modifier: only applies if post passed AND scoreModifier is set
  const scoreModifier = (passed && condition.scoreModifier !== undefined && condition.scoreModifier !== 0) 
    ? condition.scoreModifier 
    : 0

  return {
    passed,
    reason,
    scoreModifier,
    details: { imageCount, minWidth, maxWidth, minHeight, maxHeight, aspectRatio, minFileSize, maxFileSize, exclude, hasImages, imagesLength: images.length, allImagesMatch }
  }
}

/**
 * Evaluate a video condition
 */
export function evaluateVideoCondition(condition, post) {
  const minWidth = condition.minWidth
  const maxWidth = condition.maxWidth
  const minHeight = condition.minHeight
  const maxHeight = condition.maxHeight
  const aspectRatio = condition.aspectRatio
  const minFileSize = condition.minFileSize
  const maxFileSize = condition.maxFileSize
  const presentation = condition.presentation
  const exclude = condition.exclude || false

  // Check if post has video
  const video = post.embed?.video
  const hasVideo = !!video

  if (!hasVideo) {
    const passed = exclude ? true : false
    return {
      passed,
      reason: 'Post has no video',
      scoreModifier: 0,
      details: { minWidth, maxWidth, minHeight, maxHeight, aspectRatio, minFileSize, maxFileSize, presentation, exclude, hasVideo }
    }
  }

  let matches = true
  let matchReason = 'Video matches criteria'

  // Check resolution
  const width = video.aspectRatio?.width || video.width
  const height = video.aspectRatio?.height || video.height

  if (minWidth !== null && width < minWidth) {
    matches = false
    matchReason = `Video width ${width} is less than min ${minWidth}`
  } else if (maxWidth !== null && width > maxWidth) {
    matches = false
    matchReason = `Video width ${width} is greater than max ${maxWidth}`
  } else if (minHeight !== null && height < minHeight) {
    matches = false
    matchReason = `Video height ${height} is less than min ${minHeight}`
  } else if (maxHeight !== null && height > maxHeight) {
    matches = false
    matchReason = `Video height ${height} is greater than max ${maxHeight}`
  }

  // Check aspect ratio
  if (matches && aspectRatio && aspectRatio !== 'any' && width && height) {
    const ratio = width / height
    let ratioMatches = false
    switch (aspectRatio) {
      case 'square':
        ratioMatches = Math.abs(ratio - 1) < 0.01
        break
      case 'portrait':
        ratioMatches = ratio < 1
        break
      case 'landscape':
        ratioMatches = ratio > 1
        break
    }
    if (!ratioMatches) {
      matches = false
      matchReason = `Video aspect ratio ${ratio.toFixed(2)} does not match ${aspectRatio}`
    }
  }

  // Check file size
  if (matches && video.size) {
    const fileSize = video.size
    if (minFileSize !== null && fileSize < minFileSize) {
      matches = false
      matchReason = `Video file size ${fileSize} is less than min ${minFileSize}`
    } else if (maxFileSize !== null && fileSize > maxFileSize) {
      matches = false
      matchReason = `Video file size ${fileSize} is greater than max ${maxFileSize}`
    }
  }

  // Check presentation type (GIF detection)
  if (matches && presentation && presentation !== 'any') {
    const videoPresentation = video.presentation || post.embed?.presentation
    if (presentation === 'gif' && videoPresentation !== 'gif') {
      matches = false
      matchReason = `Video presentation is not GIF (is: ${videoPresentation || 'regular video'})`
    } else if (presentation === 'video' && videoPresentation === 'gif') {
      matches = false
      matchReason = 'Video presentation is GIF (not regular video)'
    }
  }

  const passed = exclude ? !matches : matches
  const reason = exclude
    ? (matches
        ? `Video matches criteria (EXCLUDE mode = FAIL)`
        : `Video does not match criteria (EXCLUDE mode = PASS)`)
    : (matches
        ? matchReason
        : matchReason)

  // Score modifier: only applies if post passed AND scoreModifier is set
  const scoreModifier = (passed && condition.scoreModifier !== undefined && condition.scoreModifier !== 0) 
    ? condition.scoreModifier 
    : 0

  return {
    passed,
    reason,
    scoreModifier,
    details: { minWidth, maxWidth, minHeight, maxHeight, aspectRatio, minFileSize, maxFileSize, presentation, exclude, hasVideo, matches }
  }
}

/**
 * Get nested field value from post object
 */
function getFieldValue(post, fieldPath) {
  const parts = fieldPath.split('.')
  let value = post

  for (const part of parts) {
    if (value == null) return null
    if (part.includes('[') && part.includes(']')) {
      // Handle array access like "tags[*]" or "facets[*].features[*].tag"
      const [key, index] = part.split('[')
      if (key && value[key]) {
        value = value[key]
        // For now, just check if array has any items (simplified)
        if (Array.isArray(value) && value.length > 0) {
          // For nested paths, we'd need to recurse, but for simplicity:
          if (fieldPath.includes('facets') && fieldPath.includes('tag')) {
            // Special handling for facets
            for (const facet of value) {
              const features = facet?.features || []
              for (const feature of features) {
                if (feature.tag) return feature.tag
              }
            }
            return null
          }
          return value[0] // Return first item for now
        }
        return null
      }
    } else {
      value = value[part]
    }
  }

  return value
}

/**
 * Evaluate any condition based on its type
 * Returns: { passed: boolean, reason: string, details?: object }
 */
export function evaluateCondition(conditionNode, post) {
  const type = conditionNode.type
  const data = conditionNode.data || {}

  let result
  switch (type) {
    case 'text':
      result = evaluateTextCondition(data, post)
      break
    case 'regex':
      result = evaluateRegexCondition(data, post)
      break
    case 'language':
      result = evaluateLanguageCondition(data, post)
      break
    case 'posttype':
      result = evaluatePostTypeCondition(data, post)
      break
    case 'author':
      result = evaluateAuthorCondition(data, post)
      break
    case 'media':
      result = evaluateMediaCondition(data, post)
      break
    case 'hashtag':
      result = evaluateHashtagCondition(data, post)
      break
    case 'labels':
      result = evaluateLabelsCondition(data, post)
      break
    case 'dateage':
      result = evaluateDateCondition(data, post)
      break
    case 'engagement':
      result = evaluateEngagementCondition(data, post)
      break
    case 'poststructure':
      result = evaluatePostStructureCondition(data, post)
      break
    case 'mentions':
      result = evaluateMentionsCondition(data, post)
      break
    case 'links':
      result = evaluateLinksCondition(data, post)
      break
    case 'image':
      result = evaluateImageCondition(data, post)
      break
    case 'video':
      result = evaluateVideoCondition(data, post)
      break
    case 'quotepost':
      result = evaluateQuotePostCondition(data, post)
      break
    default:
      result = { passed: true, reason: 'Unknown condition type (always passes)' }
  }

  // Ensure result has passed and reason
  if (typeof result === 'boolean') {
    return { passed: result, reason: result ? 'Condition passed' : 'Condition failed', scoreModifier: 0 }
  }

  // Ensure scoreModifier is always present
  if (result && typeof result === 'object') {
    // Condition-node scoring is deprecated; only scoring nodes contribute points.
    result.scoreModifier = 0
  }

  return result
}
