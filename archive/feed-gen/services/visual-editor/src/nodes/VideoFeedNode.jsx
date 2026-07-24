import React from 'react'
import { Handle, Position } from 'reactflow'
import { VideoFeedIcon } from '../components/Icons'
import './NodeStyles.css'

/**
 * Video Feed Node
 *
 * A pass-through node that marks the feed as a Bluesky Video Feed
 * (sets contentMode: app.bsky.feed.defs#contentModeVideo on the generator record).
 *
 * Place it in the flow line just before the END node:
 *   ... → junction → Video Feed → END
 *
 * All posts pass through without filtering (tier 0, always-pass).
 * At publish time the graph is inspected: if a videofeed node has a direct
 * flow edge to an END node, that feed is published with contentMode=video.
 */
function VideoFeedNode({ data, id }) {
  return (
    <div
      className="node video-feed-node"
      title="Marks this feed as a Bluesky Video Feed (contentMode: video). Place before END. All posts pass through — no filtering."
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input-left"
        style={{ left: '-10px', top: '50%', zIndex: 10 }}
        className="handle-flow handle-input"
        isConnectable={true}
      />

      <Handle
        type="source"
        position={Position.Right}
        id="output-right"
        style={{ right: '-10px', top: '50%', zIndex: 10 }}
        className="handle-flow handle-output"
        isConnectable={true}
      />

      <div className="node-label">
        {Number.isFinite(data?.ingestionRunOrder) && (
          <span className="ingestion-order-badge" title="Ingestion execution order">
            #{data.ingestionRunOrder}
          </span>
        )}
        <span className="node-icon-wrapper">
          <VideoFeedIcon size={18} />
        </span>
        Video Feed
      </div>
      <div className="node-subtitle" style={{ color: '#74c0fc' }}>
        Bluesky video mode
      </div>
    </div>
  )
}

export default VideoFeedNode
