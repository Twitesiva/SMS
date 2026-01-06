import { useEffect, useMemo, useState } from 'react'
import StudentShell from '../../components/StudentShell'
import { supabase } from '../../../supabaseClient'
import { useStudentAuth } from '../../store/studentAuth'

export default function StudentAttendance() {
  const { student } = useStudentAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [viewMonth, setViewMonth] = useState(() => new Date())

  const monthOptions = useMemo(
    () => [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ],
    []
  )

  const yearOptions = useMemo(() => {
    const years = new Set([new Date().getFullYear(), viewMonth.getFullYear()])
    records.forEach((row) => {
      const date = row.attendance_sessions?.attendance_date
      if (date) {
        years.add(new Date(`${date}T00:00:00`).getFullYear())
      }
    })

    if (years.size < 5) {
      const base = viewMonth.getFullYear()
      for (let offset = -2; offset <= 2; offset += 1) {
        years.add(base + offset)
      }
    }

    return Array.from(years).sort((a, b) => a - b)
  }, [records, viewMonth])

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

  const statusByDate = useMemo(() => {
    const map = new Map()
    records.forEach((row) => {
      const date = row.attendance_sessions?.attendance_date
      if (!date) return
      const existing = map.get(date) || []
      existing.push(row.status)
      map.set(date, existing)
    })
    return map
  }, [records])

  const calendar = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i += 1) {
      cells.push({ type: 'empty', key: `empty-${i}` })
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const statuses = statusByDate.get(dateKey) || []
      let status = ''
      if (statuses.includes('ABSENT')) {
        status = 'absent'
      } else if (statuses.includes('PRESENT') || statuses.includes('LATE')) {
        status = 'present'
      }
      cells.push({ type: 'day', key: dateKey, day, status })
    }
    while (cells.length % 7 !== 0) {
      cells.push({ type: 'empty', key: `tail-${cells.length}` })
    }
    return { cells }
  }, [viewMonth, statusByDate])

  return (
    <StudentShell>
      <div className="student-details student-attendance">
        <div className="student-details__header">
          <h2>Attendance Overview</h2>
          <p>Track present and absent sessions with subject-wise history.</p>
        </div>

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

        <div className="student-attendance__main">
          <div className="student-attendance__table-card">
            <div className="student-attendance__table-header">
              <div>
                <h4 className="mb-1">Attendance Calendar</h4>
                <p className="text-muted mb-0">Monthly calendar view of attendance.</p>
              </div>
            <div className="student-attendance__calendar-controls">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() =>
                  setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
              >
                <i className="bi bi-chevron-left"></i>
              </button>
              <div className="student-attendance__month-picker" aria-live="polite">
                <select
                  className="student-attendance__month-select"
                  value={viewMonth.getMonth()}
                  onChange={(event) => {
                    const nextMonth = Number(event.target.value)
                    setViewMonth((prev) => new Date(prev.getFullYear(), nextMonth, 1))
                  }}
                  aria-label="Select month"
                >
                  {monthOptions.map((month, index) => (
                    <option key={month} value={index}>
                      {month}
                    </option>
                  ))}
                </select>
                <select
                  className="student-attendance__month-select"
                  value={viewMonth.getFullYear()}
                  onChange={(event) => {
                    const nextYear = Number(event.target.value)
                    setViewMonth((prev) => new Date(nextYear, prev.getMonth(), 1))
                  }}
                  aria-label="Select year"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() =>
                  setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                >
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>

            {error ? (
              <div className="student-attendance__empty">{error}</div>
            ) : loading ? (
              <div className="student-attendance__empty">Loading attendance...</div>
            ) : (
              <>
                <div className="student-attendance__calendar-grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                    <div key={label} className="student-attendance__calendar-head">
                      {label}
                    </div>
                  ))}
                  {calendar.cells.map((cell) => (
                    <div
                      key={cell.key}
                      className={`student-attendance__calendar-cell ${
                        cell.type === 'day' ? `is-${cell.status || 'neutral'}` : 'is-empty'
                      }`}
                    >
                      {cell.type === 'day' && (
                        <span className="student-attendance__calendar-date">{cell.day}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="student-attendance__calendar-legend">
                  <span className="student-attendance__legend-item">
                    <span className="student-attendance__legend-dot is-present"></span> Present
                  </span>
                  <span className="student-attendance__legend-item">
                    <span className="student-attendance__legend-dot is-absent"></span> Absent
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="student-attendance__panel">
            <div className="student-attendance__panel-header">
              <div>
                <h4 className="mb-1">Attendance Summary</h4>
                <p className="text-muted mb-0">Present and absent counts at a glance.</p>
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
        </div>

      </div>
    </StudentShell>
  )
}
