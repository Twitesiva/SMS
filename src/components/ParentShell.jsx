import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useParentAuth } from '../store/parentAuth'
import crest from '../assets/media/images.png'

const navItems = [
    { to: '/parent/student-details', label: 'Student Details', icon: 'bi-person-badge' },
    { to: '/parent/attendance', label: 'Attendance', icon: 'bi-calendar-check' },
    { to: '/parent/marks', label: 'Marks', icon: 'bi-file-earmark-bar-graph' },
    { to: '/parent/notifications', label: 'Notifications', icon: 'bi-bell' },
]

export default function ParentShell({ children }) {
    const { pathname } = useLocation()
    const navTo = useNavigate()
    const { parent, signOut } = useParentAuth()
    const [collapsed, setCollapsed] = useState(false)

    const handleLogout = () => {
        signOut()
        navTo('/parent/login')
    }

    return (
        <div className={`student-portal ${collapsed ? 'student-portal--collapsed' : ''}`}>
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
                    <div className="student-header__portal">Parent Portal</div>
                </div>
                <div className="student-header__center">
                    <div className="student-header__title">Vijayam Arts & Science College</div>
                </div>
                <div className="student-header__right">
                    <button className="student-header__logout" type="button" onClick={handleLogout}>
                        <i className="bi bi-box-arrow-right"></i> Logout
                    </button>
                </div>
            </header>

            <div className="student-body">
                <aside className="student-sidebar">
                    <nav className="student-sidebar__nav">
                        {navItems.map((item) => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={`student-sidebar__link ${pathname === item.to ? 'active' : ''}`}
                            >
                                <i className={`bi ${item.icon}`}></i>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    <div className="student-sidebar__footer text-center mt-auto pb-3">
                        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem" }}>
                            Made by <a href="https://www.twite.ai" target="_blank" rel="noopener noreferrer" style={{ color: "#fff", textDecoration: "none", fontWeight: "bold" }}>Twite AI Technologies</a>
                        </div>
                    </div>
                </aside>

                <div className="student-main">
                    <div className="student-content">{children}</div>
                </div>
            </div>
        </div>
    )
}
