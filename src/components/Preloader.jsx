import { memo } from 'react'
import { useUiStore } from '../store/ui.js'
import vijayamLogo from '../assets/media/images.png'
import './Preloader.css'

const Preloader = () => {
  const isActive = useUiStore((state) => state.pendingRequests > 0)
  const overlayClass = ['preloader-overlay']
  if (isActive) overlayClass.push('preloader-overlay--visible')

  return (
    <div className={overlayClass.join(' ')} aria-hidden={!isActive}>
      <div className="preloader" role="status" aria-live="polite" aria-label="Loading Jazz Public School data">
        <div className="preloader__badge">
          <div className="preloader__crest">
            <img src={vijayamLogo} alt="Vijayam Science and Arts College logo" />
          </div>
          <div>
            <div className="preloader__college">Jazz Public School</div>
            <div className="preloader__tagline">Preparing your academic space</div>
          </div>
        </div>

        <div className="preloader__spinner">
          <div className="preloader__ring preloader__ring--outer"></div>
          <div className="preloader__ring preloader__ring--middle"></div>
          <div className="preloader__ring preloader__ring--inner"></div>
          <div className="preloader__pulse"></div>
          <div className="preloader__icons">
            <span className="preloader__icon">🎓</span>
            <span className="preloader__icon">📚</span>
            <span className="preloader__icon">🧪</span>
            <span className="preloader__icon">📐</span>
          </div>
          <div className="preloader__dot preloader__dot--one"></div>
          <div className="preloader__dot preloader__dot--two"></div>
          <div className="preloader__dot preloader__dot--three"></div>
        </div>

        <div className="preloader__status">Syncing academic data…</div>
        <div className="preloader__meter">
          <span className="preloader__segment" />
          <span className="preloader__segment" />
          <span className="preloader__segment" />
          <span className="preloader__segment" />
        </div>
      </div>
    </div>
  )
}

export default memo(Preloader)
