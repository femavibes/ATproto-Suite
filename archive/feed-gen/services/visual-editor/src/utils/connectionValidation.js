/**
 * Simple Connection Validation
 * Validates that connections are made between compatible node types
 */

import { isFlowTerminalType } from './flowNodeTypes.js'

/**
 * Normalize container parent for scope comparison (root canvas = null).
 * @param {string|null|undefined} p
 */
export function normalizeLogicContainerScope(p) {
  if (p == null || p === '') return ''
  return String(p)
}

const CONDITION_TYPES_SET = new Set([
  'text',
  'regex',
  'language',
  'posttype',
  'hashtag',
  'labels',
  'dateage',
  'author',
  'media',
  'engagement',
  'poststructure',
  'mentions',
  'links',
  'image',
  'video',
  'quotepost',
])

/** True if both ends are condition nodes and both handles are logic (orange) ports. */
export function isConditionPairLogicEdge(sourceHandle, targetHandle, sourceType, targetType) {
  const isLogicHandle = (h) => h && h.startsWith('logic-')
  return (
    isLogicHandle(sourceHandle) &&
    isLogicHandle(targetHandle) &&
    CONDITION_TYPES_SET.has(String(sourceType || '')) &&
    CONDITION_TYPES_SET.has(String(targetType || ''))
  )
}

/**
 * Validate if a connection is allowed
 * @param {string} sourceHandle - Source handle ID (must be output/+)
 * @param {string} targetHandle - Target handle ID (must be input/-)
 * @param {string} sourceType - Source node type
 * @param {string} targetType - Target node type
 * @param {{ sourceContainerParent?: string|null, targetContainerParent?: string|null }} [scope] - For condition↔condition logic edges, both ends must share the same `data.containerParent` (Option B: local wiring only inside the same AND/OR/N-of box or root).
 * @returns {boolean} True if connection is allowed
 */
export const validateConnection = (sourceHandle, targetHandle, sourceType, targetType, scope = {}) => {
  // Prevent self-connections
  if (sourceType === targetType && sourceHandle === targetHandle) {
    return false
  }

  // If handles are not provided, allow the connection (React Flow will handle validation)
  // This must come FIRST before any handle validation
  if (!sourceHandle || !targetHandle) {
    return true
  }

  // React Flow requires: sourceHandle must be from a source handle (+), targetHandle must be from a target handle (-)
  // For condition nodes, handles are named input-*/output-* but React Flow type determines source/target
  // We validate based on handle position/color matching, not strict naming

  const isConditionNode = (type) => CONDITION_TYPES_SET.has(String(type || ''))
  const isJunction = (type) =>
    type === 'junction' || type === 'logicgroup' || type === 'and' || type === 'or' || type === 'nof'
  const isScoringNode = (type) => ['recency', 'engagementscore', 'customscore'].includes(type)
  const isInjectionNode = (type) => ['rotatingposts', 'feedads'].includes(type)
  const isFixedPositionNode = (type) => ['pinnedposts', 'dynamicpinned', 'featuredpost'].includes(type)
  const isFixedSortingNode = (type) => ['fixedchronological', 'fixedbyscore', 'fixedmostlikes', 'fixedmostengagement', 'fixedrandom'].includes(type)
  const isSortingNode = (type) => ['chronological', 'byscore', 'mostlikes', 'mostengagement', 'random'].includes(type)
  const isAccessNode = (type) => type === 'whitelist'
  const isLogicNode = (type) =>
    type === 'and' || type === 'or' || type === 'nof' || type === 'logicgroup' || type === 'logicbox'

  const sourceIsCondition = isConditionNode(sourceType)
  const targetIsCondition = isConditionNode(targetType)
  const sourceIsScoring = isScoringNode(sourceType)
  const targetIsScoring = isScoringNode(targetType)
  const sourceIsInjection = isInjectionNode(sourceType)
  const targetIsInjection = isInjectionNode(targetType)
  const sourceIsFixedPosition = isFixedPositionNode(sourceType)
  const targetIsFixedPosition = isFixedPositionNode(targetType)
  const sourceIsFixedSorting = isFixedSortingNode(sourceType)
  const targetIsFixedSorting = isFixedSortingNode(targetType)
  const sourceIsSorting = isSortingNode(sourceType)
  const targetIsSorting = isSortingNode(targetType)
  const sourceIsAccess = isAccessNode(sourceType)
  const sourceIsLogic = isLogicNode(sourceType)
  const targetIsLogic = isLogicNode(targetType)

  // Video Feed node: can sit anywhere in the flow path.
  // Block logic-handle connections; allow any flow connection in or out.
  // The publish logic finds END nodes reachable from any videofeed node via BFS.
  if (sourceType === 'videofeed' || targetType === 'videofeed') {
    const isLogicH = (h) => h && h.startsWith('logic-')
    if (isLogicH(sourceHandle) || isLogicH(targetHandle)) return false
    // Don't connect videofeed output to condition node logic inputs, etc.
    if (sourceType === 'videofeed' && targetType && isConditionNode(targetType)) return false
    return true
  }

  // Access / membership nodes connect to END left input.
  if (sourceIsAccess) {
    if (!isFlowTerminalType(targetType) || targetHandle !== 'input-left') return false
    if (sourceHandle !== 'output-bottom') return false
    return true
  }

  // Injection: chain upstream → downstream (output-bottom → input-top), head → END left.
  if (sourceIsInjection) {
    if (sourceHandle !== 'output-bottom') return false
    if (isFlowTerminalType(targetType) && targetHandle === 'input-left') return true
    if (targetIsInjection && targetHandle === 'input-top') return true
    return false
  }

  // Fixed position nodes can connect to:
  // - END node's left input
  // - Other fixed position nodes (linear pipeline)
  // - Fixed sorting nodes (chain before sorting)
  // - Sorting nodes (chain before sorting)
  if (sourceIsFixedPosition || sourceIsFixedSorting) {
    if (isFlowTerminalType(targetType)) {
      // Must connect to left input
      if (targetHandle !== 'input-left') {
        return false
      }
      return true
    }
    if (targetIsFixedPosition || targetIsFixedSorting || targetIsSorting) {
      // Can chain to other fixed position nodes, fixed sorting nodes, or sorting nodes
      return true
    }
    return false
  }

  // Sorting nodes can connect to:
  // - END node's left input
  // - Other sorting nodes (linear pipeline)
  // - Injection nodes (chain before END)
  if (sourceIsSorting) {
    if (isFlowTerminalType(targetType)) {
      // Must connect to left input
      if (targetHandle !== 'input-left') {
        return false
      }
      return true
    }
    if (targetIsSorting) {
      return sourceHandle === 'output-top' && targetHandle === 'input-bottom'
    }
    return false
  }

  // Sorting → injection, or injection chain into another injection's input-top
  if (targetIsInjection && targetHandle === 'input-top') {
    if (sourceIsSorting && sourceHandle === 'output-top') return true
    if (sourceIsInjection && sourceHandle === 'output-bottom') return true
    return false
  }

  // Scoring nodes can connect freely (green flow); color validation doesn't apply
  if (sourceIsScoring || targetIsScoring) {
    return true
  }

  const isLogicHandle = (h) => h && h.startsWith('logic-')

  // Logic-handle connections (orange wires)
  if (isLogicHandle(sourceHandle) || isLogicHandle(targetHandle)) {
    if (!isLogicHandle(sourceHandle) || !isLogicHandle(targetHandle)) {
      return false
    }
    // Condition ↔ condition: only inside the same logic container (or both on root: same empty scope)
    if (sourceIsCondition && targetIsCondition) {
      const a = normalizeLogicContainerScope(scope.sourceContainerParent)
      const b = normalizeLogicContainerScope(scope.targetContainerParent)
      if (a !== b) return false
    }
    return true
  }

  // Block flow connections to/from condition nodes (but NOT junction)
  if ((sourceIsCondition && !isJunction(sourceType)) || (targetIsCondition && !isJunction(targetType))) {
    if (!isLogicHandle(sourceHandle) || !isLogicHandle(targetHandle)) {
      return false
    }
  }

  // Allow all other connections that follow + to - rule
  return true
}

/**
 * Get edge color based on connection type
 * @param {string} sourceHandle - Source handle ID
 * @param {string} targetHandle - Target handle ID
 * @param {string} sourceType - Source node type
 * @param {string} targetType - Target node type
 * @returns {string} Color hex code
 */
export const getEdgeColor = (sourceHandle, targetHandle, sourceType, targetType) => {
  const isConditionNode = (type) => ['text', 'regex', 'language', 'posttype', 'hashtag', 'labels', 'dateage', 'author', 'media', 'engagement', 'poststructure', 'mentions', 'links', 'image', 'video', 'quotepost'].includes(type)
  const isScoringNode = (type) => ['recency', 'engagementscore', 'customscore'].includes(type)
  const isInjectionNode = (type) => ['rotatingposts', 'feedads'].includes(type)
  const isFixedPositionNode = (type) => ['pinnedposts', 'dynamicpinned', 'featuredpost'].includes(type)
  const isFixedSortingNode = (type) => ['fixedchronological', 'fixedbyscore', 'fixedmostlikes', 'fixedmostengagement', 'fixedrandom'].includes(type)
  const isSortingNode = (type) => ['chronological', 'byscore', 'mostlikes', 'mostengagement', 'random'].includes(type)
  const isAccessNode = (type) => type === 'whitelist'
  const isLogicNode = (type) =>
    type === 'and' || type === 'or' || type === 'nof' || type === 'logicgroup' || type === 'logicbox'

  const sourceIsCondition = isConditionNode(sourceType)
  const targetIsCondition = isConditionNode(targetType)
  const sourceIsScoring = isScoringNode(sourceType)
  const targetIsScoring = isScoringNode(targetType)
  const sourceIsInjection = isInjectionNode(sourceType)
  const targetIsInjection = isInjectionNode(targetType)
  const sourceIsFixedPosition = isFixedPositionNode(sourceType)
  const targetIsFixedPosition = isFixedPositionNode(targetType)
  const sourceIsFixedSorting = isFixedSortingNode(sourceType)
  const targetIsFixedSorting = isFixedSortingNode(targetType)
  const sourceIsSorting = isSortingNode(sourceType)
  const targetIsSorting = isSortingNode(targetType)
  const sourceIsAccess = isAccessNode(sourceType)
  const targetIsLogic = isLogicNode(targetType)
  const sourceIsLogic = isLogicNode(sourceType)
  const sourceIsStart = sourceType === 'start'
  const sourceIsEnd = isFlowTerminalType(sourceType)
  const targetIsStart = targetType === 'start'
  const targetIsEnd = isFlowTerminalType(targetType)
  
  // Fixed position and fixed sorting nodes use yellow connections
  if (sourceIsFixedPosition || targetIsFixedPosition || sourceIsFixedSorting || targetIsFixedSorting) {
    if (isFlowTerminalType(targetType) && targetHandle === 'input-left') {
      return '#ffd43b' // Yellow for fixed position
    }
    if (targetIsFixedPosition || targetIsFixedSorting || targetIsSorting) {
      return '#ffd43b' // Yellow for fixed position chain
    }
  }

  // Video Feed (either direction) uses cyan/blue
  if (sourceType === 'videofeed' || targetType === 'videofeed') {
    return '#339af0'
  }

  // Whitelist / access → END
  if (sourceIsAccess && isFlowTerminalType(targetType) && targetHandle === 'input-left') {
    return '#20c997'
  }

  // Injection chain (same lane)
  if (
    sourceIsInjection &&
    targetIsInjection &&
    targetHandle === 'input-top' &&
    sourceHandle === 'output-bottom'
  ) {
    return '#ff6b6b'
  }

  // Injection head → END
  if (sourceIsInjection && isFlowTerminalType(targetType) && targetHandle === 'input-left') {
    return '#ff6b6b' // Red/orange for injection
  }

  // Sorting nodes use purple connections
  if (sourceIsSorting) {
    if (isFlowTerminalType(targetType) && targetHandle === 'input-left') {
      return '#9775fa' // Purple for sorting
    }
    if (targetIsSorting && targetHandle === 'input-bottom') {
      return '#9775fa' // Purple for sorting chain
    }
    if (targetIsInjection && targetHandle === 'input-top') {
      return '#9775fa' // Sorting → first injection
    }
  }
  
  // Scoring nodes use green flow connections (like logic nodes)
  if (sourceIsScoring || targetIsScoring) {
    return '#51cf66' // Green for flow
  }
  
  const isLogicHandle = (h) => h && h.startsWith('logic-')

  // Logic shortcut connections - blue (AND) by default, toggled via click
  if (isLogicHandle(sourceHandle) && isLogicHandle(targetHandle)) {
    return '#4a9eff'
  }

  // 1. Condition to condition connections - green flow
  if (sourceIsCondition && targetIsCondition) {
    return '#51cf66'
  }
  
  // 2. Condition to Logic connections - use logic node's color
  if (sourceIsCondition && targetIsLogic) {
    if (targetType === 'or') {
      return '#ff9500'
    }
    if (targetType === 'and') {
      return '#4a9eff'
    }
    if (targetType === 'nof') {
      return '#9b59b6'
    }
  }

  // Logic to condition - green flow
  if (sourceIsLogic && targetIsCondition) {
    return '#51cf66'
  }

  // 3. Flow connections (START/END/Logic left-right) are green
  // Only if NOT condition-to-condition or condition-to-logic (already handled above)
  if (!(sourceIsCondition && (targetIsCondition || targetIsLogic))) {
    // Flow: source output-right/left to target input-left/right
    if ((sourceHandle === 'output-right' || sourceHandle === 'output-left') &&
        (targetHandle === 'input-left' || targetHandle === 'input-right')) {
      return '#51cf66' // Green
    }
  }

  // 4. Logic to Logic connections - only via green FLOW handles (left-right)
  // Logic nodes can only connect to other logic nodes via flow handles
  // Top/bottom handles on logic nodes are inputs only (for condition nodes)
  if (sourceIsLogic && targetIsLogic) {
    // Logic-to-logic via flow handles should be green
    if ((sourceHandle === 'output-right' || sourceHandle === 'output-left') &&
        (targetHandle === 'input-left' || targetHandle === 'input-right')) {
      return '#51cf66' // Green for flow connections
    }
  }

  // Default: orange
  return '#ff9500' // Orange
}
