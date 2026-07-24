import React, { useState, useEffect } from 'react'
import './KeywordModal.css'
import './MediaTypeModal.css'

/**
 * Modal for configuring Media Type block
 * 
 * HOW IT WORKS:
 * - Checks post embed structure to determine media type
 * - Media types: Images, Video, Link/External, Quote, Quote with Media, No Media
 * - Matches if post has ANY of the selected media types (OR logic)
 * - Supports include/exclude modes
 * 
 * DATA STRUCTURE:
 * - Stores media types: ['images', 'video', 'link', 'quote', 'quote_with_media', 'none']
 * - Backend checks:
 *   - images: post.embed?.images exists and is non-empty
 *   - video: post.embed?.video exists
 *   - link: post.embed?.external exists
 *   - quote: post.embed?.record exists (and no media)
 *   - quote_with_media: post.embed?.recordWithMedia exists
 *   - none: no embed or empty embed
 * 
 * EMBED STRUCTURE (from POST_METADATA.md):
 * - Images: embed.$type === "app.bsky.embed.images", embed.images array (1-4 images)
 * - Video: embed.$type === "app.bsky.embed.video", embed.video blob object
 * - External: embed.$type === "app.bsky.embed.external", embed.external object
 * - Quote: embed.$type === "app.bsky.embed.record", embed.record object
 * - Quote with Media: embed.$type === "app.bsky.embed.recordWithMedia", embed.record + embed.media
 * 
 * EXAMPLE:
 * - Selected: ['images', 'video']
 * - Post with embed.images → MATCHES
 * - Post with embed.video → MATCHES
 * - Post with only text → NO MATCH
 */
function MediaTypeModal({ isOpen, onClose, nodeId, types, name, exclude, mediaTypeScores, onSave }) {
  const [selectedTypes, setSelectedTypes] = useState(types || [])
  const [blockName, setBlockName] = useState(name || '')
  const [isExclude, setIsExclude] = useState(exclude || false)
  const [scores, setScores] = useState({
    images: mediaTypeScores?.images !== undefined ? mediaTypeScores.images : 0,
    video: mediaTypeScores?.video !== undefined ? mediaTypeScores.video : 0,
    gif: mediaTypeScores?.gif !== undefined ? mediaTypeScores.gif : 0,
    link: mediaTypeScores?.link !== undefined ? mediaTypeScores.link : 0,
    quote: mediaTypeScores?.quote !== undefined ? mediaTypeScores.quote : 0,
    quote_with_media: mediaTypeScores?.quote_with_media !== undefined ? mediaTypeScores.quote_with_media : 0,
    none: mediaTypeScores?.none !== undefined ? mediaTypeScores.none : 0,
  })

  const mediaTypes = [
    { 
      value: 'images', 
      label: 'Images', 
      description: 'Posts with image embeds (1-4 images)',
      icon: '🖼️'
    },
    { 
      value: 'video', 
      label: 'Video', 
      description: 'Posts with video embeds (excludes GIFs)',
      icon: '🎥'
    },
    { 
      value: 'gif', 
      label: 'GIF', 
      description: 'Posts with GIF embeds (embed.presentation === "gif")',
      icon: '🎞️'
    },
    { 
      value: 'link', 
      label: 'Link Card', 
      description: 'Posts with external link cards',
      icon: '🔗'
    },
    { 
      value: 'quote', 
      label: 'Quote Post', 
      description: 'Posts that quote another post (no media)',
      icon: '💬'
    },
    { 
      value: 'quote_with_media', 
      label: 'Quote with Media', 
      description: 'Posts that quote another post AND have media',
      icon: '💬🖼️'
    },
    { 
      value: 'none', 
      label: 'No Media', 
      description: 'Text-only posts (no embeds)',
      icon: '📝'
    },
  ]

  useEffect(() => {
    if (isOpen) {
      setSelectedTypes(types || [])
      setBlockName(name || '')
      setIsExclude(exclude || false)
      setScores({
        images: mediaTypeScores?.images !== undefined ? mediaTypeScores.images : 0,
        video: mediaTypeScores?.video !== undefined ? mediaTypeScores.video : 0,
        gif: mediaTypeScores?.gif !== undefined ? mediaTypeScores.gif : 0,
        link: mediaTypeScores?.link !== undefined ? mediaTypeScores.link : 0,
        quote: mediaTypeScores?.quote !== undefined ? mediaTypeScores.quote : 0,
        quote_with_media: mediaTypeScores?.quote_with_media !== undefined ? mediaTypeScores.quote_with_media : 0,
        none: mediaTypeScores?.none !== undefined ? mediaTypeScores.none : 0,
      })
    }
  }, [isOpen, types, name, exclude, mediaTypeScores])

  const toggleType = (type) => {
    if (selectedTypes.includes(type)) {
      // Don't allow deselecting all types
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter((t) => t !== type))
      }
    } else {
      setSelectedTypes([...selectedTypes, type])
    }
  }

  const handleSave = () => {
    if (selectedTypes.length === 0) {
      return
    }
    
    // Only include scores if any are non-zero
    const hasAnyScores = scores.images !== 0 || scores.video !== 0 || scores.gif !== 0 || scores.link !== 0 || 
                         scores.quote !== 0 || scores.quote_with_media !== 0 || scores.none !== 0
    const mediaTypeScores = hasAnyScores ? {
      images: scores.images,
      video: scores.video,
      gif: scores.gif,
      link: scores.link,
      quote: scores.quote,
      quote_with_media: scores.quote_with_media,
      none: scores.none,
    } : undefined
    
    onSave(nodeId, {
      types: selectedTypes,
      name: blockName.trim() || null,
      exclude: isExclude,
      mediaTypeScores,
    })
    onClose()
  }

  const handleCancel = () => {
    setSelectedTypes(types || [])
    setBlockName('')
    setIsExclude(exclude || false)
    setScores({
      images: mediaTypeScores?.images !== undefined ? mediaTypeScores.images : 0,
      video: mediaTypeScores?.video !== undefined ? mediaTypeScores.video : 0,
      gif: mediaTypeScores?.gif !== undefined ? mediaTypeScores.gif : 0,
      link: mediaTypeScores?.link !== undefined ? mediaTypeScores.link : 0,
      quote: mediaTypeScores?.quote !== undefined ? mediaTypeScores.quote : 0,
      quote_with_media: mediaTypeScores?.quote_with_media !== undefined ? mediaTypeScores.quote_with_media : 0,
      none: mediaTypeScores?.none !== undefined ? mediaTypeScores.none : 0,
    })
    onClose()
  }
  
  const updateScore = (type, value) => {
    const numValue = value === '' ? 0 : parseInt(value, 10)
    setScores({
      ...scores,
      [type]: isNaN(numValue) ? 0 : numValue,
    })
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content media-type-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure Media Type Block</h3>
          <button className="modal-close" onClick={handleCancel}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Mode</label>
            <div className="mode-selector">
              <label className="mode-option">
                <input
                  type="radio"
                  name="mode"
                  value="include"
                  checked={!isExclude}
                  onChange={() => setIsExclude(false)}
                />
                <div className="mode-content">
                  <div className="mode-label">Include</div>
                  <div className="mode-desc">Posts with selected media types are included</div>
                </div>
              </label>
              <label className="mode-option">
                <input
                  type="radio"
                  name="mode"
                  value="exclude"
                  checked={isExclude}
                  onChange={() => setIsExclude(true)}
                />
                <div className="mode-content">
                  <div className="mode-label">Exclude</div>
                  <div className="mode-desc">Posts with selected media types are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g., Media Posts Only"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              className="form-input"
            />
            <div className="form-hint">
              Optional label to identify this block
            </div>
          </div>

          <div className="form-group">
            <label>Media Types</label>
            <div className="media-types-list">
              {mediaTypes.map((type) => (
                <div key={type.value} className="media-type-row">
                  <label className="media-type-option">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type.value)}
                      onChange={() => toggleType(type.value)}
                      disabled={selectedTypes.length === 1 && selectedTypes.includes(type.value)}
                    />
                    <div className="media-type-content">
                      <div className="media-type-header">
                        <span className="media-type-icon">{type.icon}</span>
                        <div className="media-type-label">{type.label}</div>
                      </div>
                      <div className="media-type-desc">{type.description}</div>
                    </div>
                  </label>
                  <div className="media-type-score-input">
                    <input
                      type="number"
                      placeholder="0"
                      value={scores[type.value] === 0 ? '' : String(scores[type.value])}
                      onChange={(e) => updateScore(type.value, e.target.value)}
                      className="form-input"
                      style={{ width: '80px' }}
                    />
                    <span className="score-modifier-hint">score</span>
                  </div>
                </div>
              ))}
            </div>
            {selectedTypes.length > 0 && (
              <div className="selected-types-summary">
                Selected: {selectedTypes.map((t) => {
                  const type = mediaTypes.find(mt => mt.value === t)
                  return type ? `${type.icon} ${type.label}` : t
                }).join(', ')}
              </div>
            )}
          </div>

          <div className="modal-info">
            <p>
              {isExclude ? (
                <>Posts with <strong>any</strong> selected media type will be <strong>excluded</strong>.</>
              ) : (
                <>Posts with <strong>any</strong> selected media type will be <strong>included</strong>.</>
              )}
            </p>
            <p style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
              Detection based on embed structure: embed.images, embed.video, embed.external, embed.record, embed.recordWithMedia
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={selectedTypes.length === 0}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default MediaTypeModal
