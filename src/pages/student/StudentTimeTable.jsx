import { useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { supabase } from '../../../supabaseClient'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'
import './Student.css'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const BREAK_LETTERS = ['B', 'R', 'E', 'A', 'K']
const LUNCH_LETTERS = ['L', 'U', 'N', 'C', 'H']
const TIME_SLOTS = [
  { key: 'p1', label: 'PERIOD 1', displayTime: '9:00 AM - 10:10 AM', startTime: '09:00:00', endTime: '10:10:00', type: 'CLASS', periodNum: 1 },
  { key: 'b1', label: 'BREAK', displayTime: '10:10 AM - 10:20 AM', type: 'BREAK' },
  { key: 'p2', label: 'PERIOD 2', displayTime: '10:20 AM - 11:30 AM', startTime: '10:20:00', endTime: '11:30:00', type: 'CLASS', periodNum: 2 },
  { key: 'p3', label: 'PERIOD 3', displayTime: '11:30 AM - 12:40 PM', startTime: '11:30:00', endTime: '12:40:00', type: 'CLASS', periodNum: 3 },
  { key: 'lunch', label: 'LUNCH', displayTime: '12:40 PM - 1:40 PM', type: 'LUNCH' },
  { key: 'p4', label: 'PERIOD 4', displayTime: '1:40 PM - 2:50 PM', startTime: '13:40:00', endTime: '14:50:00', type: 'CLASS', periodNum: 4 },
  { key: 'b2', label: 'BREAK', displayTime: '2:50 PM - 3:00 PM', type: 'BREAK' },
  { key: 'p5', label: 'PERIOD 5', displayTime: '3:00 PM - 4:00 PM', startTime: '15:00:00', endTime: '16:00:00', type: 'CLASS', periodNum: 5 },
]

const buildEmptyGrid = () => {
  const grid = {}
  DAYS.forEach((day) => {
    grid[day] = {}
  })
  return grid
}

const formatSemesterLabel = (value) => {
  if (!value) return ''
  const num = Number(value)
  if (!Number.isNaN(num)) return `Semester ${num}`
  return `Semester ${value}`
}

const resolveStudentDetails = async (student) => {
  if (!student?.id && !student?.student_id) return student || {}
  try {
    let query = supabase
      .from('students')
      .select('id, academic_year, group_id, group_name, course_id, course_name, current_semester')
    query = student?.id ? query.eq('id', student.id) : query.eq('student_id', student.student_id)
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    return data || student || {}
  } catch (err) {
    console.error('Failed to refresh student details', err)
    return student || {}
  }
}

const resolveGroupCourseIds = async (studentData) => {
  let groupId = studentData?.group_id
  let courseId = studentData?.course_id
  let groupName = studentData?.group_name || studentData?.group || ''
  let courseName = studentData?.course_name || studentData?.course || ''

  if (!groupId && groupName) {
    const { data: groupRow, error: groupError } = await supabase
      .from('groups')
      .select('group_id, group_name')
      .eq('group_name', groupName)
      .maybeSingle()
    if (groupError) throw groupError
    if (groupRow) {
      groupId = groupRow.group_id
      groupName = groupRow.group_name || groupName
    }
  }

  if (groupId && !groupName) {
    const { data: groupRow, error: groupError } = await supabase
      .from('groups')
      .select('group_id, group_name')
      .eq('group_id', groupId)
      .maybeSingle()
    if (groupError) throw groupError
    if (groupRow?.group_name) groupName = groupRow.group_name
  }

  if (!courseId && courseName) {
    const { data: courseByName, error: courseByNameError } = await supabase
      .from('courses')
      .select('course_id, course_name, course_code')
      .eq('course_name', courseName)
      .maybeSingle()
    if (courseByNameError) throw courseByNameError
    let courseRow = courseByName
    if (!courseRow) {
      const { data: courseByCode, error: courseByCodeError } = await supabase
        .from('courses')
        .select('course_id, course_name, course_code')
        .eq('course_code', courseName)
        .maybeSingle()
      if (courseByCodeError) throw courseByCodeError
      courseRow = courseByCode
    }
    if (courseRow) {
      courseId = courseRow.course_id
      courseName = courseRow.course_name || courseName
    }
  }

  if (courseId && !courseName) {
    const { data: courseRow, error: courseError } = await supabase
      .from('courses')
      .select('course_id, course_name')
      .eq('course_id', courseId)
      .maybeSingle()
    if (courseError) throw courseError
    if (courseRow?.course_name) courseName = courseRow.course_name
  }

  return { groupId, courseId, groupName, courseName }
}

const buildFileName = (parts) => {
  const cleaned = parts
    .filter(Boolean)
    .join('_')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned || 'student'
}

export default function StudentTimeTable() {
  const { student } = useStudentAuth()
  const timetableRef = useRef(null)
  const [grid, setGrid] = useState(() => buildEmptyGrid())
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasLoaded, setHasLoaded] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let isActive = true

    const loadTimetable = async () => {
      if (!student) {
        setError('Please sign in to view your timetable.')
        setGrid(buildEmptyGrid())
        setInfo(null)
        return
      }

      setLoading(true)
      setHasLoaded(false)
      setError('')
      setGrid(buildEmptyGrid())
      setInfo(null)

      try {
        const studentData = await resolveStudentDetails(student)
        const academicYear = (studentData?.academic_year || '').toString().trim()
        const semesterValue = (studentData?.current_semester || studentData?.semester || '').toString().trim()
        const { groupId, courseId, groupName, courseName } = await resolveGroupCourseIds(studentData)

        if (!academicYear || !semesterValue || !groupId || !courseId) {
          if (!isActive) return
          setError('Timetable details are incomplete for your profile.')
          setInfo({
            academic_year: academicYear,
            semester: semesterValue,
            groups: { group_name: groupName },
            courses: { course_name: courseName },
          })
          return
        }

        const { data: timetable, error: timetableError } = await supabase
          .from('timetables')
          .select('id, academic_year, semester, group_id, course_id, groups (group_name), courses (course_name, course_code)')
          .eq('academic_year', academicYear)
          .eq('group_id', groupId)
          .eq('course_id', courseId)
          .eq('semester', semesterValue)
          .maybeSingle()

        if (timetableError) throw timetableError

        if (!timetable) {
          if (!isActive) return
          setError('No timetable published yet for your class.')
          setInfo({
            academic_year: academicYear,
            semester: semesterValue,
            groups: { group_name: groupName },
            courses: { course_name: courseName },
          })
          return
        }

        const { data: slots, error: slotsError } = await supabase
          .from('timetable_slots')
          .select('day_of_week, period_number, slot_type, subjects (subject_name)')
          .eq('timetable_id', timetable.id)

        if (slotsError) throw slotsError

        const nextGrid = buildEmptyGrid()
        slots?.forEach((slot) => {
          if (slot.slot_type !== 'CLASS' || !slot.period_number) return
          const slotDef = TIME_SLOTS.find((item) => item.periodNum === slot.period_number)
          if (!slotDef) return
          if (!nextGrid[slot.day_of_week]) nextGrid[slot.day_of_week] = {}
          nextGrid[slot.day_of_week][slotDef.key] = slot.subjects?.subject_name || '-'
        })

        if (!isActive) return
        setGrid(nextGrid)
        setInfo({
          ...timetable,
          groups: { group_name: timetable.groups?.group_name || groupName },
          courses: { course_name: timetable.courses?.course_name || courseName },
        })
      } catch (err) {
        if (!isActive) return
        console.error('Failed to load timetable', err)
        setError(err?.message || 'Unable to load timetable right now.')
      } finally {
        if (isActive) {
          setLoading(false)
          setHasLoaded(true)
        }
      }
    }

    loadTimetable()
    return () => {
      isActive = false
    }
  }, [student])

  const displayCourse = info?.courses?.course_name || student?.course_name || student?.course || ''
  const displayGroup = info?.groups?.group_name || student?.group_name || student?.group || ''
  const displayYear = info?.academic_year || student?.academic_year || ''
  const displaySemester = info?.semester || student?.current_semester || student?.semester || ''

  const headerTitle = useMemo(() => {
    const titleCore = [displayCourse, displayGroup].filter(Boolean).join(', ')
    const semText = displaySemester ? ` (Sem ${displaySemester})` : ''
    return titleCore ? `Timetable View - ${titleCore}${semText}` : 'Timetable View'
  }, [displayCourse, displayGroup, displaySemester])

  const sheetTitle = displayYear ? `Class Timetable - ${displayYear}` : 'Class Timetable'
  const sheetSubtitle = [displayCourse, displayGroup, formatSemesterLabel(displaySemester)]
    .filter(Boolean)
    .join(' | ')

  const handleDownload = async () => {
    if (!timetableRef.current || downloading || !info?.id) return
    setDownloading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 80))
      const canvas = await html2canvas(timetableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('l', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let finalWidth = imgWidth
      let finalHeight = imgHeight

      if (finalHeight > pdfHeight) {
        const ratio = pdfHeight / finalHeight
        finalHeight = pdfHeight
        finalWidth *= ratio
      }

      const x = (pdfWidth - finalWidth) / 2
      const y = (pdfHeight - finalHeight) / 2

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight)
      const semesterFile = displaySemester ? `sem-${displaySemester}` : ''
      const fileBase = buildFileName([displayCourse, displayGroup, semesterFile])
      pdf.save(`Timetable_${fileBase}.pdf`)
    } catch (err) {
      console.error('Failed to export timetable', err)
    } finally {
      setDownloading(false)
    }
  }

  const badges = [
    { value: displayCourse, className: 'students-section-badge-course' },
    { value: displayGroup, className: 'students-section-badge-group' },
    { value: displayYear, className: 'students-section-badge-category' },
  ].filter((badge) => badge.value)

  return (
    <StudentShell>
      <div className="students-section-shell">
        <div className="students-section-shell-header">
          <h2 className="mb-2">Time table</h2>
          <p className="students-section-copy mb-3">
            Review your weekly class schedule and subject slots.
          </p>
          {badges.length > 0 && (
            <div className="d-flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  key={`${badge.value}-${badge.className}`}
                  className={`students-section-badge ${badge.className}`}
                >
                  {badge.value}
                </span>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="student-details__loading" role="status" aria-live="polite">
            <div className="student-details__loading-header">
              <div className="student-loader__spinner" aria-hidden="true"></div>
              <div>
                <div className="student-loader__title">Loading timetable</div>
                <div className="student-loader__subtitle">Fetching your class schedule.</div>
              </div>
            </div>
            <div className="student-details__loading-grid" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="student-loader-card" key={`timetable-loader-${index}`}>
                  <div className="student-loader-card__header student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                </div>
              ))}
            </div>
            <span className="sr-only">Loading timetable...</span>
          </div>
        )}

        {error && !loading && (
          <div className="student-details__status student-details__status--error">{error}</div>
        )}

        {!loading && !error && info?.id && (
          <div className="student-timetable-card">
            <div className="student-timetable-header">
              <div>
                <div className="student-timetable-title">{headerTitle}</div>
                <div className="student-timetable-subtitle">{sheetTitle}</div>
              </div>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleDownload}
                disabled={downloading}
              >
                <i className="bi bi-file-earmark-pdf me-2"></i>
                {downloading ? 'Preparing PDF...' : 'Download PDF'}
              </button>
            </div>

            <div className="student-timetable-sheet" ref={timetableRef}>
              <div className="student-timetable-sheet-title">{sheetTitle}</div>
              {sheetSubtitle && (
                <div className="student-timetable-sheet-subtitle">{sheetSubtitle}</div>
              )}
              <div className="student-timetable-scroll">
                <table className="student-timetable-table">
                  <thead>
                    <tr>
                      <th>DAY</th>
                      {TIME_SLOTS.map((slot) => (
                        <th key={slot.key}>
                          <span className="student-timetable-head-title">{slot.label}</span>
                          <span className="student-timetable-head-time">{slot.displayTime}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day, index) => (
                      <tr key={day}>
                        <th className="student-timetable-day">{day}</th>
                        {TIME_SLOTS.map((slot) => {
                          if (slot.type === 'BREAK') {
                            return (
                              <td key={slot.key} className="student-timetable-break">
                                {BREAK_LETTERS[index]}
                              </td>
                            )
                          }
                          if (slot.type === 'LUNCH') {
                            return (
                              <td key={slot.key} className="student-timetable-lunch">
                                {LUNCH_LETTERS[index]}
                              </td>
                            )
                          }
                          return (
                            <td key={slot.key} className="student-timetable-period">
                              {grid[day]?.[slot.key] || '-'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && hasLoaded && !info?.id && (
          <div className="student-details__status">Timetable details are unavailable.</div>
        )}
      </div>
    </StudentShell>
  )
}
