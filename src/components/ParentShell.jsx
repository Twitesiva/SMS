import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useParentAuth } from '../store/parentAuth'
import crest from '../assets/media/images.png'
import '../pages/parent/ParentPortal.css'

const navItems = [
    { to: '/parent/student-details', label: 'Student Details', icon: 'bi-person-badge' },
    { to: '/parent/attendance', label: 'Attendance', icon: 'bi-calendar-check' },
    { to: '/parent/marks', label: 'Marks', icon: 'bi-file-earmark-bar-graph' },
    { to: '/parent/notifications', label: 'Notifications', icon: 'bi-bell' }
]

const isRouteActive = (pathname, to) => {
    return pathname === to || pathname.startsWith(`${to}/`)
}

export default function ParentShell({ children }) {
    const { pathname } = useLocation()
    const navTo = useNavigate()
    const { parent, signOut } = useParentAuth()
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    const handleLogout = () => {
        signOut()
        navTo('/parent/login')
    }

    // Close mobile menu on route change
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    return (
        <div className={`parent-portal ${collapsed ? 'parent-portal--collapsed' : ''} ${mobileOpen ? 'parent-portal--mobile-open' : ''}`}>
            {/* Mobile Backdrop */}
            <div
                className="parent-portal__backdrop"
                onClick={() => setMobileOpen(false)}
                aria-hidden="true"
            ></div>

            <aside className="parent-sidebar">
                <div className={`parent-sidebar__header d-flex align-items-center ${collapsed ? 'flex-column justify-content-center py-4 gap-3' : 'px-4 py-4'}`}>
                    <img src={crest} alt="Vijayam crest" className="parent-header__logo" />
                    <div className={`parent-sidebar__brand ms-3 ${collapsed ? 'd-none' : ''}`}>
                        <div className="fw-bold text-white text-uppercase" style={{ fontSize: '1rem', letterSpacing: '0.05em', lineHeight: '1.2' }}>Vijayam</div>
                        <div className="text-white-50 small text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Arts & Science College</div>
                    </div>

                    <button
                        type="button"
                        className={`parent-sidebar__toggle ${collapsed ? '' : 'ms-auto'}`}
                        onClick={() => setCollapsed((prev) => !prev)}
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <i className={`bi ${collapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'}`} style={{ color: 'white' }}></i>
                    </button>
                </div>

                <nav className="parent-sidebar__nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={`parent-sidebar__link ${isRouteActive(pathname, item.to) ? 'active' : ''}`}
                        >
                            <i className={`bi ${item.icon}`}></i>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="parent-sidebar__footer text-center mt-auto pb-3">
                    <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem" }}>
                        Made by <a href="https://www.twite.ai" target="_blank" rel="noopener noreferrer" style={{ color: "#fff", textDecoration: "none", fontWeight: "bold" }}>Twite AI Technologies</a>
                    </div>
                </div>
            </aside>

            <div className="parent-main-wrapper">
                <header className="parent-header parent-header--global">
                    <div className="parent-header__brand">
                        <button
                            type="button"
                            className="parent-header__toggle parent-header__toggle--mobile"
                            onClick={() => setMobileOpen((prev) => !prev)}
                            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                        >
                            <i className={`bi ${mobileOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
                        </button>
                        <div className="parent-header__portal">Parent Portal</div>
                    </div>

                    <div className="parent-header__right">
                        <div className="parent-header__user-info d-flex align-items-center gap-3 me-3 text-white border-end pe-3">
                            <div className="text-end" style={{ lineHeight: '1.2' }}>
                                <div className="fw-bold small">{parent?.full_name || 'Student'}</div>
                                <div className="small opacity-75">{parent?.student_id || '—'}</div>
                            </div>
                            <div className="text-end small d-none d-md-block" style={{ lineHeight: '1.2', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '1rem' }}>
                                <div>{new Date().toLocaleDateString('en-GB')}</div>
                                <div className="opacity-75">{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                        </div>
                        <button className="parent-header__logout" type="button" onClick={handleLogout}>
                            <i className="bi bi-box-arrow-right"></i> <span className="d-none d-sm-inline">Logout</span>
                        </button>
                    </div>
                </header>

                <div className="parent-body">
                    <div className="parent-main">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}

