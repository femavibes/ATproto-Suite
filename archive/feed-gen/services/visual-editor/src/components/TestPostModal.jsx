import React, { useState } from 'react'
import './TestPostModal.css'

/**
 * Test Post Modal
 * Allows users to input a test post (JSON) and see how it evaluates against the graph
 */
export default function TestPostModal({ isOpen, onClose, onTest }) {
  const [testPost, setTestPost] = useState(`{
  "text": "I love urbanism and walkable cities!",
  "author_did": "did:plc:example123",
  "langs": ["en"],
  "created_at": "2024-01-15T10:00:00Z",
  "has_images": true,
  "has_video": false,
  "has_link": false,
  "post_type": "post",
  "tags": ["urbanism", "city"],
  "facets": [
    {
      "features": [
        {
          "tag": "walkable"
        }
      ]
    }
  ]
}`)

  const handleTest = () => {
    try {
      const parsed = JSON.parse(testPost)
      onTest(parsed)
    } catch (error) {
      alert('Invalid JSON: ' + error.message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content test-post-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Test Post Debugger</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p>Enter a test post as JSON to see how it evaluates against your graph:</p>
          <textarea
            className="test-post-input"
            value={testPost}
            onChange={(e) => setTestPost(e.target.value)}
            placeholder='{"text": "...", "langs": ["en"], ...}'
          />
          <div className="modal-actions">
            <button className="btn-primary" onClick={handleTest}>
              Test Post
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
