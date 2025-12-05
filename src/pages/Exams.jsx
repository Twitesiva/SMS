import AdminShell from '../components/AdminShell'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/mockApi'
import { showToast } from '../store/ui.js'
import { supabase } from '../../supabaseClient'

// Generate time slots in 15-minute intervals from 6:00 AM to 6:00 PM in 12-hour format
const generateTimeSlots = () => {
  const times = [];
  // Start from 6:00 AM (hour 6)
  for (let hour = 6; hour <= 18; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      // Skip times after 6:00 PM (18:00)
      if (hour === 18 && minute > 0) continue;

      const time = new Date();
      time.setHours(hour, minute, 0, 0);

      // Format as 12-hour with AM/PM
      const hours = hour % 12 || 12;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const formattedMinute = minute.toString().padStart(2, '0');
      const displayTime = `${hours}:${formattedMinute} ${ampm}`;

      // Format for time input (24-hour format)
      const value = time.toTimeString().slice(0, 5);

      times.push({ value, displayTime });
    }
  }
  return times;
};

const TIME_SLOTS = generateTimeSlots();

const DEFAULT_CATEGORY_ORDER = ['UG', 'PG']

const buildDefaultSchedule = () => ({
  selected: false,
  date: '',
  startTime: '',
  endTime: '',
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
  const [groups, setGroups] = useState([])
  const [courses, setCourses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [category, setCategory] = useState('')
  const [currentSemesterNumber, setCurrentSemesterNumber] = useState(null)
  const [academicYear, setAcademicYear] = useState('')
  const [groupCode, setGroupCode] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [semesterFocus, setSemesterFocus] = useState('')
  const [schedules, setSchedules] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ message: '', type: '' })
  const [exams, setExams] = useState([])
  const [selectedExam, setSelectedExam] = useState('')
  const [examParity, setExamParity] = useState('')
  const [examNameInput, setExamNameInput] = useState('')
  const [editingExam, setEditingExam] = useState(null)
  const [examsLoading, setExamsLoading] = useState(false)
  const [completeRegistrationModalOpen, setCompleteRegistrationModalOpen] = useState(false)
  const [completionTargetExam, setCompletionTargetExam] = useState(null)
  const [completedExamIds, setCompletedExamIds] = useState([])

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

  const handleSelectSavedExam = (exam) => {
    setExamNameInput(exam.exam_name)
    setEditingExam(exam)
    setSelectedExam(String(exam.id))
  }

  const handleSaveExamName = async () => {
    const monthYear = (examNameInput || '').trim()
    if (!monthYear) {
      showToast('Enter month and year (MM/YYYY) before saving.', { type: 'warning' })
      return
    }
    // Add validation for Month YYYY format (e.g., "December 2025")
    if (!/^[a-zA-Z]+\s\d{4}$/.test(monthYear)) {
      showToast('Please enter a valid month and year (e.g., "December 2025")', { type: 'warning' })
      return
    }
    const value = `Regular and Supplementary Examinations - ${monthYear}`
    if (editingExam) {
      showToast('Finish editing or cancel before saving a new exam name.', { type: 'warning' })
      return
    }
    const duplicate = exams.some(
      (entry) => (entry.exam_name || '').trim().toLowerCase() === value.toLowerCase()
    )
    if (duplicate) {
      showToast('This exam name already exists.', { type: 'warning' })
      return
    }
    try {
      const { data, error } = await supabase
        .from('exam_master')
        .insert({ exam_name: value })
        .select('id')
        .single()
      if (error) throw error
      await refreshExams()
      if (data?.id) {
        setSelectedExam(String(data.id))
      }
      setExamNameInput('')
      showToast('Exam name saved.', { type: 'success' })
    } catch (error) {
      console.error('Failed to save exam name:', error)
      showToast('Unable to save exam name.', { type: 'danger' })
    }
  }

  const handleUpdateExamName = async () => {
    if (!editingExam) {
      showToast('Select an exam to edit.', { type: 'warning' })
      return
    }
    const monthYear = (examNameInput || '').trim()
    if (!monthYear) {
      showToast('Month and year cannot be empty.', { type: 'warning' })
      return
    }
    // Add validation for Month YYYY format (e.g., "December 2025")
    if (!/^[a-zA-Z]+\s\d{4}$/.test(monthYear)) {
      showToast('Please enter a valid month and year (e.g., "December 2025")', { type: 'warning' })
      return
    }
    const value = `Regular and Supplementary Examinations - ${monthYear}`
    if (value === editingExam.exam_name) {
      showToast('No changes to save.', { type: 'info' })
      return
    }
    const duplicate = exams.some(
      (entry) =>
        entry.id !== editingExam.id &&
        (entry.exam_name || '').trim().toLowerCase() === value.toLowerCase()
    )
    if (duplicate) {
      showToast('Another exam already uses this name.', { type: 'warning' })
      return
    }
    try {
      const { error } = await supabase
        .from('exam_master')
        .update({ exam_name: value })
        .eq('id', editingExam.id)
      if (error) throw error
      await refreshExams()
      showToast('Exam name updated.', { type: 'success' })
      setEditingExam(null)
      setExamNameInput('')
    } catch (error) {
      console.error('Failed to update exam name:', error)
      showToast('Unable to update exam name.', { type: 'danger' })
    }
  }

  const handleDeleteExamName = async (examEntry) => {
    const target = examEntry ?? editingExam
    if (!target) {
      showToast('Select an exam to delete.', { type: 'warning' })
      return
    }
    try {
      const { error } = await supabase
        .from('exam_master')
        .delete()
        .eq('id', target.id)
      if (error) throw error
      await refreshExams()
      if (String(selectedExam) === String(target.id)) {
        setSelectedExam('')
      }
      setEditingExam(null)
      setExamNameInput('')
      showToast('Exam name removed.', { type: 'success' })
    } catch (error) {
      console.error('Failed to delete exam name:', error)
      showToast('Unable to delete exam name.', { type: 'danger' })
    }
  }

  const openCompleteRegistrationModal = (exam) => {
    setCompletionTargetExam(exam)
    setCompleteRegistrationModalOpen(true)
  }

  const closeCompleteRegistrationModal = () => {
    setCompleteRegistrationModalOpen(false)
    setCompletionTargetExam(null)
  }

  const assignSeatNumbersForExam = useCallback(async (examMasterId) => {
    if (!examMasterId) {
      console.error('No exam master ID provided for seat assignment')
      return 0
    }

    // Get all registrations for this exam
    const { data: registrations, error: regError } = await supabase
      .from('exam_registrations')
      .select('id, student_id, exam_id')
      .eq('exam_id', examMasterId)
      .not('student_id', 'is', null)
      .not('exam_id', 'is', null)

    if (regError) {
      console.error('Error fetching exam registrations:', regError)
      throw new Error('Failed to fetch exam registrations')
    }
    const registrationIds = (registrations || [])
      .map((registration) => registration?.id)
      .filter(Boolean)
    if (!registrationIds.length) {
      return 0
    }
    const studentIds = Array.from(
      new Set(
        (registrations || [])
          .map((registration) => registration?.student_id)
          .filter(Boolean)
      )
    )
    let studentLookup = new Map()
    if (studentIds.length) {
      // Query only existing columns in students table
      const { data: studentRows, error: studentsError } = await supabase
        .from('students')
        .select('id, full_name, student_id')
        .in('id', studentIds)
        .order('full_name', { ascending: true })
      if (studentsError) throw studentsError
      studentLookup = new Map(
        (studentRows || []).map((student) => [String(student.id), student])
      )
    }
    const { data: subjectRows, error: subjectsError } = await supabase
      .from('exam_registration_subjects')
      .select('exam_registration_id, subject_id')
      .in('exam_registration_id', registrationIds)
    if (subjectsError) throw subjectsError
    const validEntries = (subjectRows || [])
      .map((entry) => {
        const registration = (registrations || []).find(
          (reg) => reg?.id === entry?.exam_registration_id
        )
        if (!registration || !entry?.subject_id) return null
        const student = studentLookup.get(String(registration.student_id))
        const name = (
          student?.full_name ||
          student?.student_id ||
          ''
        )
          .toString()
          .trim()
          .toLowerCase()
        return {
          ...entry,
          student_id: registration.student_id,
          exam_id: registration.exam_id,
          studentName: name,
        }
      })
      .filter(Boolean)
    if (!validEntries.length) {
      return 0
    }
    const grouped = new Map()
    validEntries.forEach((entry) => {
      const key = String(entry.subject_id)
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(entry)
    })
    const seatAssignments = []
    grouped.forEach((entries) => {
      entries.sort((a, b) => {
        const comparison = a.studentName.localeCompare(b.studentName)
        if (comparison !== 0) return comparison
        return String(a.subject_id).localeCompare(String(b.subject_id))
      })
      entries.forEach((entry, index) => {
        seatAssignments.push({
          exam_id: examMasterId,
          student_id: entry.student_id,
          subject_id: entry.subject_id,
          seat_number: `S${String(index + 1).padStart(4, '0')}`,
        })
      })
    })
    // Delete existing seat assignments directly
    const { error: deleteError } = await supabase
      .from('student_subject_seats')
      .delete()
      .eq('exam_id', examMasterId)

    if (deleteError) {
      console.error('Error deleting existing seat assignments:', deleteError)
      throw new Error('Failed to clear existing seat assignments')
    }

    // Insert new seat assignments in batches to avoid payload size limits
    const BATCH_SIZE = 100
    for (let i = 0; i < seatAssignments.length; i += BATCH_SIZE) {
      const batch = seatAssignments.slice(i, i + BATCH_SIZE)
      const { error: insertError } = await supabase
        .from('student_subject_seats')
        .insert(batch)

      if (insertError) {
        console.error('Error inserting seat assignments batch:', insertError)
        throw new Error(`Failed to save seat assignments (batch ${i / BATCH_SIZE + 1})`)
      }
    }
    return seatAssignments.length
  }, [])

  const handleCompleteRegistrationConfirm = async () => {
    if (!completionTargetExam?.id) {
      showToast('No exam selected for registration', { type: 'warning' })
      return
    }

    closeCompleteRegistrationModal()

    try {
      showToast('Starting registration process...', { type: 'info', autoClose: 2000 })

      // Check if there are any registrations before proceeding
      const { count: registrationCount } = await supabase
        .from('exam_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('exam_id', completionTargetExam.id)

      if (!registrationCount) {
        showToast('No student registrations found for this exam', { type: 'warning' })
        return
      }

      const assignedCount = await assignSeatNumbersForExam(completionTargetExam.id)

      // Update the exam status to mark as completed
      const { error: updateError } = await supabase
        .from('exam_master')
        .update({ registration_completed: true })
        .eq('id', completionTargetExam.id)

      if (updateError) throw updateError

      setCompletedExamIds((prev) =>
        prev.includes(completionTargetExam.id)
          ? prev
          : [...prev, completionTargetExam.id]
      )

      const message = assignedCount > 0
        ? `Successfully assigned ${assignedCount} seat numbers for the exam.`
        : 'No seat assignments were needed.'

      showToast(message, {
        type: 'success',
        title: 'Registration Completed',
        autoClose: 5000
      })

      // Refresh the exams list to show updated status
      await refreshExams()

    } catch (error) {
      console.error('Registration failed:', error)

      const errorMessage = error.message || 'An unknown error occurred during registration'
      showToast(`Registration failed: ${errorMessage}`, {
        type: 'danger',
        title: 'Registration Error',
        autoClose: 10000
      })
    }
  }

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    Promise.all([
      api.listAcademicYears(),
      api.listGroups(),
      api.listCourses(),
      api.listSubjects(),
      api.getCurrentSemesterNumber(),
    ])
      .then(([years, groupsList, coursesList, subjectList, semesterNumber]) => {
        if (!isMounted) return
        setAcademicYears(years)
        setGroups(groupsList)
        setCourses(coursesList)
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

  const selectedGroup = useMemo(
    () => groups.find((group) => group.code === groupCode) ?? null,
    [groups, groupCode]
  )

  // Filter courses based on selected group
  const filteredCourses = useMemo(() => {
    if (!groupCode) return [];
    console.log('Selected Group Code:', groupCode);
    console.log('Available Groups:', groups);
    console.log('All Courses:', courses);

    const selectedGroup = groups.find(g => g.code === groupCode || g.group_code === groupCode);
    if (!selectedGroup) {
      console.log('No matching group found for code:', groupCode);
      return [];
    }

    const groupName = selectedGroup.name || selectedGroup.group_name;
    console.log('Filtering courses for group:', groupName);

    const filtered = courses.filter(course => {
      const matches = (course.group_name === groupName || course.group_name === groupCode);
      console.log(`Course: ${course.name} (${course.code}), Group: ${course.group_name}, Matches: ${matches}`);
      return matches;
    });

    console.log('Filtered Courses:', filtered);
    return filtered;
  }, [courses, groupCode, groups]);

  const selectedCourse = useMemo(
    () => filteredCourses.find((course) => course.code === courseCode) ?? null,
    [filteredCourses, courseCode]
  )

  const courseSemesterCount = selectedCourse ? Number(selectedCourse.semesters) || 0 : 0

  const availableSemesters = useMemo(() => {
    if (!courseSemesterCount) return [];
    const semesters = [];
    for (let i = 1; i <= courseSemesterCount; i += 1) {
      semesters.push(i);
    }
    return semesters;
  }, [courseSemesterCount])

  // Filter semesters to show only even or odd based on selection, with selected semester first
  const sortedSemesters = useMemo(() => {
    if (!availableSemesters.length) return [];

    if (!semesterFocus) return availableSemesters;

    const selectedSem = Number(semesterFocus);
    const isEvenSelected = selectedSem % 2 === 0;

    // Filter semesters to only include those with the same parity as selected
    const filteredSemesters = availableSemesters
      .filter(sem => isEvenSelected ? sem % 2 === 0 : sem % 2 !== 0)
      .sort((a, b) => b - a); // Sort in descending order

    // Move selected semester to the front
    const selectedIndex = filteredSemesters.indexOf(selectedSem);
    if (selectedIndex > -1) {
      filteredSemesters.splice(selectedIndex, 1);
      filteredSemesters.unshift(selectedSem);
    }

    return filteredSemesters;
  }, [availableSemesters, semesterFocus]);

  useEffect(() => {
    setSchedules({})
  }, [category, academicYear, groupCode, courseCode])

  useEffect(() => {
    if (!semesterFocus) return
    const focused = Number(semesterFocus)
    if (!availableSemesters.includes(focused)) {
      setSemesterFocus('')
    }
  }, [availableSemesters, semesterFocus])

  const filteredSubjectRows = useMemo(() => {
    if (!selectedCourse || !academicYear) return []
    return subjects.filter((subject) => {
      const semesterNumber = Number(subject.semester)
      if (!availableSemesters.includes(semesterNumber)) return false
      if (subject.courseCode && subject.courseCode !== selectedCourse.code) return false
      if (selectedGroup && subject.groupCode && subject.groupCode !== selectedGroup.code) return false
      if (academicYear && subject.academicYearName !== academicYear) return false
      return true
    })
  }, [subjects, selectedCourse, selectedGroup, academicYear, availableSemesters])

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
    if (!category || !academicYear || !groupCode || !courseCode) {
      setFeedback({
        type: 'error',
        message: 'Choose category, academic year, group and course before scheduling.',
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

      entries.push({
        academic_year: academicYear,
        group_code: groupCode,
        course_code: courseCode,
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
      setCourseCode('')
      setGroupCode('')
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

  const filtersReady = Boolean(category && academicYear && groupCode && courseCode)
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
          Choose the exam cycle, academic year, group and course so you can assign dates to the relevant
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
              <div className="mb-3">
                <h4 className="fw-bold mb-1">Exam details</h4>
                <p className="text-muted small mb-0">Create, rename, or finalize exams before assigning schedules.</p>
              </div>
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label">Exam name</label>
                  <div className="input-group">
                    <span className="input-group-text">Regular and Supplementary Examinations - </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Month YYYY (e.g., December 2025)"
                      value={examNameInput}
                      onChange={(event) => setExamNameInput(event.target.value)}
                      list="exam-name-options"
                    />
                  </div>
                  <datalist id="exam-name-options">
                    {exams.map((exam) => {
                      // Extract just the month/year part for the datalist
                      const displayValue = exam.exam_name.replace('Regular and Supplementary Examinations - ', '');
                      return <option key={exam.id} value={displayValue} />;
                    })}
                  </datalist>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-muted small mb-1">Saved exams</div>
                <div className="list-group list-group-flush">
                  {examsLoading ? (
                    <div className="text-muted small px-3 py-2">Loading exams...</div>
                  ) : exams.length ? (
                    exams.map((exam) => (
                      <div
                        key={exam.id}
                        className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2"
                      >
                        <div className="w-100 w-md-auto">
                          <div className="fw-semibold">
                            {exam.exam_name.startsWith('Regular and Supplementary Examinations - ')
                              ? exam.exam_name
                              : `Regular and Supplementary Examinations - ${exam.exam_name}`}
                          </div>
                          <div className="text-muted small">
                            {editingExam?.id === exam.id ? 'Selected for editing' : 'Tap edit to rename'}
                          </div>
                        </div>
                        <div className="d-flex flex-wrap gap-2 justify-content-end w-100 w-md-auto">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary rounded-pill px-3"
                            onClick={() => handleSelectSavedExam(exam)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger rounded-pill px-3"
                            onClick={() => handleDeleteExamName(exam)}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className={"btn btn-sm rounded-pill px-3 " + (completedExamIds.includes(exam.id) ? 'btn-outline-secondary' : 'btn-outline-success')}
                            onClick={() => openCompleteRegistrationModal(exam)}
                            disabled={completedExamIds.includes(exam.id)}
                          >
                            {completedExamIds.includes(exam.id) ? 'Completed' : 'Complete Registration'}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted small px-3 py-2">No exams saved yet.</div>
                  )}
                </div>
              </div>
              <div className="mt-3 d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleSaveExamName}
                  disabled={Boolean(editingExam)}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={handleUpdateExamName}
                  disabled={!editingExam}
                >
                  Update
                </button>
              </div>
            </div>
            <div className="card card-soft p-3 mb-4">
              <div className="row g-3">
                <div className="col-md-2">
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
                <div className="col-md-3">
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
                <div className="col-md-3">
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
                <div className="col-md-4">
                  <label className="form-label">Group</label>
                  <select className="form-select" value={groupCode} onChange={(e) => setGroupCode(e.target.value)}>
                    <option value="">Select group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.code}>
                        {group.name} ({group.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row g-3 mt-1">
                <div className="col-md-6">
                  <label className="form-label">Course</label>
                  <select
                    className="form-select"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    disabled={!groupCode}
                  >
                    <option value="">
                      {groupCode ? 'Select course' : 'Select a group first'}
                    </option>
                    {filteredCourses.map((course) => (
                      <option key={course.id} value={course.code}>
                        {course.name} ({course.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Semester</label>
                  <select
                    className="form-select"
                    value={semesterFocus}
                    onChange={(e) => setSemesterFocus(e.target.value)}
                  >
                    <option value="">
                      {availableSemesters.length
                        ? 'All semesters'
                        : 'Select course first'}
                    </option>
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
                Select the academic year, group and course to load subjects.
              </p>
            )}
            {filtersReady && !availableSemesters.length && (
              <p className="text-muted mb-3">
                This course does not define any semesters yet.
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
                    <th>Subject Code</th>
                    <th>Subject Name</th>
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
                          <td>{subject.subjectCode || subject.subjectName}</td>
                          <td>{subject.subjectName || subject.subjectCode}</td>
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
      {completeRegistrationModalOpen && (
        <div
          className="modal d-block"
          tabIndex="-1"
          role="dialog"
          aria-modal="true"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0">
                <div>
                  <h5 className="modal-title fw-bold">Complete registration?</h5>
                  <p className="text-muted small mb-0">Assign seat numbers for the selected exam before printing hall tickets.</p>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={closeCompleteRegistrationModal}
                ></button>
              </div>
              <div className="modal-body">
                <div className="p-3 rounded-3 border border-success bg-light">
                  <div className="fw-semibold text-success mb-2">Exam record</div>
                  <p className="mb-1 text-muted small">
                    Students tied to <strong>{completionTargetExam?.exam_name || 'this exam'}</strong> will be marked completed.
                  </p>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-outline-secondary" onClick={closeCompleteRegistrationModal}>
                  Cancel
                </button>
                <button type="button" className="btn btn-success" onClick={handleCompleteRegistrationConfirm}>
                  Confirm completion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
