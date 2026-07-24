import React from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from 'reactflow'

export default function OrderedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 20,
  })

  const order = data?.order || null
  const logicType = data?.logicType || null
  const logicN = data?.logicN || 2

  const handleLabelClick = (e) => {
    e.stopPropagation()
    if (data?.onToggleLogic) data.onToggleLogic(id)
  }

  const baseStyle = {
    position: 'absolute',
    transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
    zIndex: 1000,
    pointerEvents: 'all',
    borderRadius: '4px',
    border: '2px solid #1a1a1a',
    background: style.stroke || '#4a9eff',
    lineHeight: '18px',
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  }

  const nofBtnStyle = {
    background: 'rgba(0,0,0,0.35)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    padding: '0 5px',
    fontSize: '12px',
    lineHeight: '18px',
    borderRadius: '3px',
    fontWeight: 'bold',
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        {logicType && logicType === 'nof' ? (
          <div style={baseStyle} className="nodrag nopan">
            <button
              style={nofBtnStyle}
              onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN(Math.max(1, logicN - 1)) }}
              title="Decrease N"
            >−</button>
            <span
              style={{ padding: '0 5px', cursor: 'pointer' }}
              onClick={handleLabelClick}
              title="Click to cycle back to AND"
            >
              {logicN}-OF
            </span>
            <button
              style={nofBtnStyle}
              onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN(logicN + 1) }}
              title="Increase N"
            >+</button>
          </div>
        ) : logicType ? (
          <div
            style={{ ...baseStyle, padding: '0 6px', cursor: 'pointer' }}
            className="nodrag nopan"
            onClick={handleLabelClick}
            title="Click to cycle AND/OR/N-of"
          >
            {logicType.toUpperCase()}
          </div>
        ) : null}
        {order !== null && !logicType && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              background: style.stroke || '#51cf66',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 'bold',
              width: '24px',
              height: '24px',
              lineHeight: '24px',
              textAlign: 'center',
              borderRadius: '50%',
              border: '2px solid #1a1a1a',
            }}
            className="nodrag nopan"
          >
            {order}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
