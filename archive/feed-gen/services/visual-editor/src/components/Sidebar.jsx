import React, { useState } from 'react'
import { 
  TextIcon, RegexIcon, LanguageIcon, PostTypeIcon, HashtagIcon, 
  LabelsIcon, PostDateIcon, AuthorIcon, MediaIcon, EngagementIcon, MentionsIcon, LinksIcon, ImageIcon, VideoIcon, VideoFeedIcon, PlusIcon,
  RecencyIcon, ScoreIcon, CustomScoreIcon, RotatingPostsIcon,
  ChronologicalIcon, ByScoreIcon, MostLikesIcon, MostEngagementIcon, RandomIcon,
  DynamicPinnedIcon, FeaturedPostIcon, WhitelistIcon, EndIcon,
} from './Icons'
import { useHistory } from '../contexts/HistoryContext'
import { useNavigation } from '../contexts/NavigationContext'
import './Sidebar.css'

// GROUPING OPTIONS BASED ON METADATA STRUCTURE:
//
// OPTION 1: By Field Path (matches metadata hierarchy)
//   - Root Fields: text, regex, language, posttype, author, dateage
//   - Embeds: media, links
//   - Facets: mentions, hashtag
//   - Labels: labels
//   - Metrics: engagement
//
// OPTION 2: By Data Type
//   - Text: text, regex, language
//   - Structure: posttype, author, dateage
//   - Embeds: media, links
//   - Annotations: mentions, hashtag, labels
//   - Metrics: engagement
//
// OPTION 3: By What They Check
//   - Content: text, regex, language
//   - Post Info: posttype, author, dateage
//   - Embedded Content: media, links
//   - Social Features: mentions, hashtag, labels
//   - Engagement: engagement
//
// OPTION 4: By Top-Level Field
//   - Core: text, regex, language, dateage
//   - Author: author
//   - Structure: posttype
//   - Embeds: media, links
//   - Facets: mentions, hashtag
//   - Labels: labels
//   - Metrics: engagement

const NODE_TYPES = {
  sources: [
    { id: 'manualposts', name: 'Manual Posts', icon: <PlusIcon /> },
  ],
  logic: [
    { id: 'logicbox', name: 'Logic (AND / OR / N-of)', icon: '⎕' },
    { id: 'logicgroup', name: 'Group (nested view)', icon: '▣' },
    { id: 'junction', name: 'Junction', icon: '◆' },
    { id: 'end', name: 'Feed output (END)', icon: <EndIcon size={18} /> },
    { id: 'videofeed', name: 'Video Feed', icon: <VideoFeedIcon /> },
  ],
  // Text/Regex search multiple fields (text, embed.images[*].alt, embed.external.*, etc.)
  // So they're in their own category
  conditions: {
    textSearch: [
      { id: 'text', name: 'Text Contains', icon: <TextIcon /> },
      { id: 'regex', name: 'Regex Contains', icon: <RegexIcon /> },
    ],
    list: [
      { id: 'author', name: 'Author', icon: <AuthorIcon /> },
    ],
    postInfo: [
      { id: 'language', name: 'Language', icon: <LanguageIcon /> },
      { id: 'posttype', name: 'Post Type', icon: <PostTypeIcon /> },
      { id: 'dateage', name: 'Post Date', icon: <PostDateIcon /> },
    ],
    embeddedContent: [
      { id: 'media', name: 'Media Type', icon: <MediaIcon /> },
      { id: 'image', name: 'Image', icon: <ImageIcon /> },
      { id: 'video', name: 'Video', icon: <VideoIcon /> },
      { id: 'links', name: 'Links/URLs', icon: <LinksIcon /> },
      { id: 'quotepost', name: 'Quotes Post', icon: '💬' },
    ],
    socialFeatures: [
      { id: 'mentions', name: 'Mentions', icon: <MentionsIcon /> },
      { id: 'hashtag', name: 'Hashtag/Tags', icon: <HashtagIcon /> },
      { id: 'labels', name: 'Labels', icon: <LabelsIcon /> },
    ],
    metrics: [
      { id: 'engagement', name: 'Engagement', icon: <EngagementIcon /> },
    ],
  },
  scoring: [
    { id: 'recency', name: 'Recency Modifier', icon: <RecencyIcon /> },
    { id: 'engagementscore', name: 'Engagement Score', icon: <ScoreIcon /> },
    { id: 'customscore', name: 'Custom Score', icon: <CustomScoreIcon /> },
  ],
  injection: [
    { id: 'rotatingposts', name: 'Rotating Posts', icon: <RotatingPostsIcon /> },
    { id: 'feedads', name: 'Ads', icon: <RotatingPostsIcon /> },
  ],
  fixed_position: [
    { id: 'pinnedposts', name: 'Pinned Posts', icon: <DynamicPinnedIcon /> },
    { id: 'dynamicpinned', name: 'Dynamic Pinned', icon: <DynamicPinnedIcon /> },
    { id: 'featuredpost', name: 'Featured Post', icon: <FeaturedPostIcon /> },
    { id: 'fixedchronological', name: 'Fixed Chronological', icon: <ChronologicalIcon /> },
    { id: 'fixedbyscore', name: 'Fixed By Score', icon: <ByScoreIcon /> },
    { id: 'fixedmostlikes', name: 'Fixed Most Likes', icon: <MostLikesIcon /> },
    { id: 'fixedmostengagement', name: 'Fixed Most Engagement', icon: <MostEngagementIcon /> },
    { id: 'fixedrandom', name: 'Fixed Random', icon: <RandomIcon /> },
  ],
  sorting: [
    { id: 'chronological', name: 'Chronological', icon: <ChronologicalIcon /> },
    { id: 'byscore', name: 'By Score', icon: <ByScoreIcon /> },
    { id: 'mostlikes', name: 'Most Likes', icon: <MostLikesIcon /> },
    { id: 'mostengagement', name: 'Most Engagement', icon: <MostEngagementIcon /> },
    { id: 'random', name: 'Random', icon: <RandomIcon /> },
  ],
  access: [{ id: 'whitelist', name: 'Whitelist', icon: <WhitelistIcon /> }],
}

function Sidebar({ debugPanelOpen = false, debugHasResults = false, onToggleDebugPanel }) {
  const [activeTab, setActiveTab] = useState('main') // 'main', 'sources', 'scoring', 'fixed_position', 'sorting', 'injection', 'access'
  const history = useHistory()
  const { path, currentContainer } = useNavigation()
  const endPipelineView = path.length > 0 && path[path.length - 1].view === 'end'
  const sortingAllowedHere = endPipelineView
  const feedEndBlockedInNested = Boolean(currentContainer) && !endPipelineView

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="sidebar">
      <div className="sidebar-container">
        {/* Vertical Tab Navigation */}
        <div className="sidebar-tabs-vertical">
          <button
            className={`sidebar-tab-vertical ${activeTab === 'main' ? 'active' : ''}`}
            onClick={() => setActiveTab('main')}
            title="Logic and conditions"
          >
            Main
          </button>
          <button
            className={`sidebar-tab-vertical ${activeTab === 'sources' ? 'active' : ''}`}
            onClick={() => setActiveTab('sources')}
            title="Source nodes"
          >
            Sources
          </button>
          <button
            className={`sidebar-tab-vertical ${activeTab === 'scoring' ? 'active' : ''}`}
            onClick={() => setActiveTab('scoring')}
            title="Scoring modules"
          >
            Scoring
          </button>
          <button
            className={`sidebar-tab-vertical ${activeTab === 'fixed_position' ? 'active' : ''}`}
            onClick={() => setActiveTab('fixed_position')}
            title="Fixed position modules"
          >
            Fixed
          </button>
          <button
            className={`sidebar-tab-vertical ${activeTab === 'sorting' ? 'active' : ''}`}
            onClick={() => setActiveTab('sorting')}
            title="Sorting modules"
          >
            Sorting
          </button>
          <button
            className={`sidebar-tab-vertical ${activeTab === 'injection' ? 'active' : ''}`}
            onClick={() => setActiveTab('injection')}
            title="Injection modules"
          >
            Injection
          </button>
          <button
            className={`sidebar-tab-vertical ${activeTab === 'access' ? 'active' : ''}`}
            onClick={() => setActiveTab('access')}
            title="Feed access / membership"
          >
            Access
          </button>
          
          {/* Debug button — above the action group, not part of it */}
          <div className="sidebar-debug-wrapper">
            <button
              type="button"
              className={`sidebar-action-btn sidebar-action-btn--debug${debugPanelOpen ? ' sidebar-action-btn--debug-active' : ''}`}
              onClick={onToggleDebugPanel}
              title={debugPanelOpen ? 'Hide debug panel' : 'Open debug (pins, test post, URL)'}
            >
              ◎ {debugPanelOpen ? 'Hide Debug' : debugHasResults ? 'Show Debug' : 'Debug'}
            </button>
          </div>

          {/* Action Buttons at Bottom */}
          <div className="sidebar-actions">
            <button
              className="sidebar-action-btn"
              onClick={history.handleUndo}
              disabled={!history.canUndo}
              title="Undo (Ctrl+Z)"
            >
              ↶ Undo
            </button>
            <button
              className="sidebar-action-btn"
              onClick={history.handleRedo}
              disabled={!history.canRedo}
              title="Redo (Ctrl+Y)"
            >
              ↷ Redo
            </button>
            <button
              className="sidebar-action-btn"
              onClick={history.handleZoomToFit}
              title="Zoom to fit"
            >
              ⊞ Fit
            </button>
            <button
              className="sidebar-action-btn"
              onClick={history.handleCenterView}
              title="Center view"
            >
              ⊙ Center
            </button>
            <button
              className="sidebar-action-btn sidebar-action-btn-danger"
              onClick={history.handleClear}
              title="Clear canvas"
            >
              ✕ Clear
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="sidebar-content-wrapper">
          {/* Main Tab Content */}
          {activeTab === 'main' && (
            <div className="sidebar-content">
          <div className="sidebar-section">
            <h3>Logic</h3>
            <p className="sidebar-hint">
              Use <strong>Logic (AND / OR / N-of)</strong> for on-canvas boxes — drag filters inside. Use <strong>Group</strong> for a separate nested canvas (organize). Orange wires between filters still respect the same parent box or root.
            </p>
        {NODE_TYPES.logic.map((node) => {
          const endDragBlocked = node.id === 'end' && feedEndBlockedInNested
          return (
            <div
              key={node.id}
              className={`sidebar-node-item${endDragBlocked ? ' sidebar-node-item-disabled' : ''}`}
              draggable={!endDragBlocked}
              onDragStart={!endDragBlocked ? (e) => onDragStart(e, node.id) : undefined}
              title={
                endDragBlocked
                  ? 'END is only for the main canvas. Inside a group, use OUT for the subgraph exit.'
                  : undefined
              }
            >
              <span className="node-icon">{node.icon}</span>
              <span>{node.name}</span>
            </div>
          )
        })}
      </div>

      <div className="sidebar-section">
        <h3>Conditions</h3>
        
        <div className="sidebar-subsection">
          <h4>Text Search</h4>
          {NODE_TYPES.conditions.textSearch.map((node) => (
            <div
              key={node.id}
              className="sidebar-node-item"
              draggable
              onDragStart={(e) => onDragStart(e, node.id)}
            >
              <span className="node-icon">{typeof node.icon === 'string' ? node.icon : node.icon}</span>
              <span>{node.name}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-subsection">
          <h4>List</h4>
          {NODE_TYPES.conditions.list.map((node) => (
            <div
              key={node.id}
              className="sidebar-node-item"
              draggable
              onDragStart={(e) => onDragStart(e, node.id)}
            >
              <span className="node-icon">{typeof node.icon === 'string' ? node.icon : node.icon}</span>
              <span>{node.name}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-subsection">
          <h4>Post Info</h4>
          {NODE_TYPES.conditions.postInfo.map((node) => (
            <div
              key={node.id}
              className="sidebar-node-item"
              draggable
              onDragStart={(e) => onDragStart(e, node.id)}
            >
              <span className="node-icon">{typeof node.icon === 'string' ? node.icon : node.icon}</span>
              <span>{node.name}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-subsection">
          <h4>Embedded Content</h4>
          {NODE_TYPES.conditions.embeddedContent.map((node) => (
            <div
              key={node.id}
              className="sidebar-node-item"
              draggable
              onDragStart={(e) => onDragStart(e, node.id)}
            >
              <span className="node-icon">{typeof node.icon === 'string' ? node.icon : node.icon}</span>
              <span>{node.name}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-subsection">
          <h4>Social Features</h4>
          {NODE_TYPES.conditions.socialFeatures.map((node) => (
            <div
              key={node.id}
              className="sidebar-node-item"
              draggable
              onDragStart={(e) => onDragStart(e, node.id)}
            >
              <span className="node-icon">{typeof node.icon === 'string' ? node.icon : node.icon}</span>
              <span>{node.name}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-subsection">
          <h4>Metrics</h4>
          {NODE_TYPES.conditions.metrics.map((node) => (
            <div
              key={node.id}
              className="sidebar-node-item"
              draggable
              onDragStart={(e) => onDragStart(e, node.id)}
            >
              <span className="node-icon">{typeof node.icon === 'string' ? node.icon : node.icon}</span>
              <span>{node.name}</span>
            </div>
          ))}
        </div>
      </div>
          </div>
          )}

          {/* Sources Tab Content */}
          {activeTab === 'sources' && (
            <div className="sidebar-content">
              <div className="sidebar-section">
                <h3>Sources</h3>
                {NODE_TYPES.sources.map((node) => {
                  const disabled = node.id === 'manualposts'
                  return (
                  <div
                    key={node.id}
                    className={`sidebar-node-item${disabled ? ' sidebar-node-item-disabled' : ''}`}
                    draggable={!disabled}
                    onDragStart={!disabled ? (e) => onDragStart(e, node.id) : undefined}
                    title={disabled ? 'Manual Posts is temporarily disabled' : undefined}
                  >
                    <span className="node-icon">{typeof node.icon === 'string' ? node.icon : node.icon}</span>
                    <span>{node.name}</span>
                  </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Scoring Tab Content */}
          {activeTab === 'scoring' && (
            <div className="sidebar-content">
          <div className="sidebar-section">
            <h3>Scoring Modules</h3>
            {NODE_TYPES.scoring.map((node) => (
              <div
                key={node.id}
                className="sidebar-node-item"
                draggable
                onDragStart={(e) => onDragStart(e, node.id)}
              >
                <span className="node-icon">{typeof node.icon === 'string' ? node.icon : node.icon}</span>
                <span>{node.name}</span>
              </div>
            ))}
          </div>
          </div>
          )}

          {/* Fixed Position Tab Content */}
          {activeTab === 'fixed_position' && (
            <div className="sidebar-content">
              <div className="sidebar-section">
                <h3>Fixed Position Modules</h3>
                {!sortingAllowedHere && (
                  <p className="sidebar-hint">
                    Open the <strong>END</strong> pipeline (double-click END), then drag fixed-slot modules into the fixed column.
                  </p>
                )}
                {NODE_TYPES.fixed_position.map((node) => (
                  <div
                    key={node.id}
                    className={`sidebar-node-item${!sortingAllowedHere ? ' sidebar-node-item-disabled' : ''}`}
                    draggable={sortingAllowedHere}
                    onDragStart={sortingAllowedHere ? (e) => onDragStart(e, node.id) : undefined}
                    title={
                      sortingAllowedHere
                        ? undefined
                        : 'Double-click END on the main graph to open the pipeline canvas'
                    }
                  >
                    <span className="node-icon">{typeof node.icon === 'string' ? node.icon : node.icon}</span>
                    <span>{node.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sorting Tab Content — only droppable inside END pipeline (double-click END) */}
          {activeTab === 'sorting' && (
            <div className="sidebar-content">
              <div className="sidebar-section">
                <h3>Sorting Modules</h3>
                {!sortingAllowedHere && (
                  <p className="sidebar-hint">
                    Open the <strong>END</strong> pipeline (double-click the END node), then drag one sorting module into the canvas. Only one plain sorting module applies per END.
                  </p>
                )}
                {NODE_TYPES.sorting.map((node) => (
                  <div
                    key={node.id}
                    className={`sidebar-node-item${!sortingAllowedHere ? ' sidebar-node-item-disabled' : ''}`}
                    draggable={sortingAllowedHere}
                    onDragStart={sortingAllowedHere ? (e) => onDragStart(e, node.id) : undefined}
                    title={
                      sortingAllowedHere
                        ? undefined
                        : 'Double-click END on the main graph to open the pipeline canvas'
                    }
                  >
                    <span className="node-icon">{typeof node.icon === 'string' ? node.icon : node.icon}</span>
                    <span>{node.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Injection Tab Content */}
          {activeTab === 'injection' && (
            <div className="sidebar-content">
              <div className="sidebar-section">
                <h3>Injection Modules</h3>
                {!sortingAllowedHere && (
                  <p className="sidebar-hint">
                    Open the <strong>END</strong> pipeline (double-click END), then drag Rotating Posts or Ads into an injection slot.
                  </p>
                )}
                {NODE_TYPES.injection.map((node) => (
                  <div
                    key={node.id}
                    className={`sidebar-node-item${!sortingAllowedHere ? ' sidebar-node-item-disabled' : ''}`}
                    draggable={sortingAllowedHere}
                    onDragStart={sortingAllowedHere ? (e) => onDragStart(e, node.id) : undefined}
                    title={
                      sortingAllowedHere
                        ? undefined
                        : 'Double-click END on the main graph to open the pipeline canvas'
                    }
                  >
                    <span className="node-icon">{typeof node.icon === 'string' ? node.icon : node.icon}</span>
                    <span>{node.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'access' && (
            <div className="sidebar-content">
              <div className="sidebar-section">
                <h3>Access · membership</h3>
                <p className="sidebar-hint" style={{ marginBottom: '10px' }}>
                  Gate who can view this feed (not post ranking). On the main graph this connects to the END membership port.
                </p>
                {!sortingAllowedHere && (
                  <p className="sidebar-hint">
                    Open the <strong>END</strong> pipeline (double-click END), then drag Whitelist into the left slot.
                  </p>
                )}
                {NODE_TYPES.access.map((node) => (
                  <div
                    key={node.id}
                    className={`sidebar-node-item${!sortingAllowedHere ? ' sidebar-node-item-disabled' : ''}`}
                    draggable={sortingAllowedHere}
                    onDragStart={sortingAllowedHere ? (e) => onDragStart(e, node.id) : undefined}
                    title={
                      sortingAllowedHere
                        ? undefined
                        : 'Double-click END on the main graph to open the pipeline canvas'
                    }
                  >
                    <span className="node-icon">{node.icon}</span>
                    <span>{node.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
