import React from 'react'
import { Handle, Position } from 'reactflow'
import { getFieldLabel } from '../constants/textFields'
import { getLanguageName } from '../constants/languages'
import { getConditionCostRank } from '../constants/evaluationCost'
import { 
  TextIcon, RegexIcon, LanguageIcon, PostTypeIcon, HashtagIcon, 
  LabelsIcon, PostDateIcon, AuthorIcon, MediaIcon, EngagementIcon, MentionsIcon, LinksIcon, ImageIcon, VideoIcon, PostStructureIcon 
} from '../components/Icons'
import './NodeStyles.css'

const COST_TIER_LABEL = { 1: 'low', 2: 'med', 3: 'high' }
const COST_TIER_CLASS = { 1: 'cost-tier-low', 2: 'cost-tier-med', 3: 'cost-tier-high' }

const CONDITION_LABELS = {
  text: 'Text Contains',
  language: 'Language',
  posttype: 'Post Type',
  engagement: 'Engagement',
  poststructure: 'Post Structure',
  author: 'Author',
  media: 'Media',
  image: 'Image',
  video: 'Video',
  mentions: 'Mentions',
  links: 'Links/URLs',
  quotepost: 'Quotes Post',
}

const getTextBlockLabel = (exclude) => {
  return exclude ? 'Text Excludes' : 'Text Contains'
}

const getRegexBlockLabel = (exclude) => {
  return exclude ? 'Regex Excludes' : 'Regex Contains'
}

const getLanguageBlockLabel = (exclude) => {
  return exclude ? 'Language Excludes' : 'Language Contains'
}

const getPostTypeBlockLabel = (exclude) => {
  return exclude ? 'Post Type Excludes' : 'Post Type Contains'
}

const getAuthorBlockLabel = (exclude) => {
  return exclude ? 'Author Excludes' : 'Author Contains'
}

const getMediaBlockLabel = (exclude) => {
  return exclude ? 'Media Type Excludes' : 'Media Type Contains'
}

const getHashtagBlockLabel = (exclude) => {
  return exclude ? 'Hashtag/Tags Excludes' : 'Hashtag/Tags Contains'
}

const getLabelsBlockLabel = (exclude) => {
  return exclude ? 'Labels Excludes' : 'Labels Contains'
}

const getPostDateBlockLabel = (exclude) => {
  return exclude ? 'Post Date Excludes' : 'Post Date'
}

const getMentionsBlockLabel = (exclude) => {
  return exclude ? 'Mentions Excludes' : 'Mentions Contains'
}

const getLinksBlockLabel = (exclude) => {
  return exclude ? 'Links Excludes' : 'Links Contains'
}

const getImageBlockLabel = (exclude) => {
  return exclude ? 'Image Excludes' : 'Image'
}

const getVideoBlockLabel = (exclude) => {
  return exclude ? 'Video Excludes' : 'Video'
}

const getBlockIcon = (type, exclude) => {
  const iconProps = { size: 16, className: 'block-icon' }
  switch (type) {
    case 'text':
      return <TextIcon {...iconProps} />
    case 'regex':
      return <RegexIcon {...iconProps} />
    case 'language':
      return <LanguageIcon {...iconProps} />
    case 'posttype':
      return <PostTypeIcon {...iconProps} />
    case 'hashtag':
      return <HashtagIcon {...iconProps} />
    case 'labels':
      return <LabelsIcon {...iconProps} />
    case 'dateage':
      return <PostDateIcon {...iconProps} />
    case 'author':
      return <AuthorIcon {...iconProps} />
    case 'media':
      return <MediaIcon {...iconProps} />
    case 'engagement':
      return <EngagementIcon {...iconProps} />
    case 'poststructure':
      return <PostStructureIcon {...iconProps} />
    case 'mentions':
      return <MentionsIcon {...iconProps} />
    case 'links':
      return <LinksIcon {...iconProps} />
    default:
      return null
  }
}

/**
 * Condition Node
 * 
 * Handles multiple condition types:
 * - text: Keyword matching (Aho-Corasick) with field selection
 * - language: Language matching from langs field (multiselect)
 * - posttype: Post type matching (post/reply/quote)
 * 
 * For text/language types: Clicking opens modal to configure
 */
function ConditionNode({ data, id, selected }) {
  const edges = data?.edges || []
  const logicModeTop = data?.logicModeTop || 'and'
  const logicModeBottom = data?.logicModeBottom || 'and'
  const logicModeLeft = data?.logicModeLeft || 'and'
  const logicModeRight = data?.logicModeRight || 'and'
  const hasTopLogic = edges.some(e => e.target === id && e.targetHandle?.includes('logic-top'))
  const hasBottomLogic = edges.some(e => e.target === id && e.targetHandle?.includes('logic-bottom'))
  const hasLeftLogic = edges.some(e => e.target === id && e.targetHandle?.includes('logic-left'))
  const hasRightLogic = edges.some(e => e.target === id && e.targetHandle?.includes('logic-right'))
  
  // Simple check if a handle is connected
  const isHandleConnected = (handleId, isSource) => {
    if (isSource) {
      return edges.some(e => e.source === id && e.sourceHandle === handleId)
    } else {
      return edges.some(e => e.target === id && e.targetHandle === handleId)
    }
  }
  const onDelete = data?.onDelete
  const type = id.split('-')[0]
  // Use the actual node type from React Flow, falling back to ID prefix
  const nodeType = data?._nodeType || type
  const isTextNode = type === 'text'
  const isRegexNode = type === 'regex'
  const isLanguageNode = type === 'language'
  const isPostTypeNode = type === 'posttype'
  const isAuthorNode = type === 'author'
  const isMediaNode = type === 'media'
  const isHashtagNode = type === 'hashtag'
  const isLabelsNode = type === 'labels'
  const isDateAgeNode = type === 'dateage'
  const isEngagementNode = type === 'engagement'
  const isPostStructureNode = type === 'poststructure'
  const isMentionsNode = type === 'mentions'
  const isLinksNode = type === 'links'
  const isImageNode = type === 'image'
  const isVideoNode = type === 'video'
  const isQuotePostNode = type === 'quotepost'
  const exclude = data?.exclude || false
  const label = isTextNode
    ? getTextBlockLabel(exclude)
    : isRegexNode
    ? getRegexBlockLabel(exclude)
    : isLanguageNode
    ? getLanguageBlockLabel(exclude)
    : isPostTypeNode
    ? getPostTypeBlockLabel(exclude)
    : isAuthorNode
    ? getAuthorBlockLabel(exclude)
    : isMediaNode
    ? getMediaBlockLabel(exclude)
    : isHashtagNode
    ? getHashtagBlockLabel(exclude)
    : isLabelsNode
    ? getLabelsBlockLabel(exclude)
    : isDateAgeNode
    ? getPostDateBlockLabel(exclude)
    : isMentionsNode
    ? getMentionsBlockLabel(exclude)
    : isLinksNode
    ? getLinksBlockLabel(exclude)
    : isImageNode
    ? getImageBlockLabel(exclude)
    : isVideoNode
    ? getVideoBlockLabel(exclude)
    : CONDITION_LABELS[type] || type
  const blockIcon = getBlockIcon(type, exclude)
  const evaluationResult = data?.evaluationResult
  const isOrphaned = data?.isOrphaned || false
  const costTier = getConditionCostRank(type)
  const costTierLabel = COST_TIER_LABEL[costTier]
  const costTierClass = COST_TIER_CLASS[costTier]
  const baseColor = (isTextNode || isRegexNode || isLanguageNode || isPostTypeNode || isAuthorNode || isMediaNode || isHashtagNode || isLabelsNode || isDateAgeNode || isMentionsNode || isLinksNode || isImageNode || isVideoNode || isQuotePostNode) && exclude ? '#ff6b6b' : '#6b7280'
  // Override color based on evaluation result
  const color = evaluationResult 
    ? (evaluationResult.passed ? '#51cf66' : '#ff6b6b') 
    : isOrphaned ? '#444' : baseColor

  // For text nodes, show keyword summary
  const keywords = (data?.keywords || [])
    .map((k) =>
      typeof k === 'string'
        ? { value: k, wholeWord: false }
        : { value: String(k?.value || ''), wholeWord: !!k?.wholeWord }
    )
    .filter((k) => k.value.trim())
  const subName = data?.name // Sub-name/label (e.g., "Urbanism Keywords")
  const fields = data?.fields || ['text'] // Selected fields to search
  const keywordCount = keywords.length
  const fieldCount = fields.length

  // For regex nodes
  const pattern = data?.pattern || ''
  const flags = data?.flags || ''

  // For language nodes
  const languages = data?.languages || []
  const languageCount = languages.length

  // For post type nodes
  const postTypes = data?.types || []
  const postTypeCount = postTypes.length
  const postTypeLabels = {
    post: 'Post',
    reply: 'Reply',
    quote: 'Quote',
  }

  // For author nodes
  const authors = data?.authors || []
  const authorListUris = data?.listUris || []
  const authorCount = authors.length
  const authorListCount = authorListUris.length

  // For links nodes
  const urls = data?.urls || []
  const urlCount = urls.length

  // For mentions nodes
  const mentions = data?.mentions || []
  const mentionListUris = data?.listUris || []
  const mentionCount = mentions.length
  const mentionListCount = mentionListUris.length

  // For media nodes
  const mediaTypes = data?.types || []
  const mediaTypeCount = mediaTypes.length
  const mediaTypeLabels = {
    images: '🖼️ Images',
    video: '🎥 Video',
    link: '🔗 Link',
    quote: '💬 Quote',
    quote_with_media: '💬🖼️ Quote+Media',
    none: '📝 No Media',
  }

  // For hashtag nodes
  const hashtags = data?.tags || []
  const hashtagCount = hashtags.length
  const fieldTypes = data?.fieldTypes || []

  // For labels nodes
  const labels = data?.labels || []
  const labelCount = labels.length

  // For post date nodes
  const dateMode = data?.mode || 'newer_than'
  const dateValue = data?.value || {}

  // For engagement nodes
  const metricType = data?.metricType || 'likes'
  const operator = data?.operator || 'greater_than'
  const threshold = data?.threshold || 0
  const operatorSymbols = {
    greater_than: '>',
    greater_equal: '≥',
    equal: '=',
    less_equal: '≤',
    less_than: '<',
  }
  const metricLabels = {
    likes: 'Likes',
    replies: 'Replies',
    reposts: 'Reposts',
    quotes: 'Quotes',
    bookmarks: 'Bookmarks',
  }

  // For post structure nodes
  const structureType = data?.structureType || 'is_reply'
  const structureOperator = data?.operator || 'equals'
  const structureDepth = data?.depth || 1
  const structureLabels = {
    is_reply: 'Is Reply',
    is_quote: 'Is Quote',
    has_quote: 'Has Quote',
    reply_depth: 'Reply Depth',
  }

  const isConfigurableNode = isTextNode || isRegexNode || isLanguageNode || isPostTypeNode || isAuthorNode || isMediaNode || isHashtagNode || isLabelsNode || isDateAgeNode || isEngagementNode || isPostStructureNode || isMentionsNode || isLinksNode || isImageNode || isVideoNode || isQuotePostNode

  const handleClick = (e) => {
    if (isConfigurableNode) {
      e.stopPropagation()
      // Trigger modal open - will be handled by parent
      if (data?.onConfigure) {
        data.onConfigure()
      }
    }
  }

  return (
    <div
      className={`node condition-node ${data?.costOrderWarning ? 'has-cost-order-warning' : ''} ${isConfigurableNode ? 'clickable' : ''} ${isOrphaned ? 'orphaned' : ''}`}
      style={{ borderColor: color }}
      onClick={isConfigurableNode ? handleClick : undefined}
      title={
        isTextNode
          ? 'Click to configure keywords (uses Aho-Corasick matching)'
          : isRegexNode
          ? 'Click to configure regex pattern (uses JavaScript RegExp)'
          : isLanguageNode
          ? 'Click to configure languages'
          : isPostTypeNode
          ? 'Click to configure post types'
          : isAuthorNode
          ? 'Click to configure authors and lists'
          : isMediaNode
          ? 'Click to configure media types'
          : isHashtagNode
          ? 'Click to configure hashtags/tags'
          : isLabelsNode
          ? 'Click to configure labels'
          : isDateAgeNode
          ? 'Click to configure post date filter'
          : isEngagementNode
          ? 'Click to configure engagement metrics'
          : isPostStructureNode
          ? 'Click to configure post structure'
          : isMentionsNode
          ? 'Click to configure mentions'
          : isLinksNode
          ? 'Click to configure links/URLs'
          : isQuotePostNode
          ? 'Click to configure quotes post filter'
          : undefined
      }
    >
      {data?.costOrderWarning && (
        <div className="cost-order-banner" role="alert">
          ⚠ Cost order: {data.costOrderWarning}
        </div>
      )}
      {/* All 4 ports are logic ports - show mode when connected */}
      <Handle 
        type="source" 
        position={Position.Left} 
        id="logic-left"
        style={{ top: '50%', left: '-10px', zIndex: 10, transform: 'translateY(-50%)' }}
        className={`handle-logic ${hasLeftLogic ? 'has-connection' : ''}`}
        isConnectable={true}
      >
        {hasLeftLogic && (
          <div className="port-mode-label" style={{ background: logicModeLeft === 'and' ? '#4a9eff' : logicModeLeft === 'or' ? '#ff9500' : '#9b59b6' }}>
            {logicModeLeft === 'nof' ? (
              <>
                <button className="port-nof-btn" onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN('left', Math.max(1, (data?.logicNLeft || 2) - 1)) }}>-</button>
                <span className="port-nof-value" onClick={(e) => { e.stopPropagation(); if (data?.onToggleLogicMode) data.onToggleLogicMode('left') }}>{data?.logicNLeft || 2}-OF</span>
                <button className="port-nof-btn" onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN('left', (data?.logicNLeft || 2) + 1) }}>+</button>
              </>
            ) : (
              <span onClick={(e) => { e.stopPropagation(); if (data?.onToggleLogicMode) data.onToggleLogicMode('left') }}>
                {logicModeLeft === 'and' ? 'AND' : 'OR'}
              </span>
            )}
          </div>
        )}
      </Handle>
      <Handle 
        type="source" 
        position={Position.Right} 
        id="logic-right"
        style={{ top: '50%', right: '-10px', zIndex: 10, transform: 'translateY(-50%)' }}
        className={`handle-logic ${hasRightLogic ? 'has-connection' : ''}`}
        isConnectable={true}
      >
        {hasRightLogic && (
          <div className="port-mode-label" style={{ background: logicModeRight === 'and' ? '#4a9eff' : logicModeRight === 'or' ? '#ff9500' : '#9b59b6' }}>
            {logicModeRight === 'nof' ? (
              <>
                <button className="port-nof-btn" onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN('right', Math.max(1, (data?.logicNRight || 2) - 1)) }}>-</button>
                <span className="port-nof-value" onClick={(e) => { e.stopPropagation(); if (data?.onToggleLogicMode) data.onToggleLogicMode('right') }}>{data?.logicNRight || 2}-OF</span>
                <button className="port-nof-btn" onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN('right', (data?.logicNRight || 2) + 1) }}>+</button>
              </>
            ) : (
              <span onClick={(e) => { e.stopPropagation(); if (data?.onToggleLogicMode) data.onToggleLogicMode('right') }}>
                {logicModeRight === 'and' ? 'AND' : 'OR'}
              </span>
            )}
          </div>
        )}
      </Handle>
      <Handle 
        type="source" 
        position={Position.Top} 
        id="logic-top"
        style={{ top: '-10px', left: '50%', zIndex: 10, transform: 'translateX(-50%)' }}
        className={`handle-logic ${hasTopLogic ? 'has-connection' : ''}`}
        isConnectable={true}
      >
        {hasTopLogic && (
          <div className="port-mode-label" style={{ background: logicModeTop === 'and' ? '#4a9eff' : logicModeTop === 'or' ? '#ff9500' : '#9b59b6' }}>
            {logicModeTop === 'nof' ? (
              <>
                <button className="port-nof-btn" onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN('top', Math.max(1, (data?.logicNTop || 2) - 1)) }}>-</button>
                <span className="port-nof-value" onClick={(e) => { e.stopPropagation(); if (data?.onToggleLogicMode) data.onToggleLogicMode('top') }}>{data?.logicNTop || 2}-OF</span>
                <button className="port-nof-btn" onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN('top', (data?.logicNTop || 2) + 1) }}>+</button>
              </>
            ) : (
              <span onClick={(e) => { e.stopPropagation(); if (data?.onToggleLogicMode) data.onToggleLogicMode('top') }}>
                {logicModeTop === 'and' ? 'AND' : 'OR'}
              </span>
            )}
          </div>
        )}
      </Handle>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="logic-bottom"
        style={{ bottom: '-10px', left: '50%', zIndex: 10, transform: 'translateX(-50%)' }}
        className={`handle-logic ${hasBottomLogic ? 'has-connection' : ''}`}
        isConnectable={true}
      >
        {hasBottomLogic && (
          <div className="port-mode-label" style={{ background: logicModeBottom === 'and' ? '#4a9eff' : logicModeBottom === 'or' ? '#ff9500' : '#9b59b6' }}>
            {logicModeBottom === 'nof' ? (
              <>
                <button className="port-nof-btn" onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN('bottom', Math.max(1, (data?.logicNBottom || 2) - 1)) }}>-</button>
                <span className="port-nof-value" onClick={(e) => { e.stopPropagation(); if (data?.onToggleLogicMode) data.onToggleLogicMode('bottom') }}>{data?.logicNBottom || 2}-OF</span>
                <button className="port-nof-btn" onClick={(e) => { e.stopPropagation(); if (data?.onSetN) data.onSetN('bottom', (data?.logicNBottom || 2) + 1) }}>+</button>
              </>
            ) : (
              <span onClick={(e) => { e.stopPropagation(); if (data?.onToggleLogicMode) data.onToggleLogicMode('bottom') }}>
                {logicModeBottom === 'and' ? 'AND' : 'OR'}
              </span>
            )}
          </div>
        )}
      </Handle>

      <div className="node-label">
        {Number.isFinite(data?.ingestionRunOrder) && (
          <span className="ingestion-order-badge" title="Ingestion execution order">
            #{data.ingestionRunOrder}
          </span>
        )}
        {blockIcon && <span className="node-icon-wrapper">{blockIcon}</span>}
        {label}
        {costTierLabel && (
          <span className={`cost-tier-badge ${costTierClass}`} title={`Evaluation cost: ${costTierLabel}`}>
            {costTierLabel}
          </span>
        )}
        {evaluationResult && (
          <span
            className={`evaluation-badge ${evaluationResult.passed ? 'eval-pass' : 'eval-fail'}`}
            title={evaluationResult.reason}
          >
            {evaluationResult.passed ? 'PASS' : 'FAIL'}
          </span>
        )}
      </div>
      {isConfigurableNode && subName && (
        <div className="node-subname">{subName}</div>
      )}
      {isTextNode && keywordCount > 0 && (
        <div className="node-subtitle">
          {keywordCount} {keywordCount === 1 ? 'keyword' : 'keywords'}
        </div>
      )}
      {isTextNode && keywordCount > 0 && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: '#8fa8ff' }}>
          {keywords
            .slice(0, 2)
            .map((k) => `${k.value}${k.wholeWord ? ' (word)' : ''}`)
            .join(', ')}
          {keywordCount > 2 ? '…' : ''}
        </div>
      )}
      {isTextNode && fieldCount > 0 && (
        <div className="node-subtitle" style={{ fontSize: '9px', color: '#666' }}>
          {fieldCount === 1 
            ? getFieldLabel(fields[0])
            : `${fieldCount} fields`}
        </div>
      )}
      {isTextNode && data?.scoreModifier !== undefined && data?.scoreModifier !== 0 && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: data.scoreModifier > 0 ? '#4a9eff' : '#ff6b6b', fontWeight: 600 }}>
          {data.scoreModifier > 0 ? '+' : ''}{data.scoreModifier} score
        </div>
      )}
      {isRegexNode && pattern && (
        <div className="node-subtitle" style={{ fontSize: '10px', fontFamily: 'monospace' }}>
          {pattern.length > 30 ? `${pattern.substring(0, 30)}...` : pattern}
        </div>
      )}
      {isRegexNode && fieldCount > 0 && (
        <div className="node-subtitle" style={{ fontSize: '9px', color: '#666' }}>
          {fieldCount === 1 
            ? getFieldLabel(fields[0])
            : `${fieldCount} fields`}
        </div>
      )}
      {isRegexNode && data?.scoreModifier !== undefined && data?.scoreModifier !== 0 && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: data.scoreModifier > 0 ? '#4a9eff' : '#ff6b6b', fontWeight: 600 }}>
          {data.scoreModifier > 0 ? '+' : ''}{data.scoreModifier} score
        </div>
      )}
      {isLanguageNode && languageCount > 0 && (
        <div className="node-subtitle">
          {languageCount === 1
            ? getLanguageName(languages[0])
            : `${languageCount} languages`}
        </div>
      )}
      {isLanguageNode && data?.scoreModifier !== undefined && data?.scoreModifier !== 0 && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: data.scoreModifier > 0 ? '#4a9eff' : '#ff6b6b', fontWeight: 600 }}>
          {data.scoreModifier > 0 ? '+' : ''}{data.scoreModifier} score
        </div>
      )}
      {isPostTypeNode && (
        <>
          {postTypeCount > 0 && (
            <div className="node-subtitle">
              {postTypeCount === 1
                ? postTypeLabels[postTypes[0]]
                : `${postTypeCount} types`}
            </div>
          )}
          {data?.replyDepthEnabled && (
            <div className="node-subtitle" style={{ fontSize: '10px', color: '#888' }}>
              Depth {data?.replyDepthOperator === 'equals' ? '=' : data?.replyDepthOperator === 'greater_than' ? '>' : data?.replyDepthOperator === 'greater_equal' ? '≥' : data?.replyDepthOperator === 'less_than' ? '<' : '≤'} {data?.replyDepth || 1}
            </div>
          )}
          {data?.postTypeScores && (
            <div className="node-subtitle" style={{ fontSize: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              {Object.entries(data.postTypeScores).map(([type, score]) => {
                if (score === 0) return null
                return (
                  <span key={type} style={{ color: score > 0 ? '#4a9eff' : '#ff6b6b', fontWeight: 600 }}>
                    {postTypeLabels[type]}: {score > 0 ? '+' : ''}{score}
                  </span>
                )
              })}
            </div>
          )}
        </>
      )}
      {isAuthorNode && (authorCount > 0 || authorListCount > 0) && (
        <div className="node-subtitle">
          {authorCount > 0 && authorListCount > 0
            ? `${authorCount} author${authorCount !== 1 ? 's' : ''}, ${authorListCount} list${authorListCount !== 1 ? 's' : ''}`
            : authorCount > 0
            ? `${authorCount} author${authorCount !== 1 ? 's' : ''}`
            : `${authorListCount} list${authorListCount !== 1 ? 's' : ''}`}
        </div>
      )}
      {isAuthorNode && data?.scoreModifier !== undefined && data?.scoreModifier !== 0 && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: data.scoreModifier > 0 ? '#4a9eff' : '#ff6b6b', fontWeight: 600 }}>
          {data.scoreModifier > 0 ? '+' : ''}{data.scoreModifier} score
        </div>
      )}
      {isMentionsNode && (mentionCount > 0 || mentionListCount > 0) && (
        <div className="node-subtitle">
          {mentionCount > 0 && mentionListCount > 0
            ? `${mentionCount} mention${mentionCount !== 1 ? 's' : ''}, ${mentionListCount} list${mentionListCount !== 1 ? 's' : ''}`
            : mentionCount > 0
            ? (mentionCount === 1 ? mentions[0] : `${mentionCount} mentions`)
            : `${mentionListCount} list${mentionListCount !== 1 ? 's' : ''}`}
        </div>
      )}
      {isMentionsNode && data?.scoreModifier !== undefined && data?.scoreModifier !== 0 && (
        <div className={`node-score-modifier ${data.scoreModifier > 0 ? 'positive' : 'negative'}`}>
          {data.scoreModifier > 0 ? '+' : ''}{data.scoreModifier} score
        </div>
      )}
      {isLinksNode && urlCount > 0 && (
        <div className="node-subtitle">
          {urlCount === 1
            ? urls[0].replace(/^https?:\/\//, '') // Remove protocol for display
            : `${urlCount} URLs`}
        </div>
      )}
      {isLinksNode && data?.scoreModifier !== undefined && data?.scoreModifier !== 0 && (
        <div className={`node-score-modifier ${data.scoreModifier > 0 ? 'positive' : 'negative'}`}>
          {data.scoreModifier > 0 ? '+' : ''}{data.scoreModifier} score
        </div>
      )}
      {isMediaNode && mediaTypeCount > 0 && (
        <div className="node-subtitle">
          {mediaTypeCount === 1
            ? mediaTypeLabels[mediaTypes[0]] || mediaTypes[0]
            : `${mediaTypeCount} types`}
        </div>
      )}
      {isMediaNode && data?.mediaTypeScores && (
        <div className="node-subtitle" style={{ fontSize: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
          {Object.entries(data.mediaTypeScores).map(([type, score]) => {
            if (score === 0) return null
            const typeLabel = mediaTypeLabels[type] || type
            return (
              <span key={type} style={{ color: score > 0 ? '#4a9eff' : '#ff6b6b', fontWeight: 600 }}>
                {typeLabel}: {score > 0 ? '+' : ''}{score}
              </span>
            )
          })}
        </div>
      )}
      {isHashtagNode && hashtagCount > 0 && (
        <div className="node-subtitle">
          {hashtagCount === 1
            ? hashtags[0]
            : `${hashtagCount} tags`}
        </div>
      )}
      {isHashtagNode && data?.scoreModifier !== undefined && data?.scoreModifier !== 0 && (
        <div className={`node-score-modifier ${data.scoreModifier > 0 ? 'positive' : 'negative'}`}>
          {data.scoreModifier > 0 ? '+' : ''}{data.scoreModifier} score
        </div>
      )}
      {isLabelsNode && labelCount > 0 && (
        <div className="node-subtitle">
          {labelCount === 1
            ? labels[0]
            : `${labelCount} labels`}
        </div>
      )}
      {isLabelsNode && data?.scoreModifier !== undefined && data?.scoreModifier !== 0 && (
        <div className={`node-score-modifier ${data.scoreModifier > 0 ? 'positive' : 'negative'}`}>
          {data.scoreModifier > 0 ? '+' : ''}{data.scoreModifier} score
        </div>
      )}
      {isDateAgeNode && dateMode && (
        <div className="node-subtitle">
          {dateMode === 'newer_than'
            ? `Newer than ${dateValue.amount || 24} ${dateValue.unit || 'hours'}`
            : dateMode === 'older_than'
            ? `Older than ${dateValue.amount || 24} ${dateValue.unit || 'hours'}`
            : dateMode === 'between_times'
            ? `${dateValue.start || '21:00'}-${dateValue.end || '12:00'} ${dateValue.timezone || 'PST'}`
            : 'Post Date'}
        </div>
      )}
      {isDateAgeNode && data?.scoreModifier !== undefined && data?.scoreModifier !== 0 && (
        <div className="node-subtitle" style={{ fontSize: '10px', color: data.scoreModifier > 0 ? '#4a9eff' : '#ff6b6b', fontWeight: 600 }}>
          {data.scoreModifier > 0 ? '+' : ''}{data.scoreModifier} score
        </div>
      )}
      {isImageNode && data?.scoreModifier !== undefined && data?.scoreModifier !== 0 && (
        <div className={`node-score-modifier ${data.scoreModifier > 0 ? 'positive' : 'negative'}`}>
          {data.scoreModifier > 0 ? '+' : ''}{data.scoreModifier} score
        </div>
      )}
      {isVideoNode && data?.scoreModifier !== undefined && data?.scoreModifier !== 0 && (
        <div className={`node-score-modifier ${data.scoreModifier > 0 ? 'positive' : 'negative'}`}>
          {data.scoreModifier > 0 ? '+' : ''}{data.scoreModifier} score
        </div>
      )}
      {isEngagementNode && (
        <div className="node-subtitle">
          {metricLabels[metricType] || metricType} {operatorSymbols[operator] || '>'} {threshold}
        </div>
      )}
      {isEngagementNode && data?.scoreModifier !== undefined && data?.scoreModifier !== 0 && (
        <div className={`node-score-modifier ${data.scoreModifier > 0 ? 'positive' : 'negative'}`}>
          {data.scoreModifier > 0 ? '+' : ''}{data.scoreModifier} score
        </div>
      )}
      {isPostStructureNode && (
        <div className="node-subtitle">
          {structureType === 'reply_depth'
            ? `${structureLabels[structureType]} ${operatorSymbols[structureOperator] || '='} ${structureDepth}`
            : structureLabels[structureType]}
        </div>
      )}
      {(isTextNode && keywordCount === 0) || 
       (isRegexNode && !pattern) ||
       (isLanguageNode && languageCount === 0) || 
       (isPostTypeNode && postTypeCount === 0) ||
       (isAuthorNode && authorCount === 0 && authorListCount === 0) ||
       (isMediaNode && mediaTypeCount === 0) ||
       (isHashtagNode && hashtagCount === 0) ||
       (isLabelsNode && labelCount === 0) ||
       (isDateAgeNode && !dateMode) ||
       (isMentionsNode && mentionCount === 0 && mentionListCount === 0) ||
       (isImageNode && !data?.imageCount && !data?.minWidth && !data?.maxWidth && !data?.minHeight && !data?.maxHeight && !data?.aspectRatio && !data?.minFileSize && !data?.maxFileSize) ||
       (isVideoNode && !data?.minWidth && !data?.maxWidth && !data?.minHeight && !data?.maxHeight && !data?.aspectRatio && !data?.minFileSize && !data?.maxFileSize && !data?.presentation) ? (
        <div className="node-subtitle" style={{ color: '#888', fontStyle: 'italic' }}>
          Click to configure
        </div>
      ) : null}
    </div>
  )
}

export default ConditionNode
