import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Panel,
  MarkerType,
  useStore,
} from 'reactflow'
import { Agent } from '@atproto/api'
import { useHistory } from '../contexts/HistoryContext'
import 'reactflow/dist/style.css'
import {
  snapToGrid,
  GRID_SIZE,
  getEndPipelineSortingSlotFrame,
  getEndPipelineSortingSnapPosition,
  getEndPipelineSlotIndexAtFlowPoint,
  getEndPipelineAccessSlotFrame,
  getEndPipelineAccessSnapPosition,
  getEndPipelineAccessSlotIndexAtFlowPoint,
  getEndPipelineInjectionSlotFrame,
  getEndPipelineInjectionSnapPosition,
  getEndPipelineInjectionSlotIndexAtFlowPoint,
  getEndPipelineFixedSlotFrame,
  getEndPipelineFixedSnapPosition,
  getEndPipelineFixedSlotIndexAtFlowPoint,
  MAX_END_PIPELINE_SORTING_SLOTS,
  MAX_END_PIPELINE_ACCESS_SLOTS,
  MAX_END_PIPELINE_INJECTION_SLOTS,
  MAX_END_PIPELINE_FIXED_SLOTS,
} from '../constants/grid'
import { rebuildSortingChainForEndPipeline } from '../utils/endPipelineSorting'
import { rebuildAccessEdgesForEndPipeline } from '../utils/endPipelineAccess'
import { rebuildInjectionChainForEndPipeline } from '../utils/endPipelineInjection'
import { rebuildFixedSlotChainForEndPipeline } from '../utils/endPipelineFixed'
import { DEFAULT_EDGE_OPTIONS, CONNECTION_LINE_STYLE } from '../constants/edges'
import { nodeTypes } from '../constants/nodeTypes'
import { initialNodes, initialEdges } from '../constants/initialNodes'
import { handleNodeDeletion } from '../utils/keyboard'
import {
  validateConnection,
  getEdgeColor,
  isConditionPairLogicEdge,
  normalizeLogicContainerScope,
} from '../utils/connectionValidation'
import {
  bindLogicBoxParentNodes,
  sortNodesForSubflows,
  resizeLogicBoxes,
  pickEnclosingLogicBox,
  reparentNodeToLogicBox,
  nudgeLogicBoxChildAwayFromSiblings,
  maybeUnparentLogicBoxChild,
  removeLogicBoxAndLiftChildren,
  isDescendantOfZoomContainer,
  canPlaceInsideLogicBox,
  getAbsoluteNodePosition,
  getLogicBoxInnerSize,
  childNodeSize,
  LOGIC_BOX_MIN_W,
  LOGIC_BOX_MIN_H,
} from '../utils/logicBoxLayout.js'
import KeywordModal from './KeywordModal'
import RegexModal from './RegexModal'
import LanguageModal from './LanguageModal'
import PostTypeModal from './PostTypeModal'
import AuthorModal from './AuthorModal'
import MediaTypeModal from './MediaTypeModal'
import HashtagModal from './HashtagModal'
import LabelsModal from './LabelsModal'
import DateAgeModal from './DateAgeModal'
import NOfModal from './NOfModal'
import ManualPostsModal from './ManualPostsModal'
import EngagementModal from './EngagementModal'
import PostStructureModal from './PostStructureModal'
import MentionsModal from './MentionsModal'
import LinksModal from './LinksModal'
import ImageModal from './ImageModal'
import VideoModal from './VideoModal'
import QuotePostModal from './QuotePostModal'
import RecencyBoostModal from './RecencyBoostModal'
import EngagementScoreModal from './EngagementScoreModal'
import CustomScoreModal from './CustomScoreModal'
import RotatingPostsModal from './RotatingPostsModal'
import ChronologicalModal from './ChronologicalModal'
import DynamicPinnedModal from './DynamicPinnedModal'
import PinnedPostsModal from './PinnedPostsModal'
import FeaturedPostModal from './FeaturedPostModal'
import FixedChronologicalModal from './FixedChronologicalModal'
import FixedByScoreModal from './FixedByScoreModal'
import EndFeedBindingModal from './EndFeedBindingModal'
import FeedOutputsModal from './FeedOutputsModal'
import { createModalHandlers } from './handlers/modalHandlers'
import { createNodeHandlers } from './handlers/nodeHandlers'
import { calculateEdgeOrder } from '../utils/edgeOrder'
import OrderedEdge from './OrderedEdge'
import TestPostModal from './TestPostModal'
import DebugUrlModal from './DebugUrlModal'
import DebugResultsPanel from './DebugResultsPanel'
import { evaluateGraph } from '../utils/graphEvaluator'
import { analyzeCostOrderViolations, computeIngestionRunOrderMap } from '../utils/costOrderValidation'
import { mergeEvaluationResultsMap } from '../utils/mergeEvaluationResultsMap'
import { loadDebugPins, saveDebugPins } from '../utils/debugPinsStorage'
import { useNavigation } from '../contexts/NavigationContext'
import { useAuth } from '../contexts/AuthContext'
import {
  isPlainSortingNodeType,
  isPlainAccessNodeType,
  isPlainInjectionNodeType,
  isPlainFixedSlotNodeType,
} from '../constants/pipelineNodes'
import {
  ensureDefaultProject,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  getStoredProjectId,
  setStoredProjectId,
  listProjectFeeds,
  createProjectFeed,
  updateFeed,
  setFeedPublished,
  saveFeedDraft,
  promoteFeedDraftToLive,
  setFeedPublishedUri,
  saveProjectDraft,
  promoteProjectDraftToLive,
} from '../api/feedBuilderApi'
import './Canvas.css'

// Render logic labels above all edges
const edgeTypes = {
  ordered: OrderedEdge,
}

const toAtprotoRkey = (value, fallback = 'feed') => {
  const raw = String(value || '').trim().toLowerCase()
  const normalized = raw
    .replace(/[^a-z0-9._~-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
  if (normalized) return normalized.slice(0, 512)
  return String(fallback || 'feed').replace(/[^a-zA-Z0-9]/g, '').slice(0, 64) || 'feed'
}

/**
 * React Flow renders `children` outside the panned/zoomed `.react-flow__viewport`, so flow-space
 * coordinates must be wrapped with the same translate + scale as the graph (see @reactflow/core).
 */
const END_PIPELINE_SLOT_GUIDE_Z = 0
/** Above `.react-flow__nodes` (z-index 2) so “+ Add slot” stays visible and clickable. */
const END_PIPELINE_SLOT_ADD_BTN_Z = 6

function normalizeFeedRecord(feed) {
  return {
    id: String(feed.id),
    name: feed.name || '',
    slug: feed.slug || '',
    description: feed.description || '',
    avatar: feed.avatar_url || feed.avatar || '',
    published: !!feed.is_published || !!feed.published,
  }
}

/** Matches graphEvaluator loose flow edges — used only for debug edge highlighting. */
function isDebugFlowEdgeLoose(e) {
  if (!e?.source || !e?.target) return false
  if (e.sourceHandle === 'output-right' && e.targetHandle === 'input-left') return true
  if (String(e.type || '').toLowerCase() === 'flow') return true
  if (!e.sourceHandle && !e.targetHandle && e.target) return true
  return false
}

function isDebugLogicEdgeLoose(e) {
  if (String(e.type || '').toLowerCase() === 'logic') return true
  return typeof e.sourceHandle === 'string' && e.sourceHandle.startsWith('logic-')
}

function EndPipelineSlotOverlayTransform({ zIndex, children }) {
  const transform = useStore((s) => s.transform)
  const [tx, ty, zoom] = transform
  return (
    <div
      className="end-pipeline-slot-viewport-layer"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex,
        overflow: 'visible',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function EndPipelineSortingSlotsOverlay({ slotCount, hasModuleInSlot }) {
  const frames = Array.from({ length: slotCount }, (_, i) =>
    getEndPipelineSortingSlotFrame(i)
  )
  const last = frames[slotCount - 1]
  return (
    <>
      <EndPipelineSlotOverlayTransform zIndex={END_PIPELINE_SLOT_GUIDE_Z}>
        {frames.map((frame, i) => {
          const filled = hasModuleInSlot(i)
          return (
            <div
              key={i}
              className={`end-pipeline-slot-on-canvas${filled ? ' end-pipeline-slot-on-canvas--filled' : ''}`}
              style={{
                position: 'absolute',
                left: frame.x,
                top: frame.y,
                width: frame.width,
                height: frame.height,
              }}
            >
              <span className="end-pipeline-slot-on-canvas__title">
                {slotCount === 1 ? 'Sorting' : `Sorting ${i + 1}`}
                {i === 0 ? ' · to feed' : ''}
              </span>
              <span className="end-pipeline-slot-on-canvas__hint">
                {filled
                  ? 'Drop from sidebar to replace.'
                  : 'Drop one sorting module (Sidebar → Sorting).'}
              </span>
            </div>
          )
        })}
      </EndPipelineSlotOverlayTransform>
      {slotCount === 1 && (
        <EndPipelineSlotOverlayTransform zIndex={END_PIPELINE_SLOT_GUIDE_Z}>
          <div
            className="end-pipeline-sorting-footnote"
            style={{
              position: 'absolute',
              left: last.x,
              top: last.y + last.height + 12,
              width: last.width,
            }}
          >
            One sort step per feed. On the main graph, branch before this END (e.g. junction → video
            filter → this END) so each END only receives posts along its path.
          </div>
        </EndPipelineSlotOverlayTransform>
      )}
    </>
  )
}

function EndPipelineAccessSlotsOverlay({
  slotCount,
  hasModuleInSlot,
  onAddSlot,
  canAddMore,
}) {
  const frames = Array.from({ length: slotCount }, (_, i) =>
    getEndPipelineAccessSlotFrame(i)
  )
  const last = frames[slotCount - 1]
  return (
    <>
      <EndPipelineSlotOverlayTransform zIndex={END_PIPELINE_SLOT_GUIDE_Z}>
        {frames.map((frame, i) => {
          const filled = hasModuleInSlot(i)
          return (
            <div
              key={i}
              className={`end-pipeline-slot-on-canvas end-pipeline-slot-on-canvas--access${
                filled ? ' end-pipeline-slot-on-canvas--filled' : ''
              }`}
              style={{
                position: 'absolute',
                left: frame.x,
                top: frame.y,
                width: frame.width,
                height: frame.height,
              }}
            >
              <span className="end-pipeline-slot-on-canvas__title">
                Access {i + 1}
                {i === 0 ? ' · membership' : ''}
              </span>
              <span className="end-pipeline-slot-on-canvas__hint">
                {filled
                  ? 'Whitelist — click node to edit DIDs.'
                  : 'Drop Whitelist (Access tab).'}
              </span>
            </div>
          )
        })}
      </EndPipelineSlotOverlayTransform>
      {canAddMore && (
        <EndPipelineSlotOverlayTransform zIndex={END_PIPELINE_SLOT_ADD_BTN_Z}>
          <button
            type="button"
            className="end-pipeline-add-slot-btn end-pipeline-add-slot-btn--access"
            style={{
              position: 'absolute',
              left: last.x,
              top: last.y + last.height + 12,
              pointerEvents: 'auto',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onAddSlot()
            }}
          >
            + Add access slot
          </button>
        </EndPipelineSlotOverlayTransform>
      )}
    </>
  )
}

function EndPipelineInjectionSlotsOverlay({
  slotCount,
  hasModuleInSlot,
  onAddSlot,
  canAddMore,
}) {
  const frames = Array.from({ length: slotCount }, (_, i) =>
    getEndPipelineInjectionSlotFrame(i)
  )
  const last = frames[slotCount - 1]
  return (
    <>
      <EndPipelineSlotOverlayTransform zIndex={END_PIPELINE_SLOT_GUIDE_Z}>
        {frames.map((frame, i) => {
          const filled = hasModuleInSlot(i)
          return (
            <div
              key={i}
              className={`end-pipeline-slot-on-canvas end-pipeline-slot-on-canvas--injection${
                filled ? ' end-pipeline-slot-on-canvas--filled' : ''
              }`}
              style={{
                position: 'absolute',
                left: frame.x,
                top: frame.y,
                width: frame.width,
                height: frame.height,
              }}
            >
              <span className="end-pipeline-slot-on-canvas__title">
                Injection {i + 1}
                {i === 0 ? ' · to feed' : ''}
              </span>
              <span className="end-pipeline-slot-on-canvas__hint">
                {filled
                  ? 'Rotating posts / Ads — click to configure.'
                  : 'Drop Rotating Posts or Ads (Injection tab).'}
              </span>
            </div>
          )
        })}
      </EndPipelineSlotOverlayTransform>
      {canAddMore && (
        <EndPipelineSlotOverlayTransform zIndex={END_PIPELINE_SLOT_ADD_BTN_Z}>
          <button
            type="button"
            className="end-pipeline-add-slot-btn end-pipeline-add-slot-btn--injection"
            style={{
              position: 'absolute',
              left: last.x,
              top: last.y + last.height + 12,
              pointerEvents: 'auto',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onAddSlot()
            }}
          >
            + Add injection slot
          </button>
        </EndPipelineSlotOverlayTransform>
      )}
    </>
  )
}

function EndPipelineFixedSlotsOverlay({
  slotCount,
  hasModuleInSlot,
  onAddSlot,
  canAddMore,
}) {
  const frames = Array.from({ length: slotCount }, (_, i) =>
    getEndPipelineFixedSlotFrame(i)
  )
  const last = frames[slotCount - 1]
  return (
    <>
      <EndPipelineSlotOverlayTransform zIndex={END_PIPELINE_SLOT_GUIDE_Z}>
        {frames.map((frame, i) => {
          const filled = hasModuleInSlot(i)
          return (
            <div
              key={i}
              className={`end-pipeline-slot-on-canvas end-pipeline-slot-on-canvas--fixed${
                filled ? ' end-pipeline-slot-on-canvas--filled' : ''
              }`}
              style={{
                position: 'absolute',
                left: frame.x,
                top: frame.y,
                width: frame.width,
                height: frame.height,
              }}
            >
              <span className="end-pipeline-slot-on-canvas__title">
                Fixed {i + 1}
                {i === 0 ? ' · to feed' : ''}
              </span>
              <span className="end-pipeline-slot-on-canvas__hint">
                {filled
                  ? 'Pinned / featured — click to configure.'
                  : 'Drop Dynamic Pinned or Featured Post (Fixed tab).'}
              </span>
            </div>
          )
        })}
      </EndPipelineSlotOverlayTransform>
      {canAddMore && (
        <EndPipelineSlotOverlayTransform zIndex={END_PIPELINE_SLOT_ADD_BTN_Z}>
          <button
            type="button"
            className="end-pipeline-add-slot-btn end-pipeline-add-slot-btn--fixed"
            style={{
              position: 'absolute',
              left: last.x,
              top: last.y + last.height + 12,
              pointerEvents: 'auto',
            }}
            onClick={(e) => {
              e.stopPropagation()
              onAddSlot()
            }}
          >
            + Add fixed slot
          </button>
        </EndPipelineSlotOverlayTransform>
      )}
    </>
  )
}

const Canvas = React.forwardRef((props, ref) => {
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  // Ref that always holds the current nodes array without being a reactive dep.
  // Use nodesRef.current inside callbacks/effects that need the latest nodes
  // but must NOT re-run / re-create every time nodes changes.
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const [evaluationResults, setEvaluationResults] = useState(null)
  const [debugGraphSnapshot, setDebugGraphSnapshot] = useState(null)
  const [debugPostSnapshot, setDebugPostSnapshot] = useState(null)
  /** Remembers manual test post or Bluesky URL so Re-run debug can repeat the last run. */
  const [lastDebugSource, setLastDebugSource] = useState(null)
  const historyContext = useHistory()
  // Destructure stable callbacks from historyContext so dependent useCallbacks/useEffects
  // don't need the whole context object as a dep (which would cause them to rebuild on
  // every canUndo/canRedo state change).
  const {
    registerUndo: registerHistoryUndo,
    registerRedo: registerHistoryRedo,
    registerClear: registerHistoryClear,
    registerZoomToFit: registerHistoryZoomToFit,
    registerCenterView: registerHistoryCenterView,
    setCanUndo: historySetCanUndo,
    setCanRedo: historySetCanRedo,
  } = historyContext
  const { currentContainer, navigateTo, navigateToContainer, path } = useNavigation()

  const isEndPipelineView =
    path.length > 0 && path[path.length - 1].view === 'end'

  // OUT is not a feed END — do not keep the end-pipeline canvas open for it (e.g. legacy double-click).
  useEffect(() => {
    if (!isEndPipelineView || !currentContainer) return
    const host = nodes.find((n) => n.id === currentContainer)
    if (host?.type !== 'containerout') return
    navigateTo(path.length > 1 ? path.length - 2 : -1)
  }, [isEndPipelineView, currentContainer, nodes, navigateTo, path.length])

  /** Brief overlay when zooming into / out of / between groups (tree or breadcrumb navigation). */
  const [depthSwitchClass, setDepthSwitchClass] = useState('')
  const isFirstNavPaint = useRef(true)
  const prevPathLen = useRef(0)
  const prevContainerId = useRef(null)

  useEffect(() => {
    if (isFirstNavPaint.current) {
      isFirstNavPaint.current = false
      prevPathLen.current = path.length
      prevContainerId.current = currentContainer
      return
    }
    const lenSame = path.length === prevPathLen.current
    const containerSame = currentContainer === prevContainerId.current
    if (lenSame && containerSame) return

    // Only pulse when changing depth (zoom in/out). Avoid neutral pulse
    // because it can look like a translucent white block behind nodes.
    let cls = ''
    if (!lenSame) {
      cls =
        path.length > prevPathLen.current
          ? 'canvas-wrapper--depth-pulse-in'
          : 'canvas-wrapper--depth-pulse-out'
    }

    prevPathLen.current = path.length
    prevContainerId.current = currentContainer

    if (!cls) return
    setDepthSwitchClass(cls)
    const t = window.setTimeout(() => setDepthSwitchClass(''), 620)
    return () => window.clearTimeout(t)
  }, [currentContainer, path.length])

  // Auto-create START → Junction → END when entering a **group** for the first time.
  // END pipeline view (`view === 'end'`) is only for post-assignment modules (sorting slot) — no mini flow.
  // Uses nodesRef.current so this effect only fires on navigation changes, not on every nodes mutation.
  useEffect(() => {
    if (!currentContainer) return
    const lastSeg = path[path.length - 1]
    if (lastSeg?.view === 'end') return

    const inId = `containerin-${currentContainer}`
    const junctionId = `junction-${currentContainer}`
    const outId = `containerout-${currentContainer}`

    // Read latest nodes via ref — avoids `nodes` as a dep and the resulting
    // re-run on every single node mutation.
    const containerChildren = nodesRef.current.filter(n => n.data?.containerParent === currentContainer)
    const hasIn = containerChildren.some((n) => n.type === 'containerin')
    if (!hasIn) {
      setNodes((nds) => [
        ...nds,
        {
          id: inId,
          type: 'containerin',
          position: { x: 100, y: 250 },
          data: { label: 'IN', containerParent: currentContainer },
        },
        {
          id: junctionId,
          type: 'junction',
          position: { x: 450, y: 250 },
          data: { label: 'junction', containerParent: currentContainer },
        },
        {
          id: outId,
          type: 'containerout',
          position: { x: 800, y: 250 },
          data: { label: 'OUT', containerParent: currentContainer },
        },
      ])
      setEdges((eds) => [
        ...eds,
        {
          id: `edge-${inId}-${junctionId}`,
          source: inId,
          target: junctionId,
          sourceHandle: 'output-right',
          targetHandle: 'input-left',
          type: 'ordered',
          style: { stroke: '#51cf66', strokeWidth: 2 },
          data: {},
          markerEnd: { type: 'arrowclosed', color: '#51cf66', width: 20, height: 20 },
        },
        {
          id: `edge-${junctionId}-${outId}`,
          source: junctionId,
          target: outId,
          sourceHandle: 'output-right',
          targetHandle: 'input-left',
          type: 'ordered',
          style: { stroke: '#51cf66', strokeWidth: 2 },
          data: {},
          markerEnd: { type: 'arrowclosed', color: '#51cf66', width: 20, height: 20 },
        },
      ])
    }
  }, [currentContainer, path, setNodes, setEdges])

  // Remove mistaken mini-flow nodes if they were created before END pipeline skipped auto-create
  useEffect(() => {
    if (!isEndPipelineView || !currentContainer) return
    setNodes((nds) => {
      const removeIds = new Set(
        nds
          .filter(
            (n) =>
              n.data?.containerParent === currentContainer &&
              (n.type === 'containerin' ||
                n.type === 'start' ||
                n.type === 'junction' ||
                n.type === 'containerout' ||
                n.type === 'end')
          )
          .map((n) => n.id)
      )
      if (removeIds.size === 0) return nds
      setEdges((eds) =>
        eds.filter((e) => !removeIds.has(e.source) && !removeIds.has(e.target))
      )
      return nds.filter((n) => !removeIds.has(n.id))
    })
  }, [isEndPipelineView, currentContainer, setNodes, setEdges])

  // React Flow controlled `nodes` only reliably shows `data.*` that lives in useNodesState.
  // Merging evaluationResult only in a derived array was dropped internally — sync into state here.
  useEffect(() => {
    setNodes((nds) => {
      const raw = evaluationResults?.results
      const em = raw instanceof Map ? raw : raw && typeof raw === 'object' ? new Map(Object.entries(raw)) : null
      if (!em || em.size === 0) {
        let changed = false
        const out = nds.map((n) => {
          if (!n.data?.evaluationResult) return n
          changed = true
          const { evaluationResult, ...rest } = n.data
          return { ...n, data: rest }
        })
        return changed ? out : nds
      }
      let changed = false
      const out = nds.map((n) => {
        if (em.has(n.id)) {
          const nextVal = em.get(n.id)
          const cur = n.data?.evaluationResult
          if (
            cur &&
            nextVal &&
            cur.passed === nextVal.passed &&
            (cur.reason || '') === (nextVal.reason || '')
          ) {
            return n
          }
          changed = true
          return { ...n, data: { ...n.data, evaluationResult: nextVal } }
        }
        if (!n.data?.evaluationResult) return n
        changed = true
        const { evaluationResult, ...rest } = n.data
        return { ...n, data: rest }
      })
      return changed ? out : nds
    })
  }, [evaluationResults, setNodes])

  // Filter nodes and edges based on current navigation level
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      const nodeContainer = n.data?.containerParent || null

      if (isEndPipelineView && currentContainer) {
        // Blank canvas: sorting + access modules for this feed END (no END shell in this view)
        if (nodeContainer === currentContainer) {
          return (
            isPlainSortingNodeType(n.type) ||
            isPlainAccessNodeType(n.type) ||
            isPlainInjectionNodeType(n.type) ||
            isPlainFixedSlotNodeType(n.type)
          )
        }
        return false
      }

      if (currentContainer) {
        return nodeContainer === currentContainer
      }

      // Root canvas: top-level nodes + children of on-canvas logic boxes only (not zoom-group subgraph nodes).
      if (!nodeContainer) return true
      return !isDescendantOfZoomContainer(n, nodes)
    })
  }, [nodes, currentContainer, isEndPipelineView])

  const visibleEdges = useMemo(() => {
    const visibleIds = new Set(visibleNodes.map(n => n.id))
    return edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
  }, [edges, visibleNodes])

  const endPipelineHasSorting = useMemo(() => {
    if (!isEndPipelineView || !currentContainer) return false
    return nodes.some(
      (n) =>
        n.data?.containerParent === currentContainer &&
        isPlainSortingNodeType(n.type)
    )
  }, [nodes, isEndPipelineView, currentContainer])

  /** Persisted on the feed END node while in pipeline view (how many dashed slots to show). */
  const endPipelineSlotCount = useMemo(() => {
    if (!isEndPipelineView || !currentContainer) return 1
    const endN = nodes.find(
      (n) => n.id === currentContainer && (n.type === 'end' || n.type === 'containerout')
    )
    return Math.min(
      MAX_END_PIPELINE_SORTING_SLOTS,
      Math.max(1, endN?.data?.endPipelineSlotCount ?? 1)
    )
  }, [nodes, isEndPipelineView, currentContainer])

  const endPipelineAccessSlotCount = useMemo(() => {
    if (!isEndPipelineView || !currentContainer) return 1
    const endN = nodes.find(
      (n) => n.id === currentContainer && (n.type === 'end' || n.type === 'containerout')
    )
    return Math.min(
      MAX_END_PIPELINE_ACCESS_SLOTS,
      Math.max(1, endN?.data?.endPipelineAccessSlotCount ?? 1)
    )
  }, [nodes, isEndPipelineView, currentContainer])

  const endPipelineInjectionSlotCount = useMemo(() => {
    if (!isEndPipelineView || !currentContainer) return 1
    const endN = nodes.find(
      (n) => n.id === currentContainer && (n.type === 'end' || n.type === 'containerout')
    )
    return Math.min(
      MAX_END_PIPELINE_INJECTION_SLOTS,
      Math.max(1, endN?.data?.endPipelineInjectionSlotCount ?? 1)
    )
  }, [nodes, isEndPipelineView, currentContainer])

  const endPipelineFixedSlotCount = useMemo(() => {
    if (!isEndPipelineView || !currentContainer) return 1
    const endN = nodes.find(
      (n) => n.id === currentContainer && (n.type === 'end' || n.type === 'containerout')
    )
    return Math.min(
      MAX_END_PIPELINE_FIXED_SLOTS,
      Math.max(1, endN?.data?.endPipelineFixedSlotCount ?? 1)
    )
  }, [nodes, isEndPipelineView, currentContainer])

  const hasEndPipelineModuleInSlot = useCallback(
    (slotIndex) => {
      if (!currentContainer) return false
      return nodes.some(
        (n) =>
          n.data?.containerParent === currentContainer &&
          isPlainSortingNodeType(n.type) &&
          (n.data?.endPipelineSlotIndex ?? 0) === slotIndex
      )
    },
    [nodes, currentContainer]
  )

  const hasEndPipelineAccessInSlot = useCallback(
    (slotIndex) => {
      if (!currentContainer) return false
      return nodes.some(
        (n) =>
          n.data?.containerParent === currentContainer &&
          isPlainAccessNodeType(n.type) &&
          (n.data?.endPipelineAccessSlotIndex ?? 0) === slotIndex
      )
    },
    [nodes, currentContainer]
  )

  const hasEndPipelineInjectionInSlot = useCallback(
    (slotIndex) => {
      if (!currentContainer) return false
      return nodes.some(
        (n) =>
          n.data?.containerParent === currentContainer &&
          isPlainInjectionNodeType(n.type) &&
          (n.data?.endPipelineInjectionSlotIndex ?? 0) === slotIndex
      )
    },
    [nodes, currentContainer]
  )

  const hasEndPipelineFixedInSlot = useCallback(
    (slotIndex) => {
      if (!currentContainer) return false
      return nodes.some(
        (n) =>
          n.data?.containerParent === currentContainer &&
          isPlainFixedSlotNodeType(n.type) &&
          (n.data?.endPipelineFixedSlotIndex ?? 0) === slotIndex
      )
    },
    [nodes, currentContainer]
  )

  const handleAddEndPipelineAccessSlot = useCallback(() => {
    if (!currentContainer) return
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== currentContainer || (n.type !== 'end' && n.type !== 'containerout')) return n
        const cur = n.data?.endPipelineAccessSlotCount ?? 1
        if (cur >= MAX_END_PIPELINE_ACCESS_SLOTS) return n
        return {
          ...n,
          data: { ...n.data, endPipelineAccessSlotCount: cur + 1 },
        }
      })
    )
  }, [currentContainer, setNodes])

  const handleAddEndPipelineInjectionSlot = useCallback(() => {
    if (!currentContainer) return
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== currentContainer || (n.type !== 'end' && n.type !== 'containerout')) return n
        const cur = n.data?.endPipelineInjectionSlotCount ?? 1
        if (cur >= MAX_END_PIPELINE_INJECTION_SLOTS) return n
        return {
          ...n,
          data: { ...n.data, endPipelineInjectionSlotCount: cur + 1 },
        }
      })
    )
  }, [currentContainer, setNodes])

  const handleAddEndPipelineFixedSlot = useCallback(() => {
    if (!currentContainer) return
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== currentContainer || (n.type !== 'end' && n.type !== 'containerout')) return n
        const cur = n.data?.endPipelineFixedSlotCount ?? 1
        if (cur >= MAX_END_PIPELINE_FIXED_SLOTS) return n
        return {
          ...n,
          data: { ...n.data, endPipelineFixedSlotCount: cur + 1 },
        }
      })
    )
  }, [currentContainer, setNodes])

  // Detect orphaned nodes — run BFS from every START node across all levels
  const connectedNodeIds = useMemo(() => {
    const connected = new Set()
    const startNodes = nodes.filter(
      (n) =>
        (n.type === 'start' || n.type === 'manualposts') && !n.data?.containerParent
    )
    for (const startNode of startNodes) {
      const queue = [startNode.id]
      while (queue.length > 0) {
        const nodeId = queue.shift()
        if (connected.has(nodeId)) continue
        connected.add(nodeId)
        for (const e of edges) {
          if (e.source === nodeId && !connected.has(e.target)) queue.push(e.target)
          if (e.target === nodeId && !connected.has(e.source)) queue.push(e.source)
        }
      }
    }
    return connected
  }, [nodes, edges])
  
  // Undo/Redo history
  const historyRef = useRef({
    past: [],
    present: { nodes: initialNodes, edges: initialEdges },
    future: [],
  })
  const HISTORY_LIMIT = 8
  const HISTORY_CAPTURE_ENABLED = true
  const PARENT_STATE_SYNC_ENABLED = true
  const REMOTE_MEM_TELEMETRY_ENABLED = false
  const MINIMAL_CANVAS_ISOLATION_MODE =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('minimalCanvas') === '1'
  const isHistoryActionRef = useRef(false) // Flag to prevent saving history during undo/redo
  const lastHistorySigRef = useRef('')

  const buildHistorySignature = useCallback((graphNodes, graphEdges) => {
    const nodeSig = graphNodes.map((n) => ({
      id: n.id,
      type: n.type,
      x: Math.round((n.position?.x || 0) * 10) / 10,
      y: Math.round((n.position?.y || 0) * 10) / 10,
      parent: n.data?.containerParent || null,
      data: {
        ...Object.fromEntries(
          Object.entries(n.data || {}).filter(([k, v]) => {
            if (typeof v === 'function') return false
            if (k.startsWith('on')) return false
            if (k === 'evaluationResult') return false
            return true
          })
        ),
      },
    }))
    const edgeSig = graphEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || null,
      targetHandle: e.targetHandle || null,
      logicType: e.data?.logicType || 'and',
      logicN: e.data?.logicN || null,
    }))
    return JSON.stringify({ nodes: nodeSig, edges: edgeSig })
  }, [])

  const cloneGraphState = useCallback((graphNodes, graphEdges) => {
    // Strip handler functions from node data before snapshotting.
    // Functions like onDelete/onToggleLogicMode/onConfigure are attached by
    // nodesWithHandlers for rendering only — they must never enter history because
    // structuredClone (and even JSON.stringify with a replacer) will throw/drop them
    // unpredictably. Stripping them here keeps history snapshots lean and safe.
    const safeNodes = graphNodes.map((n) => {
      const safeData = {}
      for (const [k, v] of Object.entries(n.data || {})) {
        if (typeof v !== 'function') safeData[k] = v
      }
      return { ...n, data: safeData }
    })
    return {
      nodes: JSON.parse(JSON.stringify(safeNodes)),
      edges: JSON.parse(JSON.stringify(graphEdges)),
    }
  }, [])

  useEffect(() => {
    lastHistorySigRef.current = buildHistorySignature(nodes, edges)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Save state to history
  const saveToHistory = useCallback((newNodes, newEdges) => {
    if (!HISTORY_CAPTURE_ENABLED) {
      return
    }
    if (isHistoryActionRef.current) {
      return // Don't save history during undo/redo
    }
    const nextSig = buildHistorySignature(newNodes, newEdges)
    if (nextSig === lastHistorySigRef.current) {
      return
    }
    lastHistorySigRef.current = nextSig
    
    const history = historyRef.current
    const currentState = cloneGraphState(newNodes, newEdges)

    history.past.push(history.present)
    history.present = currentState
    history.future = [] // Clear future when new action is performed
    historySetCanUndo(history.past.length > 0)
    historySetCanRedo(false)
    
    // Limit history size to prevent memory issues on large graphs.
    if (history.past.length > HISTORY_LIMIT) {
      history.past.shift()
    }
  }, [historySetCanUndo, historySetCanRedo, cloneGraphState, buildHistorySignature, HISTORY_CAPTURE_ENABLED])
  
  // Undo function
  const handleUndo = useCallback(() => {
    if (!HISTORY_CAPTURE_ENABLED) return
    const history = historyRef.current
    if (history.past.length === 0) return
    
    isHistoryActionRef.current = true
    history.future.unshift(history.present)
    history.present = history.past.pop()
    
    setNodes(history.present.nodes)
    setEdges(history.present.edges)
    historySetCanUndo(history.past.length > 0)
    historySetCanRedo(history.future.length > 0)
    isHistoryActionRef.current = false
  }, [setNodes, setEdges, historySetCanUndo, historySetCanRedo, HISTORY_CAPTURE_ENABLED])
  
  // Redo function
  const handleRedo = useCallback(() => {
    if (!HISTORY_CAPTURE_ENABLED) return
    const history = historyRef.current
    if (history.future.length === 0) return
    
    isHistoryActionRef.current = true
    history.past.push(history.present)
    history.present = history.future.shift()
    
    setNodes(history.present.nodes)
    setEdges(history.present.edges)
    historySetCanUndo(history.past.length > 0)
    historySetCanRedo(history.future.length > 0)
    isHistoryActionRef.current = false
  }, [setNodes, setEdges, historySetCanUndo, historySetCanRedo, HISTORY_CAPTURE_ENABLED])
  
  // Clear canvas function
  const handleClearCanvas = useCallback(() => {
    if (window.confirm('Clear the entire canvas? This cannot be undone.')) {
      isHistoryActionRef.current = true
      const clearedState = { nodes: initialNodes, edges: initialEdges }
      historyRef.current.past.push(historyRef.current.present)
      historyRef.current.present = clearedState
      historyRef.current.future = []
      setNodes(initialNodes)
      setEdges(initialEdges)
      historySetCanUndo(historyRef.current.past.length > 0)
      historySetCanRedo(false)
      isHistoryActionRef.current = false
    }
  }, [setNodes, setEdges, historySetCanUndo, historySetCanRedo])
  
  // Sync state to parent (for TreePanel) whenever nodes or edges change
  useEffect(() => {
    if (!PARENT_STATE_SYNC_ENABLED) return
    if (props.onStateChange) props.onStateChange(nodes, edges, connectedNodeIds)
  }, [nodes, edges, connectedNodeIds, props.onStateChange, PARENT_STATE_SYNC_ENABLED])

  // Save history when nodes or edges change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToHistory(nodes, edges)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [nodes, edges, saveToHistory])
  
  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])
  
  // Calculate evaluation order for edges connected to logic nodes
  const edgesWithOrder = React.useMemo(() => {
    const ordered = calculateEdgeOrder(visibleEdges, visibleNodes)
    return [...ordered].sort((a, b) => {
      const aLogic = a.sourceHandle?.startsWith('logic-') ? 1 : 0
      const bLogic = b.sourceHandle?.startsWith('logic-') ? 1 : 0
      return aLogic - bLogic
    })
  }, [visibleEdges, visibleNodes])
  const reactFlowWrapper = useRef(null)
  const [reactFlowInstance, setReactFlowInstance] = useState(null)
  /** MiniMap duplicates the graph into a canvas; keep off by default to reduce memory/GPU churn. */
  const [showMiniMap, setShowMiniMap] = useState(false)
  
  // Zoom to fit function (defined after reactFlowInstance)
  const handleZoomToFit = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2, duration: 400 })
    }
  }, [reactFlowInstance])
  
  // Center view function (defined after reactFlowInstance)
  // Uses nodesRef so handleCenterView identity is stable across nodes changes
  // — prevents re-triggering the HistoryContext registration effect on every node mutation.
  const handleCenterView = useCallback(() => {
    const currentNodes = nodesRef.current
    if (reactFlowInstance && currentNodes.length > 0) {
      const nodePositions = currentNodes.map(node => ({
        x: node.position.x + (node.width || 150) / 2,
        y: node.position.y + (node.height || 40) / 2,
      }))
      const centerX = nodePositions.reduce((sum, pos) => sum + pos.x, 0) / nodePositions.length
      const centerY = nodePositions.reduce((sum, pos) => sum + pos.y, 0) / nodePositions.length
      reactFlowInstance.setCenter(centerX, centerY, { duration: 400 })
    }
  }, [reactFlowInstance])
  
  // Register functions with history context.
  // register* functions are stable (useCallback [] deps) so this effect fires only once at mount,
  // then again if reactFlowInstance changes (which makes handleZoomToFit / handleCenterView new).
  useEffect(() => {
    registerHistoryUndo(handleUndo)
    registerHistoryRedo(handleRedo)
    registerHistoryClear(handleClearCanvas)
    registerHistoryZoomToFit(handleZoomToFit)
    registerHistoryCenterView(handleCenterView)
  }, [
    registerHistoryUndo,
    registerHistoryRedo,
    registerHistoryClear,
    registerHistoryZoomToFit,
    registerHistoryCenterView,
    handleUndo,
    handleRedo,
    handleClearCanvas,
    handleZoomToFit,
    handleCenterView,
  ])
  
  const [modalState, setModalState] = useState({
    isOpen: false,
    modalType: 'keyword', // 'keyword', 'regex', 'language', 'posttype', 'author', 'media', 'hashtag', 'labels', 'dateage', 'nof', 'engagement', 'poststructure', 'mentions', 'links', 'image', 'video'
    nodeId: null,
    keywords: [],
    pattern: '',
    languages: [],
    types: [],
    authors: [],
    listUris: [],
    tags: [],
    fieldTypes: [],
    labels: [],
    mode: 'newer_than',
    value: {},
    name: '',
    fields: ['text'],
    exclude: false,
    flags: '',
    n: 2,
    metricType: 'likes',
    operator: 'greater_than',
    threshold: 0,
    replyDepthEnabled: false,
    replyDepthOperator: 'equals',
    replyDepth: 1,
    mentions: [],
    urls: [],
    imageCount: null,
    minWidth: null,
    maxWidth: null,
    minHeight: null,
    maxHeight: null,
    aspectRatio: null,
    minFileSize: null,
    maxFileSize: null,
    presentation: null,
    scoreModifier: undefined,
    postTypeScores: undefined,
    mediaTypeScores: undefined,
    postUrls: [],
    items: [],
    strategy: 'round-robin',
    order: 'newest',
  })
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [debugUrlModalOpen, setDebugUrlModalOpen] = useState(false)
  const [feedOutputsModalOpen, setFeedOutputsModalOpen] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState([])
  const { did: authDid, loading: authLoading, getOAuthSession } = useAuth()
  const [feedCatalog, setFeedCatalog] = useState(() => {
    try {
      const raw = localStorage.getItem('feed-builder-feed-catalog')
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [rerunDebugInProgress, setRerunDebugInProgress] = useState(false)
  const [debugPins, setDebugPins] = useState(() => loadDebugPins())
  const [contextMenu, setContextMenu] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const debugMemTimer = useRef(null)
  const debugMemSamples = useRef([])
  const debugResultCountRef = useRef(0)
  const handleOpenTestModal = useCallback(() => setTestModalOpen(true), [])
  const handleOpenDebugUrlModal = useCallback(() => setDebugUrlModalOpen(true), [])

  const showToast = useCallback((message) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    saveDebugPins(debugPins)
  }, [debugPins])

  useEffect(() => {
    localStorage.setItem('feed-builder-feed-catalog', JSON.stringify(feedCatalog))
  }, [feedCatalog])

  const applySavedGraph = useCallback((parsed) => {
    if (!parsed?.nodes || !parsed?.edges) return
    if (Array.isArray(parsed.feeds)) {
      setFeedCatalog(parsed.feeds)
    }
    const loadedNodes = parsed.nodes.map((sn) => {
      const config = sn.config || {}
      let nodeType = sn.type
      if (sn.containerParent && nodeType === 'start') nodeType = 'containerin'
      if (sn.containerParent && nodeType === 'end') nodeType = 'containerout'
      return {
        id: sn.id,
        type: nodeType,
        position: sn.position,
        data: {
          ...config,
          containerParent: sn.containerParent,
          label: nodeType,
          ...(sn.logicModeTop ? { logicModeTop: sn.logicModeTop } : {}),
          ...(sn.logicModeBottom ? { logicModeBottom: sn.logicModeBottom } : {}),
          ...(sn.name ? { name: sn.name } : {}),
          ...(sn.n ? { n: sn.n } : {}),
        },
      }
    })
    for (const edge of parsed.edges) {
      const logicType = edge.logicType || null
      if (!logicType) continue
      const targetHandle = edge.targetHandle || ''
      const targetNode = loadedNodes.find((n) => n.id === edge.target)
      if (!targetNode) continue
      if (targetHandle.includes('logic-top') && !targetNode.data.logicModeTop) {
        targetNode.data.logicModeTop = logicType
      }
      if (targetHandle.includes('logic-bottom') && !targetNode.data.logicModeBottom) {
        targetNode.data.logicModeBottom = logicType
      }
    }
    const loadedEdges = parsed.edges.map((se) => {
      const isLogic = se.sourceHandle?.startsWith('logic-')
      const logicType = se.logicType || null
      const color = isLogic ? (logicType === 'or' ? '#ff9500' : '#4a9eff') : '#51cf66'
      return {
        id: `reactflow__edge-${se.source}${se.sourceHandle}-${se.target}${se.targetHandle}`,
        source: se.source,
        target: se.target,
        sourceHandle: se.sourceHandle,
        targetHandle: se.targetHandle,
        type: 'ordered',
        zIndex: isLogic ? 10 : 0,
        style: { stroke: color, strokeWidth: 2 },
        data: { logicType },
        markerEnd: { type: 'arrowclosed', color, width: 20, height: 20 },
      }
    })
    const withParents = bindLogicBoxParentNodes(
      loadedNodes.map((n) => {
        if (n.type !== 'logicbox') return n
        const { w, h } = getLogicBoxInnerSize(n)
        return {
          ...n,
          zIndex: 0,
          width: n.width ?? w,
          height: n.height ?? h,
          style: { ...n.style, width: n.width ?? w, height: n.height ?? h },
          data: {
            ...n.data,
            logicContainerMode: n.data?.logicContainerMode || 'and',
            logicN: n.data?.logicN ?? 2,
          },
        }
      })
    )
    setNodes(resizeLogicBoxes(withParents))
    setEdges(loadedEdges)
  }, [setNodes, setEdges, setFeedCatalog])

  const loadProjectContext = useCallback(async (targetProjectId) => {
    const feeds = await listProjectFeeds(targetProjectId)
    setFeedCatalog(feeds.map(normalizeFeedRecord))

    const toGraphObject = (maybeGraph) => {
      if (!maybeGraph) return null
      if (typeof maybeGraph === 'string') {
        try {
          return JSON.parse(maybeGraph)
        } catch {
          return null
        }
      }
      return maybeGraph
    }

    const selectedProject = projects.find((p) => String(p.id) === String(targetProjectId))
    const projectDraft = toGraphObject(selectedProject?.assignment_rules_draft)
    const fallbackFeedDraft = toGraphObject(feeds?.[0]?.assignment_rules_draft)
    const graphToLoad = projectDraft || fallbackFeedDraft

    if (graphToLoad?.nodes?.length > 0) {
      // Always return to root when loading a project graph so top-level nodes
      // (like text filters connected to END) are visible immediately.
      navigateTo(-1)
      localStorage.setItem('feed-builder-graph', JSON.stringify(graphToLoad))
      applySavedGraph(graphToLoad)
      return
    }
    // Empty/new project (nodes array is absent or empty): show default canvas
    // instead of a blank canvas. An empty nodes array is the DB default for new
    // projects — do NOT treat it as a saved empty state.
    navigateTo(-1)
    setNodes(initialNodes)
    setEdges(initialEdges)
    localStorage.removeItem('feed-builder-graph')
  }, [projects, applySavedGraph, navigateTo])

  // Instant hydration on refresh: render last saved graph immediately, then
  // let auth/project API sync replace it if newer data exists.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('feed-builder-graph')
      if (!raw) return
      const cached = JSON.parse(raw)
      if (cached?.nodes?.length > 0) {
        navigateTo(-1)
        applySavedGraph(cached)
      }
    } catch {
      // Ignore corrupt local cache; API sync will recover state.
    }
  }, [applySavedGraph, navigateTo])

  useEffect(() => {
    if (authLoading) return
    if (!authDid) {
      setProjects([])
      setProjectId('')
      setFeedCatalog([])
      setNodes(initialNodes)
      setEdges(initialEdges)
      localStorage.removeItem('feed-builder-graph')
      localStorage.removeItem('feed-builder-feed-catalog')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        let listed = await listProjects()
        if ((!listed || listed.length === 0) && !cancelled) {
          await createProject({ name: 'Default Feed Project', description: 'Auto-created by visual editor' })
          listed = await listProjects()
        }
        if (cancelled) return
        setProjects(listed)
        const stored = getStoredProjectId()
        const candidate = listed.find((p) => String(p.id) === String(stored))
        const resolvedProjectId = candidate?.id || listed[0]?.id || (await ensureDefaultProject())
        if (cancelled || !resolvedProjectId) return
        setStoredProjectId(resolvedProjectId)
        setProjectId(String(resolvedProjectId))
      } catch (error) {
        console.warn('Failed to load projects from API, using local fallback.', error)
      }
    })()
    return () => { cancelled = true }
  }, [authDid, authLoading])

  useEffect(() => {
    if (!projectId) return
    loadProjectContext(projectId).catch((error) => {
      console.warn('Failed loading selected project context', error)
    })
  }, [projectId, loadProjectContext])

  useEffect(() => {
    props.onProjectStateChange?.({
      projects: projects.map((p) => ({ id: String(p.id), name: p.name || 'Untitled project' })),
      selectedProjectId: projectId ? String(projectId) : '',
    })
  }, [projects, projectId, props.onProjectStateChange])

  const handleSelectProject = useCallback((nextProjectId) => {
    if (!nextProjectId) return
    setStoredProjectId(nextProjectId)
    setProjectId(String(nextProjectId))
  }, [])

  const handleCreateProject = useCallback(async (project) => {
    const created = await createProject(project)
    setProjects((prev) => [...prev, created])
    setStoredProjectId(created.id)
    setProjectId(String(created.id))
    return created
  }, [])

  const handleDeleteProject = useCallback(async (targetProjectId) => {
    const removeId = String(targetProjectId || projectId || '')
    if (!removeId) return null
    await deleteProject(removeId)
    const nextProjects = projects.filter((p) => String(p.id) !== removeId)
    setProjects(nextProjects)
    const nextId = nextProjects[0]?.id ? String(nextProjects[0].id) : ''
    if (nextId) {
      setStoredProjectId(nextId)
      setProjectId(nextId)
      return nextId
    }
    const created = await createProject({ name: 'Default Feed Project', description: 'Auto-created by visual editor' })
    setProjects([created])
    setStoredProjectId(created.id)
    setProjectId(String(created.id))
    return String(created.id)
  }, [projectId, projects])

  const handleRenameProject = useCallback(async (targetProjectId, newName) => {
    const id = String(targetProjectId || projectId || '')
    if (!id || !newName?.trim()) return null
    const updated = await updateProject(id, { name: newName.trim() })
    setProjects((prev) => prev.map((p) => String(p.id) === id ? { ...p, name: updated.name } : p))
    return updated
  }, [projectId])

  useEffect(() => {
    props.onDebugToolbarState?.({
      panelOpen: showDebugPanel,
      hasResults: !!evaluationResults,
    })
  }, [showDebugPanel, evaluationResults, props.onDebugToolbarState])

  // Wrap onNodesChange to snap nodes to grid when moved; END pipeline sorting is pinned to the slot (see draggable: false on those nodes)
  // Uses nodesRef so this callback stays stable across nodes changes — avoids passing a new function
  // to ReactFlow on every node mutation.
  const onNodesChange = useCallback(
    (changes) => {
      const updatedChanges = changes.map((change) => {
        if (change.type === 'position' && change.position) {
          const node = nodesRef.current.find((n) => n.id === change.id)
          if (
            isEndPipelineView &&
            currentContainer &&
            node &&
            isPlainSortingNodeType(node.type) &&
            node.data?.containerParent === currentContainer
          ) {
            return {
              ...change,
              position: {
                ...getEndPipelineSortingSnapPosition(
                  node.data?.endPipelineSlotIndex ?? 0
                ),
              },
            }
          }
          if (
            isEndPipelineView &&
            currentContainer &&
            node &&
            isPlainAccessNodeType(node.type) &&
            node.data?.containerParent === currentContainer
          ) {
            return {
              ...change,
              position: {
                ...getEndPipelineAccessSnapPosition(
                  node.data?.endPipelineAccessSlotIndex ?? 0
                ),
              },
            }
          }
          if (
            isEndPipelineView &&
            currentContainer &&
            node &&
            isPlainInjectionNodeType(node.type) &&
            node.data?.containerParent === currentContainer
          ) {
            return {
              ...change,
              position: {
                ...getEndPipelineInjectionSnapPosition(
                  node.data?.endPipelineInjectionSlotIndex ?? 0
                ),
              },
            }
          }
          if (
            isEndPipelineView &&
            currentContainer &&
            node &&
            isPlainFixedSlotNodeType(node.type) &&
            node.data?.containerParent === currentContainer
          ) {
            return {
              ...change,
              position: {
                ...getEndPipelineFixedSnapPosition(
                  node.data?.endPipelineFixedSlotIndex ?? 0
                ),
              },
            }
          }
          return {
            ...change,
            position: snapToGrid(change.position.x, change.position.y),
          }
        }
        return change
      })
      onNodesChangeBase(updatedChanges)
      // Compose with the same React batch as applyNodeChanges so layout uses
      // fresh positions (onNodeDrag alone can see stale nodes one frame behind).
      setNodes((nds) => {
        if (!nds.some((n) => n.type === 'logicbox')) return nds
        return resizeLogicBoxes(bindLogicBoxParentNodes(nds))
      })
      const dragEndIds = updatedChanges
        .filter((c) => c.type === 'position' && c.dragging === false)
        .map((c) => c.id)
      if (dragEndIds.length > 0) {
        setNodes((nds) => {
          let next = resizeLogicBoxes(bindLogicBoxParentNodes(nds))
          const boxIds = new Set()
          for (const id of dragEndIds) {
            const moved = next.find((x) => x.id === id)
            if (moved?.data?.containerParent) boxIds.add(moved.data.containerParent)
          }
          for (let pass = 0; pass < 5; pass++) {
            for (const bid of boxIds) {
              const kidIds = next
                .filter((c) => c.data?.containerParent === bid)
                .map((c) => c.id)
              for (const kid of kidIds) {
                next = nudgeLogicBoxChildAwayFromSiblings(next, kid)
              }
            }
          }
          return resizeLogicBoxes(next)
        })
      }
    },
    [onNodesChangeBase, setNodes, isEndPipelineView, currentContainer]
  )

  // Connection validation - enforce + (output) to - (input) rule
  const isValidConnection = useCallback(
    (connection) => {
      // Prevent self-connections
      if (connection.source === connection.target) {
        return false
      }
      
      const sourceNode = nodes.find(n => n.id === connection.source)
      const targetNode = nodes.find(n => n.id === connection.target)
      
      if (!sourceNode || !targetNode) {
        return false
      }
      
      // If handles are not provided, allow the connection (React Flow will handle validation)
      // This is critical - during drag operations, handles may not be fully specified yet
      if (!connection.sourceHandle || !connection.targetHandle) {
        return true
      }
      
      // React Flow requires: sourceHandle from source handle (+), targetHandle from target handle (-)
      // For condition-to-condition: just validate handle colors match (orange/blue)
      // Validation is simplified - no strict input/output checks for condition chains
      
      // Use the centralized validation function which handles all handle format checks
      return validateConnection(
        connection.sourceHandle,
        connection.targetHandle,
        sourceNode?.type || '',
        targetNode?.type || '',
        {
          sourceContainerParent: sourceNode?.data?.containerParent,
          targetContainerParent: targetNode?.data?.containerParent,
        }
      )
    },
    [nodes]
  )

  const onConnect = useCallback(
    (params) => {
      // Prevent self-connections
      if (params.source === params.target) {
        return
      }
      
      const sourceNode = nodes.find(n => n.id === params.source)
      const targetNode = nodes.find(n => n.id === params.target)
      
      if (!sourceNode || !targetNode) {
        return
      }
      
      // Validate connection
      if (
        isConditionPairLogicEdge(
          params.sourceHandle,
          params.targetHandle,
          sourceNode?.type || '',
          targetNode?.type || ''
        ) &&
        normalizeLogicContainerScope(sourceNode?.data?.containerParent) !==
          normalizeLogicContainerScope(targetNode?.data?.containerParent)
      ) {
        showToast(
          'Condition↔condition logic only inside the same AND/OR/N-of box. Double-click the box, add filters there, then wire them — or keep both on the root canvas.'
        )
        return
      }

      if (!validateConnection(
        params.sourceHandle,
        params.targetHandle,
        sourceNode?.type || '',
        targetNode?.type || '',
        {
          sourceContainerParent: sourceNode?.data?.containerParent,
          targetContainerParent: targetNode?.data?.containerParent,
        }
      )) {
        return
      }
      
      // Determine edge color
      let edgeColor = getEdgeColor(
        params.sourceHandle, 
        params.targetHandle,
        sourceNode?.type || '',
        targetNode?.type || ''
      )
      
      // Generate a unique edge ID
      const edgeId = `reactflow__edge-${params.source}${params.sourceHandle}-${params.target}${params.targetHandle}`
      
      // Check for duplicate edges before adding
      const existingEdge = edges.find(e => 
        e.source === params.source && 
        e.target === params.target &&
        e.sourceHandle === params.sourceHandle &&
        e.targetHandle === params.targetHandle
      )
      
      const isLogicEdge = params.sourceHandle?.startsWith('logic-') && params.targetHandle?.startsWith('logic-')
      
      // Enforce: each node can only be the SOURCE of one logic edge (one parent max)
      if (isLogicEdge) {
        const sourceAlreadyHasParent = edges.some(e => 
          e.sourceHandle?.startsWith('logic-') && e.source === params.source
        )
        const targetAlreadyHasParent = edges.some(e => 
          e.sourceHandle?.startsWith('logic-') && e.source === params.target
        )
        // After auto-direction, one of these becomes the source (leaf).
        // We don't know which yet, so check both — if both already have outgoing logic, block.
        // If only one does, the other will become the source, which is fine.
        if (sourceAlreadyHasParent && targetAlreadyHasParent) {
          showToast('Both nodes already have a logic parent')
          return
        }
      }

      let logicType = null
      let finalSource = params.source
      let finalTarget = params.target
      let finalSourceHandle = params.sourceHandle
      let finalTargetHandle = params.targetHandle
      
      if (isLogicEdge) {
        // Calculate depth from flow path for each node
        // Depth 0 = directly in flow, 1 = one logic hop from flow, etc.
        const getFlowDepth = (nodeId, visited = new Set()) => {
          if (visited.has(nodeId)) return 999
          visited.add(nodeId)
          // Check if node is directly in flow path
          const inFlow = edges.some(e => 
            (!e.sourceHandle?.startsWith('logic-')) &&
            (e.source === nodeId || e.target === nodeId)
          )
          if (inFlow) return 0
          // Check logic neighbors
          const logicNeighbors = edges
            .filter(e => e.sourceHandle?.startsWith('logic-') && (e.source === nodeId || e.target === nodeId))
            .map(e => e.source === nodeId ? e.target : e.source)
          if (logicNeighbors.length === 0) return 999
          let minDepth = 999
          for (const neighbor of logicNeighbors) {
            minDepth = Math.min(minDepth, getFlowDepth(neighbor, visited) + 1)
          }
          return minDepth
        }
        
        const sourceDepth = getFlowDepth(params.source)
        const targetDepth = getFlowDepth(params.target)
        
        // The node closer to flow (lower depth) should be the target (arrows point toward it)
        // If equal depth, check if one already has a badge
        const sourceNode = nodes.find(n => n.id === params.source)
        const targetNode = nodes.find(n => n.id === params.target)
        
        let shouldSwap = false
        if (sourceDepth < targetDepth) {
          shouldSwap = true
        } else if (sourceDepth === targetDepth) {
          // Same depth — prefer the one that already has a badge
          if (sourceNode?.data?.logicMode && !targetNode?.data?.logicMode) {
            shouldSwap = true
          }
          // If neither or both have badges, prefer the one with more existing logic connections
          else if (!sourceNode?.data?.logicMode && !targetNode?.data?.logicMode) {
            const sourceLogicCount = edges.filter(e => e.target === params.source && e.sourceHandle?.startsWith('logic-')).length
            const targetLogicCount = edges.filter(e => e.target === params.target && e.sourceHandle?.startsWith('logic-')).length
            if (sourceLogicCount > targetLogicCount) shouldSwap = true
          }
        }
        
        if (shouldSwap) {
          finalSource = params.target
          finalTarget = params.source
          finalSourceHandle = params.targetHandle
          finalTargetHandle = params.sourceHandle
        }
        
        // Final check: the leaf (finalSource) can only have one outgoing logic edge
        const leafAlreadyHasParent = edges.some(e => 
          e.sourceHandle?.startsWith('logic-') && e.source === finalSource
        )
        if (leafAlreadyHasParent) {
          showToast('This node already has a logic connection')
          return
        }
        
        const badgeNode = nodes.find(n => n.id === finalTarget)
        const targetPort = finalTargetHandle?.includes('logic-top') ? 'top' 
          : finalTargetHandle?.includes('logic-bottom') ? 'bottom'
          : finalTargetHandle?.includes('logic-left') ? 'left' : 'right'
        const modeKey = `logicMode${targetPort.charAt(0).toUpperCase() + targetPort.slice(1)}`
        logicType = badgeNode?.data?.[modeKey] || 'and'
        edgeColor = logicType === 'and' ? '#4a9eff' : logicType === 'or' ? '#ff9500' : '#9b59b6'
        
        if (!badgeNode?.data?.[modeKey]) {
          setNodes((nds) => nds.map((n) => {
            if (n.id === finalTarget) {
              return { ...n, data: { ...n.data, [modeKey]: 'and' } }
            }
            return n
          }))
        }
      }

      // Generate edge ID with final source/target
      const finalEdgeId = `reactflow__edge-${finalSource}${finalSourceHandle}-${finalTarget}${finalTargetHandle}`

      const newEdge = {
        ...params,
        id: finalEdgeId,
        source: finalSource,
        target: finalTarget,
        sourceHandle: finalSourceHandle,
        targetHandle: finalTargetHandle,
        style: { stroke: edgeColor, strokeWidth: 2 },
        type: 'ordered',
        zIndex: isLogicEdge ? 10 : 0,
        data: {
          logicType: logicType,
          onToggleLogic: handleEdgeLogicToggle,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 20,
          height: 20,
        },
      }
      
      if (existingEdge) {
        return
      }
      setEdges((eds) => {
        // Check for any existing logic edge between these two nodes (in either direction)
        const edgeExists = eds.some(e => {
          if (!e.sourceHandle?.startsWith('logic-')) return false
          const sameDirection = e.source === newEdge.source && e.target === newEdge.target
          const reverseDirection = e.source === newEdge.target && e.target === newEdge.source
          return sameDirection || reverseDirection
        }) || eds.some(e =>
          e.source === newEdge.source && 
          e.target === newEdge.target &&
          e.sourceHandle === newEdge.sourceHandle &&
          e.targetHandle === newEdge.targetHandle
        )
        
        if (edgeExists) {
          return eds
        }
        
        // Add the new edge
        const updatedEdges = [...eds, newEdge]
        // Recalculate order after adding new edge
        return calculateEdgeOrder(updatedEdges, nodes)
      })
    },
    [nodes, edges, setEdges, showToast]
  )

  const onNodeDragStop = useCallback(
    (_, dragged) => {
      if (isEndPipelineView) return
      if (
        dragged.type === 'start' ||
        dragged.type === 'containerin' ||
        dragged.type === 'containerout' ||
        dragged.type === 'junction' ||
        dragged.type === 'logicgroup' ||
        dragged.type === 'and' ||
        dragged.type === 'or' ||
        dragged.type === 'nof' ||
        dragged.type === 'end' ||
        dragged.type === 'videofeed' ||
        isPlainSortingNodeType(dragged.type) ||
        isPlainAccessNodeType(dragged.type) ||
        isPlainInjectionNodeType(dragged.type) ||
        isPlainFixedSlotNodeType(dragged.type)
      ) {
        return
      }

      setNodes((nds) => {
        let next = bindLogicBoxParentNodes(nds)
        next = resizeLogicBoxes(next)
        next = maybeUnparentLogicBoxChild(next, dragged.id)
        const self = next.find((n) => n.id === dragged.id)
        if (!self) return nds

        if (!canPlaceInsideLogicBox(self.type)) {
          return resizeLogicBoxes(bindLogicBoxParentNodes(next))
        }

        const byId = new Map(next.map((n) => [n.id, n]))
        const abs = getAbsoluteNodePosition(self, byId)
        let cx
        let cy
        if (self.type === 'logicbox') {
          const { w, h } = getLogicBoxInnerSize(self)
          cx = abs.x + w / 2
          cy = abs.y + h / 2
        } else {
          const { w, h } = childNodeSize(self)
          cx = abs.x + w / 2
          cy = abs.y + h / 2
        }

        const zoomId = currentContainer || null
        const host = pickEnclosingLogicBox(cx, cy, next, self.id, zoomId)
        if (host && host.id !== self.data?.containerParent) {
          next = reparentNodeToLogicBox(next, self.id, host.id, abs)
        }

        next = bindLogicBoxParentNodes(next)
        next = nudgeLogicBoxChildAwayFromSiblings(next, self.id)
        return resizeLogicBoxes(next)
      })
    },
    [isEndPipelineView, currentContainer, setNodes]
  )

  // Right-click on edge to delete it
  const onEdgeContextMenu = useCallback(
    (event, edge) => {
      event.preventDefault()
      setEdges((eds) => eds.filter((e) => e.id !== edge.id))
    },
    [setEdges]
  )

  // Toggle logic type on an edge label click (cycles AND → OR → N-of → AND)
  const handleEdgeLogicToggle = useCallback((edgeId) => {
    setEdges((eds) => eds.map((e) => {
      if (e.id !== edgeId) return e
      const current = e.data?.logicType || 'and'
      let next, logicN
      if (current === 'and') { next = 'or'; logicN = e.data?.logicN }
      else if (current === 'or') { next = 'nof'; logicN = e.data?.logicN || 2 }
      else { next = 'and'; logicN = e.data?.logicN }
      const color = next === 'and' ? '#4a9eff' : next === 'or' ? '#ff9500' : '#9b59b6'
      return {
        ...e,
        data: { ...e.data, logicType: next, logicN, onToggleLogic: handleEdgeLogicToggle },
        style: { ...e.style, stroke: color },
        markerEnd: { ...e.markerEnd, color },
      }
    }))
    // Also update the target node's logicMode for that port
    setEdges((eds) => {
      const edge = eds.find(e => e.id === edgeId)
      if (!edge) return eds
      const targetPort = edge.targetHandle?.includes('logic-top') ? 'top'
        : edge.targetHandle?.includes('logic-bottom') ? 'bottom'
        : edge.targetHandle?.includes('logic-left') ? 'left' : 'right'
      const modeKey = `logicMode${targetPort.charAt(0).toUpperCase() + targetPort.slice(1)}`
      const nKey = `logicN${targetPort.charAt(0).toUpperCase() + targetPort.slice(1)}`
      // Update ALL edges on the same target+port to match
      const newType = edge.data?.logicType
      const newColor = newType === 'and' ? '#4a9eff' : newType === 'or' ? '#ff9500' : '#9b59b6'
      setNodes((nds) => nds.map((n) => {
        if (n.id === edge.target) {
          return { ...n, data: { ...n.data, [modeKey]: newType, [nKey]: edge.data?.logicN } }
        }
        return n
      }))
      return eds.map((e) => {
        if (e.target === edge.target && e.targetHandle === edge.targetHandle && e.id !== edgeId) {
          return {
            ...e,
            data: { ...e.data, logicType: newType, onToggleLogic: handleEdgeLogicToggle },
            style: { ...e.style, stroke: newColor },
            markerEnd: { ...e.markerEnd, color: newColor },
          }
        }
        return e
      })
    })
  }, [setEdges, setNodes])

  // Set N value on an N-of edge (called from wire label +/- buttons)
  const handleEdgeSetN = useCallback((edgeId, newN) => {
    setEdges((eds) => {
      const edge = eds.find(e => e.id === edgeId)
      if (!edge) return eds
      const targetPort = edge.targetHandle?.includes('logic-top') ? 'top'
        : edge.targetHandle?.includes('logic-bottom') ? 'bottom'
        : edge.targetHandle?.includes('logic-left') ? 'left' : 'right'
      const nKey = `logicN${targetPort.charAt(0).toUpperCase() + targetPort.slice(1)}`
      // Update node
      setNodes((nds) => nds.map((n) => {
        if (n.id === edge.target) {
          return { ...n, data: { ...n.data, [nKey]: newN } }
        }
        return n
      }))
      // Update all edges on same port
      return eds.map((e) => {
        if (e.target === edge.target && e.targetHandle === edge.targetHandle) {
          return { ...e, data: { ...e.data, logicN: newN } }
        }
        return e
      })
    })
  }, [setEdges, setNodes])

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow')
      if (typeof type === 'undefined' || !type) return

      const endView = path.length > 0 && path[path.length - 1].view === 'end'
      const isPipelineNode =
        isPlainSortingNodeType(type) ||
        isPlainAccessNodeType(type) ||
        isPlainInjectionNodeType(type) ||
        isPlainFixedSlotNodeType(type)

      if (type === 'end' && currentContainer && !endView) {
        window.alert(
          'Feed output (END) can only be placed on the main canvas.\n\nInside a group, the subgraph exits through OUT — it is not a separate Bluesky feed.'
        )
        return
      }

      if (isPipelineNode && (!endView || !currentContainer)) {
        window.alert(
          'Sorting, Injection, Fixed, and Access modules can only be placed inside an END pipeline.\n\nDouble-click an END node, then add modules there.'
        )
        return
      }

      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNodeId = `${type}-${Date.now()}`
      let newNode = {
        id: newNodeId,
        type,
        position: snapToGrid(flowPosition.x, flowPosition.y),
        data: {
          containerParent: currentContainer,
          label: type === 'end' ? 'END' : type === 'containerout' ? 'OUT' : type === 'containerin' ? 'IN' : type,
          keywords: type === 'text' ? [] : undefined,
          pattern: type === 'regex' ? '' : undefined,
          languages: type === 'language' ? [] : undefined,
          types: type === 'posttype' || type === 'media' ? [] : undefined,
          authors: type === 'author' ? [] : undefined,
          listUris: type === 'author' ? [] : undefined,
          tags: type === 'hashtag' ? [] : undefined,
          fieldTypes: type === 'hashtag' ? ['outline_tags', 'hashtags'] : undefined,
          labels: type === 'labels' ? [] : undefined,
          mode: type === 'dateage' ? 'newer_than' : undefined,
          value: type === 'dateage' ? { amount: 24, unit: 'hours' } : undefined,
          fields: type === 'text' || type === 'regex' ? ['text'] : undefined,
          exclude: type === 'text' || type === 'regex' || type === 'language' || type === 'posttype' || type === 'author' || type === 'media' || type === 'hashtag' || type === 'labels' || type === 'dateage' || type === 'mentions' || type === 'links' || type === 'image' || type === 'video' ? false : undefined,
          n: type === 'nof' ? 2 : undefined,
          posts: type === 'manualposts' ? [] : undefined,
          metricType: type === 'engagement' ? 'likes' : undefined,
          operator: type === 'engagement' ? 'greater_than' : type === 'poststructure' ? 'equals' : undefined,
          threshold: type === 'engagement' ? 0 : undefined,
          structureType: type === 'poststructure' ? 'is_reply' : undefined,
          depth: type === 'poststructure' ? 1 : undefined,
          mentions: type === 'mentions' ? [] : undefined,
          urls: type === 'links' ? [] : undefined,
          imageCount: type === 'image' ? null : undefined,
          minWidth: type === 'image' || type === 'video' ? null : undefined,
          maxWidth: type === 'image' || type === 'video' ? null : undefined,
          minHeight: type === 'image' || type === 'video' ? null : undefined,
          maxHeight: type === 'image' || type === 'video' ? null : undefined,
          aspectRatio: type === 'image' || type === 'video' ? null : undefined,
          minFileSize: type === 'image' || type === 'video' ? null : undefined,
          maxFileSize: type === 'image' || type === 'video' ? null : undefined,
          altText: type === 'image' || type === 'video' ? '' : undefined,
          presentation: type === 'video' ? null : undefined,
          postUrls: type === 'rotatingposts' || type === 'feedads' ? [] : undefined,
          items: type === 'pinnedposts' ? [] : undefined,
          strategy: type === 'rotatingposts' || type === 'feedads' ? 'alternate' : undefined,
          logicContainerMode: type === 'logicbox' ? 'and' : undefined,
          logicN: type === 'logicbox' ? 2 : undefined,
        },
      }

      if (type === 'logicbox') {
        newNode = {
          ...newNode,
          zIndex: 0,
          width: LOGIC_BOX_MIN_W,
          height: LOGIC_BOX_MIN_H,
          style: { width: LOGIC_BOX_MIN_W, height: LOGIC_BOX_MIN_H },
          data: {
            ...newNode.data,
            label: 'Logic',
          },
        }
      }

      if (endView && currentContainer && isPipelineNode) {
        const endId = currentContainer
        let slotIndex = 0

        if (isPlainSortingNodeType(type)) {
          slotIndex = Math.max(
            0,
            Math.min(
              MAX_END_PIPELINE_SORTING_SLOTS - 1,
              getEndPipelineSlotIndexAtFlowPoint(flowPosition.x, flowPosition.y)
            )
          )
          newNode = {
            ...newNode,
            position: getEndPipelineSortingSnapPosition(slotIndex),
            data: { ...newNode.data, endPipelineSlotIndex: slotIndex },
            draggable: false,
          }
        } else if (isPlainAccessNodeType(type)) {
          slotIndex = Math.max(
            0,
            Math.min(
              MAX_END_PIPELINE_ACCESS_SLOTS - 1,
              getEndPipelineAccessSlotIndexAtFlowPoint(flowPosition.x, flowPosition.y)
            )
          )
          newNode = {
            ...newNode,
            position: getEndPipelineAccessSnapPosition(slotIndex),
            data: { ...newNode.data, endPipelineAccessSlotIndex: slotIndex },
            draggable: false,
          }
        } else if (isPlainInjectionNodeType(type)) {
          slotIndex = Math.max(
            0,
            Math.min(
              MAX_END_PIPELINE_INJECTION_SLOTS - 1,
              getEndPipelineInjectionSlotIndexAtFlowPoint(flowPosition.x, flowPosition.y)
            )
          )
          newNode = {
            ...newNode,
            position: getEndPipelineInjectionSnapPosition(slotIndex),
            data: { ...newNode.data, endPipelineInjectionSlotIndex: slotIndex },
            draggable: false,
          }
        } else if (isPlainFixedSlotNodeType(type)) {
          slotIndex = Math.max(
            0,
            Math.min(
              MAX_END_PIPELINE_FIXED_SLOTS - 1,
              getEndPipelineFixedSlotIndexAtFlowPoint(flowPosition.x, flowPosition.y)
            )
          )
          newNode = {
            ...newNode,
            position: getEndPipelineFixedSnapPosition(slotIndex),
            data: { ...newNode.data, endPipelineFixedSlotIndex: slotIndex },
            draggable: false,
          }
        }

        setNodes((nds) => {
          const removedIds = new Set(
            nds
              .filter((n) => {
                if (n.data?.containerParent !== endId) return false
                if (isPlainSortingNodeType(type)) {
                  return isPlainSortingNodeType(n.type)
                }
                if (isPlainAccessNodeType(type)) {
                  return (
                    isPlainAccessNodeType(n.type) &&
                    (n.data?.endPipelineAccessSlotIndex ?? 0) === slotIndex
                  )
                }
                if (isPlainInjectionNodeType(type)) {
                  return (
                    isPlainInjectionNodeType(n.type) &&
                    (n.data?.endPipelineInjectionSlotIndex ?? 0) === slotIndex
                  )
                }
                if (isPlainFixedSlotNodeType(type)) {
                  return (
                    isPlainFixedSlotNodeType(n.type) &&
                    (n.data?.endPipelineFixedSlotIndex ?? 0) === slotIndex
                  )
                }
                return false
              })
              .map((n) => n.id)
          )

          const nextNodes = nds
            .filter((n) => !removedIds.has(n.id))
            .concat(newNode)

          setEdges((eds) => {
            let e2 = eds.filter(
              (edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target)
            )
            e2 = rebuildSortingChainForEndPipeline(nextNodes, e2, endId)
            e2 = rebuildAccessEdgesForEndPipeline(nextNodes, e2, endId)
            e2 = rebuildInjectionChainForEndPipeline(nextNodes, e2, endId)
            e2 = rebuildFixedSlotChainForEndPipeline(nextNodes, e2, endId)
            return e2
          })

          return nextNodes
        })
        return
      }

      setNodes((nds) => {
        let next = nds.concat(newNode)
        const zoomId = currentContainer || null
        if (canPlaceInsideLogicBox(type)) {
          const box = pickEnclosingLogicBox(
            flowPosition.x,
            flowPosition.y,
            next,
            newNodeId,
            zoomId
          )
          if (box) {
            const snapped = snapToGrid(flowPosition.x, flowPosition.y)
            next = reparentNodeToLogicBox(next, newNodeId, box.id, snapped)
          }
        }
        next = bindLogicBoxParentNodes(next)
        return resizeLogicBoxes(next)
      })
    },
    [
      path,
      currentContainer,
      reactFlowInstance,
      setNodes,
      setEdges,
    ]
  )

  // Delete nodes with Delete or Backspace key
  // Attach to document so it works regardless of focus
  React.useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't interfere if user is typing in an input field
      const target = event.target
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      
      // Get current nodes state
      setNodes((currentNodes) => {
        const selectedNodes = currentNodes.filter((node) => node.selected)
        if (selectedNodes.length > 0 && (event.key === 'Delete' || event.key === 'Backspace')) {
          event.preventDefault()
          
          // Don't allow deleting START (anchor). END nodes may be deleted when removing extra feeds.
          const deletableNodes = selectedNodes.filter(
            (node) => node.type !== 'start' && node.type !== 'containerin'
          )
          
          if (deletableNodes.length > 0) {
            const nodeCount = deletableNodes.length
            const nodeNames = deletableNodes.map(n => {
              const type = n.type === 'text' ? 'Text Contains' :
                           n.type === 'regex' ? 'Regex Contains' :
                           n.type === 'language' ? 'Language' :
                           n.type === 'posttype' ? 'Post Type' :
                           n.type === 'author' ? 'Author' :
                           n.type === 'media' ? 'Media Type' :
                           n.type === 'hashtag' ? 'Hashtag/Tags' :
                           n.type === 'labels' ? 'Labels' :
                           n.type === 'dateage' ? 'Post Date' :
                           n.type === 'and' ? 'AND' :
                           n.type === 'or' ? 'OR' :
                           n.type === 'nof' ? 'N-of' :
                           n.type === 'logicbox' ? 'Logic (AND/OR/N-of)' :
                           n.type
              return type
            }).join(', ')
            
            const message = nodeCount === 1
              ? `Delete "${nodeNames}"?`
              : `Delete ${nodeCount} nodes (${nodeNames})?`
            
            if (confirm(message)) {
              const nodeIds = deletableNodes.map((n) => n.id)
              const nextNodes = currentNodes.filter(
                (node) => !deletableNodes.includes(node)
              )
              const endIdsToRebuild = [
                ...new Set(
                  deletableNodes
                    .filter(
                      (n) =>
                        n.data?.containerParent &&
                        (isPlainSortingNodeType(n.type) ||
                          isPlainAccessNodeType(n.type) ||
                          isPlainInjectionNodeType(n.type) ||
                          isPlainFixedSlotNodeType(n.type))
                    )
                    .map((n) => n.data.containerParent)
                ),
              ]
              setEdges((currentEdges) => {
                let eds = currentEdges.filter(
                  (edge) =>
                    !nodeIds.includes(edge.source) &&
                    !nodeIds.includes(edge.target)
                )
                for (const endId of endIdsToRebuild) {
                  eds = rebuildSortingChainForEndPipeline(nextNodes, eds, endId)
                  eds = rebuildAccessEdgesForEndPipeline(nextNodes, eds, endId)
                  eds = rebuildInjectionChainForEndPipeline(nextNodes, eds, endId)
                  eds = rebuildFixedSlotChainForEndPipeline(nextNodes, eds, endId)
                }
                return eds
              })
              return nextNodes
            }
          }
        }
        return currentNodes
      })
    }
    
    document.addEventListener('keydown', handleKeyDown, true) // Use capture phase
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [setNodes, setEdges])

  // Stable handler factories — must NOT be recreated every render or `nodesWithHandlers` rebuilds all nodes every time.
  const nodeHandlers = useMemo(() => createNodeHandlers(setModalState), [setModalState])
  
  // Handle node deletion
  const handleNodeDelete = useCallback((nodeId) => {
    setNodes((nds) => {
      const victim = nds.find((n) => n.id === nodeId)
      const endParent = victim?.data?.containerParent
      const needsPipelineEdgeRebuild =
        victim &&
        endParent &&
        (isPlainSortingNodeType(victim.type) ||
          isPlainAccessNodeType(victim.type) ||
          isPlainInjectionNodeType(victim.type) ||
          isPlainFixedSlotNodeType(victim.type))

      const next =
        victim?.type === 'logicbox'
          ? removeLogicBoxAndLiftChildren(nds, nodeId)
          : nds.filter((node) => node.id !== nodeId)

      if (needsPipelineEdgeRebuild) {
        setEdges((eds) => {
          let e2 = eds.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId
          )
          e2 = rebuildSortingChainForEndPipeline(next, e2, endParent)
          e2 = rebuildAccessEdgesForEndPipeline(next, e2, endParent)
          e2 = rebuildInjectionChainForEndPipeline(next, e2, endParent)
          e2 = rebuildFixedSlotChainForEndPipeline(next, e2, endParent)
          return e2
        })
      } else {
        setEdges((eds) =>
          eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
        )
      }
      return next
    })
  }, [setNodes, setEdges])

  // Toggle logic mode on a node for a specific port (top or bottom)
  // Cycles: and → or → nof → and
  const handleToggleLogicMode = useCallback((nodeId, port) => {
    const modeKey = `logicMode${port.charAt(0).toUpperCase() + port.slice(1)}`
    const nKey = `logicN${port.charAt(0).toUpperCase() + port.slice(1)}`
    const handleMatch = `logic-${port}`
    let nextMode = 'and'

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n
        const current = n.data?.[modeKey] || 'and'
        let next
        let nVal
        if (current === 'and') {
          next = 'or'
          nVal = n.data?.[nKey]
        } else if (current === 'or') {
          next = 'nof'
          nVal = n.data?.[nKey] || 2
        } else {
          next = 'and'
          nVal = n.data?.[nKey]
        }
        nextMode = next
        return { ...n, data: { ...n.data, [modeKey]: next, [nKey]: nVal } }
      })
    )

    setEdges((eds) =>
      eds.map((e) => {
        if (e.target === nodeId && e.targetHandle?.includes(handleMatch)) {
          const color =
            nextMode === 'and' ? '#4a9eff' : nextMode === 'or' ? '#ff9500' : '#9b59b6'
          return {
            ...e,
            data: { ...e.data, logicType: nextMode },
            style: { ...e.style, stroke: color },
            markerEnd: { ...e.markerEnd, color },
          }
        }
        return e
      })
    )
  }, [setNodes, setEdges])

  // Handle right-click context menu
  const onNodeContextMenu = useCallback((event, node) => {
    // Don't show context menu for START/END nodes
    if (node.id === 'start' || node.id === 'end') {
      return
    }
    
    event.preventDefault()
    setContextMenu({
      nodeId: node.id,
      nodeType: node.type,
      x: event.clientX,
      y: event.clientY
    })
  }, [])

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Handle name from context menu
  const handleContextMenuName = useCallback(() => {
    if (!contextMenu) return
    
    const nodeId = contextMenu.nodeId
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    
    const currentNodeName = node.data?.name || ''
    const newName = prompt('Enter node name (leave empty to remove name):', currentNodeName)
    
    if (newName !== null) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                name: newName.trim() || null,
              },
            }
          }
          return n
        })
      )
    }
    
    closeContextMenu()
  }, [contextMenu, nodes, setNodes, closeContextMenu])

  // Handle delete from context menu
  const handleContextMenuDelete = useCallback(() => {
    if (!contextMenu) return
    
    const nodeId = contextMenu.nodeId
    const nodeType = contextMenu.nodeType
    
    const nodeName = nodeType === 'text' ? 'Text Contains' :
                     nodeType === 'regex' ? 'Regex Contains' :
                     nodeType === 'language' ? 'Language' :
                     nodeType === 'posttype' ? 'Post Type' :
                     nodeType === 'author' ? 'Author' :
                     nodeType === 'media' ? 'Media Type' :
                     nodeType === 'hashtag' ? 'Hashtag/Tags' :
                     nodeType === 'labels' ? 'Labels' :
                     nodeType === 'dateage' ? 'Post Date' :
                     nodeType === 'engagement' ? 'Engagement' :
                     nodeType === 'poststructure' ? 'Post Structure' :
                     nodeType === 'mentions' ? 'Mentions' :
                     nodeType === 'links' ? 'Links/URLs' :
                     nodeType === 'image' ? 'Image' :
                     nodeType === 'video' ? 'Video' :
                     nodeType === 'and' ? 'AND' :
                     nodeType === 'or' ? 'OR' :
                     nodeType === 'nof' ? 'N-of' :
                     nodeType === 'whitelist' ? 'Whitelist (access)' :
                     nodeType === 'rotatingposts' ? 'Rotating Posts' :
                     nodeType === 'feedads' ? 'Feed Ads' :
                     nodeType === 'pinnedposts' ? 'Pinned Posts' :
                     nodeType === 'dynamicpinned' ? 'Dynamic Pinned' :
                     nodeType === 'featuredpost' ? 'Featured Post' :
                     nodeType === 'end' ? 'Feed output (END)' :
                     nodeType === 'containerin' ? 'IN (group entry)' :
                     nodeType === 'containerout' ? 'OUT (group exit)' :
                     nodeType === 'junction' ? 'Junction' :
                     nodeType
    
    if (confirm(`Delete "${nodeName}"?`)) {
      handleNodeDelete(nodeId)
      closeContextMenu()
    }
  }, [contextMenu, handleNodeDelete, closeContextMenu])

  const logicChildCountsByParent = useMemo(() => {
    const m = new Map()
    for (const n of nodes) {
      const p = n.data?.containerParent
      if (p == null || p === '') continue
      m.set(p, (m.get(p) || 0) + 1)
    }
    return m
  }, [nodes])

  const costOrderResult = useMemo(
    () => analyzeCostOrderViolations(nodes, edges),
    [nodes, edges]
  )
  const ingestionRunOrderMap = useMemo(
    () => computeIngestionRunOrderMap(nodes, edges),
    [nodes, edges]
  )

  // Build per-node specific warning messages from violation pairs
  const costOrderMessages = useMemo(() => {
    const NODE_DISPLAY_LABELS = {
      text: 'Text', regex: 'Regex', language: 'Language', posttype: 'Post Type',
      hashtag: 'Hashtag', labels: 'Labels', dateage: 'Post Date', author: 'Author',
      media: 'Media', engagement: 'Engagement', poststructure: 'Post Structure',
      mentions: 'Mentions', links: 'Links', image: 'Image', video: 'Video',
      recency: 'Recency', engagementscore: 'Engagement Score', customscore: 'Custom Score',
    }
    const TIER_NAMES = { 0: 'always-pass', 1: 'low', 2: 'medium', 3: 'high' }
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    const msgs = new Map()
    for (const { earlierId, laterId, earlierRank, laterRank } of costOrderResult.pairs) {
      const earlier = nodeById.get(earlierId)
      const later = nodeById.get(laterId)
      if (!earlier || !later) continue
      const earlierLabel = NODE_DISPLAY_LABELS[earlier.type] || earlier.type
      const laterLabel = NODE_DISPLAY_LABELS[later.type] || later.type
      // Expensive node running too early
      const e1 = msgs.get(earlierId) || new Set()
      e1.add(`${laterLabel} (${TIER_NAMES[laterRank] || 'low'}) should run before this`)
      msgs.set(earlierId, e1)
      // Cheap node running too late
      const e2 = msgs.get(laterId) || new Set()
      e2.add(`${earlierLabel} (${TIER_NAMES[earlierRank] || 'high'}) runs before this`)
      msgs.set(laterId, e2)
    }
    const result = new Map()
    for (const [id, set] of msgs) {
      result.set(id, [...set].slice(0, 2).join(' · '))
    }
    return result
  }, [costOrderResult, nodes])

  // Update nodes with onConfigure handlers and onDelete.
  // Memoized to avoid re-creating every node object on unrelated renders.
  const nodesWithHandlers = useMemo(() => visibleNodes.map((node) => {
    // Inject childCount for logic nodes
    const isLogic =
      node.type === 'and' ||
      node.type === 'or' ||
      node.type === 'nof' ||
      node.type === 'logicgroup' ||
      node.type === 'logicbox'
    const childCount = isLogic ? (logicChildCountsByParent.get(node.id) || 0) : 0
    const isOrphaned = !connectedNodeIds.has(node.id)
    const coWarn = costOrderMessages.get(node.id) || null
    const ingestionRunOrder = ingestionRunOrderMap.get(node.id)
    const nodeWithExtra = isLogic
      ? {
          ...node,
          data: {
            ...node.data,
            childCount,
            isOrphaned,
            costOrderWarning: coWarn,
            ingestionRunOrder,
          },
        }
      : {
          ...node,
          data: {
            ...node.data,
            isOrphaned,
            costOrderWarning: coWarn,
            ingestionRunOrder,
          },
        }
    const nodeWithDelete = {
      ...nodeWithExtra,
      data: {
        ...nodeWithExtra.data,
        onDelete: handleNodeDelete,
        onToggleLogicMode: (port) => handleToggleLogicMode(nodeWithExtra.id, port),
        onSetN: (port, n) => {
          const nKey = `logicN${port.charAt(0).toUpperCase() + port.slice(1)}`
          setNodes((nds) => nds.map((nd) => {
            if (nd.id === nodeWithExtra.id) {
              return { ...nd, data: { ...nd.data, [nKey]: n } }
            }
            return nd
          }))
        },
      },
    }
    const withConfiguredHandler = (factory) => {
      const configured = factory(nodeWithDelete)
      return { ...configured, data: { ...configured.data, onDelete: handleNodeDelete } }
    }
    
    switch (nodeWithExtra.type) {
      case 'start':
        return {
          ...nodeWithDelete,
          data: {
            ...nodeWithDelete.data,
            onDelete: handleNodeDelete,
            onDebug: () => setDebugUrlModalOpen(true),
            onTest: () => setTestModalOpen(true),
          },
        }
      case 'text':
        return withConfiguredHandler(nodeHandlers.createTextHandler)
      case 'regex':
        return withConfiguredHandler(nodeHandlers.createRegexHandler)
      case 'language':
        return withConfiguredHandler(nodeHandlers.createLanguageHandler)
      case 'posttype':
        return withConfiguredHandler(nodeHandlers.createPostTypeHandler)
      case 'author':
        return withConfiguredHandler(nodeHandlers.createAuthorHandler)
      case 'media':
        return withConfiguredHandler(nodeHandlers.createMediaHandler)
      case 'hashtag':
        return withConfiguredHandler(nodeHandlers.createHashtagHandler)
      case 'labels':
        return withConfiguredHandler(nodeHandlers.createLabelsHandler)
      case 'dateage':
        return withConfiguredHandler(nodeHandlers.createDateAgeHandler)
      case 'engagement':
        return withConfiguredHandler(nodeHandlers.createEngagementHandler)
      case 'poststructure':
        return withConfiguredHandler(nodeHandlers.createPostStructureHandler)
      case 'mentions':
        return withConfiguredHandler(nodeHandlers.createMentionsHandler)
      case 'links':
        return withConfiguredHandler(nodeHandlers.createLinksHandler)
      case 'image':
        return withConfiguredHandler(nodeHandlers.createImageHandler)
      case 'video':
        return withConfiguredHandler(nodeHandlers.createVideoHandler)
      case 'quotepost':
        return withConfiguredHandler(nodeHandlers.createQuotePostHandler)
      case 'recency':
        return withConfiguredHandler(nodeHandlers.createRecencyHandler)
      case 'engagementscore':
        return withConfiguredHandler(nodeHandlers.createEngagementScoreHandler)
      case 'customscore':
        return withConfiguredHandler(nodeHandlers.createCustomScoreHandler)
      case 'rotatingposts':
        return withConfiguredHandler(nodeHandlers.createRotatingPostsHandler)
      case 'feedads':
        return withConfiguredHandler(nodeHandlers.createFeedAdsHandler)
      case 'dynamicpinned':
        return withConfiguredHandler(nodeHandlers.createDynamicPinnedHandler)
      case 'pinnedposts':
        return withConfiguredHandler(nodeHandlers.createPinnedPostsHandler)
      case 'featuredpost':
        return withConfiguredHandler(nodeHandlers.createFeaturedPostHandler)
      case 'chronological':
        return withConfiguredHandler(nodeHandlers.createChronologicalHandler)
      case 'byscore':
        return withConfiguredHandler(nodeHandlers.createByScoreHandler)
      case 'mostlikes':
        return withConfiguredHandler(nodeHandlers.createMostLikesHandler)
      case 'mostengagement':
        return withConfiguredHandler(nodeHandlers.createMostEngagementHandler)
      case 'random':
        return withConfiguredHandler(nodeHandlers.createRandomHandler)
      case 'whitelist':
        return {
          ...nodeWithDelete,
          data: {
            ...nodeWithDelete.data,
            onDelete: handleNodeDelete,
            onConfigure: () => {
              const current = (nodeWithDelete.data?.allowedDids || []).join(', ')
              const raw = window.prompt(
                'Allowed viewer DIDs (comma-separated). Leave empty for no restriction in the editor.',
                current
              )
              if (raw === null) return
              const allowedDids = raw
                .split(/[\s,]+/)
                .map((s) => s.trim())
                .filter(Boolean)
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === nodeWithDelete.id
                    ? { ...n, data: { ...n.data, allowedDids } }
                    : n
                )
              )
            },
          },
        }
      case 'manualposts':
        return withConfiguredHandler(nodeHandlers.createManualPostsHandler)
      case 'end':
        return {
          ...nodeWithDelete,
          data: {
            ...nodeWithDelete.data,
            onDelete: handleNodeDelete,
            onConfigure: () => {
              // Use nodesRef.current so this useMemo doesn't need `nodes` as a dep.
              // Without this, any node change (position, data) triggers a full recompute
              // of every visible node's handler objects.
              const boundFeedIds = new Set(
                nodesRef.current
                  .filter(
                    (n) =>
                      n.type === 'end' &&
                      !n.data?.containerParent &&
                      n.id !== nodeWithDelete.id &&
                      n.data?.feedId
                  )
                  .map((n) => String(n.data.feedId))
              )
              const currentFeedId = String(nodeWithDelete.data?.feedId || '')
              const availableFeeds = feedCatalog.filter(
                (f) => !boundFeedIds.has(String(f.id)) || String(f.id) === currentFeedId
              )
              setModalState({
                isOpen: true,
                modalType: 'endfeedbind',
                nodeId: nodeWithDelete.id,
                currentFeedId,
                availableFeeds,
              })
            },
          },
        }
      case 'logicbox':
        return {
          ...nodeWithDelete,
          data: {
            ...nodeWithDelete.data,
            onDelete: handleNodeDelete,
            onSetLogicContainerMode: (mode) => {
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === nodeWithDelete.id
                    ? { ...n, data: { ...n.data, logicContainerMode: mode } }
                    : n
                )
              )
            },
            onAdjustLogicN: (delta) => {
              setNodes((nds) =>
                nds.map((n) => {
                  if (n.id !== nodeWithDelete.id) return n
                  const cur = Math.max(1, Number(n.data?.logicN) || 2)
                  const childN = logicChildCountsByParent.get(n.id) || 0
                  const maxN = Math.max(1, childN || 99)
                  const nextN = Math.min(maxN, Math.max(1, cur + delta))
                  return { ...n, data: { ...n.data, logicN: nextN } }
                })
              )
            },
          },
        }
      case 'nof':
        return withConfiguredHandler(nodeHandlers.createNOfHandler)
      default:
        return { ...nodeWithDelete, data: { ...nodeWithDelete.data, onDelete: handleNodeDelete } }
    }
  }).map((node) => {
    const lockedToEndSlot =
      isEndPipelineView &&
      currentContainer &&
      (isPlainSortingNodeType(node.type) ||
        isPlainAccessNodeType(node.type) ||
        isPlainInjectionNodeType(node.type) ||
        isPlainFixedSlotNodeType(node.type)) &&
      node.data?.containerParent === currentContainer
    return lockedToEndSlot ? { ...node, draggable: false } : node
  }), [
    visibleNodes,
    connectedNodeIds,
    handleNodeDelete,
    handleToggleLogicMode,
    nodeHandlers,
    isEndPipelineView,
    currentContainer,
    feedCatalog,
    setModalState,
    setNodes,
    handleOpenDebugUrlModal,
    handleOpenTestModal,
    logicChildCountsByParent,
    costOrderMessages,
    ingestionRunOrderMap,
  ])

  const modalHandlers = useMemo(() => createModalHandlers(setNodes), [setNodes])

  const buildDebugGraphSnapshot = useCallback((graphNodes, graphEdges) => {
    const frozenNodes = graphNodes.map((n) => ({
      id: n.id,
      type: n.type,
      data: {
        name: n.data?.name ?? null,
        containerParent: n.data?.containerParent ?? null,
      },
    }))
    const frozenEdges = graphEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      data: {
        logicType: e.data?.logicType ?? 'and',
      },
    }))
    return { nodes: frozenNodes, edges: frozenEdges }
  }, [])

  // Handle test post evaluation
  const handleTestPost = useCallback((testPost) => {
    const result = evaluateGraph(nodes, edges, testPost)
    const mergedResults = mergeEvaluationResultsMap(result.results, nodes, edges)
    setEvaluationResults({ ...result, results: mergedResults })
    setDebugGraphSnapshot(buildDebugGraphSnapshot(nodes, edges))
    setDebugPostSnapshot(testPost)
    setLastDebugSource({ type: 'post', testPost })
    setTestModalOpen(false)
    setShowDebugPanel(true)
  }, [nodes, edges, buildDebugGraphSnapshot])

  // Normalize a DB post row (from debug API) into the shape expected by the evaluator
  const normalizeDebugPost = useCallback((dbPost) => {
    if (!dbPost) return null
    const langs = dbPost.language ? [dbPost.language] : (dbPost.langs || [])
    const reply =
      dbPost.reply_parent || dbPost.reply_root
        ? {
            parent: dbPost.reply_parent ? { uri: dbPost.reply_parent } : null,
            root: dbPost.reply_root ? { uri: dbPost.reply_root } : null,
          }
        : undefined

    // Reconstruct facets array from flat facet_tags DB column (string[])
    // so evaluateHashtagCondition can find them via post.facets[*].features[*].tag
    const facetTags = dbPost.facet_tags || []
    const facets = facetTags.length > 0
      ? facetTags.map(tag => ({
          features: [{ $type: 'app.bsky.richtext.facet#tag', tag }],
        }))
      : (dbPost.facets || [])

    return {
      text: dbPost.text || '',
      author_did: dbPost.author_did,
      langs,
      created_at: dbPost.created_at,
      uri: dbPost.uri,
      has_images: dbPost.has_images,
      has_video: dbPost.has_video,
      has_link: dbPost.has_link,
      post_type: dbPost.post_type,
      reply,
      like_count: dbPost.like_count || 0,
      reply_count: dbPost.reply_count || 0,
      repost_count: dbPost.repost_count || 0,
      quote_count: dbPost.quote_count || 0,
      bookmark_count: dbPost.bookmark_count || 0,
      // Tag fields for HashtagNode evaluation
      facets,
      tags: dbPost.outline_tags || [],
    }
  }, [])

  const fetchWithTimeout = useCallback(async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
  }, [])

  const handleDebugByUrl = useCallback(
    async (url) => {
      try {
        setDebugUrlModalOpen(false)
        const resp = await fetchWithTimeout(
          `/debug/post?url=${encodeURIComponent(url)}`
        )
        if (!resp.ok) {
          const text = await resp.text()
          alert(`Failed to fetch post: ${resp.status} ${text || resp.statusText}`)
          return
        }
        const data = await resp.json()
        const rawPost = data?.post || {}
        const testPost = normalizeDebugPost(rawPost)
        if (!testPost) {
          alert('Debug endpoint returned an invalid post payload.')
          return
        }
        const result = evaluateGraph(nodes, edges, testPost)
        const mergedResults = mergeEvaluationResultsMap(result.results, nodes, edges)
        setEvaluationResults({ ...result, results: mergedResults })
        setDebugGraphSnapshot(buildDebugGraphSnapshot(nodes, edges))
        setDebugPostSnapshot(testPost)
        setLastDebugSource({ type: 'url', url })
        setShowDebugPanel(true)
      } catch (err) {
        console.error('Debug by URL failed', err)
        if (err?.name === 'AbortError') {
          alert('Debug timed out while fetching from Bluesky. Please try again.')
        } else {
          alert(`Debug failed: ${err.message || String(err)}`)
        }
        setDebugUrlModalOpen(false)
      }
    },
    [edges, nodes, fetchWithTimeout, normalizeDebugPost, buildDebugGraphSnapshot]
  )

  const handleRerunDebug = useCallback(async () => {
    if (!lastDebugSource || rerunDebugInProgress) return
    if (lastDebugSource.type === 'post') {
      const result = evaluateGraph(nodes, edges, lastDebugSource.testPost)
      const mergedResults = mergeEvaluationResultsMap(result.results, nodes, edges)
      setEvaluationResults({ ...result, results: mergedResults })
      setDebugGraphSnapshot(buildDebugGraphSnapshot(nodes, edges))
      setDebugPostSnapshot(lastDebugSource.testPost)
      setShowDebugPanel(true)
      return
    }
    setRerunDebugInProgress(true)
    try {
      await handleDebugByUrl(lastDebugSource.url)
    } finally {
      setRerunDebugInProgress(false)
    }
  }, [lastDebugSource, nodes, edges, handleDebugByUrl, rerunDebugInProgress])

  const handlePinCurrentDebug = useCallback(() => {
    if (!lastDebugSource) return
    let defaultLabel = 'Debug pin'
    if (lastDebugSource.type === 'url') {
      const u = lastDebugSource.url
      defaultLabel = u.length > 56 ? `${u.slice(0, 53)}...` : u
    } else {
      const t = lastDebugSource.testPost?.text
      defaultLabel =
        typeof t === 'string' && t.trim()
          ? t.length > 48
            ? `${t.trim().slice(0, 45)}...`
            : t.trim()
          : 'Manual JSON post'
    }
    const label = window.prompt('Name this pinned debug', defaultLabel)
    if (label === null) return
    const trimmed = label.trim()
    if (!trimmed) return
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const newPin =
      lastDebugSource.type === 'url'
        ? { id, label: trimmed, kind: 'url', url: lastDebugSource.url, createdAt: Date.now() }
        : {
            id,
            label: trimmed,
            kind: 'post',
            testPost: JSON.parse(JSON.stringify(lastDebugSource.testPost)),
            createdAt: Date.now(),
          }
    setDebugPins((prev) => [...prev, newPin].slice(-30))
    showToast('Saved to Pins')
  }, [lastDebugSource, showToast])

  const handleRunPinnedDebug = useCallback(
    async (pin) => {
      if (!pin || rerunDebugInProgress) return
      if (pin.kind === 'url') {
        setRerunDebugInProgress(true)
        try {
          await handleDebugByUrl(pin.url)
        } finally {
          setRerunDebugInProgress(false)
        }
        return
      }
      const result = evaluateGraph(nodes, edges, pin.testPost)
      const mergedResults = mergeEvaluationResultsMap(result.results, nodes, edges)
      setEvaluationResults({ ...result, results: mergedResults })
      setDebugGraphSnapshot(buildDebugGraphSnapshot(nodes, edges))
      setDebugPostSnapshot(pin.testPost)
      setLastDebugSource({ type: 'post', testPost: pin.testPost })
      setShowDebugPanel(true)
    },
    [nodes, edges, handleDebugByUrl, rerunDebugInProgress, buildDebugGraphSnapshot]
  )

  const primaryDebugFlowPath = useMemo(() => {
    if (!evaluationResults?.endResults?.length) return null
    const list = evaluationResults.endResults
    const pick =
      list.find((er) => er.passed && Array.isArray(er.flowPath) && er.flowPath.length) ||
      list.find((er) => Array.isArray(er.flowPath) && er.flowPath.length) ||
      list[0]
    return pick?.flowPath || null
  }, [evaluationResults])

  const spineFlowEdgeIds = useMemo(() => {
    const path = primaryDebugFlowPath
    if (!path || path.length < 2 || !edgesWithOrder?.length) return null
    const ids = new Set()
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]
      const b = path[i + 1]
      const hit = edgesWithOrder.find((e) => e.source === a && e.target === b && isDebugFlowEdgeLoose(e))
      if (hit?.id) ids.add(hit.id)
    }
    return ids.size > 0 ? ids : null
  }, [primaryDebugFlowPath, edgesWithOrder])

  const edgesForRender = useMemo(
    () =>
      edgesWithOrder.map((e) => {
        const baseData = {
          ...e.data,
          onToggleLogic: handleEdgeLogicToggle,
          onSetN: (newN) => handleEdgeSetN(e.id, newN),
        }
        let style = { ...(e.style || {}) }
        let markerEnd = e.markerEnd ? { ...e.markerEnd } : undefined
        const resMap = evaluationResults?.results

        if (resMap) {
          if (spineFlowEdgeIds && isDebugFlowEdgeLoose(e)) {
            if (spineFlowEdgeIds.has(e.id)) {
              const targetPass = resMap.get(e.target)?.passed
              if (targetPass === false) {
                style = { ...style, stroke: '#ff6b6b', strokeWidth: Math.max(Number(style.strokeWidth) || 2, 2.5) }
              } else if (targetPass === true) {
                style = { ...style, stroke: '#51cf66', strokeWidth: Math.max(Number(style.strokeWidth) || 2, 2) }
              }
              delete style.strokeDasharray
              style.opacity = 1
            } else {
              style = {
                ...style,
                strokeDasharray: '6 5',
                stroke: style.stroke || e.style?.stroke || '#6b6b6b',
                opacity: 0.5,
              }
            }
          } else if (isDebugLogicEdgeLoose(e)) {
            const srcRes = resMap.get(e.source)
            if (srcRes && srcRes.passed === false) {
              style = {
                ...style,
                strokeDasharray: '5 4',
                stroke: '#ff6b6b',
                strokeWidth: Math.max(Number(style.strokeWidth) || 2, 2),
                opacity: 0.95,
              }
              if (markerEnd) markerEnd = { ...markerEnd, color: '#ff6b6b' }
            }
          }
        }

        return {
          ...e,
          data: baseData,
          style,
          markerEnd,
        }
      }),
    [edgesWithOrder, handleEdgeLogicToggle, handleEdgeSetN, evaluationResults, spineFlowEdgeIds]
  )

  const nodesForRender = useMemo(() => {
    // Safety net: derive logic-box dimensions from current child geometry at
    // render time so container growth never depends on callback ordering.
    const laidOut = resizeLogicBoxes(bindLogicBoxParentNodes(nodesWithHandlers))
    return sortNodesForSubflows(laidOut).map((n) => ({
      ...n,
      data: { ...n.data, edges: edgesWithOrder },
    }))
  }, [nodesWithHandlers, edgesWithOrder])

  useEffect(() => {
    if (!showDebugPanel) {
      if (debugMemTimer.current) {
        clearInterval(debugMemTimer.current)
        debugMemTimer.current = null
      }
      debugMemSamples.current = []
      return
    }
    if (debugMemTimer.current) clearInterval(debugMemTimer.current)
    debugMemTimer.current = setInterval(() => {
      try {
        const perfMem = performance?.memory
        if (!perfMem) return
        const used = Math.round((perfMem.usedJSHeapSize / (1024 * 1024)) * 10) / 10
        const total = Math.round((perfMem.totalJSHeapSize / (1024 * 1024)) * 10) / 10
        const limit = Math.round((perfMem.jsHeapSizeLimit / (1024 * 1024)) * 10) / 10
        const sample = { ts: Date.now(), used }
        const bucket = debugMemSamples.current
        bucket.push(sample)
        if (bucket.length > 120) bucket.shift()
        const recent = bucket.slice(-10)
        const trendDelta = recent.length >= 2 ? recent[recent.length - 1].used - recent[0].used : 0
        const resultCount = debugResultCountRef.current || 0
        window.__debugMemStats = {
          usedMB: used,
          totalMB: total,
          limitMB: limit,
          trend10MB: Math.round(trendDelta * 10) / 10,
          results: resultCount,
          samples: bucket.length,
          panelOpen: !!showDebugPanel,
          ts: Date.now(),
        }
        if (REMOTE_MEM_TELEMETRY_ENABLED && bucket.length % 5 === 0) {
          fetch('/api/debug/memory-sample', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.__debugMemStats),
          }).catch(() => {
            // Diagnostics endpoint is best-effort.
          })
        }
      } catch {
        // Diagnostics only.
      }
    }, 2000)
    return () => {
      if (debugMemTimer.current) {
        clearInterval(debugMemTimer.current)
        debugMemTimer.current = null
      }
    }
  }, [showDebugPanel, REMOTE_MEM_TELEMETRY_ENABLED])

  const handleRemovePinnedDebug = useCallback((id) => {
    setDebugPins((prev) => prev.filter((p) => p.id !== id))
  }, [])

  /** Focus + select a node from the debug tree (navigate into the right container level first). */
  const handleNavigateToDebugNode = useCallback(
    (nodeId) => {
      if (!nodeId || !reactFlowInstance) return
      const target = nodes.find((n) => n.id === nodeId)
      if (!target) return

      const parentId = target.data?.containerParent ?? null
      const parentNode = parentId ? nodes.find((n) => n.id === parentId) : null
      navigateToContainer(parentId, parentNode?.data?.name || parentNode?.type, nodes)

      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })))

      const focus = () => {
        try {
          reactFlowInstance.fitView({
            nodes: [{ id: nodeId }],
            padding: 0.35,
            duration: 450,
            maxZoom: 1.5,
          })
        } catch (e) {
          console.warn('Could not focus node on canvas', e)
        }
      }
      setTimeout(focus, 60)
    },
    [reactFlowInstance, setNodes, nodes, navigateToContainer]
  )

  // Clear evaluation results
  const handleClearResults = useCallback(() => {
    setEvaluationResults(null)
    setDebugGraphSnapshot(null)
    setDebugPostSnapshot(null)
    setLastDebugSource(null)
  }, [])

  const handleHideDebugPanel = useCallback(() => {
    // Hide panel but keep results visible on canvas.
    setShowDebugPanel(false)
  }, [])

  const handleClearDebugPanel = useCallback(() => {
    // Clear both panel and results.
    setShowDebugPanel(false)
    setEvaluationResults(null)
    setDebugGraphSnapshot(null)
    setDebugPostSnapshot(null)
    setLastDebugSource(null)
  }, [])

  useEffect(() => {
    debugResultCountRef.current = evaluationResults?.results?.size || 0
  }, [evaluationResults])

  const endOutputs = useMemo(
    () =>
      nodes
        .filter((n) => n.type === 'end' && !n.data?.containerParent)
        .map((n) => ({
          id: n.id,
          name: n.data?.name || '',
          feedId: n.data?.feedId || '',
        })),
    [nodes]
  )

  const feedBindings = useMemo(() => {
    const map = new Map()
    for (const out of endOutputs) {
      if (out.feedId) map.set(out.feedId, out.id)
    }
    return map
  }, [endOutputs])

  const validateEndFeedMappingBeforePersist = useCallback((options = {}) => {
    const { requireFeedIds = true } = options
    // Only top-level ENDs are Bluesky feed outputs. Inner ENDs inside Group/AND/OR/N-OF
    // (e.g. id end-logicgroup-*) share the parent container and must not require feedId.
    const endNodes = nodes.filter((n) => n.type === 'end' && !n.data?.containerParent)
    if (endNodes.length <= 1) return true

    if (requireFeedIds) {
      const missing = endNodes.filter((n) => {
        const feedId = n.data?.feedId
        return !feedId || !String(feedId).trim()
      })
      if (missing.length > 0) {
        const missingLabels = missing.map((n) => n.data?.name || n.id).join(', ')
        alert(
          `Multi-END graphs require a Feed ID on every top-level END node before save/export.\n\n(END nodes inside a Group do not get their own feed — bind feeds on the canvas-level END outputs.)\n\nMissing feedId on: ${missingLabels}`
        )
        return false
      }
    }

    const feedAssignments = new Map()
    for (const endNode of endNodes) {
      const feedId = String(endNode.data?.feedId || '').trim()
      if (!feedId) continue
      if (!feedAssignments.has(feedId)) feedAssignments.set(feedId, [])
      feedAssignments.get(feedId).push(endNode)
    }
    const duplicates = [...feedAssignments.entries()].filter(([, list]) => list.length > 1)
    if (duplicates.length > 0) {
      const lines = duplicates
        .map(([fid, list]) => `${fid}: ${list.map((n) => n.data?.name || n.id).join(', ')}`)
        .join('\n')
      alert(`Each feed can only be assigned to one END node.\n\nDuplicate assignments:\n${lines}`)
      return false
    }

    const feedById = new Map(feedCatalog.map((f) => [f.id, f]))
    const usedSlugs = new Set()
    for (const endNode of endNodes) {
      const feed = feedById.get(String(endNode.data?.feedId || '').trim())
      const slug = String(feed?.slug || '').trim().toLowerCase()
      if (!slug) continue
      if (usedSlugs.has(slug)) {
        alert(`Feed slug "${slug}" is assigned to more than one END node.`)
        return false
      }
      usedSlugs.add(slug)
    }
    return true
  }, [nodes, feedCatalog])

  // Export graph state for sharing
  const handleExport = useCallback(() => {
    if (!validateEndFeedMappingBeforePersist()) return

    // Build clean export with semantic meaning
    const conditionTypes = ['text', 'regex', 'language', 'posttype', 'hashtag', 'labels', 'dateage', 'author', 'media', 'engagement', 'poststructure', 'mentions', 'links', 'image', 'video']
    const logicTypes = ['and', 'or', 'nof', 'logicbox']

    // Sort nodes: follow flow edges from START, insert logic-linked nodes after their partner
    const flowEdges = edges.filter(e => !e.sourceHandle?.startsWith('logic-'))
    const logicEdges = edges.filter(e => e.sourceHandle?.startsWith('logic-'))
    const ordered = []
    const visited = new Set()

    function walkFlow(nodeId) {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      ordered.push(nodeId)
      // Add any logic-linked nodes right after this one
      for (const le of logicEdges) {
        const partner = le.source === nodeId ? le.target : le.target === nodeId ? le.source : null
        if (partner && !visited.has(partner)) {
          visited.add(partner)
          ordered.push(partner)
        }
      }
      // Follow flow edges out
      for (const fe of flowEdges) {
        if (fe.source === nodeId && !visited.has(fe.target)) {
          walkFlow(fe.target)
        }
      }
    }
    const rootFlowSeed =
      nodes.find((n) => n.type === 'start' && !n.data?.containerParent)?.id || 'start'
    walkFlow(rootFlowSeed)
    // Add any remaining nodes not reached by flow
    for (const n of nodes) {
      if (!visited.has(n.id)) ordered.push(n.id)
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const sortedNodes = ordered.map(id => nodeMap.get(id)).filter(Boolean)

    const exportNodes = sortedNodes.map(node => {
      const base = {
        id: node.id,
        type: node.type,
        position: node.position,
        containerParent: node.data?.containerParent || null,
      }

      if (node.data?.name) base.name = node.data.name
      if (node.data?.logicModeTop && node.data.logicModeTop !== 'and') base.logicModeTop = node.data.logicModeTop
      if (node.data?.logicModeBottom && node.data.logicModeBottom !== 'and') base.logicModeBottom = node.data.logicModeBottom

      // Strip functions, keep only config data
      if (conditionTypes.includes(node.type)) {
        const config = {}
        const d = node.data || {}
        if (d.keywords?.length) config.keywords = d.keywords
        if (d.pattern) config.pattern = d.pattern
        if (d.flags) config.flags = d.flags
        if (d.languages?.length) config.languages = d.languages
        if (d.types?.length) config.types = d.types
        if (d.authors?.length) config.authors = d.authors
        if (d.listUris?.length) config.listUris = d.listUris
        if (d.tags?.length) config.tags = d.tags
        if (d.fieldTypes?.length) config.fieldTypes = d.fieldTypes
        if (d.labels?.length) config.labels = d.labels
        if (d.mentions?.length) config.mentions = d.mentions
        if (d.urls?.length) config.urls = d.urls
        if (d.fields && JSON.stringify(d.fields) !== '["text"]') config.fields = d.fields
        if (d.exclude) config.exclude = true
        if (d.mode) config.mode = d.mode
        if (d.value && Object.keys(d.value).length) config.value = d.value
        if (d.metricType) config.metricType = d.metricType
        if (d.operator) config.operator = d.operator
        if (d.threshold) config.threshold = d.threshold
        if (d.structureType) config.structureType = d.structureType
        if (d.depth) config.depth = d.depth
        if (d.postTypeScores) config.postTypeScores = d.postTypeScores
        if (d.mediaTypeScores) config.mediaTypeScores = d.mediaTypeScores
        if (d.imageCount != null) config.imageCount = d.imageCount
        if (d.minWidth != null) config.minWidth = d.minWidth
        if (d.maxWidth != null) config.maxWidth = d.maxWidth
        if (d.minHeight != null) config.minHeight = d.minHeight
        if (d.maxHeight != null) config.maxHeight = d.maxHeight
        if (d.aspectRatio) config.aspectRatio = d.aspectRatio
        if (d.minFileSize != null) config.minFileSize = d.minFileSize
        if (d.maxFileSize != null) config.maxFileSize = d.maxFileSize
        if (d.presentation) config.presentation = d.presentation
        if (d.replyDepthEnabled) {
          config.replyDepthEnabled = true
          config.replyDepthOperator = d.replyDepthOperator
          config.replyDepth = d.replyDepth
        }
        if (Object.keys(config).length) base.config = config
      }

      if (logicTypes.includes(node.type)) {
        const childCount = nodes.filter(n => n.data?.containerParent === node.id).length
        base.childCount = childCount
        if (node.type === 'nof') base.n = node.data?.n || 2
        if (node.type === 'logicbox') {
          base.logicContainerMode = node.data?.logicContainerMode || 'and'
          base.logicN = node.data?.logicN ?? 2
        }
      }

      if (node.type === 'end' || node.type === 'containerout') {
        const d = node.data || {}
        const config = {}
        if (d.feedId && node.type === 'end') config.feedId = d.feedId
        if (Object.keys(config).length) base.config = { ...(base.config || {}), ...config }
      }

      return base
    })

    // Sort edges: flow edges in traversal order, logic edges after related flow node
    const sortedEdges = []
    for (const nodeId of ordered) {
      for (const fe of flowEdges) {
        if (fe.source === nodeId) sortedEdges.push(fe)
      }
      for (const le of logicEdges) {
        if (le.source === nodeId || le.target === nodeId) {
          if (!sortedEdges.includes(le)) sortedEdges.push(le)
        }
      }
    }
    // Add any remaining edges
    for (const e of edges) {
      if (!sortedEdges.includes(e)) sortedEdges.push(e)
    }

    const exportEdges = sortedEdges.map(edge => {
      const e = {
        source: edge.source,
        target: edge.target,
      }
      const isLogic = edge.sourceHandle?.startsWith('logic-')
      if (isLogic) {
        e.type = 'logic'
        e.logic = edge.data?.logicType || 'and'
      } else {
        e.type = 'flow'
      }
      return e
    })

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      nodes: exportNodes,
      edges: exportEdges,
      feeds: feedCatalog,
    }
    
    const exportString = JSON.stringify(exportData, null, 2)
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(exportString).then(() => {
        alert('Graph exported and copied to clipboard!')
      }).catch(() => {
        showExportDialog(exportString)
      })
    } else {
      showExportDialog(exportString)
    }
  }, [nodes, edges, feedCatalog, validateEndFeedMappingBeforePersist])

  const persistDraftGraph = useCallback((showSavedAlert = true) => {
    if (!validateEndFeedMappingBeforePersist({ requireFeedIds: false })) return

    try {
      // Save in stable format that survives editor changes
      const saveNodes = nodes.map(node => {
        const s = {
          id: node.id,
          type: node.type,
          position: node.position,
          containerParent: node.data?.containerParent || null,
        }
        // Save config data (exclude functions, edges, internal state)
        const skipKeys = new Set(['onConfigure', 'onDelete', 'onToggleLogicMode', 'onDebug', 'onTest', 'edges', 'nodes', 'evaluationResult', 'childCount', 'label'])
        const config = {}
        for (const [k, v] of Object.entries(node.data || {})) {
          if (skipKeys.has(k) || typeof v === 'function') continue
          if (k === 'containerParent') continue // already top-level
          if (v === undefined || v === null) continue
          if (Array.isArray(v) && v.length === 0) continue
          config[k] = v
        }
        if (Object.keys(config).length) s.config = config
        return s
      })

      const saveEdges = edges.map(edge => {
        const e = {
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        }
        if (edge.data?.logicType) e.logicType = edge.data.logicType
        return e
      })

      const saveData = {
        version: 2,
        savedAt: new Date().toISOString(),
        nodes: saveNodes,
        edges: saveEdges,
        feeds: feedCatalog,
      }
      
      localStorage.setItem('feed-builder-graph', JSON.stringify(saveData))
      if (projectId) {
        saveProjectDraft(projectId, saveData).catch((apiError) => {
          console.warn('Failed to sync project draft graph to API', apiError)
          showToast('Saved locally; project draft sync failed')
        })
      }
      const feedIds = feedCatalog.map((f) => String(f.id)).filter(Boolean)
      if (feedIds.length > 0) {
        Promise.all(feedIds.map((feedId) => saveFeedDraft(feedId, saveData))).catch((apiError) => {
          console.warn('Failed to sync draft graph to feed API', apiError)
          showToast('Saved locally; API draft sync failed')
        })
      }
      if (showSavedAlert) alert('Draft saved!')
      return true
    } catch (error) {
      console.error('Error saving graph:', error)
      alert('Failed to save draft: ' + error.message)
      return false
    }
  }, [nodes, edges, feedCatalog, validateEndFeedMappingBeforePersist, showToast, projectId])

  const handleSaveDraft = useCallback(() => {
    persistDraftGraph(true)
  }, [persistDraftGraph])

  // Returns true if any videofeed node can reach the END node for this feed via flow edges (BFS).
  // This allows the Video Feed node to be placed anywhere upstream, not just directly before END.
  const isVideoFeedForFeed = useCallback((feedId) => {
    const endNode = nodes.find(
      (n) =>
        n.type === 'end' &&
        !n.data?.containerParent &&
        String(n.data?.feedId || '') === String(feedId)
    )
    if (!endNode) return false
    const videofeedNodes = nodes.filter((n) => n.type === 'videofeed')
    if (videofeedNodes.length === 0) return false

    const isFlowEdge = (e) => {
      if (e.data?.logicType) return false
      if (typeof e.sourceHandle === 'string' && e.sourceHandle.startsWith('logic-')) return false
      return true
    }

    for (const vfNode of videofeedNodes) {
      const visited = new Set()
      const queue = [vfNode.id]
      while (queue.length > 0) {
        const cur = queue.shift()
        if (visited.has(cur)) continue
        visited.add(cur)
        if (cur === endNode.id) return true
        edges
          .filter((e) => e.source === cur && isFlowEdge(e))
          .forEach((e) => queue.push(e.target))
      }
    }
    return false
  }, [nodes, edges])

  const handlePublish = useCallback(() => {
    if (!validateEndFeedMappingBeforePersist()) return
    const saved = persistDraftGraph(false)
    if (!saved) return
    try {
      const feedIds = feedCatalog.map((f) => String(f.id)).filter(Boolean)
      if (feedIds.length === 0) {
        alert('Create at least one feed before publishing.')
        return
      }
      Promise.all(feedIds.map((feedId) => promoteFeedDraftToLive(feedId)))
        .then(async () => {
          if (projectId) await promoteProjectDraftToLive(projectId)
          const session = await getOAuthSession?.()
          if (!session) throw new Error('OAuth session unavailable; sign in again')
          const tokenSet = await session.getTokenSet(false)
          const scopeText = String(tokenSet?.scope || '')
          if (!scopeText.includes('repo:app.bsky.feed.generator')) {
            throw new Error('OAuth token missing publish scope. Log out and sign in again to grant publish permission.')
          }
          const sessionDid = session.did || session.sub || authDid
          if (!sessionDid) throw new Error('OAuth session missing DID; sign in again')
          const agent = new Agent(session)
          const serviceDid = `did:web:${window.location.hostname.toLowerCase()}`
          await Promise.all(feedIds.map(async (feedId) => {
            const feed = feedCatalog.find((f) => String(f.id) === String(feedId))
            const rkey = toAtprotoRkey(feed?.slug, feedId)
            const record = {
              $type: 'app.bsky.feed.generator',
              did: serviceDid,
              displayName: String(feed?.name || 'Feed').slice(0, 24),
              ...(feed?.description ? { description: String(feed.description).slice(0, 300) } : {}),
              createdAt: new Date().toISOString(),
              ...(isVideoFeedForFeed(feedId)
                ? { contentMode: 'app.bsky.feed.defs#contentModeVideo' }
                : {}),
            }
            const res = await agent.com.atproto.repo.putRecord({
              repo: sessionDid,
              collection: 'app.bsky.feed.generator',
              rkey,
              record,
            })
            const uri = res?.data?.uri || `at://${sessionDid}/app.bsky.feed.generator/${rkey}`
            await setFeedPublishedUri(feedId, uri)
          }))
          showToast('Published')
        })
        .catch((error) => alert('Failed to publish: ' + error.message))
    } catch (error) {
      alert('Failed to publish: ' + error.message)
    }
  }, [validateEndFeedMappingBeforePersist, persistDraftGraph, showToast, feedCatalog, projectId, authDid, getOAuthSession, isVideoFeedForFeed])

  // Expose methods via ref
  // Import graph from JSON string
  const handleImport = useCallback(() => {
    const input = prompt('Paste graph JSON:')
    if (!input) return
    
    try {
      const parsed = JSON.parse(input)
      if (!parsed.nodes || !parsed.edges) {
        alert('Invalid graph format: missing nodes or edges')
        return
      }
      if (Array.isArray(parsed.feeds)) {
        setFeedCatalog(parsed.feeds)
      }

      // Rebuild React Flow nodes
      // Ensure IDs start with the node type (ConditionNode uses id.split('-')[0] for type detection)
      const importedNodes = parsed.nodes.map((sn) => {
        let nodeType = sn.type
        if (sn.containerParent && nodeType === 'start') nodeType = 'containerin'
        if (sn.containerParent && nodeType === 'end') nodeType = 'containerout'
        let id = sn.id
        const legacyIdOk =
          (nodeType === 'containerin' && String(id).startsWith('start-')) ||
          (nodeType === 'containerout' && String(id).startsWith('end-'))
        if (
          !legacyIdOk &&
          nodeType !== 'start' &&
          nodeType !== 'end' &&
          nodeType !== 'containerin' &&
          nodeType !== 'containerout' &&
          !id.startsWith(nodeType)
        ) {
          id = `${nodeType}-${id}`
        }
        return {
          id,
          type: nodeType,
          position: sn.position,
          data: {
            ...(sn.config || {}),
            containerParent: sn.containerParent || null,
            label: nodeType,
            logicModeTop: sn.logicModeTop || undefined,
            logicModeBottom: sn.logicModeBottom || undefined,
            name: sn.name || undefined,
            n: sn.n || undefined,
            logicContainerMode:
              (sn.config && sn.config.logicContainerMode) || sn.logicContainerMode || undefined,
            logicN: (sn.config && sn.config.logicN) ?? sn.logicN ?? undefined,
          },
        }
      })

      // Build ID remap for edges
      const idRemap = new Map()
      parsed.nodes.forEach((sn, i) => {
        idRemap.set(sn.id, importedNodes[i].id)
      })

      // Infer logicModeTop/Bottom from edges if not set on nodes
      for (const edge of parsed.edges) {
        if (edge.type !== 'logic') continue
        const logicType = edge.logic || edge.logicType || 'and'
        const targetHandle = edge.targetHandle || (edge.type === 'logic' ? 'logic-top' : null)
        if (!targetHandle) continue
        
        const remappedTarget = idRemap.get(edge.target) || edge.target
        const targetNode = importedNodes.find(n => n.id === remappedTarget)
        if (!targetNode) continue
        
        if (targetHandle.includes('logic-top') && !targetNode.data.logicModeTop) {
          targetNode.data.logicModeTop = logicType
        }
        if (targetHandle.includes('logic-bottom') && !targetNode.data.logicModeBottom) {
          targetNode.data.logicModeBottom = logicType
        }
      }

      // Rebuild React Flow edges using remapped IDs
      const importedEdges = parsed.edges.map(se => {
        const source = idRemap.get(se.source) || se.source
        const target = idRemap.get(se.target) || se.target
        // Determine handles from edge type
        let sourceHandle = se.sourceHandle || 'output-right'
        let targetHandle = se.targetHandle || 'input-left'
        if (se.type === 'logic') {
          // For exported format without handles, use logic defaults
          if (!se.sourceHandle) sourceHandle = 'logic-bottom'
          if (!se.targetHandle) targetHandle = 'logic-top'
        }
        
        const isLogic = sourceHandle.startsWith('logic-')
        const logicType = se.logic || se.logicType || null
        const color = isLogic
          ? (logicType === 'or' ? '#ff9500' : '#4a9eff')
          : '#51cf66'
        return {
          id: `reactflow__edge-${source}${sourceHandle}-${target}${targetHandle}`,
          source,
          target,
          sourceHandle,
          targetHandle,
          type: 'ordered',
          zIndex: isLogic ? 10 : 0,
          style: { stroke: color, strokeWidth: 2 },
          data: { logicType },
          markerEnd: {
            type: 'arrowclosed',
            color: color,
            width: 20,
            height: 20,
          },
        }
      })

      const importedWithParents = bindLogicBoxParentNodes(
        importedNodes.map((n) =>
          n.type === 'logicbox' && !n.style?.width
            ? {
                ...n,
                zIndex: 0,
                width: LOGIC_BOX_MIN_W,
                height: LOGIC_BOX_MIN_H,
                style: { width: LOGIC_BOX_MIN_W, height: LOGIC_BOX_MIN_H },
                data: {
                  ...n.data,
                  logicContainerMode: n.data?.logicContainerMode || 'and',
                  logicN: n.data?.logicN ?? 2,
                },
              }
            : n
        )
      )
      setNodes(importedWithParents)
      setEdges(importedEdges)
    } catch (error) {
      console.error('Import error:', error)
      alert('Failed to parse graph: ' + error.message)
    }
  }, [setNodes, setEdges])

  React.useImperativeHandle(
    ref,
    () => ({
      exportGraph: handleExport,
      importGraph: handleImport,
      saveGraph: handleSaveDraft,
      publishGraph: handlePublish,
      openFeedManager: () => {
        // Feed manager is conceptually global; snap back to main canvas first
        // to avoid confusion when user is deep in END pipeline view.
        navigateTo(-1)
        // Always refresh feeds from the API when opening the manager so the
        // catalog is never stale (e.g. after a failed publish attempt).
        if (projectId) {
          listProjectFeeds(projectId)
            .then((feeds) => setFeedCatalog(feeds.map(normalizeFeedRecord)))
            .catch(() => {})
        }
        setFeedOutputsModalOpen(true)
      },
      getNodes: () => nodes,
      getEdges: () => edges,
      toggleDebugPanel: () => setShowDebugPanel((s) => !s),
      openDebugPanel: () => setShowDebugPanel(true),
      navigateToNode: handleNavigateToDebugNode,
      selectProject: handleSelectProject,
      createProject: handleCreateProject,
      renameProject: handleRenameProject,
      deleteProject: handleDeleteProject,
    }),
    [
      handleExport,
      handleImport,
      handleSaveDraft,
      handlePublish,
      nodes,
      edges,
      handleNavigateToDebugNode,
      navigateTo,
      handleSelectProject,
      handleCreateProject,
      handleRenameProject,
      handleDeleteProject,
      projectId,
      setFeedCatalog,
    ]
  )

  // Show export dialog with textarea for manual copying
  const showExportDialog = (text) => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-999999px'
    document.body.appendChild(textarea)
    textarea.select()
    
    try {
      document.execCommand('copy')
      alert('Graph exported! The data has been copied to your clipboard. Paste it here to share.')
    } catch (err) {
      // Final fallback: show in prompt
      prompt('Graph Export (copy this text):', text)
    }
    
    document.body.removeChild(textarea)
  }

  return (
    <div
      className={`canvas-wrapper${depthSwitchClass ? ` ${depthSwitchClass}` : ''}${isEndPipelineView ? ' canvas-wrapper--end-pipeline' : ''}`}
      ref={reactFlowWrapper}
    >
      {evaluationResults && (
        <div
          className="canvas-debug-run-banner"
          role="status"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 12,
            maxWidth: 'min(520px, 92vw)',
            padding: '10px 14px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(30, 80, 120, 0.95), rgba(18, 40, 60, 0.95))',
            border: '1px solid rgba(74, 158, 255, 0.45)',
            color: '#e7f5ff',
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.35,
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
          }}
        >
          Debug run active — nodes show <strong style={{ color: '#7bed9f' }}>PASS</strong> /{' '}
          <strong style={{ color: '#ff8787' }}>FAIL</strong>; flow on the spine is solid (green/red by
          step), other flow edges are dashed. Use Clear Results to hide.
        </div>
      )}
      {evaluationResults && (
        <button
          onClick={handleClearResults}
          style={{
            position: 'absolute',
            top: '100px',
            right: '10px',
            zIndex: 10,
            padding: '8px 16px',
            backgroundColor: '#666',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#777'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#666'}
          title="Clear test results"
        >
          Clear Results
        </button>
      )}
      {MINIMAL_CANVAS_ISOLATION_MODE ? (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'grid',
            placeItems: 'center',
            color: '#888',
            fontSize: '14px',
            border: '1px dashed #3a3a3a',
            borderRadius: '10px',
            background: 'rgba(18,18,18,0.65)',
          }}
        >
          Minimal canvas isolation mode active (`?minimalCanvas=1`)
        </div>
      ) : (
        <ReactFlow
          onlyRenderVisibleElements={!evaluationResults?.results?.size}
          edges={edgesForRender}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={closeContextMenu}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          connectionMode="loose"
          onConnectStart={(event, { nodeId, handleType, handleId }) => {
            window._firstClickedNode = nodeId
            window._firstClickedHandle = handleId
            window._lastClickedHandle = null
            window._lastClickedNode = null
          }}
          onConnectEnd={() => {
            setTimeout(() => {
              window._firstClickedNode = null
              window._firstClickedHandle = null
              window._secondClickedNode = null
              window._secondClickedHandle = null
              window._lastClickedHandle = null
              window._lastClickedNode = null
            }, 300)
          }}
          onEdgeContextMenu={onEdgeContextMenu}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodes={nodesForRender}
          snapToGrid={true}
          snapGrid={[GRID_SIZE, GRID_SIZE]}
          minZoom={0.2}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          connectionLineStyle={CONNECTION_LINE_STYLE}
        >
          <Background gap={20} size={1} color="#2a2a2a" />
          {isEndPipelineView && (
            <>
              <EndPipelineSortingSlotsOverlay
                slotCount={endPipelineSlotCount}
                hasModuleInSlot={hasEndPipelineModuleInSlot}
              />
              <EndPipelineInjectionSlotsOverlay
                slotCount={endPipelineInjectionSlotCount}
                hasModuleInSlot={hasEndPipelineInjectionInSlot}
                onAddSlot={handleAddEndPipelineInjectionSlot}
                canAddMore={endPipelineInjectionSlotCount < MAX_END_PIPELINE_INJECTION_SLOTS}
              />
              <EndPipelineFixedSlotsOverlay
                slotCount={endPipelineFixedSlotCount}
                hasModuleInSlot={hasEndPipelineFixedInSlot}
                onAddSlot={handleAddEndPipelineFixedSlot}
                canAddMore={endPipelineFixedSlotCount < MAX_END_PIPELINE_FIXED_SLOTS}
              />
              <EndPipelineAccessSlotsOverlay
                slotCount={endPipelineAccessSlotCount}
                hasModuleInSlot={hasEndPipelineAccessInSlot}
                onAddSlot={handleAddEndPipelineAccessSlot}
                canAddMore={endPipelineAccessSlotCount < MAX_END_PIPELINE_ACCESS_SLOTS}
              />
            </>
          )}
          <Controls />
          <Panel position="bottom-left" style={{ margin: 8 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setShowMiniMap((v) => !v)}
              title="MiniMap duplicates the graph for navigation; it uses extra memory when enabled."
            >
              {showMiniMap ? 'Hide minimap' : 'Show minimap'}
            </button>
          </Panel>
          {showMiniMap && (
            <MiniMap
              nodeColor="#4a9eff"
              maskColor="rgba(0, 0, 0, 0.6)"
              style={{ backgroundColor: '#1a1a1a' }}
            />
          )}
          <Panel position="top-right" className="canvas-info">
            {isEndPipelineView ? (
              <>
                <div className="info-text" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Feed pipeline
                  {(() => {
                    const endNode = nodes.find(
                      (n) =>
                        n.id === currentContainer &&
                        (n.type === 'end' || n.type === 'containerout')
                    )
                    const name = endNode?.data?.name?.trim()
                    return name ? ` · ${name}` : ''
                  })()}
                </div>
              </>
            ) : currentContainer ? (
              <div className="info-text" style={{ fontSize: '13px', fontWeight: 600 }}>
                {(() => {
                  const containerNode = nodes.find((n) => n.id === currentContainer)
                  return containerNode?.data?.name || 'Group'
                })()}
              </div>
            ) : (
              <div className="info-text">Snap to Grid: ON</div>
            )}
          </Panel>
        </ReactFlow>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#2a2a2a',
            border: '1px solid #3a3a3a',
            borderRadius: '4px',
            padding: '4px 0',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            minWidth: '120px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleContextMenuName}
            style={{
              width: '100%',
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              color: '#e0e0e0',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            onMouseEnter={(e) => e.target.style.background = '#3a3a3a'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            Name Node
          </button>
          <div style={{ height: '1px', background: '#3a3a3a', margin: '4px 0' }} />
          <button
            onClick={handleContextMenuDelete}
            style={{
              width: '100%',
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              color: '#ff6b6b',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '14px'
            }}
            onMouseEnter={(e) => e.target.style.background = '#3a1a1a'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            Delete Node
          </button>
        </div>
      )}

      <KeywordModal
        isOpen={modalState.isOpen && modalState.modalType === 'keyword'}
        onClose={() => setModalState({ isOpen: false, modalType: 'keyword', nodeId: null, keywords: [], name: '', fields: ['text'], exclude: false })}
        nodeId={modalState.nodeId}
        keywords={modalState.keywords}
        name={modalState.name}
        fields={modalState.fields}
        exclude={modalState.exclude}
        onSave={modalHandlers.handleSaveKeywords}
      />

      <RegexModal
        isOpen={modalState.isOpen && modalState.modalType === 'regex'}
        onClose={() => setModalState({ isOpen: false, modalType: 'regex', nodeId: null, pattern: '', name: '', fields: ['text'], exclude: false, flags: '' })}
        nodeId={modalState.nodeId}
        pattern={modalState.pattern}
        name={modalState.name}
        fields={modalState.fields}
        exclude={modalState.exclude}
        onSave={modalHandlers.handleSaveRegex}
      />

      <LanguageModal
        isOpen={modalState.isOpen && modalState.modalType === 'language'}
        onClose={() => setModalState({ isOpen: false, modalType: 'language', nodeId: null, languages: [], name: '', exclude: false })}
        nodeId={modalState.nodeId}
        languages={modalState.languages}
        name={modalState.name}
        exclude={modalState.exclude}
        onSave={modalHandlers.handleSaveLanguage}
      />

      <PostTypeModal
        isOpen={modalState.isOpen && modalState.modalType === 'posttype'}
        onClose={() => setModalState({ isOpen: false, modalType: 'posttype', nodeId: null, types: [], name: '', exclude: false, replyDepthEnabled: false, replyDepthOperator: 'equals', replyDepth: 1, postTypeScores: undefined })}
        nodeId={modalState.nodeId}
        types={modalState.types}
        name={modalState.name}
        exclude={modalState.exclude}
        replyDepthEnabled={modalState.replyDepthEnabled}
        replyDepthOperator={modalState.replyDepthOperator}
        replyDepth={modalState.replyDepth}
        postTypeScores={modalState.postTypeScores}
        onSave={modalHandlers.handleSavePostType}
      />

      <AuthorModal
        isOpen={modalState.isOpen && modalState.modalType === 'author'}
        onClose={() => setModalState({ isOpen: false, modalType: 'author', nodeId: null, authors: [], listUris: [], name: '', exclude: false })}
        nodeId={modalState.nodeId}
        authors={modalState.authors}
        listUris={modalState.listUris}
        name={modalState.name}
        exclude={modalState.exclude}
        onSave={modalHandlers.handleSaveAuthor}
      />

      <MediaTypeModal
        isOpen={modalState.isOpen && modalState.modalType === 'media'}
        onClose={() => setModalState({ isOpen: false, modalType: 'media', nodeId: null, types: [], name: '', exclude: false, mediaTypeScores: undefined })}
        nodeId={modalState.nodeId}
        types={modalState.types}
        name={modalState.name}
        exclude={modalState.exclude}
        mediaTypeScores={modalState.mediaTypeScores}
        onSave={modalHandlers.handleSaveMediaType}
      />

      <HashtagModal
        isOpen={modalState.isOpen && modalState.modalType === 'hashtag'}
        onClose={() =>
          setModalState({
            isOpen: false,
            modalType: 'hashtag',
            nodeId: null,
            tags: [],
            fieldTypes: ['outline_tags', 'hashtags'],
            name: '',
            exclude: false,
          })
        }
        nodeId={modalState.nodeId}
        tags={modalState.tags}
        fieldTypes={modalState.fieldTypes}
        name={modalState.name}
        exclude={modalState.exclude}
        onSave={modalHandlers.handleSaveHashtag}
      />

      <LabelsModal
        isOpen={modalState.isOpen && modalState.modalType === 'labels'}
        onClose={() =>
          setModalState({
            isOpen: false,
            modalType: 'labels',
            nodeId: null,
            labels: [],
            name: '',
            exclude: false,
          })
        }
        nodeId={modalState.nodeId}
        labels={modalState.labels}
        name={modalState.name}
        exclude={modalState.exclude}
        onSave={modalHandlers.handleSaveLabels}
      />

      <DateAgeModal
        isOpen={modalState.isOpen && modalState.modalType === 'dateage'}
        onClose={() => setModalState({ isOpen: false, modalType: 'dateage', nodeId: null, mode: 'newer_than', value: { amount: 24, unit: 'hours' }, name: '', exclude: false })}
        nodeId={modalState.nodeId}
        mode={modalState.mode}
        value={modalState.value}
        name={modalState.name}
        exclude={modalState.exclude}
        onSave={modalHandlers.handleSaveDateAge}
      />
      <NOfModal
        isOpen={modalState.isOpen && modalState.modalType === 'nof'}
        onClose={() => setModalState({ isOpen: false, modalType: 'nof', nodeId: null, n: 2 })}
        nodeId={modalState.nodeId}
        n={modalState.n}
        onSave={modalHandlers.handleSaveNOf}
      />

      <ManualPostsModal
        isOpen={modalState.isOpen && modalState.modalType === 'manualposts'}
        onClose={() => setModalState({ isOpen: false, modalType: 'manualposts', nodeId: null, posts: [], name: '' })}
        nodeId={modalState.nodeId}
        posts={modalState.posts}
        name={modalState.name}
        onSave={modalHandlers.handleSaveManualPosts}
      />

      <EngagementModal
        isOpen={modalState.isOpen && modalState.modalType === 'engagement'}
        onClose={() => setModalState({ isOpen: false, modalType: 'engagement', nodeId: null, metricType: 'likes', operator: 'greater_than', threshold: 0 })}
        nodeId={modalState.nodeId}
        metricType={modalState.metricType}
        operator={modalState.operator}
        threshold={modalState.threshold}
        onSave={modalHandlers.handleSaveEngagement}
      />

      <PostStructureModal
        isOpen={modalState.isOpen && modalState.modalType === 'poststructure'}
        onClose={() => setModalState({ isOpen: false, modalType: 'poststructure', nodeId: null, structureType: 'is_reply', operator: 'equals', depth: 1 })}
        nodeId={modalState.nodeId}
        structureType={modalState.structureType}
        operator={modalState.operator}
        depth={modalState.depth}
        onSave={modalHandlers.handleSavePostStructure}
      />

      <MentionsModal
        isOpen={modalState.isOpen && modalState.modalType === 'mentions'}
        onClose={() => setModalState({ isOpen: false, modalType: 'mentions', nodeId: null, mentions: [], listUris: [], name: '', exclude: false })}
        nodeId={modalState.nodeId}
        mentions={modalState.mentions}
        listUris={modalState.listUris}
        name={modalState.name}
        exclude={modalState.exclude}
        onSave={modalHandlers.handleSaveMentions}
      />

      <LinksModal
        isOpen={modalState.isOpen && modalState.modalType === 'links'}
        onClose={() => setModalState({ isOpen: false, modalType: 'links', nodeId: null, urls: [], name: '', exclude: false, requireThumbnail: false })}
        nodeId={modalState.nodeId}
        urls={modalState.urls}
        name={modalState.name}
        exclude={modalState.exclude}
        requireThumbnail={modalState.requireThumbnail}
        onSave={modalHandlers.handleSaveLinks}
      />

      <QuotePostModal
        isOpen={modalState.isOpen && modalState.modalType === 'quotepost'}
        onClose={() => setModalState({ isOpen: false, modalType: 'quotepost', nodeId: null, uris: [], dids: [], name: '', exclude: false })}
        nodeId={modalState.nodeId}
        uris={modalState.uris || []}
        dids={modalState.dids || []}
        name={modalState.name}
        exclude={modalState.exclude}
        onSave={modalHandlers.handleSaveQuotePost}
      />

      <ImageModal
        isOpen={modalState.isOpen && modalState.modalType === 'image'}
        onClose={() => setModalState({ isOpen: false, modalType: 'image', nodeId: null, imageCount: null, minWidth: null, maxWidth: null, minHeight: null, maxHeight: null, aspectRatio: null, minFileSize: null, maxFileSize: null, exclude: false })}
        nodeId={modalState.nodeId}
        imageCount={modalState.imageCount}
        minWidth={modalState.minWidth}
        maxWidth={modalState.maxWidth}
        minHeight={modalState.minHeight}
        maxHeight={modalState.maxHeight}
        aspectRatio={modalState.aspectRatio}
        minFileSize={modalState.minFileSize}
        maxFileSize={modalState.maxFileSize}
        exclude={modalState.exclude}
        onSave={modalHandlers.handleSaveImage}
      />

      <VideoModal
        isOpen={modalState.isOpen && modalState.modalType === 'video'}
        onClose={() => setModalState({ isOpen: false, modalType: 'video', nodeId: null, minWidth: null, maxWidth: null, minHeight: null, maxHeight: null, aspectRatio: null, minFileSize: null, maxFileSize: null, presentation: null, exclude: false })}
        nodeId={modalState.nodeId}
        minWidth={modalState.minWidth}
        maxWidth={modalState.maxWidth}
        minHeight={modalState.minHeight}
        maxHeight={modalState.maxHeight}
        aspectRatio={modalState.aspectRatio}
        minFileSize={modalState.minFileSize}
        maxFileSize={modalState.maxFileSize}
        presentation={modalState.presentation}
        exclude={modalState.exclude}
        onSave={modalHandlers.handleSaveVideo}
      />

      <RecencyBoostModal
        isOpen={modalState.isOpen && modalState.modalType === 'recency'}
        onClose={() => setModalState({ isOpen: false, modalType: 'recency', nodeId: null, decayHours: 24, maxBoost: 100 })}
        nodeId={modalState.nodeId}
        decayHours={modalState.decayHours}
        maxBoost={modalState.maxBoost}
        onSave={modalHandlers.handleSaveRecency}
      />

      <EngagementScoreModal
        isOpen={modalState.isOpen && modalState.modalType === 'engagementscore'}
        onClose={() => setModalState({ isOpen: false, modalType: 'engagementscore', nodeId: null, likeWeight: 1, replyWeight: 2, repostWeight: 3, quoteWeight: 4, bookmarkWeight: 1 })}
        nodeId={modalState.nodeId}
        likeWeight={modalState.likeWeight}
        replyWeight={modalState.replyWeight}
        repostWeight={modalState.repostWeight}
        quoteWeight={modalState.quoteWeight}
        bookmarkWeight={modalState.bookmarkWeight}
        onSave={modalHandlers.handleSaveEngagementScore}
      />

      <CustomScoreModal
        isOpen={modalState.isOpen && modalState.modalType === 'customscore'}
        onClose={() => setModalState({ isOpen: false, modalType: 'customscore', nodeId: null, score: 0 })}
        nodeId={modalState.nodeId}
        score={modalState.score}
        onSave={modalHandlers.handleSaveCustomScore}
      />

      <RotatingPostsModal
        isOpen={
          modalState.isOpen &&
          (modalState.modalType === 'rotatingposts' ||
            modalState.modalType === 'feedads')
        }
        onClose={() =>
          setModalState({
            isOpen: false,
            modalType: 'rotatingposts',
            nodeId: null,
            postUrls: [],
            strategy: 'round-robin',
          })
        }
        nodeId={modalState.nodeId}
        postUrls={modalState.postUrls}
        strategy={modalState.strategy}
        onSave={modalHandlers.handleSaveRotatingPosts}
        heading={modalState.modalType === 'feedads' ? 'Feed Ads' : 'Rotating Posts'}
        urlHint={
          modalState.modalType === 'feedads'
            ? 'Add Bluesky post URLs for sponsored or house ad posts. They are injected using the same rotation rules as rotating posts.'
            : 'Add Bluesky post URLs. These posts will rotate based on the selected strategy.'
        }
      />

      <ChronologicalModal
        isOpen={modalState.isOpen && modalState.modalType === 'chronological'}
        onClose={() => setModalState({ isOpen: false, modalType: 'chronological', nodeId: null, order: 'newest' })}
        nodeId={modalState.nodeId}
        order={modalState.order}
        onSave={modalHandlers.handleSaveChronological}
      />

      <DynamicPinnedModal
        isOpen={modalState.isOpen && modalState.modalType === 'dynamicpinned'}
        onClose={() => setModalState({ isOpen: false, modalType: 'dynamicpinned', nodeId: null, position: 0, apiEndpoint: '' })}
        nodeId={modalState.nodeId}
        position={modalState.position}
        apiEndpoint={modalState.apiEndpoint}
        name={modalState.name}
        onSave={modalHandlers.handleSaveDynamicPinned}
      />

      <PinnedPostsModal
        isOpen={modalState.isOpen && modalState.modalType === 'pinnedposts'}
        onClose={() => setModalState({ isOpen: false, modalType: 'pinnedposts', nodeId: null, items: [], name: '' })}
        nodeId={modalState.nodeId}
        items={modalState.items}
        name={modalState.name}
        onSave={modalHandlers.handleSavePinnedPosts}
      />

      <FeaturedPostModal
        isOpen={modalState.isOpen && modalState.modalType === 'featuredpost'}
        onClose={() => setModalState({ isOpen: false, modalType: 'featuredpost', nodeId: null, position: 1, apiEndpoint: '' })}
        nodeId={modalState.nodeId}
        position={modalState.position}
        apiEndpoint={modalState.apiEndpoint}
        name={modalState.name}
        onSave={modalHandlers.handleSaveFeaturedPost}
      />

      <FixedChronologicalModal
        isOpen={modalState.isOpen && modalState.modalType === 'fixedchronological'}
        onClose={() => setModalState({ isOpen: false, modalType: 'fixedchronological', nodeId: null, startPosition: undefined, endPosition: undefined, order: 'newest' })}
        nodeId={modalState.nodeId}
        startPosition={modalState.startPosition}
        endPosition={modalState.endPosition}
        order={modalState.order}
        name={modalState.name}
        onSave={modalHandlers.handleSaveFixedChronological}
      />

      <FixedByScoreModal
        isOpen={modalState.isOpen && modalState.modalType === 'fixedbyscore'}
        onClose={() => setModalState({ isOpen: false, modalType: 'fixedbyscore', nodeId: null, startPosition: undefined, endPosition: undefined })}
        nodeId={modalState.nodeId}
        startPosition={modalState.startPosition}
        endPosition={modalState.endPosition}
        name={modalState.name}
        onSave={modalHandlers.handleSaveFixedByScore}
      />

      <FixedByScoreModal
        isOpen={modalState.isOpen && modalState.modalType === 'fixedmostlikes'}
        onClose={() => setModalState({ isOpen: false, modalType: 'fixedmostlikes', nodeId: null, startPosition: undefined, endPosition: undefined })}
        nodeId={modalState.nodeId}
        startPosition={modalState.startPosition}
        endPosition={modalState.endPosition}
        name={modalState.name}
        onSave={modalHandlers.handleSaveFixedMostLikes}
      />

      <FixedByScoreModal
        isOpen={modalState.isOpen && modalState.modalType === 'fixedmostengagement'}
        onClose={() => setModalState({ isOpen: false, modalType: 'fixedmostengagement', nodeId: null, startPosition: undefined, endPosition: undefined })}
        nodeId={modalState.nodeId}
        startPosition={modalState.startPosition}
        endPosition={modalState.endPosition}
        name={modalState.name}
        onSave={modalHandlers.handleSaveFixedMostEngagement}
      />

      <FixedByScoreModal
        isOpen={modalState.isOpen && modalState.modalType === 'fixedrandom'}
        onClose={() => setModalState({ isOpen: false, modalType: 'fixedrandom', nodeId: null, startPosition: undefined, endPosition: undefined })}
        nodeId={modalState.nodeId}
        startPosition={modalState.startPosition}
        endPosition={modalState.endPosition}
        name={modalState.name}
        onSave={modalHandlers.handleSaveFixedRandom}
      />

      <EndFeedBindingModal
        isOpen={modalState.isOpen && modalState.modalType === 'endfeedbind'}
        nodeId={modalState.nodeId}
        currentFeedId={modalState.currentFeedId}
        availableFeeds={modalState.availableFeeds}
        onClose={() =>
          setModalState({
            isOpen: false,
            modalType: 'endfeedbind',
            nodeId: null,
            currentFeedId: '',
            availableFeeds: [],
          })
        }
        onSave={(nodeId, selectedFeedId) => {
          setNodes((nds) => {
            const selectedFeed = feedCatalog.find((f) => String(f.id) === String(selectedFeedId))
            return nds.map((n) =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      feedId: selectedFeedId || '',
                      name: selectedFeed?.name || n.data?.name || 'END',
                    },
                  }
                : n
            )
          })
          setModalState({
            isOpen: false,
            modalType: 'endfeedbind',
            nodeId: null,
            currentFeedId: '',
            availableFeeds: [],
          })
        }}
      />

      <FeedOutputsModal
        isOpen={feedOutputsModalOpen}
        projects={projects.map((p) => ({ id: String(p.id), name: p.name || 'Untitled project' }))}
        selectedProjectId={projectId}
        onSelectProject={handleSelectProject}
        onCreateProject={async (project) => {
          try {
            await handleCreateProject(project)
          } catch (error) {
            alert(`Failed to create project: ${error.message}`)
          }
        }}
        feeds={feedCatalog}
        bindings={feedBindings}
        onClose={() => setFeedOutputsModalOpen(false)}
        onCreateFeed={async (feed) => {
          if (feedCatalog.some((f) => f.slug.toLowerCase() === String(feed.slug || '').toLowerCase())) {
            alert(`Slug "${feed.slug}" already exists.`)
            return
          }
          try {
            if (projectId) {
              const created = await createProjectFeed(projectId, feed)
              setFeedCatalog((prev) => [...prev, normalizeFeedRecord(created)])
              return
            }
          } catch (error) {
            alert(`Failed to create feed: ${error.message}`)
            return
          }
          const id = `feed-${Date.now()}`
          setFeedCatalog((prev) => [
            ...prev,
            {
              id,
              name: feed.name,
              slug: feed.slug,
              description: feed.description || '',
              avatar: feed.avatar || '',
              published: false,
            },
          ])
        }}
        onEditFeed={async (feedId, patch) => {
          if (
            patch.slug &&
            feedCatalog.some(
              (f) => f.id !== feedId && String(f.slug || '').toLowerCase() === String(patch.slug).toLowerCase()
            )
          ) {
            alert(`Slug "${patch.slug}" already exists.`)
            return
          }
          try {
            await updateFeed(feedId, patch)
          } catch (error) {
            alert(`Failed to update feed: ${error.message}`)
            return
          }
          setFeedCatalog((prev) =>
            prev.map((f) => (f.id === feedId ? { ...f, ...patch } : f))
          )
        }}
        onTogglePublished={async (feedId) => {
          const current = feedCatalog.find((f) => f.id === feedId)
          const nextPublished = !current?.published
          try {
            if (nextPublished) {
              // Publishing: register via OAuth Agent (handles DPoP), then save URI to DB
              const session = await getOAuthSession?.()
              if (!session) throw new Error('OAuth session unavailable — sign in again')
              const sessionDid = session.did || session.sub || authDid
              if (!sessionDid) throw new Error('OAuth session missing DID — sign in again')
              const agent = new Agent(session)
              const feed = feedCatalog.find((f) => String(f.id) === String(feedId))
              const rkey = toAtprotoRkey(feed?.slug, feedId)
              const serviceDid = `did:web:${window.location.hostname.toLowerCase()}`
              const record = {
                $type: 'app.bsky.feed.generator',
                did: serviceDid,
                displayName: String(feed?.name || 'Feed').slice(0, 24),
                ...(feed?.description ? { description: String(feed.description).slice(0, 300) } : {}),
                createdAt: new Date().toISOString(),
                ...(isVideoFeedForFeed(feedId)
                  ? { contentMode: 'app.bsky.feed.defs#contentModeVideo' }
                  : {}),
              }
              const res = await agent.com.atproto.repo.putRecord({
                repo: sessionDid,
                collection: 'app.bsky.feed.generator',
                rkey,
                record,
              })
              const uri = res?.data?.uri || `at://${sessionDid}/app.bsky.feed.generator/${rkey}`
              await setFeedPublishedUri(feedId, uri)
            } else {
              // Unpublishing: just update the DB flag (no Bluesky API call needed)
              await setFeedPublished(feedId, false)
            }
          } catch (error) {
            alert(`Failed to change publish state: ${error.message}`)
            return
          }
          setFeedCatalog((prev) =>
            prev.map((f) =>
              f.id === feedId ? { ...f, published: nextPublished } : f
            )
          )
        }}
      />

      <TestPostModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        onTest={handleTestPost}
      />

      <DebugUrlModal
        isOpen={debugUrlModalOpen}
        onClose={() => setDebugUrlModalOpen(false)}
        onDebug={handleDebugByUrl}
      />

      {showDebugPanel && (
        <DebugResultsPanel
          results={evaluationResults}
          debugPost={debugPostSnapshot}
          nodes={debugGraphSnapshot?.nodes || []}
          edges={debugGraphSnapshot?.edges || []}
          onClose={handleHideDebugPanel}
          onClear={handleClearDebugPanel}
          onRerunDebug={lastDebugSource ? handleRerunDebug : undefined}
          rerunInProgress={rerunDebugInProgress}
          debugPins={debugPins}
          canPinCurrent={!!lastDebugSource}
          onPinCurrent={handlePinCurrentDebug}
          onRunPinned={handleRunPinnedDebug}
          onRemovePinned={handleRemovePinnedDebug}
          onOpenTestPost={handleOpenTestModal}
          onOpenDebugUrl={handleOpenDebugUrlModal}
          onNavigateToNode={handleNavigateToDebugNode}
        />
      )}

      {toast && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#ff6b6b',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 500,
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
})

Canvas.displayName = 'Canvas'

export default Canvas
