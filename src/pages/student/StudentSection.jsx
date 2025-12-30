import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'

const sectionLabels = {
  'personal-details': 'Personal details',
  'course-list': 'Subject list',
  'grade-mark': 'Grade / Mark',
  attendance: 'Attendance',
  'exam-result': 'Exam result',
  'time-table': 'Time table',
  'hostel-details': 'Hostel details',
  transport: 'Transport',
  'fee-payment': 'Fee payment',
}

const toRoman = (value) => {
  const map = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
  const num = Number(value)
  if (!Number.isNaN(num) && map[num - 1]) return map[num - 1]
  return '-'
}

const formatSemesterLabel = (value) => {
  const roman = toRoman(value)
  if (roman === '-') return 'Semester'
  return `${roman} Semester`
}

const normalizeSubject = (row = {}) => {
  const subjectName = row.subject_name || row.subjectName || row.subject_code || row.subjectCode || '-'
  const subjectCode = row.subject_code || row.subjectCode || ''
  return {
    id: row.subject_id || row.id || `${subjectCode}-${subjectName}`,
    subjectName,
    subjectCode,
  }
}

const groupSubjectsBySemester = (rows = []) => {
  const grouped = new Map()
  rows.forEach((row) => {
    const semesterValue =
      row.semester_number ?? row.semester ?? row.semesterNumber ?? row.semester
    const semester = Number(semesterValue)
    const key = Number.isNaN(semester) ? 'NA' : semester
    const list = grouped.get(key) || []
    list.push(normalizeSubject(row))
    grouped.set(key, list)
  })

  const entries = Array.from(grouped.entries())
    .sort((a, b) => {
      if (a[0] === 'NA') return 1
      if (b[0] === 'NA') return -1
      return Number(a[0]) - Number(b[0])
    })
    .map(([semester, subjects]) => ({
      semester,
      subjects: subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
    }))

  return entries
}

export default function StudentSection() {
  const { section } = useParams()
  const { student } = useStudentAuth()
  const label = useMemo(() => sectionLabels[section] || 'Student Portal', [section])
  const [subjectGroups, setSubjectGroups] = useState([])
  const [subjectLoading, setSubjectLoading] = useState(false)
  const [subjectError, setSubjectError] = useState('')

  useEffect(() => {
    if (section !== 'course-list') return
    if (!student) {
      setSubjectError('Please sign in to view your subjects.')
      setSubjectGroups([])
      return
    }

    const courseFilter = student.course_name || student.courseCode || student.course || ''
    if (!courseFilter) {
      setSubjectError('Course information is missing for this student.')
      setSubjectGroups([])
      return
    }

    const loadSubjects = async () => {
      setSubjectLoading(true)
      setSubjectError('')
      try {
        let query = supabase
          .from('subjects')
          .select('subject_id, subject_code, subject_name, semester_number, course_name, academic_year')
          .eq('course_name', courseFilter)

        if (student.academic_year) {
          query = query.eq('academic_year', student.academic_year)
        }

        const { data, error } = await query.order('semester_number', { ascending: true })
        if (error) throw error
        setSubjectGroups(groupSubjectsBySemester(data || []))
      } catch (err) {
        console.error(err)
        setSubjectError(err?.message || 'Unable to load subjects right now.')
        setSubjectGroups([])
      } finally {
        setSubjectLoading(false)
      }
    }

    loadSubjects()
  }, [section, student])

  return (
    <StudentShell>
      {section === 'course-list' ? (
        <div className="students-section-shell">
          <div className="students-section-shell-header">
            <h2 className="mb-2">{label}</h2>
            <div className="d-flex flex-wrap gap-2">
              {student?.course_name && (
                <span className="students-section-badge students-section-badge-course">
                  {student.course_name}
                </span>
              )}
              {student?.group_name && (
                <span className="students-section-badge students-section-badge-group">
                  {student.group_name}
                </span>
              )}
              {student?.academic_year && (
                <span className="students-section-badge students-section-badge-category">
                  {student.academic_year}
                </span>
              )}
            </div>
          </div>

          {subjectLoading && (
            <div className="student-details__loading" role="status" aria-live="polite">
              <div className="student-details__loading-header">
                <div className="student-loader__spinner" aria-hidden="true"></div>
                <div>
                  <div className="student-loader__title">Loading subjects</div>
                  <div className="student-loader__subtitle">Preparing your semester-wise list.</div>
                </div>
              </div>
              <div className="student-details__loading-grid" aria-hidden="true">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="student-loader-card" key={`subject-loader-${index}`}>
                    <div className="student-loader-card__header student-loader__shimmer"></div>
                    <div className="student-loader-card__line student-loader__shimmer"></div>
                    <div className="student-loader-card__line student-loader__shimmer"></div>
                    <div className="student-loader-card__line student-loader__shimmer"></div>
                    <div className="student-loader-card__line student-loader__shimmer"></div>
                  </div>
                ))}
              </div>
              <span className="sr-only">Loading subjects...</span>
            </div>
          )}

          {subjectError && !subjectLoading && (
            <div className="student-details__status student-details__status--error">
              {subjectError}
            </div>
          )}

          {!subjectLoading && !subjectError && subjectGroups.length === 0 && (
            <div className="student-details__status">No subjects found for your course.</div>
          )}

          {!subjectLoading && !subjectError && subjectGroups.length > 0 && (
            <div className="students-section-list">
              {subjectGroups.map((group) => (
                <div className="subjects-combo-card card" key={`semester-${group.semester}`}>
                  <div className="card-body">
                    <div className="subjects-combo-header d-flex align-items-start justify-content-between">
                      <div>
                        <div className="fw-semibold">{formatSemesterLabel(group.semester)}</div>
                        <div className="text-muted small">
                          {group.subjects.length} subject{group.subjects.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {Number(group.semester) === Number(student?.current_semester) && (
                        <span className="students-section-badge students-section-badge-course">
                          Current semester
                        </span>
                      )}
                    </div>
                    <div className="subjects-combo-category p-3 mb-0">
                      <ul className="student-subject-list">
                        {group.subjects.map((subject) => (
                          <li className="student-subject-item" key={subject.id}>
                            <span className="student-subject-name">{subject.subjectName}</span>
                            {subject.subjectCode && (
                              <span className="student-subject-code">{subject.subjectCode}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="student-section">
          <div className="student-section__card">
            <h2>{label}</h2>
            <p>Details for {label.toLowerCase()} will appear here.</p>
          </div>
        </div>
      )}
    </StudentShell>
  )
}
