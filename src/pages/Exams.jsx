import AdminShell from '../components/AdminShell'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/mockApi'
import { showToast } from '../store/ui.js'
import { supabase } from '../../supabaseClient'
import { TIME_SLOTS } from '../lib/timeSlots'

const DEFAULT_CATEGORY_ORDER = ['UG', 'PG']

const buildDefaultSchedule = () => ({
  selected: false,
  date: '',
  startTime: '',
  endTime: '',
})

const normalizeYearName = (value) => {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

const parseCategoryValues = (value) => {
  if (value === undefined || value === null || value === '') return []
  if (Array.isArray(value)) return value.map((v) => String(v).trim().toUpperCase()).filter(Boolean)
  const candidate = String(value).trim()
  if (!candidate) return []
  if (candidate.startsWith('[') && candidate.endsWith(']')) {
    try {
      const parsed = JSON.parse(candidate)
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => String(v).trim().toUpperCase())
          .filter(Boolean)
      }
    } catch (err) {
      // ignore and fall through to comma splitting
    }
  }
  return candidate
    .split(/[,;\s]+/)
    .map((v) => String(v).trim().toUpperCase())
    .filter(Boolean)
}

export default function Exams() {
  const [academicYears, setAcademicYears] = useState([])
  const [subjects, setSubjects] = useState([])
  const [category, setCategory] = useState('')
  const [currentSemesterNumber, setCurrentSemesterNumber] = useState(null)
  const [academicYear, setAcademicYear] = useState('')
  const [semesterFocus, setSemesterFocus] = useState('')
  const [schedules, setSchedules] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', type: '' })
  const [exams, setExams] = useState([])
  const [selectedExam, setSelectedExam] = useState('')
  const [examParity, setExamParity] = useState('')
  const [examsLoading, setExamsLoading] = useState(false)

  // Fetch exams from exam_master table
  const refreshExams = useCallback(async () => {
    setExamsLoading(true)
    try {
      const { data, error } = await supabase
        .from('exam_master')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setExams(data || [])
    } catch (error) {
      console.error('Error fetching exams:', error)
      setFeedback({
        message: error.message || 'Failed to load exams. Please try again later.',
        type: 'error',
      })
    } finally {
      setExamsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshExams()
  }, [refreshExams])

  useEffect(() => {
    if (selectedExam || !exams.length) return
    const firstExamId = exams[0]?.id
    if (!firstExamId) return
    setSelectedExam(String(firstExamId))
  }, [exams, selectedExam])




  useEffect(() => {
    let isMounted = true
    setLoading(true)
    Promise.all([
      api.listAcademicYears(),
      api.listSubjects(),
      api.getCurrentSemesterNumber(),
    ])
      .then(([years, subjectList, semesterNumber]) => {
        if (!isMounted) return
        setAcademicYears(years)
        setSubjects(subjectList)
        if (semesterNumber !== null && semesterNumber !== undefined) {
          const normalized = Number(semesterNumber)
          if (!Number.isNaN(normalized)) {
            setExamParity(normalized % 2 === 0 ? 'EVEN' : 'ODD')
            setCurrentSemesterNumber(normalized)
          } else {
            setCurrentSemesterNumber(null)
          }
        } else {
          setCurrentSemesterNumber(null)
        }
        setFeedback((prev) => (prev.type === 'error' ? { message: '', type: '' } : prev))
      })
      .catch((err) => {
        console.error(err)
        if (!isMounted) return
        setFeedback({
          message: err.message || 'Failed to load exam data',
          type: 'error',
        })
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  const categoryOptions = useMemo(() => {
    const seen = new Set()
    academicYears.forEach((year) => {
      const values = parseCategoryValues(year.category || year.year_category || year.name)
      values.forEach((value) => seen.add(value))
    })
    const available = Array.from(seen)
    if (!available.length) {
      return DEFAULT_CATEGORY_ORDER
    }
    const ordered = []
    DEFAULT_CATEGORY_ORDER.forEach((key) => {
      if (available.includes(key)) ordered.push(key)
    })
    available.forEach((item) => {
      if (!ordered.includes(item)) ordered.push(item)
    })
    return ordered
  }, [academicYears])

  const availableSemesters = useMemo(() => {
    const normalizedAcademicYear = normalizeYearName(academicYear)
    if (!normalizedAcademicYear) return []
    const semesterSet = new Set()
    subjects.forEach((subject) => {
      const subjectYear = normalizeYearName(subject.academicYearName || subject.academic_year || subject.academicYear)
      if (!subjectYear || subjectYear !== normalizedAcademicYear) return
      const semesterNumber = Number(subject.semester)
      if (!semesterNumber || Number.isNaN(semesterNumber)) return
      semesterSet.add(semesterNumber)
    })
    return Array.from(semesterSet).sort((a, b) => a - b)
  }, [subjects, academicYear])

  // Filter semesters to specific user requirement:
  // If a semester is selected, show it and all lower semesters of the same parity (Odd/Even), sorted descending.
  // e.g. Select 5 -> Show 5, 3, 1. Select 4 -> Show 4, 2.
  const sortedSemesters = useMemo(() => {
    if (!availableSemesters.length) return [];

    if (!semesterFocus) return availableSemesters;

    const selectedSem = Number(semesterFocus);
    const isEvenSelected = selectedSem % 2 === 0;

    return availableSemesters
      .filter(sem => {
        const isSameParity = (sem % 2 === 0) === isEvenSelected;
        const isLowerOrEqual = sem <= selectedSem;
        return isSameParity && isLowerOrEqual;
      })
      .sort((a, b) => b - a); // Sort in descending order
  }, [availableSemesters, semesterFocus]);

  useEffect(() => {
    setSchedules({})
  }, [category, academicYear])

  useEffect(() => {
    if (!semesterFocus) return
    const focused = Number(semesterFocus)
    if (!availableSemesters.includes(focused)) {
      setSemesterFocus('')
    }
  }, [availableSemesters, semesterFocus])

  const filteredSubjectRows = useMemo(() => {
    const normalizedAcademicYear = normalizeYearName(academicYear)
    if (!normalizedAcademicYear) return []
    return subjects.filter((subject) => {
      const subjectYear = normalizeYearName(subject.academicYearName || subject.academic_year || subject.academicYear)
      if (subjectYear !== normalizedAcademicYear) return false
      const semesterNumber = Number(subject.semester)
      if (!availableSemesters.includes(semesterNumber)) return false
      return true
    })
  }, [subjects, academicYear, availableSemesters])

  const expandedSubjects = useMemo(() => {
    const entries = []
    filteredSubjectRows.forEach((subject) => {
      const semesterNumber = Number(subject.semester)
      if (!semesterNumber) return
      const codes = subject.subjectCodes?.length
        ? subject.subjectCodes
        : subject.subjectCode
          ? [subject.subjectCode]
          : []
      const names = subject.subjectNames?.length
        ? subject.subjectNames
        : subject.subjectName
          ? [subject.subjectName]
          : []
      const maxLen = Math.max(codes.length, names.length, 1)
      for (let i = 0; i < maxLen; i += 1) {
        const code = codes[i] ?? codes[0] ?? ''
        const name = names[i] ?? names[0] ?? ''
        entries.push({
          id: `${subject.id}-${i}`,
          parentId: subject.id,
          semester: semesterNumber,
          subjectCode: code,
          subjectName: name,
          subjectCodeRaw: subject.subjectCodeRaw,
        })
      }
    })
    return entries
  }, [filteredSubjectRows])

  const subjectsBySemester = useMemo(() => {
    const grouped = {}
    expandedSubjects.forEach((subject) => {
      const sem = Number(subject.semester)
      if (!sem) return
      if (!grouped[sem]) grouped[sem] = []
      grouped[sem].push(subject)
    })
    return grouped
  }, [expandedSubjects])

  const subjectMap = useMemo(() => {
    const map = {}
    expandedSubjects.forEach((subject) => {
      map[String(subject.id)] = subject
    })
    return map
  }, [expandedSubjects])

  const handleToggleSubject = (subjectId) => {
    const key = String(subjectId)
    setSchedules((prev) => {
      const current = prev[key] || buildDefaultSchedule()
      const updated = { ...current, selected: !current.selected }
      return { ...prev, [key]: updated }
    })
  }

  const handleScheduleChange = (subjectId, field, value) => {
    const key = String(subjectId)
    setSchedules((prev) => {
      const current = prev[key] || buildDefaultSchedule()
      return {
        ...prev,
        [key]: {
          ...current,
          selected: true,
          [field]: value,
        },
      }
    })
  }

  const [showPreview, setShowPreview] = useState(false)

  const handlePreview = () => {
    setFeedback({ message: '', type: '' })
    if (!category || !academicYear) {
      setFeedback({
        type: 'error',
        message: 'Choose a category and academic year before scheduling.',
      })
      return
    }
    if (!selectedExam) {
      setFeedback({
        type: 'error',
        message: 'Please select an exam from the dropdown.',
      })
      return
    }

    const selectedEntries = Object.entries(schedules).filter(([, entry]) => entry.selected)

    if (!selectedEntries.length) {
      setFeedback({ type: 'error', message: 'Select at least one subject to schedule.' })
      return
    }

    for (const [id, entry] of selectedEntries) {
      const subject = subjectMap[id]
      if (!subject) continue
      if (!entry.date || !entry.startTime || !entry.endTime) {
        setFeedback({
          type: 'error',
          message: `Enter date and time for ${subject.subjectName || subject.subjectCode || 'selected subject'}.`,
        })
        return
      }
      const subjectCodeRaw = subject.subjectCodeRaw?.trim() ?? subject.subjectCode?.trim()
      if (!subjectCodeRaw) {
        setFeedback({
          type: 'error',
          message: `Subject code is missing for ${subject.subjectName || 'the selected subject'}.`,
        })
        return
      }
    }

    setShowPreview(true)
  }

  const handleConfirmSave = async () => {
    const entries = []
    for (const [id, entry] of Object.entries(schedules)) {
      if (!entry.selected) continue
      const subject = subjectMap[id]
      if (!subject) continue

      const subjectCodeRaw = subject.subjectCodeRaw?.trim() ?? subject.subjectCode?.trim()
      const subjectGroupCode = subject.groupCode || subject.group_code || ''
      const subjectCourseCode = subject.courseCode || subject.course_code || ''

      entries.push({
        academic_year: academicYear,
        group_code: subjectGroupCode,
        course_code: subjectCourseCode,
        semester_number: subject.semester,
        subject_code: subjectCodeRaw,
        exam_date: entry.date,
        exam_start_time: entry.startTime,
        exam_end_time: entry.endTime,
        category,
        exam_master_id: selectedExam,
      })
    }

    try {
      setSaving(true)
      await api.saveExamSchedule(entries)
      const successMessage = 'Exam schedule saved successfully.'
      setFeedback({ message: successMessage, type: 'success' })
      showToast(successMessage, { type: 'success' })

      // Reset form fields
      setSchedules({})
      setSelectedExam('')
      setSemesterFocus('')
      setAcademicYear('')
      setCategory('')
      setExamParity('')
      setCurrentSemesterNumber(null)
      setShowPreview(false)
    } catch (err) {
      console.error(err)
      const errorMessage = err.message || 'Unable to save exam schedule.'
      setFeedback({ type: 'error', message: errorMessage })
      showToast(errorMessage, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const filtersReady = Boolean(category && academicYear)
  const semesterHasSubjects = availableSemesters.some(
    (sem) => (subjectsBySemester[sem] || []).length > 0
  )
  const selectedCount = Object.values(schedules).filter((entry) => entry.selected).length
  const saveDisabled = saving || !filtersReady || !semesterHasSubjects || !selectedCount

  return (
    <AdminShell>
      <div className="container py-4">
        <h2 className="fw-bold mb-1">Exam Scheduling</h2>
        <p className="text-muted mb-4">
          Choose the exam cycle and academic year so you can assign dates to the relevant
          subjects.
        </p>
        {feedback.message ? (
          <div
            className={`alert alert-${feedback.type === 'error' ? 'danger' : 'success'} mb-3`}
            role="alert"
          >
            {feedback.message}
          </div>
        ) : null}
        {!showPreview ? (
          <>
            <div className="card card-soft p-3 mb-4">
              <h5 className="mb-3 text-dark fw-bold">Create Exam Time Table</h5>
            <div className="row g-3">
              <div className="col-12 col-md-3">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Select category</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Exam Name</label>
                <select
                  className="form-select"
                  value={selectedExam}
                  onChange={(e) => setSelectedExam(e.target.value)}
                  disabled={examsLoading || exams.length === 0}
                >
                  <option value="">
                    {examsLoading ? 'Loading exams...' : exams.length === 0 ? 'No exams available' : 'Select exam'}
                  </option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.exam_name}
                    </option>
                  ))}
                </select>
                {examsLoading && <div className="form-text">Loading exam data...</div>}
                {!examsLoading && exams.length === 0 && (
                  <div className="form-text text-warning">No exams found. Please create an exam first.</div>
                )}
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Academic Year</label>
                <select
                  className="form-select"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                >
                  <option value="">Select academic year</option>
                  {academicYears.map((year) => (
                    <option key={year.id} value={year.academic_year}>
                      {year.academic_year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Semester</label>
                <select
                  className="form-select"
                  value={semesterFocus}
                  onChange={(e) => setSemesterFocus(e.target.value)}
                >
                  <option value="">Select semester</option>
                  {availableSemesters.map((sem) => (
                    <option key={sem} value={sem}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            </div>
            {loading && <p className="text-muted mb-3">Loading exam metadata...</p>}
            {!loading && !filtersReady && (
              <p className="text-muted mb-3">
                Select a category and academic year to load subjects.
              </p>
            )}
            {filtersReady && !availableSemesters.length && (
              <p className="text-muted mb-3">
                No semesters found for the selected academic year.
              </p>
            )}
            {filtersReady && availableSemesters.length > 0 && (
              <div className="mb-3">
                <small className="text-muted">
                  {semesterFocus
                    ? `Focusing on semester ${semesterFocus}`
                    : 'Showing all semesters'}
                </small>
              </div>
            )}
            {filtersReady && availableSemesters.length > 0 && (
              <>
                {sortedSemesters.map((semesterNumber) => {
                  const semesterSubjects = subjectsBySemester[semesterNumber] || []
                  return (
                    <div className="card card-soft mb-3" key={semesterNumber}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <h5 className="mb-0">Semester {semesterNumber}</h5>
                          <span className="text-muted">
                            {semesterSubjects.length} subject{semesterSubjects.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        {semesterSubjects.length ? (
                          <div className="table-responsive">
                            <table className="table mb-0">
                              <thead>
                                <tr>
                                  <th style={{ width: '120px' }}>Select</th>
                                  <th>Subject Code</th>
                                  <th>Subject Name</th>
                                  <th>Date</th>
                                  <th>Start Time</th>
                                  <th>End Time</th>
                                </tr>
                              </thead>
                              <tbody>
                                {semesterSubjects.map((subject) => {
                                  const entry = schedules[String(subject.id)] || buildDefaultSchedule()
                                  return (
                                    <tr key={subject.id}>
                                      <td>
                                        <div className="form-check">
                                          <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id={`subject-${subject.id}`}
                                            checked={entry.selected}
                                            onChange={() => handleToggleSubject(subject.id)}
                                          />
                                          <label className="form-check-label" htmlFor={`subject-${subject.id}`}>
                                            {entry.selected ? 'Scheduled' : 'Select'}
                                          </label>
                                        </div>
                                      </td>
                                      <td>{subject.subjectCode || subject.subjectName}</td>
                                      <td>{subject.subjectName || subject.subjectCode}</td>
                                      <td>
                                        <div className="input-group input-group-sm">
                                          <input
                                            type="date"
                                            className="form-control form-control-sm"
                                            value={entry.date}
                                            min={new Date().toISOString().split('T')[0]}
                                            disabled={!entry.selected}
                                            onChange={(e) => handleScheduleChange(subject.id, 'date', e.target.value)}
                                            style={{ minWidth: '120px' }}
                                          />
                                        </div>
                                      </td>
                                      <td>
                                        <div className="input-group input-group-sm">
                                          <select
                                            className="form-select form-select-sm"
                                            value={entry.startTime}
                                            disabled={!entry.selected}
                                            onChange={(e) => handleScheduleChange(subject.id, 'startTime', e.target.value)}
                                            style={{ minWidth: '120px' }}
                                          >
                                            <option value="">Select start time</option>
                                            {TIME_SLOTS.map((time) => (
                                              <option key={`start-${time.value}`} value={time.value}>
                                                {time.displayTime}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </td>
                                      <td>
                                        <div className="input-group input-group-sm">
                                          <select
                                            className="form-select form-select-sm"
                                            value={entry.endTime}
                                            disabled={!entry.selected || !entry.startTime}
                                            onChange={(e) => handleScheduleChange(subject.id, 'endTime', e.target.value)}
                                            style={{ minWidth: '120px' }}
                                          >
                                            <option value="">Select end time</option>
                                            {TIME_SLOTS
                                              .filter(time => {
                                                if (!entry.startTime) return true;
                                                const [startH, startM] = entry.startTime.split(':').map(Number);
                                                const [endH, endM] = time.value.split(':').map(Number);
                                                return (endH > startH) || (endH === startH && endM > startM);
                                              })
                                              .map((time) => (
                                                <option key={`end-${time.value}`} value={time.value}>
                                                  {time.displayTime}
                                                </option>
                                              ))}
                                          </select>
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-muted mb-0">No subjects defined for this semester yet.</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
            <div className="d-flex justify-content-end">
              <button className="btn btn-brand" disabled={saveDisabled} onClick={handlePreview}>
                Preview
              </button>
            </div>
          </>
        ) : (
          <div className="card card-soft p-4">
            <div className="mb-4">
              <h4 className="fw-bold mb-1">Preview Schedule</h4>
              <p className="text-muted small mb-0">Review the exam schedule before saving.</p>
            </div>

            <div className="table-responsive mb-4">
              <table className="table table-bordered">
                <thead className="bg-light">
                  <tr>
                    <th>Semester</th>
                    <th>Subject</th>
                    <th>Date</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(schedules)
                    .filter(([, entry]) => entry.selected)
                    .map(([id, entry]) => {
                      const subject = subjectMap[id];
                      if (!subject) return null;

                      const startTimeDisplay = TIME_SLOTS.find(t => t.value === entry.startTime)?.displayTime || entry.startTime;
                      const endTimeDisplay = TIME_SLOTS.find(t => t.value === entry.endTime)?.displayTime || entry.endTime;

                      return (
                        <tr key={id}>
                          <td>{subject.semester}</td>
                          <td>{subject.subjectCode} - {subject.subjectName}</td>
                          <td>{entry.date}</td>
                          <td>{startTimeDisplay} - {endTimeDisplay}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button
                className="btn btn-outline-secondary"
                onClick={() => setShowPreview(false)}
                disabled={saving}
              >
                Back
              </button>
              <button
                className="btn btn-brand"
                onClick={handleConfirmSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Create Exam Schedule'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
