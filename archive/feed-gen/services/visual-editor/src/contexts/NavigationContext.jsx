import React, { createContext, useContext, useState, useCallback } from 'react'

const NavigationContext = createContext()

export function NavigationProvider({ children }) {
  // Stack of container IDs we've zoomed into. Empty = root level.
  const [path, setPath] = useState([])

  // Current container ID (last in path), or null for root
  const currentContainer = path.length > 0 ? path[path.length - 1] : null

  /**
   * @param {string} containerId
   * @param {string} [containerLabel]
   * @param {{ view?: 'group' | 'end' }} [options] — `end` = END pipeline canvas (sorting slot); `group` = logic group
   */
  const zoomIn = useCallback((containerId, containerLabel, options = {}) => {
    const view = options.view || 'group'
    setPath((prev) => [
      ...prev,
      { id: containerId, label: containerLabel || containerId, view },
    ])
  }, [])

  // Go back to a specific level in the breadcrumb
  const navigateTo = useCallback((index) => {
    if (index < 0) {
      setPath([])
    } else {
      setPath(prev => prev.slice(0, index + 1))
    }
  }, [])

  // Go up one level
  const zoomOut = useCallback(() => {
    setPath(prev => prev.slice(0, -1))
  }, [])

  // Navigate to a specific container by building the full path from root
  const navigateToContainer = useCallback((containerId, containerLabel, allNodes) => {
    if (!containerId) {
      setPath([])
      return
    }
    // Build full ancestor path
    const fullPath = []
    let current = allNodes?.find(n => n.id === containerId)
    while (current) {
      fullPath.unshift({ id: current.id, label: containerLabel || current.data?.name || current.type })
      const parentId = current.data?.containerParent
      if (!parentId) break
      current = allNodes?.find(n => n.id === parentId)
      containerLabel = null // only use provided label for the target
    }
    setPath(fullPath)
  }, [])

  return (
    <NavigationContext.Provider value={{ path, currentContainer: currentContainer?.id || null, zoomIn, zoomOut, navigateTo, navigateToContainer }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  return useContext(NavigationContext)
}
