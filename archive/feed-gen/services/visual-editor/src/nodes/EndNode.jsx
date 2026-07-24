import React from 'react'
import { Handle, Position, useEdges, useNodes } from 'reactflow'
import { EndIcon, VideoFeedIcon } from '../components/Icons'
import { useNavigation } from '../contexts/NavigationContext'
import './NodeStyles.css'

/**
 * END Block — root feed output only. Inner groups use ContainerOutNode (OUT).
 */
function EndNode({ data, id }) {
  const { zoomIn } = useNavigation()
  const rfEdges = useEdges()
  const rfNodes = useNodes()
  const isLeftConnected = rfEdges.some((e) => e.target === id && e.targetHandle === 'input-left')

  const isVideoFeed = React.useMemo(() => {
    const isFlowEdge = (e) =>
      !e.data?.logicType && !(typeof e.sourceHandle === 'string' && e.sourceHandle.startsWith('logic-'))
    const visited = new Set()
    const queue = [id]
    while (queue.length > 0) {
      const cur = queue.shift()
      if (visited.has(cur)) continue
      visited.add(cur)
      const node = rfNodes.find((n) => n.id === cur)
      if (cur !== id && node?.type === 'videofeed') return true
      rfEdges
        .filter((e) => e.target === cur && isFlowEdge(e))
        .forEach((e) => queue.push(e.source))
    }
    return false
  }, [id, rfEdges, rfNodes])

  const handleDoubleClick = (e) => {
    e.stopPropagation()
    zoomIn(id, data?.name || 'END', { view: 'end' })
  }

  const handleConfigure = (e) => {
    e.stopPropagation()
    data?.onConfigure?.()
  }

  return (
    <div
      className="node end-node"
      title="One feed per END. Double-click: sort, injection, fixed, access (only this feed)."
      onDoubleClick={handleDoubleClick}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="input-left"
        style={{ top: '50%', left: '-10px' }}
        className={`handle-flow handle-input ${isLeftConnected ? 'has-connection' : ''}`}
      />
      <div className="node-label">
        {Number.isFinite(data?.ingestionRunOrder) && (
          <span className="ingestion-order-badge" title="Ingestion execution order">
            #{data.ingestionRunOrder}
          </span>
        )}
        <span className="node-icon-wrapper">
          <EndIcon size={18} />
        </span>
        {data?.name?.trim() ? data.name.trim() : 'END'}
      </div>
      <div className="node-subtitle">
        Feed output
        {isVideoFeed && (
          <span
            title="Video Feed — publishes with contentMode: video"
            style={{ marginLeft: 5, color: '#339af0', verticalAlign: 'middle', display: 'inline-flex' }}
          >
            <VideoFeedIcon size={12} />
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={handleConfigure}
        className="btn-secondary"
        style={{ marginTop: 4, fontSize: 10, padding: '2px 8px' }}
      >
        Feed
      </button>
      <div className="node-subtitle" style={{ color: '#555', fontSize: '9px' }}>
        Double-click: feed pipeline
      </div>
    </div>
  )
}

export default EndNode
