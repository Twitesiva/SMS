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

  const handleLogout = () => {
    signOut()
    navTo('/student/login')
  }

  return (
    <div className="student-portal">
      <aside className="student-sidebar">
        <div className="student-sidebar__brand">
          <img src={crest} alt="Vijayam crest" className="student-sidebar__logo" />
          <div>
            <div className="student-sidebar__title">Student Portal</div>
            <div className="student-sidebar__subtitle">Vijayam Arts & Science College</div>
          </div>
        </div>

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
          <div className="student-sidebar__student-id">{student?.student_id || 'Student ID'}</div>
          <div className="student-sidebar__student-name">{student?.full_name || 'Student'}</div>
        </div>
      </aside>

      <div className="student-main">
        <header className="student-header">
          <div className="student-header__title">Vijayam Arts & Science College</div>
          <button className="student-header__logout" type="button" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right"></i> Logout
          </button>
        </header>
        <div className="student-content">{children}</div>
      </div>
    </div>
  )
}
