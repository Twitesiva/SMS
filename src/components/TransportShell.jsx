import React, { useLayoutEffect, useRef, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTransportAuth } from '../store/transportAuth'
import crest from '../assets/media/images.png'
import { supabase } from '../../supabaseClient'
import './TransportShell.css'

const navItems = [
  { to: '/transport/dashboard', label: 'Dashboard', icon: 'bi-grid-fill' },
  { to: '/transport/routes', label: 'Route Creations', icon: 'bi-map' },
  { to: '/transport/view-routes', label: 'View Routes with Vehicles', icon: 'bi-eye' },
  { to: '/transport/vehicles', label: 'Seats Availability', icon: 'bi-truck-front' },
  { to: '/transport/allocation', label: 'Transport Allocation', icon: 'bi-person-badge' },
  { to: '/transport/notifications', label: 'Notifications', icon: 'bi-bell-fill' },
  { to: '/transport/reports', label: 'Reports', icon: 'bi-file-earmark-text' },
]

export default function TransportShell({ children, brandTitle = "TRANSPORT PORTAL" }) {
  const { pathname } = useLocation()
  const navTo = useNavigate()
  const { transportUser, signOut } = useTransportAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)

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

  const [currentTime, setCurrentTime] = useState(new Date())

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch Notification Count
  useEffect(() => {
    const fetchNotifCount = async () => {
      try {
        const { data: routesData } = await supabase
          .from('transport_routes')
          .select(`
                    seats_available,
                    student_transport (count)
                `)

        if (routesData) {
          let count = 0
          routesData.forEach(route => {
            const capacity = route.seats_available || 0
            // Note: supabase count result behaves differently based on version/query. 
            // Using 'student_transport (count)' returns array of objects with count.
            // But actually, 'count' property is usually on the object if grouped? 
            // Wait, earlier I used select(`..., student_transport(count)`).
            // Supabase js returns data structure: { student_transport: [{ count: 5 }] }
            const used = route.student_transport ? route.student_transport[0]?.count || 0 : 0

            if (used > capacity) {
              count += (used - capacity)
            }
          })
          setNotifCount(count)
        }
      } catch (error) {
        console.error(error)
      }
    }

    fetchNotifCount()
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifCount, 30000)
    return () => clearInterval(interval)
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
            <div className="transport-header__portal">{brandTitle}</div>
          </div>

          <div className="transport-header__right">
            <div className="d-none d-md-flex align-items-center gap-3 me-3 text-white border-end pe-3">
              {/* Notification Bell */}
              <Link to="/transport/notifications" className="position-relative me-3 text-white">
                <i className="bi bi-bell fs-5"></i>
                {notifCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.6rem' }}>
                    {notifCount}
                    <span className="visually-hidden">unread notifications</span>
                  </span>
                )}
              </Link>

              <div className="text-end small d-none d-md-block" style={{ lineHeight: '1.2', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '1rem' }}>
                <div>{currentTime.toLocaleDateString('en-GB')}</div>
                <div className="opacity-75">{currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
              </div>
            </div>
            <button className="transport-header__logout" type="button" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right"></i> <span className="d-none d-sm-inline">Logout</span>
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
