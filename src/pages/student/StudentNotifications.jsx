import { useEffect, useState } from 'react'
import StudentShell from '../../components/StudentShell'
import { supabase } from '../../../supabaseClient'
import { useStudentAuth } from '../../store/studentAuth'
import './Student.css'

export default function StudentNotifications() {
  const { student } = useStudentAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadNotifications = async () => {
      if (!student?.id) {
        setNotifications([])
        return
      }

      setLoading(true)
      setError('')
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
          .map((dateValue) => ({
            id: dateValue,
            title: 'Attendance Update',
            message: `You have been marked absent on ${new Date(`${dateValue}T00:00:00`).toLocaleDateString('en-GB')}.\nIf this record is incorrect, kindly contact your HOD.`,
            date: dateValue
          }))

        setNotifications(notices)

        const readKey = `student-notifications-read:${student.id}`
        localStorage.setItem(readKey, JSON.stringify(notices.map((note) => note.id)))
      } catch (err) {
        console.error('Failed to load notifications', err)
        setError('Unable to load notifications right now.')
        setNotifications([])
      } finally {
        setLoading(false)
      }
    }

    loadNotifications()
  }, [student?.id])

  return (
    <StudentShell>
      <div className="students-section-shell">
        <div className="student-card mb-4">
          <div className="student-card__header">Notifications</div>
          <div className="student-card__body">
            <p className="students-section-copy mb-0">
              Attendance alerts and important updates.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="student-details__loading" role="status" aria-live="polite">
            <div className="student-loader__spinner mx-auto mb-2" aria-hidden="true"></div>
            <div className="text-center text-muted">Loading notifications...</div>
          </div>
        ) : error ? (
          <div className="student-details__status student-details__status--error">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="student-details__status">No notifications right now.</div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {notifications.map((note) => (
              <div key={note.id} className="student-card">
                <div className="student-card__header">{note.title}</div>
                <div className="student-card__body student-notification__message" style={{ whiteSpace: 'pre-line' }}>
                  {note.message}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StudentShell>
  )
}

