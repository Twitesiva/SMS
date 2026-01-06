import { useEffect, useMemo, useState } from 'react'
import StudentShell from '../../components/StudentShell'
import { supabase } from '../../../supabaseClient'
import { useStudentAuth } from '../../store/studentAuth'

export default function StudentAttendance() {
  const { student } = useStudentAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadAttendance = async () => {
      if (!student?.id) {
        setError('Student profile is missing.')
        return
      }

      setLoading(true)
      setError('')
      try {
        const { data: recordRows, error: recordError } = await supabase
          .from('attendance_records')
          .select('id, status, attendance_session_id, created_at')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })

        if (recordError) throw recordError

        const sessionIds = (recordRows || []).map((row) => row.attendance_session_id).filter(Boolean)
        if (!sessionIds.length) {
          setRecords([])
          return
        }

        const { data: sessionRows, error: sessionError } = await supabase
          .from('attendance_sessions')
          .select('id, attendance_date, subject_id')
          .in('id', sessionIds)

        if (sessionError) throw sessionError

        const subjectIds = (sessionRows || []).map((row) => row.subject_id).filter(Boolean)
        const subjectMap = new Map()
        if (subjectIds.length) {
          const { data: subjectRows, error: subjectError } = await supabase
            .from('subjects')
            .select('subject_id, subject_name, subject_code')
            .in('subject_id', subjectIds)

          if (subjectError) throw subjectError

          ;(subjectRows || []).forEach((row) => {
            subjectMap.set(row.subject_id, row)
          })
        }

        const sessionMap = new Map()
        ;(sessionRows || []).forEach((row) => {
          sessionMap.set(row.id, row)
        })

        const merged = (recordRows || []).map((row) => {
          const session = sessionMap.get(row.attendance_session_id)
          const subject = session ? subjectMap.get(session.subject_id) : null
          return {
            ...row,
            attendance_sessions: session
              ? {
                  attendance_date: session.attendance_date,
                  subjects: subject || null
                }
              : null
          }
        })

        setRecords(merged)
      } catch (err) {
        console.error('Failed to load attendance', err)
        setError('Unable to load attendance right now.')
        setRecords([])
      } finally {
        setLoading(false)
      }
    }

    loadAttendance()
  }, [student?.id])

  const summary = useMemo(() => {
    const total = records.length
    const present = records.filter((row) => row.status === 'PRESENT').length
    const absent = records.filter((row) => row.status === 'ABSENT').length
    const rate = total > 0 ? Math.round((present / total) * 100) : 0
    return { total, present, absent, rate }
  }, [records])

  const formatStatus = (status) => {
    if (status === 'PRESENT') return 'Present'
    if (status === 'ABSENT') return 'Absent'
    return status || 'Unknown'
  }

  const statusClass = (status) => {
    if (status === 'PRESENT') return 'student-attendance-badge student-attendance-badge--present'
    if (status === 'ABSENT') return 'student-attendance-badge student-attendance-badge--absent'
    return 'student-attendance-badge'
  }

  return (
    <StudentShell>
      <div className="student-attendance">
        <section className="student-attendance__hero">
          <div className="student-attendance__hero-content">
            <div className="student-attendance__eyebrow">Student Portal</div>
            <h2 className="student-attendance__title">Attendance Overview</h2>
            <p className="student-attendance__subtitle">
              Track present and absent sessions with subject-wise history.
            </p>
          </div>
        </section>

        <div className="student-attendance__stats">
          <div className="student-attendance__stat">
            <div className="student-attendance__stat-head">
              <span className="student-attendance__stat-icon">
                <i className="bi bi-collection" aria-hidden="true"></i>
              </span>
              <div className="student-attendance__stat-label">Total Sessions</div>
            </div>
            <div className="student-attendance__stat-value">{summary.total}</div>
            <div className="student-attendance__stat-meta">Recorded entries</div>
          </div>
          <div className="student-attendance__stat">
            <div className="student-attendance__stat-head">
              <span className="student-attendance__stat-icon student-attendance__stat-icon--present">
                <i className="bi bi-check2-circle" aria-hidden="true"></i>
              </span>
              <div className="student-attendance__stat-label">Present</div>
            </div>
            <div className="student-attendance__stat-value">{summary.present}</div>
            <div className="student-attendance__stat-meta">Attended classes</div>
          </div>
          <div className="student-attendance__stat">
            <div className="student-attendance__stat-head">
              <span className="student-attendance__stat-icon student-attendance__stat-icon--absent">
                <i className="bi bi-x-circle" aria-hidden="true"></i>
              </span>
              <div className="student-attendance__stat-label">Absent</div>
            </div>
            <div className="student-attendance__stat-value">{summary.absent}</div>
            <div className="student-attendance__stat-meta">Missed sessions</div>
          </div>
          <div className="student-attendance__stat">
            <div className="student-attendance__stat-head">
              <span className="student-attendance__stat-icon student-attendance__stat-icon--rate">
                <i className="bi bi-graph-up" aria-hidden="true"></i>
              </span>
              <div className="student-attendance__stat-label">Attendance Rate</div>
            </div>
            <div className="student-attendance__stat-value">{summary.rate}%</div>
            <div className="student-attendance__stat-meta">Overall percentage</div>
          </div>
        </div>

        <div className="student-attendance__table-card">
          <div className="student-attendance__table-header">
            <div>
              <h4 className="mb-1">Recent Attendance</h4>
              <p className="text-muted mb-0">Latest sessions with subject details.</p>
            </div>
            <div className="student-attendance__table-meta">
              {loading ? 'Loading...' : `${records.length} records`}
            </div>
          </div>
          {error ? (
            <div className="student-attendance__empty">{error}</div>
          ) : (
            <div className="table-responsive">
              <table className="table student-attendance__table mb-0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Subject</th>
                    <th className="text-end">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="3" className="text-center text-muted py-4">Loading attendance...</td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center text-muted py-4">No attendance records yet.</td>
                    </tr>
                  ) : (
                    records.slice(0, 12).map((row) => {
                      const session = row.attendance_sessions
                      const subject = session?.subjects
                      return (
                        <tr key={row.id}>
                          <td>{session?.attendance_date || '--'}</td>
                          <td>
                            <div className="student-attendance__subject">
                              {subject?.subject_name || 'Unknown subject'}
                            </div>
                            <div className="student-attendance__subject-code">
                              {subject?.subject_code || '--'}
                            </div>
                          </td>
                          <td className="text-end">
                            <span className={statusClass(row.status)}>{formatStatus(row.status)}</span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </StudentShell>
  )
}
