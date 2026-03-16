import { memo } from 'react'
import { useUiStore } from '../store/ui.js'
import './Preloader.css'

/**
 * A minimal, professional global loader component.
 * Activates whenever there are pending background requests.
 */
const Preloader = () => {
  const isActive = useUiStore((state) => state.pendingRequests > 0)

  if (!isActive) return null

  return (
    <div className="preloader-overlay" role="status" aria-busy="true" aria-label="Loading content">
      <div className="preloader-inner">
        <div className="preloader-spinner"></div>
        <div className="preloader-text">Loading...</div>
      </div>
    </div>
  )
}

export default memo(Preloader)
