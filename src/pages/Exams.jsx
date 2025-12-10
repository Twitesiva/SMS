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
  ...overrides,
})

const BASE_TABLE_ROW_ID = 'row-base'
const createTableRowId = () => `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const normalizeSubjectCode = (value) => {
  if (value === undefined || value === null) return ''
  return String(value).trim().toUpperCase()
}

const normalizeDisplayValue = (value) => {
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

const getSubjectDisplayName = (subject) => {
  if (!subject) return ''
  const candidates = []
  if (Array.isArray(subject.subjectNames)) {
    candidates.push(...subject.subjectNames)
  }
  candidates.push(subject.subjectName, subject.subject_name, subject.name)
  for (const candidate of candidates) {
    if (candidate) return String(candidate).trim()
  }
  return ''
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
  const [semesterFocus, setSemesterFocus] = useState('')
  const [schedules, setSchedules] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', type: '' })
  const [exams, setExams] = useState([])
  const [selectedExam, setSelectedExam] = useState('')
  const [examDate, setExamDate] = useState('')
  const [examParity, setExamParity] = useState('')
  const [examsLoading, setExamsLoading] = useState(false)
  const [tableRowIds, setTableRowIds] = useState([BASE_TABLE_ROW_ID])
  const [entryDate, setEntryDate] = useState('')
  const [queuedEntries, setQueuedEntries] = useState([])
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [previewFilterGroup, setPreviewFilterGroup] = useState('')
  const [previewFilterCourse, setPreviewFilterCourse] = useState('')
  const [previewFilterSemester, setPreviewFilterSemester] = useState('')
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
    if (!selectedExam) {
      setExamDate('')
      return
    }
    const exam = exams.find((item) => String(item.id) === String(selectedExam))
    if (!exam) {
      setExamDate('')
      return
    }
    const normalized = new Date(exam.date)
    setExamDate(
      Number.isNaN(normalized.getTime())
        ? ''
        : normalized.toISOString().split('T')[0]
    )
  }, [selectedExam, exams])

  useEffect(() => {
    if (!examDate) {
      setEntryDate('')
      return
    }
    setEntryDate(examDate)
  }, [examDate])

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
      api.listCourses(),
    ])
      .then(([years, subjectList, semesterNumber, courses]) => {
        if (!isMounted) return

        const courseGroupMap = {}
        const courseNameMap = {}
        if (courses) {
          courses.forEach((c) => {
            if (c.courseName) courseGroupMap[c.courseName] = c.groupName
            if (c.courseCode) courseGroupMap[c.courseCode] = c.groupName
            if (c.courseCode && c.courseName) courseNameMap[c.courseCode] = c.courseName
          })
        }

        const enrichedSubjects = (subjectList || []).map((s) => {
          const gName = courseGroupMap[s.courseName] || courseGroupMap[s.courseCode]
          const cName = courseNameMap[s.courseCode] || s.courseName
          return {
            ...s,
            groupName: s.groupName || gName || '',
            courseName: cName,
          }
        })

        setAcademicYears(years)
        setSubjects(enrichedSubjects)
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

  useEffect(() => {
    if (!availableSemesters.length) {
      setSemesterFocus('')
      return
    }
    const highest = String(Math.max(...availableSemesters))
    setSemesterFocus((prev) =>
      prev && availableSemesters.includes(Number(prev)) ? prev : highest
    )
  }, [availableSemesters])

  useEffect(() => {
    setSchedules({})
    setTableRowIds([BASE_TABLE_ROW_ID])
    setEntryDate('')
    setQueuedEntries([])
  }, [category])

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

  const subjectLookup = useMemo(() => {
    const map = {}
    subjects.forEach((subject) => {
      if (!subject) return
      const candidateCodes = new Set()
      if (Array.isArray(subject.subjectCodes)) {
        subject.subjectCodes.forEach((code) => candidateCodes.add(code))
      }
      if (subject.subjectCode) candidateCodes.add(subject.subjectCode)
      if (subject.subjectCodeRaw) candidateCodes.add(subject.subjectCodeRaw)
      candidateCodes.forEach((code) => {
        const normalized = normalizeSubjectCode(code)
        if (normalized) map[normalized] = subject
      })
    })
    return map
  }, [subjects])

  const getSubjectDetails = useCallback(
    (inputCode) => {
      const trimmed = inputCode ? String(inputCode).trim() : ''
      const normalized = normalizeSubjectCode(trimmed)
      const matched = normalized ? subjectLookup[normalized] : null
      const name = getSubjectDisplayName(matched)
      let label = normalized
      if (trimmed && name) {
        label = `${trimmed}-${name}`
      } else if (trimmed) {
        label = trimmed
      }
      const group =
        normalizeDisplayValue(
          matched?.groupCode ||
          matched?.group_code ||
          matched?.groupName ||
          matched?.group_name ||
          matched?.group
        ) || ''
      const course =
        normalizeDisplayValue(
          matched?.courseName ||
          matched?.course_name ||
          matched?.courseCode ||
          matched?.course_code ||
          matched?.course
        ) || ''

      const courseCode = normalizeDisplayValue(
        matched?.courseCode || matched?.course_code || matched?.course || ''
      )
      const courseName = normalizeDisplayValue(
        matched?.courseName || matched?.course_name || matched?.course || ''
      )
      const semester =
        normalizeDisplayValue(
          matched?.semester ||
          matched?.semester_number ||
          matched?.semesterNumber ||
          matched?.semesterNo
        ) || ''
      return { label, group, course, courseCode, courseName, semester, subject: matched }
    },
    [subjectLookup]
  )

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

  const addTableRow = () => {
    setTableRowIds((prev) => [...prev, createTableRowId()])
  }

  const removeTableRow = (rowId) => {
    if (rowId === BASE_TABLE_ROW_ID) return
    setTableRowIds((prev) => prev.filter((id) => id !== rowId))
    setSchedules((prev) => {
      const next = { ...prev }
      delete next[rowId]
      return next
    })
  }

  const handleAddEntry = () => {
    if (!selectedExam) {
      showValidationError('Select an exam before adding entries.')
      return
    }
    if (!entryDate) {
      showValidationError('Select a date before saving the entry.')
      return
    }
    const rows = tableRowIds
    const targetSemesterNumber =
      (semesterFocus && !Number.isNaN(Number(semesterFocus)) && Number(semesterFocus)) ||
      (availableSemesters.length ? Math.max(...availableSemesters) : null) ||
      currentSemesterNumber ||
      null
    const academicYearValue =
      targetSemesterNumber && semesterAcademicYear[targetSemesterNumber]
        ? semesterAcademicYear[targetSemesterNumber]
        : defaultAcademicYear
    const newEntries = rows
      .map((rowKey) => {
        const entry =
          schedules[rowKey] ||
          buildDefaultSchedule({ date: entryDate })
        const dateValue = entry.date || entryDate || examDate
        const subjectCode = String(entry.subjectCode ?? '').trim()
        if (!subjectCode || !entry.startTime || !entry.endTime || !dateValue) return null
        const {
          label: subjectLabel,
          group: subjectGroupValue,
          course: subjectCourseValue,
          courseCode: subjectCourseCodeValue,
          courseName: subjectCourseNameValue,
          semester: subjectSemesterValue,
        } = getSubjectDetails(subjectCode)
        return {
          id: `${rowKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          academic_year: academicYearValue,
          semester_number:
            subjectSemesterValue || targetSemesterNumber || null,
          subject_code: subjectCode,
          exam_date: dateValue,
          exam_start_time: entry.startTime,
          exam_end_time: entry.endTime,
          category,
          exam_master_id: selectedExam,
          subjectName: subjectLabel || subjectCode,
          subjectGroup: subjectGroupValue,
          subjectCourse: subjectCourseValue,
          subjectCourseCode: subjectCourseCodeValue,
          subjectCourseName: subjectCourseNameValue,
          subjectSemester: subjectSemesterValue,
        }
      })
      .filter(Boolean)
    if (!newEntries.length) {
      showValidationError('Add at least one subject with code, date, and time before adding an entry.')
      return
    }
    const wasEditing = Boolean(editingEntryId)
    setQueuedEntries((prev) => [...prev, ...newEntries])
    setTableRowIds([BASE_TABLE_ROW_ID])
    setSchedules({})
    setEntryDate('')
    setEditingEntryId(null)
    const toastMessage = wasEditing
      ? 'Entry updated. You can select another date now.'
      : 'Entry added. You can select another date now.'
    showToast(toastMessage, { type: 'success' })
  }

  const handleEditEntry = (entryId) => {
    const entry = queuedEntries.find((item) => item.id === entryId)
    if (!entry) return
    setQueuedEntries((prev) => prev.filter((item) => item.id !== entryId))
    setEntryDate(entry.exam_date)
    setSchedules({
      [BASE_TABLE_ROW_ID]: {
        date: entry.exam_date,
        startTime: entry.exam_start_time,
        endTime: entry.exam_end_time,
        subjectCode: entry.subject_code,
      },
    })
    setTableRowIds([BASE_TABLE_ROW_ID])
    setEditingEntryId(entryId)
    setShowPreview(false)
    showToast('Entry moved back to the table for editing.', { type: 'info' })
  }

  const handleScheduleChange = (rowId, field, value) => {
    const key = String(rowId)
    setSchedules((prev) => {
      const current = prev[key] || buildDefaultSchedule()
      return {
        ...prev,
        [key]: {
          ...current,
          [field]: value,
          date: current.date || entryDate || examDate || '',
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
      if (entry.subjectGroup) record.group_code = entry.subjectGroup
      if (entry.subjectCourseCode) {
        record.course_code = entry.subjectCourseCode
      } else if (entry.subjectCourse) {
        record.course_code = entry.subjectCourse
      }
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
      setCategory('')
      setExamParity('')
      setCurrentSemesterNumber(null)
      setShowPreview(false)
      setQueuedEntries([])
      setTableRowIds([BASE_TABLE_ROW_ID])
      setEntryDate('')
      setPreviewFilterGroup('')
      setPreviewFilterCourse('')
      setPreviewFilterSemester('')
      setEditingEntryId(null)
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

  const categorySelected = Boolean(category)
  const examDateSelected = Boolean(examDate)
  const filtersReady = categorySelected && Boolean(selectedExam) && examDateSelected
  const semesterHasSubjects = availableSemesters.some(
    (sem) => (subjectsBySemester[sem] || []).length > 0
  )
  const queuedCount = queuedEntries.length
  const readyRowCount = tableRowIds.filter((rowKey) => {
    const entry = schedules[rowKey] || buildDefaultSchedule()
    const subjectCode = (entry.subjectCode ?? '').trim()
    const dateValue = entry.date || entryDate || examDate
    return subjectCode && entry.startTime && entry.endTime && dateValue
  }).length
  const addEntryDisabled = !entryDate || !readyRowCount || !selectedExam
  const saveDisabled = saving || !filtersReady || !semesterHasSubjects || !queuedCount

  const previewFilterOptions = useMemo(() => {
    const groups = new Set()
    const courses = new Map() // Use Map to store code -> name
    const semesters = new Set()

    queuedEntries.forEach((entry) => {
      // 1. Groups: Always all available groups
      if (entry.subjectGroup) groups.add(entry.subjectGroup)

      // 2. Courses: Filter by selected group
      const matchesGroup = !previewFilterGroup || entry.subjectGroup === previewFilterGroup
      if (matchesGroup) {
        // Prefer explicit course code, fallback to legacy subjectCourse
        const code = entry.subjectCourseCode || entry.subjectCourse
        const name = entry.subjectCourseName || entry.subjectCourse
        if (code) {
          courses.set(code, name)
        }
      }

      // 3. Semesters: Filter by selected group AND selected course
      const entryCourseCode = entry.subjectCourseCode || entry.subjectCourse
      const matchesCourse = !previewFilterCourse || entryCourseCode === previewFilterCourse
      if (matchesGroup && matchesCourse) {
        if (
          entry.subjectSemester !== undefined &&
          entry.subjectSemester !== null &&
          entry.subjectSemester !== ''
        ) {
          semesters.add(Number(entry.subjectSemester))
        } else if (
          entry.semester_number !== undefined &&
          entry.semester_number !== null
        ) {
          semesters.add(Number(entry.semester_number))
        }
      }
    })

    const courseList = Array.from(courses.entries()).map(([code, name]) => ({
      code,
      name,
    })).sort((a, b) => a.name.localeCompare(b.name))

    return {
      groups: Array.from(groups).sort(),
      courses: courseList,
      semesters: Array.from(semesters).sort((a, b) => a - b),
    }
  }, [queuedEntries, previewFilterGroup, previewFilterCourse])

  // Reset course/semester filters if they become invalid due to upstream changes
  useEffect(() => {
    if (previewFilterGroup && previewFilterCourse) {
      // Check if current course is still valid for this group
      const validCourse = previewFilterOptions.courses.some(c => c.code === previewFilterCourse)
      if (!validCourse) {
        setPreviewFilterCourse('')
      }
    }
    if (previewFilterSemester) {
      const validSemester = previewFilterOptions.semesters.includes(Number(previewFilterSemester))
      if (!validSemester) {
        setPreviewFilterSemester('')
      }
    }
  }, [previewFilterGroup, previewFilterOptions, previewFilterCourse, previewFilterSemester])

  const filteredPreviewEntries = useMemo(() => {
    return queuedEntries.filter((entry) => {
      if (previewFilterGroup && entry.subjectGroup !== previewFilterGroup) return false
      if (previewFilterCourse) {
        const entryCode = entry.subjectCourseCode || entry.subjectCourse
        if (entryCode !== previewFilterCourse) return false
      }
      if (
        previewFilterSemester &&
        String(entry.semester_number) !== String(previewFilterSemester)
      ) {
        return false
      }
      return true
    })
  }, [queuedEntries, previewFilterGroup, previewFilterCourse, previewFilterSemester])

  useEffect(() => {
    if (queuedEntries.length) return
    setPreviewFilterGroup('')
    setPreviewFilterCourse('')
    setPreviewFilterSemester('')
  }, [queuedEntries.length])

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
                  {selectedExam ? (
                    <>
                      <label className="form-label">Exam Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                        aria-label="Exam date"
                      />
                    </>
                  ) : (
                    <div className="mt-3 mt-md-0">
                      <p className="form-text text-muted mb-0">
                        Select an exam to show the date picker.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {loading && <p className="text-muted mb-3">Loading exam metadata...</p>}
            {!loading && !categorySelected && (
              <p className="text-muted mb-3">
                Select a category to load subjects and reveal the exam time table.
              </p>
            )}
            {categorySelected && !selectedExam && (
              <p className="text-muted mb-3">Select an exam to load the exam date picker.</p>
            )}
            {selectedExam && !examDateSelected && (
              <p className="text-muted mb-3">Choose the exam date to access the scheduling table.</p>
            )}
            {selectedExam && examDateSelected && !availableSemesters.length && (
              <p className="text-muted mb-3">
                No semesters found for the selected category.
              </p>
            )}
            {selectedExam && examDateSelected && availableSemesters.length > 0 && (
              <div className="card card-soft mb-3">
                <div className="card-body">
                  <div className="d-flex flex-column flex-sm-row gap-3 align-items-center justify-content-between mb-3">
                    <h4 className="fw-semibold text-dark mb-0 display-6">Add exam time table</h4>
                    <div className="d-flex align-items-center gap-2">
                      <label className="small text-muted mb-0">Select date</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                      />
                    </div>
                  </div>
                  {!entryDate ? (
                    <p className="text-muted mb-0">Choose a date to add subjects.</p>
                  ) : (
                    <>
                      <div className="table-responsive">
                        <table className="table mb-0">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Subject Code</th>
                              <th>Start Time</th>
                              <th>End Time</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {tableRowIds.map((rowKey) => {
                              const entry =
                                schedules[rowKey] ||
                                buildDefaultSchedule()
                              const subjectCodeValue = entry.subjectCode ?? ''
                              const startTimeVal = entry.startTime ?? ''
                              const rowDate = entry.date || entryDate || examDate
                              return (
                                <tr key={rowKey}>
                                  <td>
                                    <input
                                      type="date"
                                      className="form-control form-control-sm"
                                      value={rowDate}
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
                                          handleScheduleChange(rowKey, 'subjectCode', e.target.value)
                                        }
                                      />
                                    </div>
                                  </td>
                                  <td>
                                    <select
                                      className="form-select form-select-sm"
                                      value={startTimeVal}
                                      onChange={(e) =>
                                        handleScheduleChange(rowKey, 'startTime', e.target.value)
                                      }
                                    >
                                      <option value="">Select start time</option>
                                      {TIME_SLOTS.map((time) => (
                                        <option key={`start-${rowKey}-${time.value}`} value={time.value}>
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
                                        handleScheduleChange(rowKey, 'endTime', e.target.value)
                                      }
                                    >
                                      <option value="">Select end time</option>
                                      {TIME_SLOTS.filter((time) => {
                                        if (!startTimeVal) return true
                                        const [startH, startM] = startTimeVal.split(':').map(Number)
                                        const [endH, endM] = time.value.split(':').map(Number)
                                        return endH > startH || (endH === startH && endM > startM)
                                      }).map((time) => (
                                        <option key={`end-${rowKey}-${time.value}`} value={time.value}>
                                          {time.displayTime}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="text-end">
                                    {rowKey !== BASE_TABLE_ROW_ID && (
                                      <button
                                        type="button"
                                        className="btn btn-link btn-sm text-danger p-0"
                                        onClick={() => removeTableRow(rowKey)}
                                      >
                                        Remove row
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 d-flex flex-wrap gap-2 align-items-center justify-content-between">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={addTableRow}
                        >
                          + Add another row
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={handleAddEntry}
                          disabled={addEntryDisabled}
                        >
                          + Add entry
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            {queuedEntries.length ? (
              <p className="small text-muted mb-2">
                {queuedEntries.length} {queuedEntries.length === 1 ? 'entry' : 'entries'} ready for preview or save.
              </p>
            ) : (
              <p className="small text-muted mb-2">
                Use "+ Add entry" to buffer each day before previewing or submitting.
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
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Group</label>
                <select
                  className="form-select form-select-sm"
                  value={previewFilterGroup}
                  onChange={(e) => setPreviewFilterGroup(e.target.value)}
                >
                  <option value="">All groups</option>
                  {previewFilterOptions.groups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Course</label>
                <select
                  className="form-select form-select-sm"
                  value={previewFilterCourse}
                  onChange={(e) => setPreviewFilterCourse(e.target.value)}
                >
                  <option value="">All courses</option>
                  {previewFilterOptions.courses.map((course) => (
                    <option key={course.code} value={course.code}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small mb-1">Semester</label>
                <select
                  className="form-select form-select-sm"
                  value={previewFilterSemester}
                  onChange={(e) => setPreviewFilterSemester(e.target.value)}
                >
                  <option value="">All semesters</option>
                  {previewFilterOptions.semesters.map((sem) => (
                    <option key={sem} value={sem}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-responsive mb-4">
              <table className="table table-bordered">
                <thead className="bg-light">
                  <tr>
                    <th>Semester</th>
                    <th>Subject</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPreviewEntries.length ? (
                    filteredPreviewEntries.map((entry) => {
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
                          <td>
                            <button
                              type="button"
                              className="btn btn-link btn-sm"
                              onClick={() => handleEditEntry(entry.id)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center text-muted">
                        No entries match the selected filters.
                      </td>
                    </tr>
                  )}
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
