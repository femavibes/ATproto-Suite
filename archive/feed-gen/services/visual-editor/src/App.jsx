import React, { useRef, useState, useCallback, useLayoutEffect, useEffect } from 'react'
import Canvas from './components/Canvas'
import Sidebar from './components/Sidebar'
import Breadcrumb from './components/Breadcrumb'
import TreePanel from './components/TreePanel'
import LiveFiltersModal from './components/LiveFiltersModal'
import { HistoryProvider } from './contexts/HistoryContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { useAuth } from './contexts/AuthContext'
import { listProjectFeeds, updateProjectIngestionFilters } from './api/feedBuilderApi'
import { GearIcon } from './components/Icons'
import './App.css'
import './components/Breadcrumb.css'
import './components/TreePanel.css'

function deriveLiveFiltersFromGraph(graph) {
  const parsed = typeof graph === 'string' ? (() => {
    try { return JSON.parse(graph) } catch { return {} }
  })() : (graph || {})
  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : []
  const keywords = new Set()
  const languageCodes = new Set()
  const regexPatterns = new Set()

  for (const node of nodes) {
    const type = String(node?.type || '')
    const data = (node?.data && typeof node.data === 'object') ? node.data : {}
    const config = (node?.config && typeof node.config === 'object') ? node.config : {}
    const source = Object.keys(data).length ? data : config
    if (type === 'text' && Array.isArray(source.keywords)) {
      for (const kw of source.keywords) {
        const v = String((typeof kw === 'string' ? kw : kw?.value) || '').trim()
        if (v) keywords.add(v.toLowerCase())
      }
    }
    if (type === 'language' && Array.isArray(source.languages)) {
      for (const code of source.languages) {
        const v = String(code || '').trim()
        if (v) languageCodes.add(v.toLowerCase())
      }
    }
    if (type === 'regex' && source.pattern) {
      const v = String(source.pattern).trim()
      if (v) regexPatterns.add(v)
    }
  }

  return {
    keywordStems: Array.from(keywords).sort(),
    languageCodes: Array.from(languageCodes).sort(),
    regexPatterns: Array.from(regexPatterns),
  }
}

function App() {
  const {
    did,
    handle,
    avatar,
    loading: authLoading,
    error: authError,
    handleInput,
    setHandleInput,
    login,
    logout,
    oauthReady,
  } = useAuth()
  const canvasRef = useRef(null)
  const [treeNodes, setTreeNodes] = useState([])
  const [treeEdges, setTreeEdges] = useState([])
  const [treeConnected, setTreeConnected] = useState(new Set())
  const [projectToolbar, setProjectToolbar] = useState({ projects: [], selectedProjectId: '' })

  const handleStateChange = useCallback((nodes, edges, connectedIds) => {
    setTreeNodes(nodes)
    setTreeEdges(edges)
    if (connectedIds) setTreeConnected(connectedIds)
  }, [])

  const handleExport = () => {
    if (canvasRef.current && canvasRef.current.exportGraph) {
      canvasRef.current.exportGraph()
    }
  }

  const handleImport = () => {
    if (canvasRef.current && canvasRef.current.importGraph) {
      canvasRef.current.importGraph()
    }
  }

  const handleSave = () => {
    if (canvasRef.current && canvasRef.current.saveGraph) {
      canvasRef.current.saveGraph()
    }
  }

  const handleManageFeeds = () => {
    canvasRef.current?.openFeedManager?.()
  }

  const handlePublish = () => {
    canvasRef.current?.publishGraph?.()
  }

  const [debugToolbar, setDebugToolbar] = useState({ panelOpen: false, hasResults: false })
  const [liveFiltersOpen, setLiveFiltersOpen] = useState(false)
  const [liveFiltersLoading, setLiveFiltersLoading] = useState(false)
  const [liveFiltersApplying, setLiveFiltersApplying] = useState(false)
  const [liveFiltersData, setLiveFiltersData] = useState([])
  const [liveFiltersSummary, setLiveFiltersSummary] = useState({
    keywordStems: [],
    languageCodes: [],
    regexPatterns: [],
    notes: [],
    unsafeToDropForKeywordGate: false,
    unsafeToDropForLanguageGate: false,
  })

  const handleToggleDebugPanel = useCallback(() => {
    canvasRef.current?.toggleDebugPanel?.()
  }, [])

  const handleCreateProject = useCallback(async () => {
    const name = window.prompt('New project name:')
    if (!name || !name.trim()) return
    try {
      await canvasRef.current?.createProject?.({
        name: name.trim(),
        description: 'Created from header',
      })
    } catch (error) {
      alert(`Failed to create project: ${error.message}`)
    }
  }, [])

  const handleDeleteProject = useCallback(async () => {
    const current = projectToolbar.projects.find((p) => p.id === projectToolbar.selectedProjectId)
    if (!current) return
    const ok = window.confirm(`Delete project "${current.name}" and all its feeds?`)
    if (!ok) return
    try {
      await canvasRef.current?.deleteProject?.(current.id)
    } catch (error) {
      alert(`Failed to delete project: ${error.message}`)
    }
  }, [projectToolbar])

  const handleOpenLiveFilters = useCallback(async () => {
    if (!projectToolbar.selectedProjectId) {
      alert('Select a project first.')
      return
    }
    setLiveFiltersOpen(true)
    setLiveFiltersLoading(true)
    try {
      const feeds = await listProjectFeeds(projectToolbar.selectedProjectId)
      const normalized = feeds.map((feed) => {
        const hints = feed.prefilter_hints || {}
        const fromGraph = deriveLiveFiltersFromGraph(feed.assignment_rules_live)
        return {
          id: feed.id,
          name: feed.name,
          slug: feed.slug,
          keywordStems: fromGraph.keywordStems,
          languageCodes: fromGraph.languageCodes,
          regexPatterns: fromGraph.regexPatterns,
          notes: Array.isArray(hints.notes) ? hints.notes : [],
          unsafeToDropForKeywordGate: !!hints.unsafeToDropForKeywordGate,
          unsafeToDropForLanguageGate: !!hints.unsafeToDropForLanguageGate,
        }
      })
      setLiveFiltersData(normalized)
      setLiveFiltersSummary({
        keywordStems: Array.from(new Set(normalized.flatMap((f) => f.keywordStems))).sort(),
        languageCodes: Array.from(new Set(normalized.flatMap((f) => f.languageCodes))).sort(),
        regexPatterns: Array.from(new Set(normalized.flatMap((f) => f.regexPatterns))),
        notes: Array.from(new Set(normalized.flatMap((f) => f.notes))),
        unsafeToDropForKeywordGate: normalized.some((f) => f.unsafeToDropForKeywordGate),
        unsafeToDropForLanguageGate: normalized.some((f) => f.unsafeToDropForLanguageGate),
      })
    } catch (error) {
      alert(`Failed to load live filters: ${error.message}`)
      setLiveFiltersData([])
      setLiveFiltersSummary({
        keywordStems: [],
        languageCodes: [],
        regexPatterns: [],
        notes: [],
        unsafeToDropForKeywordGate: false,
        unsafeToDropForLanguageGate: false,
      })
    } finally {
      setLiveFiltersLoading(false)
    }
  }, [projectToolbar.selectedProjectId])

  const handleApplyIngestionFilters = useCallback(async () => {
    if (!projectToolbar.selectedProjectId) return
    setLiveFiltersApplying(true)
    try {
      // Capture latest unsaved canvas edits before promoting ingestion filters.
      canvasRef.current?.saveGraph?.()
      const result = await updateProjectIngestionFilters(projectToolbar.selectedProjectId)
      await handleOpenLiveFilters()
      alert(`Updated ingestion filters for ${result.updated_feeds ?? 0} feed(s).`)
    } catch (error) {
      alert(`Failed to update ingestion filters: ${error.message}`)
    } finally {
      setLiveFiltersApplying(false)
    }
  }, [projectToolbar.selectedProjectId, handleOpenLiveFilters])

  const handleRenameProject = useCallback(async () => {
    const current = projectToolbar.projects.find((p) => p.id === projectToolbar.selectedProjectId)
    if (!current) return
    const name = window.prompt('Rename project:', current.name)
    if (!name || !name.trim() || name.trim() === current.name) return
    try {
      await canvasRef.current?.renameProject?.(current.id, name.trim())
    } catch (error) {
      alert(`Failed to rename project: ${error.message}`)
    }
  }, [projectToolbar])

  const [projDropdownOpen, setProjDropdownOpen] = useState(false)
  const projDropdownRef = useRef(null)
  useEffect(() => {
    if (!projDropdownOpen) return
    const handler = (e) => {
      if (projDropdownRef.current && !projDropdownRef.current.contains(e.target)) setProjDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [projDropdownOpen])

  const [projActionsOpen, setProjActionsOpen] = useState(false)
  const projActionsRef = useRef(null)
  useEffect(() => {
    if (!projActionsOpen) return
    const handler = (e) => {
      if (projActionsRef.current && !projActionsRef.current.contains(e.target)) setProjActionsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [projActionsOpen])

  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef(null)

  useEffect(() => {
    if (!settingsOpen) return
    const handler = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [settingsOpen])

  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  useEffect(() => {
    if (!userMenuOpen) return
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  const appChromeRef = useRef(null)
  const [appChromeHeightPx, setAppChromeHeightPx] = useState(52)

  useLayoutEffect(() => {
    const el = appChromeRef.current
    if (!el) return
    const update = () => {
      const h = Math.ceil(el.getBoundingClientRect().height)
      if (h > 0) setAppChromeHeightPx(h)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <NavigationProvider>
      <HistoryProvider>
        <div
          className="app"
          style={{ '--app-chrome-height': `${appChromeHeightPx}px` }}
        >
          <div className="app-chrome" ref={appChromeRef}>
            <header className="app-header">
              <h1 className="app-header__title">Feed Rule Builder</h1>

              {/* ── Centered user section ── */}
              <div className="header-user-section">
                {authLoading ? (
                  <span style={{ fontSize: 12, color: '#888' }}>Auth…</span>
                ) : did ? (
                  <div className="header-user-menu-wrapper" ref={userMenuRef}>
                    <button
                      className={`header-user-btn${userMenuOpen ? ' header-user-btn--open' : ''}`}
                      onClick={() => setUserMenuOpen((o) => !o)}
                      title={did}
                    >
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={handle || did}
                          className="header-user-avatar"
                        />
                      ) : (
                        <span className="header-user-avatar header-user-avatar--placeholder">
                          {(handle || did).slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="header-user-handle">
                        {handle ? `@${handle}` : did}
                      </span>
                      <svg className="header-user-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {userMenuOpen && (
                      <div className="user-dropdown">
                        <button
                          className="user-dropdown__item user-dropdown__item--danger"
                          onClick={() => { setUserMenuOpen(false); logout() }}
                        >
                          Log out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="header-login-form">
                    <span style={{ fontSize: 10, color: '#666', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                      Invite-only beta
                    </span>
                    <input
                      className="form-input"
                      style={{ width: 180, fontSize: 12, padding: '4px 8px' }}
                      placeholder="handle.bsky.social"
                      value={handleInput}
                      onChange={(e) => setHandleInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && login()}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!oauthReady || !handleInput.trim()}
                      onClick={login}
                      title="Invite-only beta: approved handles only"
                    >
                      Sign in
                    </button>
                  </div>
                )}
              </div>

              {/* ── Right action buttons ── */}
              <div className="header-actions">
                {did && (
                  <div className="header-project-group">
                    {/* Custom project picker */}
                    <div className="proj-dropdown-wrapper" ref={projDropdownRef}>
                      <button
                        className={`proj-dropdown-btn${projDropdownOpen ? ' proj-dropdown-btn--open' : ''}`}
                        onClick={() => setProjDropdownOpen((o) => !o)}
                        title="Switch project"
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: '#888' }}>
                          <rect x="1" y="2" width="14" height="3" rx="1" fill="currentColor" opacity=".5"/>
                          <rect x="1" y="6.5" width="14" height="3" rx="1" fill="currentColor" opacity=".8"/>
                          <rect x="1" y="11" width="9" height="3" rx="1" fill="currentColor"/>
                        </svg>
                        <span className="proj-dropdown-btn__label">
                          {projectToolbar.projects.find((p) => p.id === projectToolbar.selectedProjectId)?.name || 'No project'}
                        </span>
                        <svg className="proj-dropdown-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      {projDropdownOpen && (
                        <div className="proj-dropdown-menu">
                          {projectToolbar.projects.length === 0 ? (
                            <div className="proj-dropdown-menu__empty">No projects</div>
                          ) : (
                            projectToolbar.projects.map((project) => (
                              <button
                                key={project.id}
                                className={`proj-dropdown-menu__item${project.id === projectToolbar.selectedProjectId ? ' proj-dropdown-menu__item--active' : ''}`}
                                onClick={() => {
                                  setProjDropdownOpen(false)
                                  canvasRef.current?.selectProject?.(project.id)
                                }}
                              >
                                {project.id === projectToolbar.selectedProjectId && (
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                                    <path d="M2 6l3 3 5-5" stroke="#4a9eff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                                <span>{project.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Project actions ⋯ */}
                    <div className="proj-actions-wrapper" ref={projActionsRef}>
                      <button
                        className={`proj-actions-btn${projActionsOpen ? ' proj-actions-btn--open' : ''}`}
                        onClick={() => setProjActionsOpen((o) => !o)}
                        title="Project actions"
                      >
                        <span className="proj-actions-dots">⋯</span>
                      </button>
                      {projActionsOpen && (
                        <div className="proj-actions-menu">
                          <button
                            className="proj-actions-menu__item"
                            onClick={() => { setProjActionsOpen(false); handleRenameProject() }}
                          >
                            Rename project
                          </button>
                          <button
                            className="proj-actions-menu__item"
                            onClick={() => { setProjActionsOpen(false); handleCreateProject() }}
                          >
                            New project
                          </button>
                          <div className="proj-actions-menu__divider" />
                          <button
                            className="proj-actions-menu__item proj-actions-menu__item--danger"
                            onClick={() => { setProjActionsOpen(false); handleDeleteProject() }}
                          >
                            Delete project
                          </button>
                        </div>
                      )}
                    </div>
                    <button className="btn-secondary" onClick={handleManageFeeds}>Manage Feeds</button>
                  </div>
                )}
                <button className="btn-secondary" onClick={handleOpenLiveFilters} disabled={!did}>Live Filters</button>
                <button className="btn-primary" onClick={handleSave} disabled={!did}>Save Draft</button>
                <button className="btn-primary" onClick={handlePublish} disabled={!did}>Publish</button>
                <div className="settings-menu-wrapper" ref={settingsRef}>
                  <button
                    className={`btn-icon btn-icon--gear${settingsOpen ? ' btn-icon--active' : ''}`}
                    onClick={() => setSettingsOpen((o) => !o)}
                    title="Settings"
                  >
                    <GearIcon size={16} />
                  </button>
                  {settingsOpen && (
                    <div className="settings-dropdown">
                      <button
                        className="settings-dropdown__item"
                        onClick={() => { setSettingsOpen(false); handleImport() }}
                      >
                        Import Graph
                      </button>
                      <button
                        className="settings-dropdown__item"
                        onClick={() => { setSettingsOpen(false); handleExport() }}
                      >
                        Export Graph
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>
            {authError && (
              <div style={{ padding: '6px 16px', fontSize: 12, color: '#f66', background: '#2a1515' }}>
                {authError}
              </div>
            )}
            <Breadcrumb />
          </div>
          <div className="app-content">
            <Sidebar
              debugPanelOpen={debugToolbar.panelOpen}
              debugHasResults={debugToolbar.hasResults}
              onToggleDebugPanel={handleToggleDebugPanel}
            />
            <Canvas
              ref={canvasRef}
              onStateChange={handleStateChange}
              onDebugToolbarState={setDebugToolbar}
              onProjectStateChange={setProjectToolbar}
            />
            <TreePanel
              nodes={treeNodes}
              edges={treeEdges}
              connectedNodeIds={treeConnected}
              onNodeFocus={(nodeId) => canvasRef.current?.navigateToNode?.(nodeId)}
            />
            <LiveFiltersModal
              isOpen={liveFiltersOpen}
              loading={liveFiltersLoading}
              applying={liveFiltersApplying}
              summary={liveFiltersSummary}
              filters={liveFiltersData}
              onApplyIngestionFilters={handleApplyIngestionFilters}
              onClose={() => setLiveFiltersOpen(false)}
            />
          </div>
        </div>
      </HistoryProvider>
    </NavigationProvider>
  )
}

export default App
