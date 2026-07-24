import React, { useState } from 'react'
import './KeywordModal.css'

/**
 * Manual Posts Modal
 * 
 * Allows users to manually add posts to the feed by entering post URIs.
 * Post URIs should be in the format: at://did:plc:.../app.bsky.feed.post/...
 * 
 * Multiple posts can be added, one per line or comma-separated.
 */
function ManualPostsModal({ isOpen, onClose, nodeId, posts = [], name = '', onSave }) {
  const [localPosts, setLocalPosts] = useState(posts.join('\n'))
  const [localName, setLocalName] = useState(name)

  if (!isOpen) return null

  const handleSave = () => {
    // Parse posts from textarea (one per line or comma-separated)
    const postLines = localPosts
      .split(/[\n,]/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
    
    // Validate post URIs (should start with at://)
    const validPosts = postLines.filter(post => post.startsWith('at://'))
    const invalidPosts = postLines.filter(post => !post.startsWith('at://') && post.length > 0)
    
    if (invalidPosts.length > 0) {
      alert(`Some posts are invalid (must start with "at://"):\n${invalidPosts.join('\n')}`)
      return
    }
    
    onSave(nodeId, {
      posts: validPosts,
      name: localName,
    })
    onClose()
  }

  const handleCancel = () => {
    setLocalPosts(posts.join('\n'))
    setLocalName(name)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manual Posts</h2>
          <button className="modal-close" onClick={handleCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="manual-posts-name">Name (optional)</label>
            <input
              id="manual-posts-name"
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="e.g., Featured Posts"
            />
          </div>

          <div className="form-group">
            <label htmlFor="manual-posts-uris">Post URIs</label>
            <textarea
              id="manual-posts-uris"
              value={localPosts}
              onChange={(e) => setLocalPosts(e.target.value)}
              placeholder="at://did:plc:abc123/app.bsky.feed.post/xyz789&#10;at://did:plc:def456/app.bsky.feed.post/uvw012&#10;&#10;One post per line, or comma-separated"
              rows={10}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
            <div className="form-help">
              Enter post URIs in the format: <code>at://did:plc:.../app.bsky.feed.post/...</code>
              <br />
              One per line, or comma-separated.
            </div>
          </div>

          {localPosts.trim() && (
            <div className="form-preview">
              <strong>Preview:</strong> {localPosts.split(/[\n,]/).filter(p => p.trim()).length} post(s) will be added
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCancel}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default ManualPostsModal
