import { useEffect, useMemo, useState } from 'react'
import ParentShell from '../../components/ParentShell'
import { supabase } from '../../../supabaseClient'
import { useParentAuth } from '../../store/parentAuth'
import '../student/Student.css'

export default function ParentAttendance() {
  const { parent } = useParentAuth()
  const [studentRecord, setStudentRecord] = useState(null)
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, total: 0, rate: '0.0' })
  const [absences, setAbsences] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const loadAttendance = async () => {
      if (!parent?.student_id) {
        setError('Student ID not available for this parent.')
        return
      }

      setLoading(true)
      setError('')
      try {
        const { data: studentRow, error: studentError } = await supabase
          .from('students')
          .select('id, full_name, student_id, course_name, group_name, academic_year')
          .eq('student_id', parent.student_id)
          .maybeSingle()

        if (studentError) throw studentError
        if (!studentRow) throw new Error('Student record not found.')

        if (!active) return
        setStudentRecord(studentRow)

        const { data: attendanceRows, error: attendanceError } = await supabase
          .from('attendance_records')
          .select('status, attendance_session_id')
          .eq('student_id', studentRow.id)

        if (attendanceError) throw attendanceError

        const total = (attendanceRows || []).length
        const present = (attendanceRows || []).filter((row) => row.status === 'PRESENT').length
        const absent = Math.max(total - present, 0)
        const rate = total ? ((present / total) * 100).toFixed(1) : '0.0'

        if (!active) return
        setAttendanceStats({ present, absent, total, rate })

        const absentSessionIds = (attendanceRows || [])
          .filter((row) => row.status === 'ABSENT' && row.attendance_session_id)
          .map((row) => row.attendance_session_id)

        if (absentSessionIds.length) {
          const { data: sessionRows, error: sessionError } = await supabase
            .from('attendance_sessions')
            .select('id, attendance_date')
            .in('id', absentSessionIds)
            .order('attendance_date', { ascending: false })

          if (sessionError) throw sessionError
          const formatted = (sessionRows || []).slice(0, 6).map((row) => ({
            id: row.id,
            date: new Date(`${row.attendance_date}T00:00:00`).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })
          }))
          if (active) setAbsences(formatted)
        } else if (active) {
          setAbsences([])
        }
      } catch (err) {
        if (active) setError(err?.message || 'Unable to load attendance details.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadAttendance()
    return () => {
      active = false
    }
  }, [parent?.student_id])

  const badges = useMemo(() => {
    if (!studentRecord) return []
    return [studentRecord.course_name, studentRecord.group_name, studentRecord.academic_year].filter(Boolean)
  }, [studentRecord])

  return (
    <ParentShell>
      <div className="students-section-shell">
        <div className="students-section-shell-header">
          <h2 className="mb-2">Attendance</h2>
          <p className="students-section-copy mb-3">
            Review attendance totals and recent absences.
          </p>
          {badges.length > 0 && (
            <div className="d-flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span key={badge} className="students-section-badge students-section-badge-course">
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="student-details__loading" role="status" aria-live="polite">
            <div className="student-details__loading-header">
              <div className="student-loader__spinner" aria-hidden="true"></div>
              <div>
                <div className="student-loader__title">Loading attendance</div>
                <div className="student-loader__subtitle">Fetching attendance stats.</div>
              </div>
            </div>
            <span className="sr-only">Loading attendance...</span>
          </div>
        )}

        {error && !loading && (
          <div className="student-details__status student-details__status--error">{error}</div>
        )}

        {!loading && !error && studentRecord && (
          <div className="student-dashboard__grid">
            <div className="student-card">
              <div className="student-card__header">Attendance Summary</div>
              <div className="student-card__body">
                <div className="student-detail-row">
                  <div className="student-detail-label">Present</div>
                  <div className="student-detail-colon">:</div>
                  <div className="student-detail-value">{attendanceStats.present}</div>
                </div>
                <div className="student-detail-row">
                  <div className="student-detail-label">Absent</div>
                  <div className="student-detail-colon">:</div>
                  <div className="student-detail-value">{attendanceStats.absent}</div>
                </div>
                <div className="student-detail-row">
                  <div className="student-detail-label">Attendance %</div>
                  <div className="student-detail-colon">:</div>
                  <div className="student-detail-value">{attendanceStats.rate}%</div>
                </div>
              </div>
            </div>

            <div className="student-card">
              <div className="student-card__header">Recent Absences</div>
              <div className="student-card__body">
                {absences.length ? (
                  <div className="student-detail-list">
                    {absences.map((absence) => (
                      <div key={absence.id} className="student-detail-row">
                        <div className="student-detail-label">Absent</div>
                        <div className="student-detail-colon">:</div>
                        <div className="student-detail-value">{absence.date}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="student-card__empty">No recent absences recorded.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ParentShell>
  )
}
