import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/mockApi'

const formatDate = (value) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN')
}

const formatTime = (value) => value || '-'

const parseScheduleCodes = (subjectCode) => {
  if (!subjectCode) return []
  if (Array.isArray(subjectCode)) return subjectCode.filter(Boolean)
  const value = String(subjectCode).trim()
  if (!value) return []
  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
    } catch (err) {
      console.warn('Unable to parse subject code array', err)
    }
  }
  return value
    .split(/[\r\n,;]+/)
    .map((code) => code.trim())
    .filter(Boolean)
}

export default function PublicTimeTable() {
  const [subjects, setSubjects] = useState([])
  const [filters, setFilters] = useState({ academic_year: '', group_code: '', course_code: '' })
  const [examSchedule, setExamSchedule] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hallTicket, setHallTicket] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundStudent, setFoundStudent] = useState(null)

  useEffect(() => {
    let isActive = true
    api.listSubjects()
      .then((subjectsData) => {
        if (!isActive) return
        setSubjects(subjectsData || [])
      })
      .catch(() => {
        if (!isActive) return
        setSubjects([])
      })
    return () => {
      isActive = false
    }
  }, [])


  const subjectNameMap = useMemo(() => {
    const map = {}
    subjects.forEach((subject) => {
      const codes =
        Array.isArray(subject.subjectCodes) && subject.subjectCodes.length
          ? subject.subjectCodes
          : subject.subjectCode
            ? [subject.subjectCode]
            : []
      const names =
        Array.isArray(subject.subjectNames) && subject.subjectNames.length
          ? subject.subjectNames
          : subject.subjectName
            ? [subject.subjectName]
            : []
      codes.forEach((code, index) => {
        if (!code) return
        const labelSource =
          names[index] || names[0] || subject.subjectName || subject.subjectCode || ''
        const trimmedLabel = String(labelSource || '').trim()
        const trimmedCode = String(code).trim()
        if (!trimmedCode) return
        map[trimmedCode] = trimmedLabel || map[trimmedCode] || ''
      })
    })
    return map
  }, [subjects])

  const scheduleRows = useMemo(() => {
    const expanded = []
    examSchedule.forEach((row) => {
      const codes = parseScheduleCodes(row.subject_code)
      const names = parseScheduleCodes(row.subject_name)
      if (!codes.length) {
        expanded.push({
          ...row,
          displayCode: row.subject_code || '-',
          displayName: subjectNameMap[String(row.subject_code || '').trim()] || row.subject_name || '-',
        })
        return
      }
      codes.forEach((code, index) => {
        const trimmed = String(code).trim()
        const mappedName =
          names[index] ||
          subjectNameMap[trimmed] ||
          row.subject_name ||
          ''
        expanded.push({
          ...row,
          id:
            row.id !== undefined
              ? `${row.id}-${trimmed || index}`
              : `${trimmed || ''}-${row.semester_number}-${row.exam_date}-${index}`,
          displayCode: trimmed || '-',
          displayName: mappedName || '-',
        })
      })
    })
    return expanded.sort((a, b) => {
      const semA = Number(a.semester_number) || 0
      const semB = Number(b.semester_number) || 0
      return semA - semB
    })
  }, [examSchedule, subjectNameMap])

  const hasFilters =
    Boolean(filters.academic_year) ||
    Boolean(filters.group_code) ||
    Boolean(filters.course_code)

  useEffect(() => {
    let isActive = true
    if (!hasFilters) {
      setExamSchedule([])
      setError('')
      setLoading(false)
      return () => {
        isActive = false
      }
    }
    setLoading(true)
    setError('')
    const query = {}
    if (filters.academic_year) query.academic_year = filters.academic_year
    if (filters.group_code) query.group_code = filters.group_code
    if (filters.course_code) query.course_code = filters.course_code
    api.listExamSchedules(query)
      .then((data) => {
        if (!isActive) return

        let filtered = data || []

        // Filter by course/group if specified, using the subjects map
        if (filters.course_code || filters.group_code) {
          filtered = filtered.filter((item) => {
            if (!item.subject_code) return false
            const itemCode = String(item.subject_code).trim().toLowerCase()

            // Find the subject definition to know its course/group
            const sub = subjects.find((s) =>
              s.subjectCodes && s.subjectCodes.some(c => String(c).trim().toLowerCase() === itemCode)
            )

            // If subject definition not found, include it (don't strictly hide it)
            if (!sub) return true

            if (filters.course_code && sub.courseName !== filters.course_code) return false

            return true
          })
        }

        // Find the latest exam schedule (largest exam_master_id)
        if (filtered.length > 0) {
          const maxExamId = filtered.reduce((max, item) => {
            const current = Number(item.exam_master_id) || 0
            return current > max ? current : max
          }, 0)

          if (maxExamId > 0) {
            filtered = filtered.filter(item => Number(item.exam_master_id) === maxExamId)
          }
        }

        setExamSchedule(filtered)
      })
      .catch((err) => {
        if (!isActive) return
        setExamSchedule([])
        setError(err.message || 'Unable to load exam timetable')
      })
      .finally(() => {
        if (isActive) setLoading(false)
      })
    return () => {
      isActive = false
    }
  }, [filters, hasFilters])

  const handleFilterChange = (key, value) => {
    setFoundStudent(null) // clear found student context if user manually changes filters
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSearch = async () => {
    if (!hallTicket.trim()) return
    setSearching(true)
    setError('')
    setFoundStudent(null)
    try {
      const student = await api.getStudentByHallTicket(hallTicket.trim())
      if (student) {
        setFoundStudent(student)
        setFilters({
          academic_year: student.academic_year || '',
          group_code: student.group || '',
          course_code: student.course_name || '',
        })
      } else {
        setError('Student not found with this Hall Ticket Number')
        setFilters({ academic_year: '', group_code: '', course_code: '' })
        setExamSchedule([])
      }
    } catch (err) {
      console.error(err)
      setError('Error searching for student')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="container py-5">
      <div className="row mb-4">

      </div>
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="card card-soft p-4">
            <h4 className="mb-3">Exam Time Table</h4>

            <div className="row g-3 mb-4 align-items-end">
              <div className="col-md-8">
                <label className="form-label">Search by Hall Ticket Number</label>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter Hall Ticket Number"
                    value={hallTicket}
                    onChange={(e) => setHallTicket(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleSearch}
                    disabled={searching || !hallTicket.trim()}
                  >
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>
            </div>

            {foundStudent && (
              <div className="card mb-4 border">
                <div className="card-header bg-light">
                  <h6 className="mb-0 fw-bold text-dark">Student Details</h6>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <span className="text-muted">Student Name : </span>
                      <span className="fw-medium">{foundStudent.full_name}</span>
                    </div>
                    <div className="col-12">
                      <span className="text-muted">Hall Ticket No : </span>
                      <span className="fw-medium">{foundStudent.hall_ticket_no}</span>
                    </div>
                    <div className="col-12">
                      <span className="text-muted">Academic Year : </span>
                      <span className="fw-medium">{foundStudent.academic_year}</span>
                    </div>
                    <div className="col-12">
                      <span className="text-muted">Course : </span>
                      <span className="fw-medium">{foundStudent.course_display || foundStudent.course_name}</span>
                    </div>
                    <div className="col-12">
                      <span className="text-muted">Group : </span>
                      <span className="fw-medium">{foundStudent.group_display || foundStudent.group}</span>
                    </div>
                    <div className="col-12">
                      <span className="text-muted">Current Semester : </span>
                      <span className="fw-medium">{foundStudent.current_semester}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <hr className="my-4" />


            {!hasFilters ? (
              <div className="text-muted">
                Please enter your Hall Ticket Number to view the timetable.
              </div>
            ) : loading ? (
              <p className="text-muted">Loading timetable...</p>
            ) : error ? (
              <div className="alert alert-danger mb-0">{error}</div>
            ) : examSchedule.length === 0 ? (
              <div className="text-muted">No exam schedule published yet.</div>
            ) : (
              <div className="table-responsive">
                <table className="table mb-0">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Subject</th>
                      <th>Semester</th>
                      <th>Date</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map((row, index) => (
                      <tr
                        key={
                          row.id ??
                          `${row.subject_code}-${row.semester_number}-${row.exam_date}`
                        }
                      >
                        <td>{index + 1}</td>
                        <td>{row.displayCode} - {row.displayName}</td>
                        <td>{row.semester_number || '-'}</td>
                        <td>{formatDate(row.exam_date)}</td>
                        <td>{formatTime(row.exam_start_time)}</td>
                        <td>{formatTime(row.exam_end_time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
