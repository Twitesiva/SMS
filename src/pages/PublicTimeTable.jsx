import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/mockApi'

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
  const [years, setYears] = useState([])
  const [groups, setGroups] = useState([])
  const [courses, setCourses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [filters, setFilters] = useState({ academic_year: '', group_code: '', course_code: '' })
  const [examSchedule, setExamSchedule] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true
    Promise.all([
      api.listAcademicYears(),
      api.listGroups(),
      api.listCourses(),
      api.listSubjects(),
    ])
      .then(([yearsData, groupsData, coursesData, subjectsData]) => {
        if (!isActive) return
        setYears(yearsData || [])
        setGroups(groupsData || [])
        setCourses(coursesData || [])
        setSubjects(subjectsData || [])
      })
      .catch(() => {
        if (!isActive) return
        setYears([])
        setGroups([])
        setCourses([])
        setSubjects([])
      })
    return () => {
      isActive = false
    }
  }, [])

  const availableCourses = useMemo(() => {
    if (!filters.group_code) return courses
    return courses.filter(
      (course) =>
        !course.group_code ||
        course.group_code === filters.group_code ||
        course.groupCode === filters.group_code
    )
  }, [courses, filters.group_code])

  const subjectNameMap = useMemo(() => {
    const map = {}
    subjects.forEach((subject) => {
      const codes =
        Array.isArray(subject.subjectCodes) && subject.subjectCodes.length
          ? subject.subjectCodes
          : subject.subjectCode
          ? [subject.subjectCode]
          : []
      const label = subject.subjectName || subject.subjectCode || ''
      const trimmedLabel = String(label || '').trim()
      codes.forEach((code) => {
        if (!code) return
        map[String(code).trim()] = trimmedLabel || map[String(code).trim()] || ''
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
    return expanded
  }, [examSchedule, subjectNameMap])

  useEffect(() => {
    let isActive = true
    setLoading(true)
    setError('')
    const query = {}
    if (filters.academic_year) query.academic_year = filters.academic_year
    if (filters.group_code) query.group_code = filters.group_code
    if (filters.course_code) query.course_code = filters.course_code
    api.listExamSchedules(query)
      .then((data) => {
        if (!isActive) return
        setExamSchedule(data || [])
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
  }, [filters])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="card card-soft p-4">
            <h4 className="mb-3">Exam Time Table</h4>
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <label className="form-label">Academic Year</label>
                <select
                  className="form-select"
                  value={filters.academic_year}
                  onChange={(e) => handleFilterChange('academic_year', e.target.value)}
                >
                  <option value="">All years</option>
                  {years.map((year) => (
                    <option key={year.id} value={year.academic_year}>
                      {year.academic_year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Group</label>
                <select
                  className="form-select"
                  value={filters.group_code}
                  onChange={(e) => handleFilterChange('group_code', e.target.value)}
                >
                  <option value="">All groups</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.code}>
                      {group.name} ({group.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Course</label>
                <select
                  className="form-select"
                  value={filters.course_code}
                  onChange={(e) => handleFilterChange('course_code', e.target.value)}
                >
                  <option value="">All courses</option>
                  {availableCourses.map((course) => (
                    <option key={course.id} value={course.code}>
                      {course.name} ({course.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {loading ? (
              <p className="text-muted">Loading timetable…</p>
            ) : error ? (
              <div className="alert alert-danger mb-0">{error}</div>
            ) : examSchedule.length === 0 ? (
              <div className="text-muted">No exam schedule published yet.</div>
            ) : (
              <div className="table-responsive">
                <table className="table mb-0">
                  <thead>
                    <tr>
                      <th>Semester</th>
                      <th>Subject Name</th>
                      <th>Subject Code</th>
                      <th>Date</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map((row) => (
                      <tr
                        key={
                          row.id ??
                          `${row.subject_code}-${row.semester_number}-${row.exam_date}`
                        }
                      >
                        <td>{row.semester_number || '-'}</td>
                        <td>{row.displayName}</td>
                        <td>{row.displayCode}</td>
                        <td>{formatDate(row.exam_date)}</td>
                        <td>{formatTime(row.exam_start_time)}</td>
                        <td>{formatTime(row.exam_end_time)}</td>
                        <td>{row.category || '-'}</td>
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
