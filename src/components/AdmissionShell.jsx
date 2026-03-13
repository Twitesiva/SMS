import { useEffect, useState, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import crest from '../assets/media/images.png'
import './AdmissionsPortalShell.css' // Uses the copied Staff styles

const admissionPortalNavGroups = [
    {
        title: 'Admissions Overview',
        static: true,
        items: [
            { to: '/admissions/overview', label: 'Admissions Overview', icon: 'bi-speedometer2' }
        ]
    },
    {
        title: 'Application Review',
        static: true,
        items: [
            { to: '/admissions/review', label: 'Application Review', icon: 'bi-file-earmark-check' }
        ]
    },
    {
        title: 'Student Application',
        static: true,
        items: [
            { to: '/admissions/application', label: 'Student Application', icon: 'bi-window-plus' }
        ]
    },
    {
        title: 'Admissions Enrolled',
        static: true,
        items: [
            { to: '/admissions/confirmed', label: 'Admissions Enrolled', icon: 'bi-person-check' }
        ]
    }
];

export default function AdmissionShell({ children, navGroups, brandTitle = "Admissions Portal" }) {
    const { pathname } = useLocation()
    const navTo = useNavigate()
    const { user, signOut } = useAuth()
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    // Flatten navGroups to valid navItems for the sidebar to match Staff Portal look
    const activeNavGroups = navGroups || admissionPortalNavGroups;
    const navItems = useMemo(() => {
        return activeNavGroups.flatMap(group => group.items);
    }, [activeNavGroups]);

    const isRouteActive = (pathname, to) => {
        return pathname === to || pathname.startsWith(`${to}/`)
    }

    const handleLogout = () => {
        signOut()
        navTo('/')
    }

    // Close mobile menu on route change
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    return (
        <div className={`staff-portal ${collapsed ? 'staff-portal--collapsed' : ''} ${mobileOpen ? 'staff-portal--mobile-open' : ''}`}>
            {/* Mobile Backdrop */}
            <div
                className="staff-portal__backdrop"
                onClick={() => setMobileOpen(false)}
                aria-hidden="true"
            ></div>

            <aside className="staff-sidebar">
                <div className={`staff-sidebar__header d-flex align-items-center ${collapsed ? 'flex-column justify-content-center py-4 gap-3' : 'px-4 py-4'}`}>
                    <img src={crest} alt="Vijayam crest" className="staff-header__logo" />
                    <div className={`staff-sidebar__brand ms-3 ${collapsed ? 'd-none' : ''}`}>
                        <div className="fw-bold text-white text-uppercase" style={{ fontSize: '1rem', letterSpacing: '0.05em', lineHeight: '1.2' }}>Vijayam</div>
                        <div className="text-white-50 small text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Public School</div>
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

                <nav className="staff-sidebar__nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={`staff-sidebar__link ${isRouteActive(pathname, item.to) ? 'active' : ''}`}
                        >
                            <i className={`bi ${item.icon}`}></i>
                            <span>{item.label}</span>
                        </Link>
                    ))}
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
                        <div className="d-flex align-items-center gap-3 me-3 text-white border-end pe-3 staff-header__meta">
                            <div className="text-end" style={{ lineHeight: '1.2', display: 'none' }}>
                                <div className="fw-bold small">{user?.user_metadata?.full_name || user?.email || 'Admin User'}</div>
                                <div className="small opacity-75">{user?.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Admissions'}</div>

                            </div>
                            <div className="text-end small d-none d-md-block" style={{ lineHeight: '1.2', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '1rem' }}>
                                <div>{new Date().toLocaleDateString('en-GB')}</div>
                                <div className="opacity-75">{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                        </div>
                        <button className="staff-header__logout" type="button" onClick={handleLogout}>
                            <i className="bi bi-box-arrow-right"></i> <span className="d-none d-sm-inline">Logout</span>
                        </button>
                    </div>
                </header>

                <div className="staff-body">
                    <div className="staff-main">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}

