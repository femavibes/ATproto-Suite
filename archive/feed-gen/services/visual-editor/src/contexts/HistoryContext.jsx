import React, { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react'

const HistoryContext = createContext(null)

export const useHistory = () => {
  const context = useContext(HistoryContext)
  if (!context) {
    throw new Error('useHistory must be used within HistoryProvider')
  }
  return context
}

export const HistoryProvider = ({ children }) => {
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Store registered callbacks in refs — no state updates, no re-renders on registration.
  // Previously stored as useState which caused HistoryContext to re-render every time Canvas
  // registered new handlers, cascading re-renders to all context consumers.
  const undoFnRef = useRef(null)
  const redoFnRef = useRef(null)
  const clearFnRef = useRef(null)
  const zoomToFitFnRef = useRef(null)
  const centerViewFnRef = useRef(null)

  const registerUndo = useCallback((fn) => { undoFnRef.current = fn }, [])
  const registerRedo = useCallback((fn) => { redoFnRef.current = fn }, [])
  const registerClear = useCallback((fn) => { clearFnRef.current = fn }, [])
  const registerZoomToFit = useCallback((fn) => { zoomToFitFnRef.current = fn }, [])
  const registerCenterView = useCallback((fn) => { centerViewFnRef.current = fn }, [])

  const handleUndo = useCallback(() => { undoFnRef.current?.() }, [])
  const handleRedo = useCallback(() => { redoFnRef.current?.() }, [])
  const handleClear = useCallback(() => { clearFnRef.current?.() }, [])
  const handleZoomToFit = useCallback(() => { zoomToFitFnRef.current?.() }, [])
  const handleCenterView = useCallback(() => { centerViewFnRef.current?.() }, [])

  // Memoize the context value to prevent new object on every canUndo/canRedo state update
  // from cascading re-renders to all consumers beyond those that actually use canUndo/canRedo.
  const value = useMemo(() => ({
    canUndo,
    canRedo,
    setCanUndo,
    setCanRedo,
    registerUndo,
    registerRedo,
    registerClear,
    registerZoomToFit,
    registerCenterView,
    handleUndo,
    handleRedo,
    handleClear,
    handleZoomToFit,
    handleCenterView,
  }), [
    canUndo,
    canRedo,
    registerUndo,
    registerRedo,
    registerClear,
    registerZoomToFit,
    registerCenterView,
    handleUndo,
    handleRedo,
    handleClear,
    handleZoomToFit,
    handleCenterView,
  ])

  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  )
}
