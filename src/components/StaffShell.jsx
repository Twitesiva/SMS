import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useStaffAuth } from '../store/staffAuth'
import crest from '../assets/media/images.png'

export default function StaffShell({ children }) {
    const location = useLocation()
    const { pathname, search } = location
    const navTo = useNavigate()
    const { staff, signOut } = useStaffAuth()
    const [collapsed, setCollapsed] = useState(false)
    const [openSection, setOpenSection] = useState(null)
    const isHOD = staff?.designation === 'HOD'

    const navItems = useMemo(() => [
        {
            to: '/staff/dashboard',
            label: 'My Profile',
            icon: 'bi-speedometer2',
        },
        {
            to: '/staff/attendance',
            label: 'Student Attendance',
            icon: 'bi-clipboard-check',
        },
        {
            to: '/staff/students',
            label: 'Student Records',
            icon: 'bi-people',
        },
        {
            to: '/staff/timetable',
            label: 'Academic Timetable',
            icon: 'bi-calendar-week',
        },
        {
            to: '/staff/circulars',
            label: 'Circulars',
            icon: 'bi-megaphone-fill',
        },
        {
            to: '/staff/materials',
            label: 'Learning Materials',
            icon: 'bi-folder2-open',
        },
        {
            to: '/staff/leave',
            label: 'Leave & On-Duty Management',
            icon: 'bi-person-lines-fill',
            subItems: isHOD
                ? [
                    { to: '/staff/leave?view=students', label: 'Student Requests' },
                    { to: '/staff/leave?view=staff', label: 'Staff Requests' },
                ]
                : []
        },
        {
            to: '/staff/performance',
            label: 'Academic Performance Feedback',
            icon: 'bi-graph-up-arrow',
        },
        {
            to: '/staff/my-attendance',
            label: 'My Attendance Overview',
            icon: 'bi-person-check',
        },
    ], [isHOD])

    const isActiveLink = (to) => {
        const [toPath, toQuery] = to.split('?')
        if (toPath !== pathname) return false
        if (!toQuery) return true
        const currentParams = new URLSearchParams(search)
        const targetParams = new URLSearchParams(toQuery)
        for (const [key, value] of targetParams.entries()) {
            if (currentParams.get(key) !== value) return false
        }
        return true
    }

    const handleLogout = () => {
        signOut()
        navTo('/staff/login')
    }

    return (
        <div className={`student-portal staff-portal ${collapsed ? 'student-portal--collapsed' : ''}`}>
            <header className="student-header student-header--global">
                <div className="student-header__brand">
                    <button
                        type="button"
                        className="student-header__toggle"
                        onClick={() => setCollapsed((prev) => !prev)}
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <i className={`bi ${collapsed ? 'bi-chevron-double-right' : 'bi-list'}`}></i>
                    </button>
                    <img src={crest} alt="Vijayam crest" className="student-header__logo" />
                    <div className="student-header__portal">Staff Portal</div>
                </div>
                <div className="student-header__center">
                    <div className="student-header__title">Vijayam Arts & Science College</div>
                </div>
                <div className="student-header__right">
                    <div className="d-flex align-items-center gap-3 me-3 text-white border-end pe-3">
                        <div className="text-end" style={{ lineHeight: '1.2' }}>
                            <div className="fw-bold small">{staff?.full_name || 'Staff'}</div>
                        </div>
                        <div className="text-end small d-none d-md-block" style={{ lineHeight: '1.2', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '1rem' }}>
                            <div>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                            <div className="opacity-75">{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                    </div>
                    <button className="student-header__logout" type="button" onClick={handleLogout}>
                        <i className="bi bi-box-arrow-right"></i> Logout
                    </button>
                </div>
            </header>

            <div className="student-body">
                <aside className="student-sidebar">
                    <nav className="student-sidebar__nav">
                        {navItems.map((item) => {
                            const hasActiveChild = item.subItems?.some((subItem) => isActiveLink(subItem.to))
                            const isActiveParent = isActiveLink(item.to) || hasActiveChild
                            const showSubnav = isActiveParent || openSection === item.to
                            return (
                            <div key={item.to}>
                                {item.subItems?.length ? (
                                    <button
                                        type="button"
                                        className={`student-sidebar__link ${isActiveParent ? 'active' : ''}`}
                                        onClick={() => setOpenSection((prev) => (prev === item.to ? null : item.to))}
                                        aria-expanded={showSubnav}
                                    >
                                        <i className={`bi ${item.icon}`}></i>
                                        <span>{item.label}</span>
                                    </button>
                                ) : (
                                    <Link
                                        to={item.to}
                                        className={`student-sidebar__link ${isActiveLink(item.to) ? 'active' : ''}`}
                                    >
                                        <i className={`bi ${item.icon}`}></i>
                                        <span>{item.label}</span>
                                    </Link>
                                )}
                                {!!item.subItems?.length && showSubnav && (
                                    <div className="student-sidebar__subnav">
                                        {item.subItems.map((subItem) => (
                                            <Link
                                                key={subItem.to}
                                                to={subItem.to}
                                                className={`student-sidebar__link student-sidebar__link--sub ${isActiveLink(subItem.to) ? 'active' : ''}`}
                                            >
                                                <span>{subItem.label}</span>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                            )
                        })}
                    </nav>
                </aside>

                <div className="student-main">
                    <div className="student-content">{children}</div>
                </div>
            </div>
        </div>
    )
}
