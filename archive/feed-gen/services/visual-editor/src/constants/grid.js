/**
 * Grid Configuration
 * Controls snap-to-grid behavior for node positioning
 */

export const GRID_SIZE = 20

export const snapToGrid = (x, y) => ({
  x: Math.round(x / GRID_SIZE) * GRID_SIZE,
  y: Math.round(y / GRID_SIZE) * GRID_SIZE,
})

/**
 * END pipeline nodes use `.node` in `src/nodes/NodeStyles.css` (180×100, border-box).
 * Slot outline and node position share the same flow-space top-left so they line up.
 */
export const END_PIPELINE_SORTING_NODE_SIZE = { width: 180, height: 100 }

/** Vertical gap between stacked slots in one column (flow space). */
export const END_PIPELINE_SORT_SLOT_STRIDE_Y =
  END_PIPELINE_SORTING_NODE_SIZE.height + GRID_SIZE

/**
 * Left-to-right: Sorting → Injection → Fixed → Access (even spacing; node width 180 + 20 gutter).
 */
const END_PIPELINE_ROW0_Y = snapToGrid(220, 220).y
const END_PIPELINE_COL_GAP = 200

export const END_PIPELINE_SORTING_X = snapToGrid(60, 220).x
const END_PIPELINE_INJECTION_X = END_PIPELINE_SORTING_X + END_PIPELINE_COL_GAP
const END_PIPELINE_FIXED_X = END_PIPELINE_INJECTION_X + END_PIPELINE_COL_GAP
const END_PIPELINE_ACCESS_X = END_PIPELINE_FIXED_X + END_PIPELINE_COL_GAP

/** One plain sorting module per feed END (no stacking). */
export const MAX_END_PIPELINE_SORTING_SLOTS = 1
export const MAX_END_PIPELINE_ACCESS_SLOTS = 8
export const MAX_END_PIPELINE_INJECTION_SLOTS = 8
export const MAX_END_PIPELINE_FIXED_SLOTS = 8

function slotFrameAtColumn(columnX, slotIndex) {
  const i = Math.max(0, slotIndex)
  return {
    x: columnX,
    y: END_PIPELINE_ROW0_Y + i * END_PIPELINE_SORT_SLOT_STRIDE_Y,
    width: END_PIPELINE_SORTING_NODE_SIZE.width,
    height: END_PIPELINE_SORTING_NODE_SIZE.height,
  }
}

function slotIndexAtFlowPoint(flowX, flowY, slotCount, columnX, maxSlots) {
  const n = Math.max(1, Math.min(maxSlots, slotCount))
  for (let i = 0; i < n; i++) {
    const f = slotFrameAtColumn(columnX, i)
    if (
      flowX >= f.x &&
      flowX <= f.x + f.width &&
      flowY >= f.y &&
      flowY <= f.y + f.height
    ) {
      return i
    }
  }
  return 0
}

/**
 * @param {number} slotIndex 0 = nearest END (top of stack), higher = upstream
 */
export function getEndPipelineSortingSlotFrame(slotIndex) {
  return slotFrameAtColumn(END_PIPELINE_SORTING_X, slotIndex)
}

export function getEndPipelineSortingSnapPosition(slotIndex) {
  const f = getEndPipelineSortingSlotFrame(slotIndex)
  return { x: f.x, y: f.y }
}

/** @deprecated Use getEndPipelineSortingSlotFrame(0) */
export const END_PIPELINE_SORTING_SLOT_FRAME = getEndPipelineSortingSlotFrame(0)

/** @deprecated Use getEndPipelineSortingSnapPosition(0) */
export const END_PIPELINE_SORTING_SNAP_POSITION = getEndPipelineSortingSnapPosition(0)

export function getEndPipelineAccessSlotFrame(slotIndex = 0) {
  return slotFrameAtColumn(END_PIPELINE_ACCESS_X, slotIndex)
}

export function getEndPipelineAccessSnapPosition(slotIndex = 0) {
  const f = getEndPipelineAccessSlotFrame(slotIndex)
  return { x: f.x, y: f.y }
}

export function getEndPipelineAccessSlotIndexAtFlowPoint(flowX, flowY, slotCount) {
  return slotIndexAtFlowPoint(
    flowX,
    flowY,
    slotCount,
    END_PIPELINE_ACCESS_X,
    MAX_END_PIPELINE_ACCESS_SLOTS
  )
}

export function getEndPipelineInjectionSlotFrame(slotIndex = 0) {
  return slotFrameAtColumn(END_PIPELINE_INJECTION_X, slotIndex)
}

export function getEndPipelineInjectionSnapPosition(slotIndex = 0) {
  const f = getEndPipelineInjectionSlotFrame(slotIndex)
  return { x: f.x, y: f.y }
}

export function getEndPipelineInjectionSlotIndexAtFlowPoint(flowX, flowY, slotCount) {
  return slotIndexAtFlowPoint(
    flowX,
    flowY,
    slotCount,
    END_PIPELINE_INJECTION_X,
    MAX_END_PIPELINE_INJECTION_SLOTS
  )
}

export function getEndPipelineFixedSlotFrame(slotIndex = 0) {
  return slotFrameAtColumn(END_PIPELINE_FIXED_X, slotIndex)
}

export function getEndPipelineFixedSnapPosition(slotIndex = 0) {
  const f = getEndPipelineFixedSlotFrame(slotIndex)
  return { x: f.x, y: f.y }
}

export function getEndPipelineFixedSlotIndexAtFlowPoint(flowX, flowY, slotCount) {
  return slotIndexAtFlowPoint(
    flowX,
    flowY,
    slotCount,
    END_PIPELINE_FIXED_X,
    MAX_END_PIPELINE_FIXED_SLOTS
  )
}

/**
 * Which sorting slot a flow-space point falls into, or 0 if outside all frames [0, slotCount).
 */
export function getEndPipelineSlotIndexAtFlowPoint(flowX, flowY, slotCount) {
  return slotIndexAtFlowPoint(
    flowX,
    flowY,
    slotCount,
    END_PIPELINE_SORTING_X,
    MAX_END_PIPELINE_SORTING_SLOTS
  )
}
