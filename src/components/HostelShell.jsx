import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useHostelAuth } from '../store/hostelAuth'
import logo from '../assets/media/images.png'
import './AdminPortalShell.css'
import '../pages/staff/StaffPortal.css'
import '../pages/student/Student.css'

const hostelNavGroups = [
  {
    static: true,
    items: [
      { to: '/hostel/dashboard', label: 'Dashboard', icon: 'bi-speedometer2', exact: true },
      { to: '/hostel/blocks', label: 'Blocks', icon: 'bi-box' },
      { to: '/hostel/rooms', label: 'Room Creation', icon: 'bi-door-closed' },
      { to: '/hostel/room-year-mapping', label: 'Year Mapping', icon: 'bi-calendar-check' },
      { to: '/hostel/allocations', label: 'Allocations', icon: 'bi-person-check' },
      { to: '/hostel/reports', label: 'Reports', icon: 'bi-graph-up' }
    ]
  }
]

export default function HostelShell({ children, navGroups, brandTitle = "HOSTEL PORTAL" }) {
  const { pathname } = useLocation()
  const navTo = useNavigate()
  const { signOut } = useHostelAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState({})
  const activeNavGroups = navGroups || hostelNavGroups
  const navRef = useRef(null)

  const isRouteActive = (path, to, exact = false) => {
    if (exact) return path === to
    return path === to || path.startsWith(`${to}/`)
  }

  const toggleGroup = (index) => {
    if (activeNavGroups[index]?.static) return
    setExpandedGroups((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const handleLogout = () => {
    signOut()
    navTo('/hostel/login')
  }

  useEffect(() => setMobileOpen(false), [pathname])

  useLayoutEffect(() => {
    const savedScroll = sessionStorage.getItem('hostelSidebarScroll')
    if (navRef.current && savedScroll) navRef.current.scrollTop = Number(savedScroll)
  }, [])

  useEffect(() => {
    const navEl = navRef.current
    if (!navEl) return
    const handleScroll = () => sessionStorage.setItem('hostelSidebarScroll', navEl.scrollTop)
    navEl.addEventListener('scroll', handleScroll)
    return () => navEl.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const activeGroupIndex = activeNavGroups.findIndex(
      (group) => !group.static && group.items.some((item) => isRouteActive(pathname, item.to, item.exact))
    )
    if (activeGroupIndex !== -1) {
      setExpandedGroups((prev) => ({ ...prev, [activeGroupIndex]: true }))
    }
  }, [pathname, activeNavGroups])

  return (
    <div className={`staff-portal ${collapsed ? 'staff-portal--collapsed' : ''} ${mobileOpen ? 'staff-portal--mobile-open' : ''}`}>
      <div className="staff-portal__backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true"></div>

      <aside className="staff-sidebar">
        <div className={`staff-sidebar__header d-flex align-items-center ${collapsed ? 'flex-column justify-content-center py-4 gap-3' : 'px-4 py-4'}`}>
          <img src={logo} alt="Vijayam crest" className="staff-header__logo" />
          <div className={`staff-sidebar__brand ms-3 ${collapsed ? 'd-none' : ''}`}>
            <div className="fw-bold text-white text-uppercase" style={{ fontSize: '1rem', letterSpacing: '0.05em', lineHeight: '1.2' }}>Vijayam</div>
            <div className="text-white-50 small text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Arts & Science College</div>
          </div>

          <button
            type="button"
            className={`staff-sidebar__toggle ${collapsed ? '' : 'ms-auto'}`}
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i className={`bi ${collapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'}`} style={{ color: 'white' }}></i>
          </button>
        </div>

        <nav className="staff-sidebar__nav" ref={navRef}>
          {activeNavGroups.map((group, groupIndex) => {
            const isStatic = group.static
            const isActiveGroup = group.items.some((item) => isRouteActive(pathname, item.to, item.exact))
            const isExpanded = expandedGroups[groupIndex]

            if (isStatic) {
              return (
                group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`staff-sidebar__link ${isRouteActive(pathname, item.to, item.exact) ? 'active' : ''}`}
                  >
                    <i className={`bi ${item.icon}`}></i>
                    <span>{item.label}</span>
                  </Link>
                ))
              )
            }

            return (
              <div key={groupIndex} className="nav-group-wrapper">
                <div
                  className={`staff-sidebar__link ${isActiveGroup ? 'group-active' : ''}`}
                  onClick={() => toggleGroup(groupIndex)}
                  style={{ cursor: 'pointer', justifyContent: 'space-between' }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <i className={`bi ${group.icon || 'bi-grid-fill'}`} style={{ fontSize: "0.9rem", opacity: 0.8 }}></i>
                    <span>{group.title}</span>
                  </div>
                  <i className={`bi bi-chevron-${isExpanded ? "up" : "down"} ms-auto`} style={{ fontSize: "0.8rem", opacity: 0.7 }}></i>
                </div>

                {isExpanded && !collapsed && (
                  <div className="ps-3 pe-2 pb-2">
                    {group.items.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`staff-sidebar__link ${isRouteActive(pathname, item.to, item.exact) ? 'active' : ''}`}
                        style={{ padding: '8px 12px', fontSize: '0.9rem', marginBottom: '2px', background: isRouteActive(pathname, item.to, item.exact) ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none' }}
                      >
                        <i className={`bi ${item.icon}`} style={{ fontSize: '0.85rem' }}></i>
                        <span style={{ fontSize: '0.85rem' }}>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="staff-sidebar__footer text-center mt-auto pb-3">
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem" }}>
            Made by <a href="https://www.twite.ai" target="_blank" rel="noopener noreferrer" style={{ color: "#fff", textDecoration: "none", fontWeight: "bold" }}>Twite AI Technologies</a>
          </div>
        </div>
      </aside>

      <div className="staff-main-wrapper">
        <header className="staff-header staff-header--global">
          <div className="staff-header__brand">
            <button
              type="button"
              className="staff-header__toggle staff-header__toggle--mobile"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              <i className={`bi ${mobileOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
            </button>
            <div className="staff-header__portal">{brandTitle}</div>
          </div>

          <div className="staff-header__right">
            <div className="d-flex align-items-center gap-3 me-3 text-white border-end pe-3">
              <div className="text-end small d-none d-md-block" style={{ lineHeight: '1.2', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '1rem' }}>
                <div>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                <div className="opacity-75">{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
            <button className="staff-header__logout" type="button" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right"></i> Logout
            </button>
          </div>
        </header>

        <div className="staff-body">
          <div className="staff-main admin-content">
            {children}
          </div>
        </div>
      </div>
      <div className="staff-sidebar__footer text-center mt-auto pb-3 d-lg-none"></div>
    </div>
  )
}
