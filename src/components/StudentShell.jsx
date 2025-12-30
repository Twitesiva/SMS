import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useStudentAuth } from '../store/studentAuth'
import crest from '../assets/media/images.png'

const navItems = [
  { to: '/student/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
  { to: '/student/personal-details', label: 'Personal details', icon: 'bi-person' },
  { to: '/student/course-list', label: 'Course list', icon: 'bi-journal-text' },
  { to: '/student/grade-mark', label: 'Grade / Mark', icon: 'bi-award' },
  { to: '/student/attendance', label: 'Attendance', icon: 'bi-calendar-check' },
  { to: '/student/exam-result', label: 'Exam result', icon: 'bi-file-earmark-bar-graph' },
  { to: '/student/time-table', label: 'Time table', icon: 'bi-clock-history' },
  { to: '/student/hostel-details', label: 'Hostel details', icon: 'bi-house-door' },
  { to: '/student/transport', label: 'Transport', icon: 'bi-bus-front' },
  { to: '/student/fee-payment', label: 'Fee payment', icon: 'bi-credit-card' },
]

export default function StudentShell({ children }) {
  const { pathname } = useLocation()
  const navTo = useNavigate()
  const { student, signOut } = useStudentAuth()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    signOut()
    navTo('/student/login')
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
          <div className="student-header__portal">Student Portal</div>
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

          <div className="student-sidebar__footer">
            <div className="student-sidebar__student-id">{student?.student_id || '—'}</div>
            <div className="student-sidebar__student-name">{student?.full_name || 'Student'}</div>
            <div className="student-sidebar__datetime">
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' '}
              {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
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
