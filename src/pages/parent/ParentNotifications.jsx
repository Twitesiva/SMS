import { useEffect, useMemo, useState } from 'react'
import ParentShell from '../../components/ParentShell'
import { supabase } from '../../../supabaseClient'
import { useParentAuth } from '../../store/parentAuth'

import { resolveStudentCourseGroup } from '../../lib/resolveStudentCourseGroup'

export default function ParentNotifications() {
  const { parent } = useParentAuth()
  const [studentRecord, setStudentRecord] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const loadNotifications = async () => {
      if (!parent?.student_id) {
        setError('Student ID not available for this parent.')
        return
      }

      setLoading(true)
      setError('')
      try {
        const { data: studentRow, error: studentError } = await supabase
          .from('students')
          .select('id, full_name, student_id, course_name, group_name, academic_year, gender')
          .eq('student_id', parent.student_id)
          .maybeSingle()

        if (studentError) throw studentError
        if (!studentRow) throw new Error('Student record not found.')

        const resolvedStudent = await resolveStudentCourseGroup(supabase, studentRow)
        if (!active) return
        setStudentRecord(resolvedStudent)

        const { data: absenceRows, error: absenceError } = await supabase
          .from('attendance_records')
          .select('attendance_session_id, status')
          .eq('student_id', studentRow.id)
          .eq('status', 'ABSENT')
          .order('created_at', { ascending: false })
          .limit(10)

        if (absenceError) throw absenceError

        const sessionIds = (absenceRows || []).map((row) => row.attendance_session_id).filter(Boolean)
        if (!sessionIds.length) {
          if (active) setNotifications([])
          return
        }

        const { data: sessions, error: sessionError } = await supabase
          .from('attendance_sessions')
          .select('id, attendance_date')
          .in('id', sessionIds)
          .order('attendance_date', { ascending: false })

        if (sessionError) throw sessionError

        const normalizedGender = (studentRow?.gender || '').toString().trim().toLowerCase()
        const childLabel = normalizedGender.startsWith('f') ? 'daughter' : normalizedGender.startsWith('m') ? 'son' : 'child'
        const notices = (sessions || []).map((row) => {
          const dateText = new Date(`${row.attendance_date}T00:00:00`).toLocaleDateString('en-GB')
          return {
            id: row.id,
            title: 'Absent Notice :',
            text: `This notification is to inform you that your ${childLabel} was recorded as absent in the official attendance register for the school day on ${dateText}.`
          }
        })

        if (active) setNotifications(notices)
      } catch (err) {
        if (active) setError(err?.message || 'Unable to load notifications.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadNotifications()
    return () => {
      active = false
    }
  }, [parent?.student_id])

  const badges = useMemo(() => {
    if (!studentRecord) return []
    return [
      studentRecord.course_display || studentRecord.course_name,
      studentRecord.group_display || studentRecord.group_name,
      studentRecord.academic_year
    ].filter(Boolean)
  }, [studentRecord])

  return (
    <ParentShell>
      <div className="students-section-shell">
        <div className="student-card mb-4">
          <div className="student-card__header">Notifications</div>

        </div>

        {loading && (
          <div className="student-details__loading" role="status" aria-live="polite">
            <div className="student-details__loading-header">
              <div className="student-loader__spinner" aria-hidden="true"></div>
              <div>
                <div className="student-loader__title">Loading notifications</div>
                <div className="student-loader__subtitle">Fetching absence alerts.</div>
              </div>
            </div>
            <span className="sr-only">Loading notifications...</span>
          </div>
        )}

        {error && !loading && (
          <div className="student-details__status student-details__status--error">{error}</div>
        )}

        {!loading && !error && (
          <div className="student-card">

            <div className="student-card__body">
              {notifications.length ? (
                <div className="student-detail-list">
                  {notifications.map((note) => (
                    <div key={note.id} className="parent-notification-item">
                      <div className="student-detail-label">{note.title}</div>
                      <p className="parent-notification-text">{note.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="student-card__empty">No recent notifications.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </ParentShell>
  )
}

