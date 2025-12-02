import AdminShell from '../components/AdminShell'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/mockApi'
import { showToast } from '../store/ui.js'
import { supabase } from '../../supabaseClient'

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

  // Fetch exams from exam_master table
  useEffect(() => {
    const fetchExams = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('exam_master')
          .select('id, exam_name, created_at')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Database error:', error);
          throw new Error('Failed to fetch exams from database');
        }
        
        if (!data || data.length === 0) {
          console.warn('No exams found in the database');
          setFeedback({
            message: 'No exams found. Please create an exam first.',
            type: 'warning'
          });
          return;
        }
        
        setExams(data);
        setFeedback({ message: '', type: '' });
      } catch (error) {
        console.error('Error fetching exams:', error);
        setFeedback({
          message: error.message || 'Failed to load exams. Please try again later.',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

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

  const handleSave = async () => {
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
    const entries = []
    for (const [id, entry] of Object.entries(schedules)) {
      if (!entry.selected) continue
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
        exam_master_id: selectedExam, // Add the selected exam ID as a reference to exam_master
      })
    }
    if (!entries.length) {
      setFeedback({ type: 'error', message: 'Select at least one subject to schedule.' })
      return
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
                disabled={loading || exams.length === 0}
              >
                <option value="">
                  {loading ? 'Loading exams...' : (exams.length === 0 ? 'No exams available' : 'Select exam')}
                </option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.exam_name}
                  </option>
                ))}
              </select>
              {loading && <div className="form-text">Loading exam data...</div>}
              {!loading && exams.length === 0 && (
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
                                    <input
                                      type="date"
                                      className="form-control form-control-sm"
                                      value={entry.date}
                                      disabled={!entry.selected}
                                      onChange={(e) => handleScheduleChange(subject.id, 'date', e.target.value)}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="time"
                                      className="form-control form-control-sm"
                                      value={entry.startTime}
                                      disabled={!entry.selected}
                                      onChange={(e) => handleScheduleChange(subject.id, 'startTime', e.target.value)}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="time"
                                      className="form-control form-control-sm"
                                      value={entry.endTime}
                                      disabled={!entry.selected}
                                      onChange={(e) => handleScheduleChange(subject.id, 'endTime', e.target.value)}
                                    />
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
          <button className="btn btn-brand" disabled={saveDisabled} onClick={handleSave}>
            {saving ? 'Saving schedule…' : 'Save Exam Schedule'}
          </button>
        </div>
      </div>
    </AdminShell>
  )
}
