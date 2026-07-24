import React from 'react'
import { Handle, Position } from 'reactflow'
import { PlusIcon } from '../components/Icons'
import './NodeStyles.css'

/**
 * Manual Posts Block
 * 
 * Allows users to manually add posts to the feed.
 * Users can add post URIs (at://...) that will be included in the feed.
 * This is useful for pinned posts, featured content, or manually curated posts.
 * 
 * Flow: Manual Posts → [conditions/logic] → END
 * 
 * Unlike START (which represents all database posts), Manual Posts represents
 * a specific set of user-selected posts that should be included in the feed.
 */
function ManualPostsNode({ data, id }) {
  const onDelete = data?.onDelete
  const onConfigure = data?.onConfigure
  const edges = data?.edges || []
  const isConnected = edges.some(e => e.source === id && e.sourceHandle === 'output-right')
  
  const posts = data?.posts || []
  const postCount = posts.length
  
  const handleClick = (e) => {
    e.stopPropagation()
    if (onConfigure) {
      onConfigure()
    }
  }
  
  return (
    <div 
      className="node start-node manual-posts-node" 
      title="Manually add posts to the feed (click to configure)"
      onClick={handleClick}
      style={{ cursor: onConfigure ? 'pointer' : 'default' }}
    >
      <div className="node-label">
        {Number.isFinite(data?.ingestionRunOrder) && (
          <span className="ingestion-order-badge" title="Ingestion execution order">
            #{data.ingestionRunOrder}
          </span>
        )}
        <span className="node-icon-wrapper">
          <PlusIcon size={18} />
        </span>
        Manual Posts
      </div>
      {postCount > 0 ? (
        <div className="node-subtitle">
          {postCount} {postCount === 1 ? 'post' : 'posts'}
        </div>
      ) : (
        <div className="node-subtitle" style={{ color: '#888', fontStyle: 'italic' }}>
          Click to add posts
        </div>
      )}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="output-right"
        style={{ top: '50%', right: '-10px' }}
        className={`handle-flow handle-output ${isConnected ? 'has-connection' : ''}`}
        isConnectable={true}
      />
    </div>
  )
}

export default ManualPostsNode
