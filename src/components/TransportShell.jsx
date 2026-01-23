import React, { useLayoutEffect, useRef, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTransportAuth } from '../store/transportAuth'
import crest from '../assets/media/images.png'
import './TransportShell.css'

const navItems = [
  { to: '/transport/dashboard', label: 'Dashboard', icon: 'bi-grid-fill' },
  { to: '/transport/routes', label: 'Route Creation', icon: 'bi-map' },

  { to: '/transport/reports', label: 'Reports', icon: 'bi-file-earmark-text' },
]

export default function TransportShell({ children }) {
  const { pathname } = useLocation()
  const navTo = useNavigate()
  const { transportUser, signOut } = useTransportAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    signOut()
    navTo('/transport/login')
  }

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const navRef = React.useRef(null)

  // Restore sidebar scroll position
  useLayoutEffect(() => {
    const savedScroll = sessionStorage.getItem('transportSidebarScroll')
    if (navRef.current && savedScroll) {
      navRef.current.scrollTop = Number(savedScroll)
    }
  }, [])

  // Save sidebar scroll position
  useEffect(() => {
    const navEl = navRef.current
    if (!navEl) return

    const handleScroll = () => {
      sessionStorage.setItem('transportSidebarScroll', navEl.scrollTop)
    }

    navEl.addEventListener('scroll', handleScroll)
    return () => navEl.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className={`transport-portal ${collapsed ? 'transport-portal--collapsed' : ''} ${mobileOpen ? 'transport-portal--mobile-open' : ''}`}>
      {/* Mobile Backdrop */}
      <div
        className="transport-portal__backdrop"
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      ></div>

      <aside className="transport-sidebar">
        <div className={`transport-sidebar__header d-flex align-items-center ${collapsed ? 'flex-column justify-content-center py-4 gap-3' : 'px-4 py-4'}`}>
          <img src={crest} alt="Vijayam crest" className="transport-header__logo" />
          <div className={`transport-sidebar__brand ms-3 ${collapsed ? 'd-none' : ''}`}>
            <div className="fw-bold text-white text-uppercase" style={{ fontSize: '1rem', letterSpacing: '0.05em', lineHeight: '1.2' }}>Vijayam</div>
            <div className="text-white-50 small text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Arts & Science College</div>
          </div>

          <button
            type="button"
            className={`transport-sidebar__toggle ${collapsed ? '' : 'ms-auto'}`}
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i className={`bi ${collapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'}`} style={{ color: 'white' }}></i>
          </button>
        </div>

        <nav className="transport-sidebar__nav" ref={navRef}>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`transport-sidebar__link ${pathname === item.to ? 'active' : ''}`}
            >
              <i className={`bi ${item.icon}`}></i>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="transport-sidebar__footer text-center mt-auto pb-3">
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem" }}>
            Made by <a href="https://www.twite.ai" target="_blank" rel="noopener noreferrer" style={{ color: "#fff", textDecoration: "none", fontWeight: "bold" }}>Twite AI Technologies</a>
          </div>
        </div>
      </aside>

      <div className="transport-main-wrapper">
        <header className="transport-header transport-header--global">
          <div className="transport-header__brand">
            <button
              type="button"
              className="transport-header__toggle transport-header__toggle--mobile"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              <i className={`bi ${mobileOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
            </button>
            <div className="transport-header__portal">Transport Portal</div>
          </div>

          <div className="transport-header__right">
            <button className="transport-header__logout" type="button" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right"></i> Logout
            </button>
          </div>
        </header>

        <div className="transport-body">
          <div className="transport-main">
            <div className="transport-content">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
