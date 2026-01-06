import { useEffect, useMemo, useState } from 'react'
import StudentShell from '../../components/StudentShell'
import { supabase } from '../../../supabaseClient'
import { useStudentAuth } from '../../store/studentAuth'

export default function StudentAttendance() {
  const { student } = useStudentAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [dateFilter, setDateFilter] = useState('')
  const pageSize = 12

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
        setPage(1)
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

  const chartData = useMemo(() => {
    const getDateKey = (value) => (value ? String(value).slice(0, 10) : '')
    const today = new Date()
    const uniqueDates = Array.from(
      new Set(
        records
          .map((row) => getDateKey(row.attendance_sessions?.attendance_date))
          .filter(Boolean)
      )
    ).sort((a, b) => (a < b ? 1 : -1))

    const dayKeys = uniqueDates.slice(0, 5).sort()

    const weekly = dayKeys.map((key) => {
      const rows = records.filter((row) => getDateKey(row.attendance_sessions?.attendance_date) === key)
      const total = rows.length
      const present = rows.filter((row) => row.status === 'PRESENT').length
      const rate = total > 0 ? Math.round((present / total) * 100) : 0
      const dateObj = new Date(`${key}T00:00:00`)
      const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
      const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
      return { key, total, present, rate, dayLabel, dateLabel }
    })

    return { weekly }
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

  const totalPages = Math.max(1, Math.ceil(records.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const filteredRecords = dateFilter
    ? records.filter((row) => row.attendance_sessions?.attendance_date === dateFilter)
    : records
  const totalPagesFiltered = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const currentPageFiltered = Math.min(page, totalPagesFiltered)
  const startIndexFiltered = (currentPageFiltered - 1) * pageSize
  const pageRows = filteredRecords.slice(startIndexFiltered, startIndexFiltered + pageSize)

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
            <div className="student-attendance__table-tools">
              <div className="student-attendance__filter">
                <label className="student-attendance__filter-label">Filter by date</label>
                <input
                  type="date"
                  className="form-control"
                  value={dateFilter}
                  onChange={(event) => {
                    setDateFilter(event.target.value)
                    setPage(1)
                  }}
                />
              </div>
              {dateFilter && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    setDateFilter('')
                    setPage(1)
                  }}
                >
                  Clear
                </button>
              )}
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
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center text-muted py-4">No attendance records yet.</td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const session = row.attendance_sessions
                      const subject = session?.subjects
                      return (
                        <tr key={row.id}>
                          <td>{session?.attendance_date || '--'}</td>
                          <td>
                            <div className="student-attendance__subject">
                              {subject?.subject_name || 'Unknown subject'}
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
          {filteredRecords.length > pageSize && !error && (
            <div className="student-attendance__pagination">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPageFiltered === 1}
              >
                Previous
              </button>
              <div className="student-attendance__pagination-meta">
                Page {currentPageFiltered} of {totalPagesFiltered}
              </div>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setPage((prev) => Math.min(totalPagesFiltered, prev + 1))}
                disabled={currentPageFiltered === totalPagesFiltered}
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="student-attendance__insights">
          <div className="student-attendance__panel">
            <div className="student-attendance__panel-header">
              <div>
                <h4 className="mb-1">Attendance Split</h4>
                <p className="text-muted mb-0">Present vs absent ratio.</p>
              </div>
            </div>
            <div className="student-attendance__donut-wrap">
              <div
                className="student-attendance__donut"
                style={{
                  background: summary.total
                    ? `conic-gradient(#22c55e ${summary.rate}%, #ef4444 0)`
                    : 'conic-gradient(#e2e8f0 0%, #e2e8f0 100%)'
                }}
              >
                <div className="student-attendance__donut-center">
                  <div className="student-attendance__donut-value">{summary.rate}%</div>
                  <div className="student-attendance__donut-label">Attendance</div>
                </div>
              </div>
              <div className="student-attendance__donut-legend">
                <div>
                  <span className="student-attendance__legend-swatch student-attendance__legend-swatch--present"></span>
                  Present: {summary.present}
                </div>
                <div>
                  <span className="student-attendance__legend-swatch student-attendance__legend-swatch--absent"></span>
                  Absent: {summary.absent}
                </div>
              </div>
            </div>
          </div>

          <div className="student-attendance__panel">
            <div className="student-attendance__panel-header">
              <div>
                <h4 className="mb-1">Weekly Trend</h4>
                <p className="text-muted mb-0">Attendance rate over the last 7 days.</p>
              </div>
            </div>
            <div className="student-attendance__line-chart">
              {chartData.weekly.length < 2 ? (
                <div className="student-attendance__empty">
                  {chartData.weekly.length === 1 ? (
                    <>
                      Latest day: {chartData.weekly[0].dayLabel}, {chartData.weekly[0].dateLabel} ·
                      {' '}Attendance {chartData.weekly[0].rate}%
                    </>
                  ) : (
                    'No weekly attendance data yet.'
                  )}
                </div>
              ) : (
                <>
                  <svg viewBox="0 0 320 160" role="img" aria-label="Weekly attendance trend">
                    <polyline
                      fill="none"
                      stroke="#2a6cf4"
                      strokeWidth="3"
                      points={chartData.weekly
                        .map((item, index) => {
                          const denominator = Math.max(1, chartData.weekly.length - 1)
                          const x = (index / denominator) * 300 + 10
                          const y = 140 - (item.rate / 100) * 120
                          return `${x},${y}`
                        })
                        .join(' ')}
                    />
                    {chartData.weekly.map((item, index) => {
                      const denominator = Math.max(1, chartData.weekly.length - 1)
                      const x = (index / denominator) * 300 + 10
                      const y = 140 - (item.rate / 100) * 120
                      return <circle key={item.key} cx={x} cy={y} r="4" fill="#2a6cf4" />
                    })}
                  </svg>
                  <div
                    className="student-attendance__line-labels"
                    style={{ gridTemplateColumns: `repeat(${chartData.weekly.length}, 1fr)` }}
                  >
                    {chartData.weekly.map((item) => (
                      <span key={item.key} className="student-attendance__line-label">
                        <span>{item.dayLabel}</span>
                        <span>{item.dateLabel}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </StudentShell>
  )
}
