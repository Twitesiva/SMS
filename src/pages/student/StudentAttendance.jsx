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

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Grouping by Date
  const dateWiseRecords = useMemo(() => {
    const map = new Map()
    records.forEach((r) => {
      const d = r.attendance_sessions?.attendance_date
      if (!d) return
      if (!map.has(d)) map.set(d, [])
      map.get(d).push(r)
    })
    return Array.from(map.entries())
      .map(([date, sessions]) => ({ date, sessions }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [records])

  const todayData = useMemo(() => {
    const dayEntry = dateWiseRecords.find((d) => d.date === todayIso)
    const sessions = dayEntry?.sessions || []
    const present = sessions.filter((s) => s.status === 'PRESENT').length
    const total = sessions.length
    const rate = total > 0 ? Math.round((present / 5) * 100) : 0 // Assuming 5 is full day

    let label = 'NO DATA'
    let tone = 'secondary'
    if (total > 0) {
      if (present >= 5) { label = 'FULL PRESENT'; tone = 'success'; }
      else if (present >= 3) { label = 'HALF DAY'; tone = 'warning'; }
      else { label = 'ABSENT / PARTIAL'; tone = 'danger'; }
    }

    return { present, total, rate, label, tone, sessions }
  }, [dateWiseRecords, todayIso])

  const overallStats = useMemo(() => {
    const totalCount = records.length
    const presentCount = records.filter((r) => r.status === 'PRESENT').length
    const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0
    return { totalCount, presentCount, rate }
  }, [records])

  const formatDate = (value) => {
    if (!value) return 'N/A'
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <StudentShell>
      <div className="student-details student-attendance">
        <div className="student-details__header">
          <h2 className="fw-bold text-dark">Attendance Analysis</h2>
          <p className="text-dark fw-semibold">Monitor your daily sessions and attendance status.</p>
        </div>

        <div className="student-attendance__stats">
          <div className="student-attendance__stat">
            <div className="student-attendance__stat-head">
              <span className="student-attendance__stat-icon">
                <i className="bi bi-calendar-check text-primary" aria-hidden="true"></i>
              </span>
              <div className="student-attendance__stat-label fw-bold text-dark">Today's Sessions</div>
            </div>
            <div className="student-attendance__stat-value text-dark">{todayData.total} / 5</div>
            <div className="student-attendance__stat-meta text-dark">Recorded for today</div>
          </div>
          <div className="student-attendance__stat">
            <div className="student-attendance__stat-head">
              <span className="student-attendance__stat-icon">
                <i className="bi bi-graph-up text-info" aria-hidden="true"></i>
              </span>
              <div className="student-attendance__stat-label fw-bold text-dark">Today's Rate</div>
            </div>
            <div className="student-attendance__stat-value text-dark">{todayData.rate}%</div>
            <div className="student-attendance__stat-meta text-dark">Daily percentage</div>
          </div>
          <div className="student-attendance__stat">
            <div className="student-attendance__stat-head">
              <span className="student-attendance__stat-icon">
                <i className="bi bi-globe text-primary" aria-hidden="true"></i>
              </span>
              <div className="student-attendance__stat-label fw-bold text-dark">Overall Rate</div>
            </div>
            <div className="student-attendance__stat-value text-dark">{overallStats.rate}%</div>
            <div className="student-attendance__stat-meta text-dark">Total attendance</div>
          </div>
        </div>

        <div className="student-attendance__main">
          <div className="student-attendance__table-card">
            <div className="student-attendance__table-header">
              <div>
                <h4 className="fw-bold text-dark mb-1">Attendance History (Day-wise)</h4>
                <p className="text-dark small mb-0">Analysis of grouped daily sessions.</p>
              </div>
            </div>

            {error ? (
              <div className="student-attendance__empty">{error}</div>
            ) : loading ? (
              <div className="student-attendance__empty">Loading attendance...</div>
            ) : dateWiseRecords.length === 0 ? (
              <div className="student-attendance__empty">No attendance records found.</div>
            ) : (
              <div className="table-responsive">
                <table className="student-attendance__table">
                  <thead>
                    <tr className="bg-light">
                      <th className="text-dark fw-bold">Date</th>
                      <th className="text-dark fw-bold text-center">Day Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dateWiseRecords.map((day) => {
                      const presentCount = day.sessions.filter(s => s.status === 'PRESENT').length
                      
                      let statusText = 'ABSENT'
                      let badgeClass = 'bg-danger'
                      if (presentCount >= 5) { statusText = 'FULL PRESENT'; badgeClass = 'bg-success'; }
                      else if (presentCount >= 3) { statusText = 'HALF DAY'; badgeClass = 'bg-warning text-dark'; }

                      return (
                        <tr key={day.date} className="border-bottom">
                          <td className="fw-bold text-dark">{formatDate(day.date)}</td>
                          <td className="text-center">
                            <span className={`badge ${badgeClass} fw-bold px-3 py-2`} style={{ minWidth: '120px' }}>
                              {statusText}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="student-attendance__panel">
            <div className="student-attendance__panel-header">
              <div>
                <h4 className="fw-bold text-dark mb-1">Overall Summary</h4>
                <p className="text-dark small mb-0">Total attendance breakdown</p>
              </div>
            </div>
            
            <div className="student-attendance__donut-wrap mt-4">
              <div
                className="student-attendance__donut"
                style={{
                  background: overallStats.totalCount
                    ? `conic-gradient(#10b981 ${overallStats.rate}%, #ef4444 0)`
                    : 'conic-gradient(#e2e8f0 0%, #e2e8f0 100%)'
                }}
              >
                <div className="student-attendance__donut-center">
                  <div className="student-attendance__donut-value text-dark fw-bold">{overallStats.rate}%</div>
                  <div className="student-attendance__donut-label text-dark small fw-bold">Overall</div>
                </div>
              </div>
            </div>

            <div className="w-100 px-2 mt-4">
              <div className="d-flex flex-column gap-3">
                <div className="d-flex justify-content-between p-3 bg-white rounded shadow-sm border-start border-4 border-primary">
                  <span className="text-dark fw-bold">Total Sessions</span>
                  <span className="text-dark fw-bold fs-5">{overallStats.totalCount}</span>
                </div>
                <div className="d-flex justify-content-between p-3 bg-white rounded shadow-sm border-start border-4 border-success">
                  <span className="text-dark fw-bold">Total Present</span>
                  <span className="text-success fw-bold fs-5">{overallStats.presentCount}</span>
                </div>
                <div className="d-flex justify-content-between p-3 bg-white rounded shadow-sm border-start border-4 border-danger">
                  <span className="text-dark fw-bold">Total Absent</span>
                  <span className="text-danger fw-bold fs-5">{overallStats.totalCount - overallStats.presentCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </StudentShell>
  )
}