import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useStudentAuth } from '../store/studentAuth'
import crest from '../assets/media/images.png'
import { supabase } from '../../supabaseClient'

const navItems = [
  { to: '/student/dashboard', label: 'My Profile', icon: 'bi-speedometer2' },
  { to: '/student/personal-details', label: 'Personal details', icon: 'bi-person' },
  { to: '/student/course-list', label: 'Learning Materials', icon: 'bi-journal-text' },
  { to: '/student/time-table', label: 'Time table', icon: 'bi-clock-history' },
  { to: '/student/hostel-details', label: 'Hostel details', icon: 'bi-house-door' },
  { to: '/student/fee-payment', label: 'Fee payment', icon: 'bi-credit-card' },
  { to: '/student/certificate', label: 'Certificate', icon: 'bi-patch-check' },
  { to: '/student/leave-request', label: 'Leave Request', icon: 'bi-calendar-minus' },

  { to: '/student/attendance', label: 'Attendance', icon: 'bi-calendar-check' },
  { to: '/student/notifications', label: 'Notifications', icon: 'bi-bell' },
  { to: '/student/circulars', label: 'Circulars', icon: 'bi-megaphone' },
  { to: '/student/exam-result', label: 'Exam result', icon: 'bi-file-earmark-bar-graph' },
  { to: '/student/transport', label: 'Transport', icon: 'bi-bus-front' },
]

export default function StudentShell({ children }) {
  const { pathname } = useLocation()
  const navTo = useNavigate()
  const { student, signOut } = useStudentAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const handleLogout = () => {
    signOut()
    navTo('/student/login')
  }

  useEffect(() => {
    const loadNotifications = async () => {
      if (!student?.id) {
        setNotifications([])
        setUnreadCount(0)
        return
      }

      try {
        const { data: absenceRows, error: absenceError } = await supabase
          .from('attendance_records')
          .select('attendance_session_id, status')
          .eq('student_id', student.id)
          .eq('status', 'ABSENT')
          .order('created_at', { ascending: false })
          .limit(30)

        if (absenceError) throw absenceError

        const sessionIds = (absenceRows || [])
          .map((row) => row.attendance_session_id)
          .filter(Boolean)

        if (!sessionIds.length) {
          setNotifications([])
          return
        }

        const { data: sessions, error: sessionError } = await supabase
          .from('attendance_sessions')
          .select('id, attendance_date')
          .in('id', sessionIds)

        if (sessionError) throw sessionError

        const dates = Array.from(
          new Set((sessions || []).map((row) => row.attendance_date).filter(Boolean))
        ).sort((a, b) => (a < b ? 1 : -1))

        if (!dates.length) {
          setNotifications([])
          return
        }

        const { data: leaveRows, error: leaveError } = await supabase
          .from('leave_requests')
          .select('from_date, to_date, status')
          .eq('applicant_type', 'STUDENT')
          .eq('applicant_id', student.id)
          .in('status', ['APPROVED', 'HOD_APPROVED', 'APPROVED_BY_HOD'])

        if (leaveError) throw leaveError

        const onApprovedLeave = (dateValue) =>
          (leaveRows || []).some((leave) => {
            if (!leave.from_date || !leave.to_date) return false
            return dateValue >= leave.from_date && dateValue <= leave.to_date
          })

        const notices = dates
          .filter((dateValue) => !onApprovedLeave(dateValue))
          .slice(0, 5)
          .map((dateValue) => ({
            id: dateValue,
            title: 'Absent Marked',
            message: `You were marked absent on ${new Date(`${dateValue}T00:00:00`).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })}. If you attended, contact your HOD.`,
            date: dateValue
          }))

        setNotifications(notices)
        const readKey = `student-notifications-read:${student.id}`
        const readIds = new Set(JSON.parse(localStorage.getItem(readKey) || '[]'))
        const unread = notices.filter((note) => !readIds.has(note.id)).length
        setUnreadCount(unread)
      } catch (error) {
        console.error('Failed to load attendance notifications', error)
        setNotifications([])
        setUnreadCount(0)
      }
    }

    loadNotifications()
  }, [student?.id])

  useEffect(() => {
    if (pathname !== '/student/notifications' || !student?.id) return
    const readKey = `student-notifications-read:${student.id}`
    const readIds = new Set(JSON.parse(localStorage.getItem(readKey) || '[]'))
    notifications.forEach((note) => readIds.add(note.id))
    localStorage.setItem(readKey, JSON.stringify(Array.from(readIds)))
    setUnreadCount(0)
  }, [pathname, notifications, student?.id])

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
                {item.to === '/student/notifications' && unreadCount > 0 && (
                  <span className="student-sidebar__link-badge">{unreadCount}</span>
                )}
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
