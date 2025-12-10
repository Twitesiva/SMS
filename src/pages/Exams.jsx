import AdminShell from '../components/AdminShell'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/mockApi'
import { showToast } from '../store/ui.js'
import { supabase } from '../../supabaseClient'
import { TIME_SLOTS } from '../lib/timeSlots'

const DEFAULT_CATEGORY_ORDER = ['UG', 'PG']

const buildDefaultSchedule = (overrides = {}) => ({
  date: '',
  startTime: '',
  endTime: '',
  subjectCode: '',
  semester: null,
  ...overrides,
})

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
  const [semesterFocus, setSemesterFocus] = useState('')
  const [schedules, setSchedules] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', type: '' })
  const [exams, setExams] = useState([])
  const [selectedExam, setSelectedExam] = useState('')
  const [examParity, setExamParity] = useState('')
  const [examsLoading, setExamsLoading] = useState(false)
  const [customRowsBySemester, setCustomRowsBySemester] = useState({})
  const [selectedDateBySemester, setSelectedDateBySemester] = useState({})
  const [queuedEntries, setQueuedEntries] = useState([])
  const defaultAcademicYear = academicYears[0]?.academic_year || ''

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
    setQueuedEntries([])
  }, [selectedExam])




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
    if (!category) return []
    const normalizedCategory = String(category).trim().toUpperCase()
    if (!normalizedCategory) return []
    const semesterSet = new Set()
    subjects.forEach((subject) => {
      const subjectCategory = String(subject.category || '').trim().toUpperCase()
      if (subjectCategory && subjectCategory !== normalizedCategory) return
      const semesterNumber = Number(subject.semester)
      if (!semesterNumber || Number.isNaN(semesterNumber)) return
      semesterSet.add(semesterNumber)
    })
    return Array.from(semesterSet).sort((a, b) => a - b)
  }, [subjects, category])

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
    setCustomRowsBySemester({})
    setSelectedDateBySemester({})
    setQueuedEntries([])
  }, [category])

  useEffect(() => {
    if (!semesterFocus) return
    const focused = Number(semesterFocus)
    if (!availableSemesters.includes(focused)) {
      setSemesterFocus('')
    }
  }, [availableSemesters, semesterFocus])

  const filteredSubjectRows = useMemo(() => {
    if (!category) return []
    const normalizedCategory = String(category).trim().toUpperCase()
    if (!normalizedCategory) return []
    return subjects.filter((subject) => {
      const subjectCategory = String(subject.category || '').trim().toUpperCase()
      if (subjectCategory && subjectCategory !== normalizedCategory) return false
      const semesterNumber = Number(subject.semester)
      if (!availableSemesters.includes(semesterNumber)) return false
      return true
    })
  }, [subjects, category, availableSemesters])

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

  const updateDateForSemesterEntries = (semesterNumber, dateValue) => {
    setSchedules((prev) => {
      const next = { ...prev }
      Object.entries(next).forEach(([key, entry]) => {
        if (Number(entry.semester) === semesterNumber) {
          next[key] = { ...entry, date: dateValue }
        }
      })
      return next
    })
  }

  const handleSemesterDateChange = (semesterNumber, value) => {
    setSelectedDateBySemester((prev) => ({
      ...prev,
      [String(semesterNumber)]: value,
    }))
    updateDateForSemesterEntries(semesterNumber, value)
  }

  const getRowsForSemester = (semesterNumber) => {
    const baseRowId = `base-${semesterNumber}`
    const customRows = (customRowsBySemester[semesterNumber] || []).map((rowId) => ({
      key: rowId,
      semester: semesterNumber,
      subject: null,
      isCustom: true,
    }))
    return [
      {
        key: baseRowId,
        semester: semesterNumber,
        subject: null,
      },
      ...customRows,
    ]
  }

  const semesterAcademicYear = useMemo(() => {
    const map = {}
    Object.entries(subjectsBySemester).forEach(([sem, list]) => {
      const first = list[0]
      if (!first) return
      const year =
        first.academicYearName ||
        first.academic_year ||
        first.academicYear ||
        ''
      if (year) {
        map[Number(sem)] = year
      }
    })
    return map
  }, [subjectsBySemester])

  const createCustomRowId = (semesterNumber) =>
    `custom-${semesterNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const addCustomRow = (semesterNumber) => {
    const dateValue = selectedDateBySemester[String(semesterNumber)] || ''
    if (!dateValue) return
    const rowId = createCustomRowId(semesterNumber)
    setCustomRowsBySemester((prev) => {
      const existing = prev[semesterNumber] || []
      return { ...prev, [semesterNumber]: [...existing, rowId] }
    })
    setSchedules((prev) => ({
      ...prev,
      [rowId]: buildDefaultSchedule({ semester: semesterNumber, date: dateValue }),
    }))
  }

  const removeCustomRow = (semesterNumber, rowId) => {
    setCustomRowsBySemester((prev) => {
      const existing = prev[semesterNumber] || []
      return { ...prev, [semesterNumber]: existing.filter((id) => id !== rowId) }
    })
    setSchedules((prev) => {
      const next = { ...prev }
      delete next[rowId]
      return next
    })
  }

  const handleAddEntry = (semesterNumber) => {
    if (!selectedExam) {
      showValidationError('Select an exam before adding entries.')
      return
    }
    const dateValue = selectedDateBySemester[String(semesterNumber)]
    if (!dateValue) {
      showValidationError('Select a date before saving the entry.')
      return
    }
    const rows = getRowsForSemester(semesterNumber)
    const newEntries = rows
      .map((row) => {
        const entry =
          schedules[row.key] ||
          buildDefaultSchedule({ semester: row.semester, date: dateValue })
        const subjectCode = (entry.subjectCode ?? '').trim()
        if (!subjectCode || !entry.startTime || !entry.endTime || !entry.date) return null
        const semesterNumberForEntry = entry.semester ?? row.semester ?? semesterNumber
        const academicYear =
          row.subject?.academicYearName ||
          row.subject?.academic_year ||
          row.subject?.academicYear ||
          semesterAcademicYear[semesterNumberForEntry] ||
          defaultAcademicYear ||
          ''
        return {
          id: `${row.key}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          academic_year: academicYear,
          semester_number: semesterNumberForEntry,
          subject_code: subjectCode,
          exam_date: entry.date,
          exam_start_time: entry.startTime,
          exam_end_time: entry.endTime,
          category,
          exam_master_id: selectedExam,
          subjectName:
            row.subject?.subjectName ||
            row.subject?.subjectCode ||
            subjectCode ||
            'Manual entry',
          subjectGroupCode: row.subject?.groupCode || row.subject?.group_code,
          subjectCourseCode: row.subject?.courseCode || row.subject?.course_code,
        }
      })
      .filter(Boolean)
    if (!newEntries.length) {
      showValidationError('Add at least one subject with code, date, and time before adding an entry.')
      return
    }
    setQueuedEntries((prev) => [...prev, ...newEntries])
    setSchedules((prev) => {
      const next = { ...prev }
      rows.forEach((row) => {
        next[row.key] = buildDefaultSchedule({ semester: row.semester })
      })
      return next
    })
    setSelectedDateBySemester((prev) => ({
      ...prev,
      [String(semesterNumber)]: '',
    }))
    showToast('Entry added. You can select another date now.', { type: 'success' })
  }

  const handleScheduleChange = (subjectId, field, value, semesterOverride = null) => {
    const key = String(subjectId)
    setSchedules((prev) => {
      const current = prev[key] || buildDefaultSchedule({ semester: semesterOverride })
      return {
        ...prev,
        [key]: {
          ...current,
          [field]: value,
          semester: current.semester ?? semesterOverride,
          date:
            current.date ||
            selectedDateBySemester[String(current.semester ?? semesterOverride ?? '')] ||
            current.date,
        },
      }
    })
  }

  const [showPreview, setShowPreview] = useState(false)

  const showValidationError = (message) => {
    setFeedback({ type: 'error', message })
    showToast(message, { type: 'error' })
  }

  const validateScheduleForm = () => {
    if (!category) {
      showValidationError('Choose a category before scheduling.')
      return false
    }
    if (!selectedExam) {
      showValidationError('Please select an exam from the dropdown.')
      return false
    }

    if (!queuedEntries.length) {
      showValidationError('Add at least one entry before proceeding.')
      return false
    }

    return true
  }

  const handlePreview = () => {
    setFeedback({ message: '', type: '' })
    if (!validateScheduleForm()) return
    setShowPreview(true)
  }

  const handleConfirmSave = async () => {
    const entries = queuedEntries.map((entry) => {
      const record = {
        academic_year: entry.academic_year,
        semester_number: entry.semester_number,
        subject_code: entry.subject_code,
        exam_date: entry.exam_date,
        exam_start_time: entry.exam_start_time,
        exam_end_time: entry.exam_end_time,
        category: entry.category,
        exam_master_id: entry.exam_master_id,
      }
      if (entry.subjectGroupCode) record.group_code = entry.subjectGroupCode
      if (entry.subjectCourseCode) record.course_code = entry.subjectCourseCode
      return record
    })

    try {
      setSaving(true)
      const { error } = await supabase.from('exam_schedule').insert(entries)
      if (error) throw error
      const successMessage = 'Exam schedule saved successfully.'
      setFeedback({ message: '', type: '' })
      showToast(successMessage, { type: 'success' })

      // Reset form fields
      setSchedules({})
      setSelectedExam('')
      setSemesterFocus('')
      setCategory('')
      setExamParity('')
      setCurrentSemesterNumber(null)
      setShowPreview(false)
      setQueuedEntries([])
      setCustomRowsBySemester({})
      setSelectedDateBySemester({})
    } catch (err) {
      console.error(err)
      const errorMessage = err.message || 'Unable to save exam schedule.'
      setFeedback({ type: 'error', message: errorMessage })
      showToast(errorMessage, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSchedule = async () => {
    setFeedback({ message: '', type: '' })
    if (!validateScheduleForm()) return
    await handleConfirmSave()
  }

  const filtersReady = Boolean(category && selectedExam)
  const semesterHasSubjects = availableSemesters.some(
    (sem) => (subjectsBySemester[sem] || []).length > 0
  )
  const queuedCount = queuedEntries.length
  const saveDisabled = saving || !filtersReady || !semesterHasSubjects || !queuedCount

  return (
    <AdminShell>
      <div className="container py-4">
        <h2 className="fw-bold mb-1">Exam Scheduling</h2>
        <p className="text-muted mb-4">
          Choose the exam cycle and semester so you can assign dates to the relevant
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
                <div className="col-12 col-md-4">
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
                <div className="col-12 col-md-4">
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
                <div className="col-12 col-md-4">
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
                Select a category and exam to load subjects.
              </p>
            )}
            {filtersReady && !availableSemesters.length && (
              <p className="text-muted mb-3">
                No semesters found for the selected category.
              </p>
            )}
            {filtersReady && availableSemesters.length > 0 && !semesterFocus && (
              <p className="text-muted mb-3">
                Select a semester to view and schedule subjects.
              </p>
            )}
            {filtersReady && availableSemesters.length > 0 && semesterFocus && (
              <>
                <div className="mb-3">
                  <small className="text-muted">Focusing on semester {semesterFocus}</small>
                </div>
                {sortedSemesters.map((semesterNumber) => {
                  const dateValue = selectedDateBySemester[String(semesterNumber)] || ''
                  const rows = getRowsForSemester(semesterNumber)
                  const readyRowCount = rows.filter((row) => {
                    const entry =
                      schedules[row.key] ||
                      buildDefaultSchedule({ semester: row.semester, date: dateValue })
                    const subjectCode = (entry.subjectCode ?? '').trim()
                    return subjectCode && entry.startTime && entry.endTime && entry.date
                  }).length
                  const addEntryDisabled = !dateValue || !readyRowCount || !selectedExam
                  return (
                    <div className="card card-soft mb-3" key={semesterNumber}>
                      <div className="card-body">
                        <div className="d-flex flex-column flex-sm-row gap-3 align-items-center justify-content-between mb-3">
                          <h5 className="fw-semibold text-dark mb-0">Add exam time table</h5>
                          <div className="d-flex align-items-center gap-2">
                            <label className="small text-muted mb-0">Select date</label>
                            <input
                              type="date"
                              className="form-control form-control-sm"
                              value={dateValue}
                              onChange={(e) => handleSemesterDateChange(semesterNumber, e.target.value)}
                            />
                          </div>
                        </div>
                        {!dateValue ? (
                          <p className="text-muted mb-0">
                            Choose a date to add subjects for semester {semesterNumber}.
                          </p>
                        ) : rows.length ? (
                          <div className="table-responsive">
                            <table className="table mb-0">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Subject Code</th>
                                  <th>Start Time</th>
                                  <th>End Time</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row) => {
                                  const entry =
                                    schedules[row.key] ||
                                    buildDefaultSchedule({
                                      semester: row.semester,
                                      date: dateValue,
                                    })
                                  const subjectCodeValue = entry.subjectCode ?? ''
                                  const startTimeVal = entry.startTime ?? ''
                                  return (
                                <tr key={row.key}>
                                  <td>
                                    <input
                                      type="date"
                                      className="form-control form-control-sm"
                                      value={entry.date}
                                      disabled
                                    />
                                  </td>
                                  <td>
                                    <div className="d-flex flex-column gap-1">
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={subjectCodeValue}
                                        placeholder="Enter subject code"
                                        onChange={(e) =>
                                          handleScheduleChange(row.key, 'subjectCode', e.target.value, row.semester)
                                        }
                                      />
                                      {row.isCustom && (
                                        <button
                                          type="button"
                                          className="btn btn-link btn-sm text-danger p-0"
                                          onClick={() => removeCustomRow(semesterNumber, row.key)}
                                        >
                                          Remove row
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <select
                                      className="form-select form-select-sm"
                                      value={startTimeVal}
                                      onChange={(e) =>
                                        handleScheduleChange(row.key, 'startTime', e.target.value, row.semester)
                                      }
                                    >
                                      <option value="">Select start time</option>
                                      {TIME_SLOTS.map((time) => (
                                        <option key={`start-${row.key}-${time.value}`} value={time.value}>
                                          {time.displayTime}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td>
                                    <select
                                      className="form-select form-select-sm"
                                      value={entry.endTime}
                                      onChange={(e) =>
                                        handleScheduleChange(row.key, 'endTime', e.target.value, row.semester)
                                      }
                                    >
                                      <option value="">Select end time</option>
                                      {TIME_SLOTS.filter((time) => {
                                        if (!startTimeVal) return true
                                        const [startH, startM] = startTimeVal.split(':').map(Number)
                                        const [endH, endM] = time.value.split(':').map(Number)
                                        return endH > startH || (endH === startH && endM > startM)
                                      }).map((time) => (
                                        <option key={`end-${row.key}-${time.value}`} value={time.value}>
                                          {time.displayTime}
                                        </option>
                                      ))}
                                    </select>
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
                        <div className="mt-3 d-flex flex-wrap gap-2 align-items-center">
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => addCustomRow(semesterNumber)}
                            disabled={!dateValue}
                          >
                            + Add another row
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => handleAddEntry(semesterNumber)}
                          >
                            + Add entry
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
            {queuedEntries.length ? (
              <p className="small text-muted mb-2">
                {queuedEntries.length} {queuedEntries.length === 1 ? 'entry' : 'entries'} ready for preview or save.
              </p>
            ) : (
              <p className="small text-muted mb-2">
                Use “+ Add entry” per semester to buffer each day before previewing or submitting.
              </p>
            )}
            <div className="d-flex justify-content-end gap-2">
              <button className="btn btn-brand" disabled={saveDisabled} onClick={handlePreview}>
                Preview entries
              </button>
              <button
                className="btn btn-success"
                disabled={saveDisabled}
                onClick={handleSaveSchedule}
              >
                {saving ? 'Saving...' : 'Submit entries'}
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
                  {queuedEntries.map((entry) => {
                    const startTimeDisplay =
                      TIME_SLOTS.find((t) => t.value === entry.exam_start_time)?.displayTime ||
                      entry.exam_start_time
                    const endTimeDisplay =
                      TIME_SLOTS.find((t) => t.value === entry.exam_end_time)?.displayTime ||
                      entry.exam_end_time
                    return (
                      <tr key={entry.id}>
                        <td>{entry.semester_number}</td>
                        <td>{entry.subjectName || entry.subject_code}</td>
                        <td>{entry.exam_date}</td>
                        <td>{startTimeDisplay} - {endTimeDisplay}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-end">
              <button
                className="btn btn-outline-secondary"
                onClick={() => setShowPreview(false)}
                disabled={saving}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
