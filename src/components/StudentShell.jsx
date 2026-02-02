import React, { useLayoutEffect, useRef, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useStudentAuth } from '../store/studentAuth'
import crest from '../assets/media/images.png'
import { supabase } from '../../supabaseClient'
import './StudentShell.css'

const navItems = [
  { to: '/student/dashboard', label: 'My Profile', icon: 'bi-speedometer2' },
  { to: '/student/personal-details', label: 'Personal details', icon: 'bi-person' },
  { to: '/student/course-list', label: 'Learning Materials', icon: 'bi-journal-text' },
  { to: '/student/time-table', label: 'Time table', icon: 'bi-clock-history' },
  { to: '/student/hostel-details', label: 'Hostel Details', icon: 'bi-house-door' },
  { to: '/student/fee-payment', label: 'Fee payment', icon: 'bi-credit-card' },
  { to: '/student/certificate', label: 'Certificate', icon: 'bi-patch-check' },
  { to: '/student/leave-request', label: 'Leave Request', icon: 'bi-calendar-minus' },

  { to: '/student/attendance', label: 'Attendance', icon: 'bi-calendar-check' },
  { to: '/student/notifications', label: 'Notifications', icon: 'bi-bell' },
  { to: '/student/circulars', label: 'Circulars', icon: 'bi-megaphone' },
  { to: '/student/results', label: 'Results', icon: 'bi-file-earmark-bar-graph' },
  { to: '/student/transport', label: 'Transport', icon: 'bi-bus-front' },
  { to: '/student/library', label: 'Library', icon: 'bi-book' },
]

const isRouteActive = (pathname, to) => {
  return pathname === to || pathname.startsWith(`${to}/`)
}

export default function StudentShell({ children }) {
  const { pathname } = useLocation()
  const navTo = useNavigate()
  const { student, signOut } = useStudentAuth()
  const [isHostelStudent, setIsHostelStudent] = useState(Boolean(student?.is_hostel))
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const handleLogout = () => {
    signOut()
    navTo('/student/login')
  }

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

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
            title: 'Attendance Update',
            message: `You have been marked absent on ${new Date(`${dateValue}T00:00:00`).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })}.\nIf this record is incorrect, kindly contact your HOD.`,
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
    let isMounted = true
    const loadHostelFlag = async () => {
      if (!student?.id) {
        if (isMounted) setIsHostelStudent(Boolean(student?.is_hostel))
        return
      }
      try {
        const { data, error } = await supabase
          .from('students')
          .select('is_hostel')
          .eq('id', student.id)
          .maybeSingle()
        if (error) throw error
        if (isMounted) setIsHostelStudent(Boolean(data?.is_hostel))
      } catch (err) {
        console.error('Failed to load hostel status', err)
        if (isMounted) setIsHostelStudent(Boolean(student?.is_hostel))
      }
    }
    loadHostelFlag()
    return () => {
      isMounted = false
    }
  }, [student?.id, student?.is_hostel])

  useEffect(() => {
    if (pathname !== '/student/notifications' || !student?.id) return
    const readKey = `student-notifications-read:${student.id}`
    const readIds = new Set(JSON.parse(localStorage.getItem(readKey) || '[]'))
    notifications.forEach((note) => readIds.add(note.id))
    localStorage.setItem(readKey, JSON.stringify(Array.from(readIds)))
    setUnreadCount(0)
  }, [pathname, notifications, student?.id])

  const navRef = React.useRef(null)

  // Restore sidebar scroll position
  useLayoutEffect(() => {
    const savedScroll = sessionStorage.getItem('studentSidebarScroll')
    if (navRef.current && savedScroll) {
      navRef.current.scrollTop = Number(savedScroll)
    }
  }, [])

  // Save sidebar scroll position
  useEffect(() => {
    const navEl = navRef.current
    if (!navEl) return

    const handleScroll = () => {
      sessionStorage.setItem('studentSidebarScroll', navEl.scrollTop)
    }

    navEl.addEventListener('scroll', handleScroll)
    return () => navEl.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className={`student-portal ${collapsed ? 'student-portal--collapsed' : ''} ${mobileOpen ? 'student-portal--mobile-open' : ''}`}>
      {/* Mobile Backdrop */}
      <div
        className="student-portal__backdrop"
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      ></div>

      <aside className="student-sidebar">
        <div className={`student-sidebar__header d-flex align-items-center ${collapsed ? 'flex-column justify-content-center py-4 gap-3' : 'px-4 py-4'}`}>
          <img src={crest} alt="Vijayam crest" className="student-header__logo" />
          <div className={`student-sidebar__brand ms-3 ${collapsed ? 'd-none' : ''}`}>
            <div className="fw-bold text-white text-uppercase" style={{ fontSize: '1rem', letterSpacing: '0.05em', lineHeight: '1.2' }}>Vijayam</div>
            <div className="text-white-50 small text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Arts & Science College</div>
          </div>

          <button
            type="button"
            className={`student-sidebar__toggle ${collapsed ? '' : 'ms-auto'}`}
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i className={`bi ${collapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'}`} style={{ color: 'white' }}></i>
          </button>
        </div>

        <nav className="student-sidebar__nav" ref={navRef}>
          {navItems.map((item) => {
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`student-sidebar__link ${isRouteActive(pathname, item.to) ? 'active' : ''}`}
              >
                <i className={`bi ${item.icon}`}></i>
                <span>{item.label}</span>
                {item.to === '/student/notifications' && unreadCount > 0 && (
                  <span className="student-sidebar__link-badge">{unreadCount}</span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="student-sidebar__footer text-center mt-auto pb-3">
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem" }}>
            Made by <a href="https://www.twite.ai" target="_blank" rel="noopener noreferrer" style={{ color: "#fff", textDecoration: "none", fontWeight: "bold" }}>Twite AI Technologies</a>
          </div>
        </div>
      </aside>

      <div className="student-main-wrapper">
        <header className="student-header student-header--global">
          <div className="student-header__brand">
            <button
              type="button"
              className="student-header__toggle student-header__toggle--mobile"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              <i className={`bi ${mobileOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
            </button>
            <div className="student-header__portal">Student Portal</div>
          </div>

          <div className="student-header__right">
            <div className="d-flex align-items-center gap-3 me-3 text-white border-end pe-3">
              <div className="text-end" style={{ lineHeight: '1.2' }}>
                <div className="fw-bold small">{student?.full_name || 'Student'}</div>
                <div className="small opacity-75">{student?.student_id || '—'}</div>
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
          <div className="student-main">
            <div className="student-content">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
