/**
 * Edge/Connection Styling
 * Controls how connections between blocks appear
 * 
 * Connection types:
 * - OR logic: Orange (#ff9500) - connections to/from OR blocks
 * - AND logic: Blue (#4a9eff) - connections to/from AND blocks
 * - Continue flow: Green (#51cf66) - main pipeline flow
 */

export const EDGE_COLORS = {
  OR: '#ff9500',      // Orange - OR logic
  AND: '#4a9eff',     // Blue - AND logic
  NOF: '#9b59b6',     // Purple - N-of logic
  CONTINUE: '#51cf66', // Green - Continue flow (main pipeline)
}

export const DEFAULT_EDGE_STYLE = {
  stroke: EDGE_COLORS.CONTINUE,
  strokeWidth: 2,
}

export const DEFAULT_EDGE_OPTIONS = {
  style: DEFAULT_EDGE_STYLE,
  type: 'smoothstep',
}

export const CONNECTION_LINE_STYLE = {
  stroke: '#888888', // Neutral grey for dragging connection line
  strokeWidth: 2,
  markerEnd: {
    type: 'arrowclosed',
    width: 20,
    height: 20,
  },
}

/**
 * Determine edge color based on source and target handles
 * @param {string} sourceHandle - Source handle ID (e.g., 'output-left', 'output-right')
 * @param {string} targetHandle - Target handle ID (e.g., 'input-left', 'input-top')
 * @param {string} sourceType - Source node type
 * @param {string} targetType - Target node type
 * @param {string} sourceId - Source node ID (to determine if it's AND or OR)
 * @returns {string} Color hex code
 */
export const getEdgeColor = (sourceHandle, targetHandle, sourceType, targetType, sourceId = '') => {
  const isConditionNode = (type) => ['text', 'regex', 'language', 'posttype', 'hashtag', 'labels', 'dateage', 'author', 'media'].includes(type)
  const isLogicNode = (type) => type === 'and' || type === 'or' || type === 'nof'
  
  const sourceIsCondition = sourceType && isConditionNode(sourceType)
  const targetIsCondition = targetType && isConditionNode(targetType)
  const targetIsLogic = targetType && isLogicNode(targetType)
  const sourceIsLogic = sourceType && isLogicNode(sourceType)
  const targetIsAnd = targetType === 'and'
  const targetIsOr = targetType === 'or'
  const sourceIsAnd = sourceType === 'and'
  const sourceIsOr = sourceType === 'or'
  const targetIsNOf = targetType === 'nof'
  const sourceIsNOf = sourceType === 'nof'
  
  // Condition to Condition: Bidirectional - direction determined by first click
  if (sourceIsCondition && targetIsCondition) {
    // Blue handles (top/bottom) = AND logic
    if ((sourceHandle === 'top-blue-source' || sourceHandle === 'top-blue-target' ||
         sourceHandle === 'bottom-blue-source' || sourceHandle === 'bottom-blue-target') &&
        (targetHandle === 'top-blue-source' || targetHandle === 'top-blue-target' ||
         targetHandle === 'bottom-blue-source' || targetHandle === 'bottom-blue-target')) {
      return EDGE_COLORS.AND // Blue
    }
    // Orange handles (left/right) = OR logic
    if ((sourceHandle === 'left-orange-source' || sourceHandle === 'left-orange-target' ||
         sourceHandle === 'right-orange-source' || sourceHandle === 'right-orange-target') &&
        (targetHandle === 'left-orange-source' || targetHandle === 'left-orange-target' ||
         targetHandle === 'right-orange-source' || targetHandle === 'right-orange-target')) {
      return EDGE_COLORS.OR // Orange
    }
  }
  
  // Condition to Logic: Based on target logic type (conditions always feed INTO logic)
  if (sourceIsCondition && targetIsLogic) {
    // Blue handles (top/bottom) from condition to logic
    if ((sourceHandle === 'top-blue-source' || sourceHandle === 'top-blue-target' ||
         sourceHandle === 'bottom-blue-source' || sourceHandle === 'bottom-blue-target') &&
        (targetHandle === 'input-top' || targetHandle === 'input-bottom')) {
      if (targetIsOr) {
        return EDGE_COLORS.OR // Orange for OR blocks
      }
      if (targetIsAnd) {
        return EDGE_COLORS.AND // Blue for AND blocks
      }
    }
    // Orange handles (left/right) from condition to logic
    if ((sourceHandle === 'left-orange-source' || sourceHandle === 'left-orange-target' ||
         sourceHandle === 'right-orange-source' || sourceHandle === 'right-orange-target') &&
        (targetHandle === 'input-top' || targetHandle === 'input-bottom')) {
      if (targetIsOr) {
        return EDGE_COLORS.OR // Orange for OR blocks
      }
      if (targetIsAnd) {
        return EDGE_COLORS.AND // Blue for AND blocks
      }
    }
  }
  
  // Left/right connections = FLOW (green) - main pipeline (only for non-condition to non-condition)
  if ((sourceHandle === 'output-left' || sourceHandle === 'output-right') &&
      (targetHandle === 'input-left' || targetHandle === 'input-right')) {
    // Only green if NOT condition-to-condition (those use orange for OR logic)
    if (!(sourceIsCondition && targetIsCondition)) {
      return EDGE_COLORS.CONTINUE // Green
    }
  }
  
  // Logic to Condition: Based on source logic type
  if (sourceIsLogic && targetIsCondition) {
    // Top/bottom handles - match the logic block color
    if ((sourceHandle === 'output-top' || sourceHandle === 'output-bottom') &&
        (targetHandle === 'input-top' || targetHandle === 'input-bottom')) {
      if (sourceIsOr) {
        return EDGE_COLORS.OR // Orange for OR blocks
      }
      if (sourceIsAnd) {
        return EDGE_COLORS.AND // Blue for AND blocks
      }
    }
  }
  
  // Logic to Logic: Based on source logic type
  if (sourceIsLogic && targetIsLogic) {
    // Top/bottom handles - match the source logic block color
    if ((sourceHandle === 'output-top' || sourceHandle === 'output-bottom') &&
        (targetHandle === 'input-top' || targetHandle === 'input-bottom')) {
      if (sourceIsOr) {
        return EDGE_COLORS.OR // Orange for OR blocks
      }
      if (sourceIsAnd) {
        return EDGE_COLORS.AND // Blue for AND blocks
      }
    }
  }
  
  // Condition to N-of: Purple (N-of accepts blue or orange from conditions)
  if (sourceIsCondition && targetIsNOf) {
    // Blue or orange handles from condition to N-of top handles
    if ((sourceHandle === 'top-blue-source' || sourceHandle === 'top-blue-target' ||
         sourceHandle === 'bottom-blue-source' || sourceHandle === 'bottom-blue-target' ||
         sourceHandle === 'left-orange-source' || sourceHandle === 'left-orange-target' ||
         sourceHandle === 'right-orange-source' || sourceHandle === 'right-orange-target') &&
        (targetHandle === 'input-top' || targetHandle === 'input-top-2')) {
      return EDGE_COLORS.NOF // Purple
    }
  }
  
  // N-of to Condition: Purple (N-of outputs to conditions)
  if (sourceIsNOf && targetIsCondition) {
    // Bottom handles - purple for N-of
    if (sourceHandle === 'output-bottom' || sourceHandle === 'output-bottom-2') {
      return EDGE_COLORS.NOF // Purple
    }
  }
  
  // N-of to Logic or Logic to N-of: Purple
  if ((sourceIsNOf && targetIsLogic) || (sourceIsLogic && targetIsNOf)) {
    if ((sourceHandle === 'output-bottom' || sourceHandle === 'output-bottom-2') &&
        (targetHandle === 'input-top' || targetHandle === 'input-top-2')) {
      return EDGE_COLORS.NOF // Purple
    }
  }
  
  // Start / IN → … / End / OUT: continue flow (green)
  if (
    sourceType === 'start' ||
    sourceType === 'containerin' ||
    targetType === 'end' ||
    targetType === 'containerout'
  ) {
    return EDGE_COLORS.CONTINUE // Green
  }
  
  // Default: continue flow (green)
  return EDGE_COLORS.CONTINUE
}
