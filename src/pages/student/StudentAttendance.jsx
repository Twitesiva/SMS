import { useEffect, useMemo, useState } from 'react'
import StudentShell from '../../components/StudentShell'
import { supabase } from '../../../supabaseClient'
import { useStudentAuth } from '../../store/studentAuth'

export default function StudentAttendance() {
  const { student } = useStudentAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

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

  const formatDate = (value) => {
    if (!value) return 'N/A'
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const subjectsList = useMemo(() => {
    const unique = new Map()
    records.forEach((row) => {
      const subject = row.attendance_sessions?.subjects
      if (subject?.subject_id) {
        unique.set(subject.subject_id, subject)
      }
    })
    return Array.from(unique.values()).sort((a, b) =>
      (a.subject_name || '').localeCompare(b.subject_name || '')
    )
  }, [records])

  const monthYearOptions = useMemo(() => {
    const years = new Set()
    records.forEach((row) => {
      const dateValue = row.attendance_sessions?.attendance_date
      if (!dateValue) return
      years.add(new Date(`${dateValue}T00:00:00`).getFullYear())
    })
    return Array.from(years).sort((a, b) => a - b)
  }, [records])

  const filteredRecords = useMemo(() => {
    const fromValue = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
    const toValue = dateTo ? new Date(`${dateTo}T23:59:59`) : null

    return records.filter((row) => {
      const dateValue = row.attendance_sessions?.attendance_date
      const dateObj = dateValue ? new Date(`${dateValue}T00:00:00`) : null
      const subjectId = row.attendance_sessions?.subjects?.subject_id

      if (fromValue && (!dateObj || dateObj < fromValue)) return false
      if (toValue && (!dateObj || dateObj > toValue)) return false
      if (filterYear && (!dateObj || dateObj.getFullYear() !== Number(filterYear))) return false
      if (filterMonth && (!dateObj || dateObj.getMonth() !== Number(filterMonth))) return false
      if (filterSubject && String(subjectId) !== String(filterSubject)) return false
      if (filterStatus && row.status !== filterStatus) return false

      return true
    })
  }, [records, dateFrom, dateTo, filterYear, filterMonth, filterSubject, filterStatus])

  const filteredSummary = useMemo(() => {
    const total = filteredRecords.length
    const present = filteredRecords.filter((row) => row.status === 'PRESENT').length
    const absent = filteredRecords.filter((row) => row.status === 'ABSENT').length
    const rate = total > 0 ? Math.round((present / total) * 100) : 0
    return { total, present, absent, rate }
  }, [filteredRecords])

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
                <h4 className="mb-1">Attendance Sessions</h4>
                <p className="text-muted mb-0">Day and session-wise attendance history.</p>
              </div>
            </div>
            <div className="student-attendance__filters">
              <div className="student-attendance__filter">
                <label className="form-label">From</label>
                <input
                  type="date"
                  className="form-control"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </div>
              <div className="student-attendance__filter">
                <label className="form-label">To</label>
                <input
                  type="date"
                  className="form-control"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </div>
              <div className="student-attendance__filter">
                <label className="form-label">Month</label>
                <select
                  className="form-select"
                  value={filterMonth}
                  onChange={(event) => setFilterMonth(event.target.value)}
                >
                  <option value="">All</option>
                  {monthOptions.map((month, index) => (
                    <option key={month} value={index}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              <div className="student-attendance__filter">
                <label className="form-label">Year</label>
                <select
                  className="form-select"
                  value={filterYear}
                  onChange={(event) => setFilterYear(event.target.value)}
                >
                  <option value="">All</option>
                  {monthYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="student-attendance__filter">
                <label className="form-label">Subject</label>
                <select
                  className="form-select"
                  value={filterSubject}
                  onChange={(event) => setFilterSubject(event.target.value)}
                >
                  <option value="">All</option>
                  {subjectsList.map((subject) => (
                    <option key={subject.subject_id} value={subject.subject_id}>
                      {subject.subject_code ? `${subject.subject_code} - ` : ''}
                      {subject.subject_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="student-attendance__filter">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={filterStatus}
                  onChange={(event) => setFilterStatus(event.target.value)}
                >
                  <option value="">All</option>
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                </select>
              </div>
            </div>

            {error ? (
              <div className="student-attendance__empty">{error}</div>
            ) : loading ? (
              <div className="student-attendance__empty">Loading attendance...</div>
            ) : records.length === 0 ? (
              <div className="student-attendance__empty">No attendance records found.</div>
            ) : filteredRecords.length === 0 ? (
              <div className="student-attendance__empty">No records match the selected filters.</div>
            ) : (
              <div className="table-responsive">
                <table className="student-attendance__table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Subject</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((row) => {
                      const subject = row.attendance_sessions?.subjects
                      const subjectLabel = subject
                        ? `${subject.subject_code ? `${subject.subject_code} - ` : ''}${subject.subject_name || ''}`.trim()
                        : 'N/A'
                      return (
                        <tr key={row.id}>
                          <td>{formatDate(row.attendance_sessions?.attendance_date)}</td>
                          <td>{subjectLabel || 'N/A'}</td>
                          <td>
                            <span className={statusClass(row.status)}>
                              {formatStatus(row.status)}
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
                <h4 className="mb-1">Attendance Summary</h4>
                <p className="text-muted mb-0">Present and absent counts for the selected filters.</p>
              </div>
            </div>
            <div className="student-attendance__donut-wrap">
              <div
                className="student-attendance__donut"
                style={{
                  background: filteredSummary.total
                    ? `conic-gradient(#22c55e ${filteredSummary.rate}%, #ef4444 0)`
                    : 'conic-gradient(#e2e8f0 0%, #e2e8f0 100%)'
                }}
              >
                <div className="student-attendance__donut-center">
                  <div className="student-attendance__donut-value">{filteredSummary.rate}%</div>
                  <div className="student-attendance__donut-label">Attendance</div>
                </div>
              </div>
              <div className="student-attendance__donut-legend">
                <div>
                  <span className="student-attendance__legend-swatch student-attendance__legend-swatch--present"></span>
                  Present: {filteredSummary.present}
                </div>
                <div>
                  <span className="student-attendance__legend-swatch student-attendance__legend-swatch--absent"></span>
                  Absent: {filteredSummary.absent}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </StudentShell>
  )
}
