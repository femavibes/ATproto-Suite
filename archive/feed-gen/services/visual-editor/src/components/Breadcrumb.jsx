import React, { useEffect, useRef, useState } from 'react'
import { useNavigation } from '../contexts/NavigationContext'

function Breadcrumb() {
  const { path, navigateTo } = useNavigation()
  const [pathTick, setPathTick] = useState(false)
  const pathSigRef = useRef('')
  const skipFirst = useRef(true)

  useEffect(() => {
    const sig = path.map((p) => p.id).join('\u001e')
    if (skipFirst.current) {
      skipFirst.current = false
      pathSigRef.current = sig
      return
    }
    if (sig === pathSigRef.current) return
    pathSigRef.current = sig
    setPathTick(true)
    const t = window.setTimeout(() => setPathTick(false), 480)
    return () => window.clearTimeout(t)
  }, [path])

  if (path.length === 0) return null

  return (
    <div className={`breadcrumb-bar${pathTick ? ' breadcrumb-bar--path-tick' : ''}`}>
      <button className="breadcrumb-item breadcrumb-root" onClick={() => navigateTo(-1)}>
        Root
      </button>
      {path.map((item, index) => (
        <React.Fragment key={item.id}>
          <span className="breadcrumb-separator">/</span>
          <button
            className={`breadcrumb-item ${index === path.length - 1 ? 'breadcrumb-current' : ''}`}
            onClick={() => navigateTo(index)}
          >
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  )
}

export default Breadcrumb
