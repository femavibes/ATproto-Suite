import React, { useState, useEffect } from 'react'
import './KeywordModal.css'
import './PostTypeModal.css'

/**
 * Modal for configuring Post Type block
 * 
 * HOW IT WORKS:
 * - Checks the post_type field or post structure to determine type
 * - Post types: 'post' (regular), 'reply' (has reply.parent), 'quote' (has embed.record)
 * - Matches if post is ANY of the selected types (OR logic)
 * - Supports include/exclude modes
 * 
 * DATA STRUCTURE:
 * - Stores post types: ['post', 'reply', 'quote']
 * - Backend checks: post.post_type === 'post' || post.post_type === 'reply' || ...
 * 
 * DETECTION LOGIC (from POST_METADATA.md):
 * - If post has reply.parent.uri → type = 'reply'
 * - If post has embed.record (embed.$type === "app.bsky.embed.record") → type = 'quote'
 * - Otherwise → type = 'post'
 * 
 * Note: Quote with media (embed.$type === "app.bsky.embed.recordWithMedia") is handled
 * by the Media Type block, not Post Type block.
 */
function PostTypeModal({ isOpen, onClose, nodeId, types, name, exclude, replyDepthEnabled, replyDepthOperator, replyDepth, postTypeScores, onSave }) {
  const [selectedTypes, setSelectedTypes] = useState(types || [])
  const [blockName, setBlockName] = useState(name || '')
  const [isExclude, setIsExclude] = useState(exclude || false)
  const [enableReplyDepth, setEnableReplyDepth] = useState(replyDepthEnabled || false)
  const [depthOperator, setDepthOperator] = useState(replyDepthOperator || 'equals')
  const [depth, setDepth] = useState(replyDepth || 1)
  const [scores, setScores] = useState({
    post: postTypeScores?.post !== undefined ? postTypeScores.post : 0,
    reply: postTypeScores?.reply !== undefined ? postTypeScores.reply : 0,
    quote: postTypeScores?.quote !== undefined ? postTypeScores.quote : 0,
  })

  const postTypes = [
    { value: 'post', label: 'Post', description: 'Regular posts (not replies or quotes)' },
    { value: 'reply', label: 'Reply', description: 'Replies to other posts' },
    { value: 'quote', label: 'Quote', description: 'Quote posts (embedding another post)' },
  ]

  const REPLY_DEPTH_OPERATORS = [
    { value: 'equals', label: 'Equals (=)', symbol: '=' },
    { value: 'greater_than', label: 'Greater than (>)', symbol: '>' },
    { value: 'greater_equal', label: 'Greater than or equal (≥)', symbol: '≥' },
    { value: 'less_than', label: 'Less than (<)', symbol: '<' },
    { value: 'less_equal', label: 'Less than or equal (≤)', symbol: '≤' },
  ]

  useEffect(() => {
    if (isOpen) {
      setSelectedTypes(types || [])
      setBlockName(name || '')
      setIsExclude(exclude || false)
      setEnableReplyDepth(replyDepthEnabled || false)
      setDepthOperator(replyDepthOperator || 'equals')
      setDepth(replyDepth || 1)
      setScores({
        post: postTypeScores?.post !== undefined ? postTypeScores.post : 0,
        reply: postTypeScores?.reply !== undefined ? postTypeScores.reply : 0,
        quote: postTypeScores?.quote !== undefined ? postTypeScores.quote : 0,
      })
    }
  }, [isOpen, types, name, exclude, replyDepthEnabled, replyDepthOperator, replyDepth, postTypeScores])

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
    if (selectedTypes.length === 0 && !enableReplyDepth) {
      return
    }
    
    // Only include postTypeScores if any are non-zero
    const hasAnyScores = scores.post !== 0 || scores.reply !== 0 || scores.quote !== 0
    const postTypeScores = hasAnyScores ? {
      post: scores.post,
      reply: scores.reply,
      quote: scores.quote,
    } : undefined
    
    onSave(nodeId, {
      types: selectedTypes,
      name: blockName.trim() || null,
      exclude: isExclude,
      replyDepthEnabled: enableReplyDepth,
      replyDepthOperator: enableReplyDepth ? depthOperator : undefined,
      replyDepth: enableReplyDepth ? parseInt(depth, 10) : undefined,
      postTypeScores,
    })
    onClose()
  }

  const handleCancel = () => {
    setSelectedTypes(types || [])
    setBlockName('')
    setIsExclude(exclude || false)
    setScores({
      post: postTypeScores?.post !== undefined ? postTypeScores.post : 0,
      reply: postTypeScores?.reply !== undefined ? postTypeScores.reply : 0,
      quote: postTypeScores?.quote !== undefined ? postTypeScores.quote : 0,
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
      <div className="modal-content post-type-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure Post Type Block</h3>
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
                  <div className="mode-desc">Posts of selected types are included</div>
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
                  <div className="mode-desc">Posts of selected types are excluded</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Label (optional)</label>
            <input
              type="text"
              placeholder="e.g., Replies Only"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              className="form-input"
            />
            <div className="form-hint">
              Optional label to identify this block
            </div>
          </div>

          <div className="form-group">
            <label>Post Types</label>
            <div className="post-types-list">
              {postTypes.map((type) => (
                <div key={type.value} className="post-type-row">
                  <label className="post-type-option">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type.value)}
                      onChange={() => toggleType(type.value)}
                      disabled={selectedTypes.length === 1 && selectedTypes.includes(type.value)}
                    />
                    <div className="post-type-content">
                      <div className="post-type-label">{type.label}</div>
                      <div className="post-type-desc">{type.description}</div>
                    </div>
                  </label>
                  <div className="post-type-score-input">
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
                Selected: {selectedTypes.map((t) => postTypes.find(pt => pt.value === t)?.label).join(', ')}
              </div>
            )}
          </div>

          <div className="modal-info">
            <p>
              {isExclude ? (
                <>Posts of <strong>any</strong> selected type will be <strong>excluded</strong>.</>
              ) : (
                <>Posts of <strong>any</strong> selected type will be <strong>included</strong>.</>
              )}
            </p>
            <p style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
              Detection: Reply if has <code>reply.parent</code>, Quote if has <code>embed.record</code>, otherwise Post.
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

export default PostTypeModal
