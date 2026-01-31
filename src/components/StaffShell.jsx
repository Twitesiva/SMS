import { useEffect, useState, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useStaffAuth } from '../store/staffAuth'
import crest from '../assets/media/images.png'
import '../pages/staff/StaffPortal.css' // Updated CSS location

export default function StaffShell({ children }) {
    const { pathname } = useLocation()
    const navTo = useNavigate()
    const { staff, signOut } = useStaffAuth()
    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)

    const isHOD = staff?.designation === 'HOD'

    const navItems = useMemo(() => {
        const items = [
            { to: '/staff/dashboard', label: 'My Profile', icon: 'bi-speedometer2' },
            { to: '/staff/attendance', label: 'Student Attendance', icon: 'bi-clipboard-check' },
            { to: '/staff/students', label: 'Student Records', icon: 'bi-people' },
            { to: '/staff/timetable', label: 'Academic Timetable', icon: 'bi-calendar-week' },
            { to: '/staff/circulars', label: 'Circulars', icon: 'bi-megaphone-fill' },
            { to: '/staff/materials', label: 'Learning Materials', icon: 'bi-folder2-open' },
            { to: '/staff/performance', label: 'Academic Performance', icon: 'bi-graph-up-arrow' },
            { to: '/staff/my-attendance', label: 'My Attendance', icon: 'bi-person-check' },
        ]

        if (isHOD) {
            items.push(
                { to: '/staff/leave?view=students', label: 'Leave: Student Requests', icon: 'bi-person-lines-fill' },
                { to: '/staff/leave?view=staff', label: 'Leave: Staff Requests', icon: 'bi-person-lines-fill' }
            )
        }
        return items
    }, [isHOD])

    const isRouteActive = (pathname, to) => {
        return pathname === to || pathname.startsWith(`${to}/`)
    }

    const handleLogout = () => {
        signOut()
        navTo('/staff/login')
    }

    // Close mobile menu on route change
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    const handleNavClick = () => {
        setMobileOpen(false)
    }

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

                <nav className="staff-sidebar__nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={`staff-sidebar__link ${isRouteActive(pathname, item.to) ? 'active' : ''}`}
                            onClick={handleNavClick}
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
                        <div className="staff-header__portal">Staff Portal</div>
                    </div>

                    <div className="staff-header__right">
                        <div className="staff-header__meta d-flex align-items-center gap-3 me-3 text-white border-end pe-3">
                            <div className="text-end" style={{ lineHeight: '1.2' }}>
                                <div className="fw-bold small">{staff?.full_name || 'Staff Member'}</div>
                                <div className="small opacity-75">{(staff?.designation || 'Faculty').replace(/_/g, ' ')}</div>
                            </div>
                            <div className="staff-header__meta-date text-end small d-none d-md-block" style={{ lineHeight: '1.2', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '1rem' }}>
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
                    <div className="staff-main">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}
