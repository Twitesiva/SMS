import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabaseClient'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'

const formatSemesterLabel = (value) => {
  const num = Number(value)
  if (Number.isNaN(num)) return 'Semester'
  return `Semester ${num}`
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

const resolveCategoryName = (row = {}, lookup) => {
  const direct =
    row.category ||
    row.category_name ||
    row.categoryName ||
    row.subject_category?.category_name ||
    ''
  if (direct) return direct
  const categoryId = row.category_id ?? row.categoryId
  if (categoryId && lookup?.get(String(categoryId))) {
    return lookup.get(String(categoryId))
  }
  return 'General'
}

const groupSubjectsBySemesterAndCategory = (rows = [], categoryLookup) => {
  const semesterMap = new Map()
  rows.forEach((row) => {
    const semesterValue =
      row.semester_number ?? row.semester ?? row.semesterNumber ?? row.semester
    const semester = Number(semesterValue)
    const semesterKey = Number.isNaN(semester) ? 'NA' : semester
    const categoryName = resolveCategoryName(row, categoryLookup)
    if (!semesterMap.has(semesterKey)) {
      semesterMap.set(semesterKey, new Map())
    }
    const categoryMap = semesterMap.get(semesterKey)
    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, [])
    }
    categoryMap.get(categoryName).push(normalizeSubject(row))
  })

  return Array.from(semesterMap.entries())
    .sort((a, b) => {
      if (a[0] === 'NA') return 1
      if (b[0] === 'NA') return -1
      return Number(a[0]) - Number(b[0])
    })
    .map(([semester, categories]) => {
      const categoryEntries = Array.from(categories.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, subjects]) => ({
          name,
          subjects: subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
        }))
      const totalCount = categoryEntries.reduce((sum, entry) => sum + entry.subjects.length, 0)
      return { semester, categories: categoryEntries, totalCount }
    })
}

export default function StudentSubjectList() {
  const { student } = useStudentAuth()
  const [subjectGroups, setSubjectGroups] = useState([])
  const [subjectLoading, setSubjectLoading] = useState(false)
  const [subjectError, setSubjectError] = useState('')
  const tableRows = useMemo(() => {
    const rows = []
    let rowIndex = 0
    subjectGroups.forEach((group) => {
      rows.push({
        type: 'group',
        key: `semester-${group.semester}`,
        label: formatSemesterLabel(group.semester),
        count: group.totalCount,
      })
      group.categories.forEach((category) => {
        category.subjects.forEach((subject) => {
          rowIndex += 1
          rows.push({
            type: 'row',
            key: `${group.semester}-${category.name}-${subject.id}`,
            index: rowIndex,
            semester: group.semester,
            category: category.name,
            subjectName: subject.subjectName,
            subjectCode: subject.subjectCode,
          })
        })
      })
    })
    return rows
  }, [subjectGroups])

  useEffect(() => {
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
        let resolvedCourseCode = courseFilter
        try {
          const { data: courseRows, error: courseError } = await supabase
            .from('courses')
            .select('course_code, course_name')
            .or(`course_code.ilike.${courseFilter},course_name.ilike.${courseFilter}`)
          if (courseError) {
            console.error('Failed to resolve course code', courseError)
          } else if (courseRows?.length) {
            const lower = courseFilter.toLowerCase()
            const matched = courseRows.find(
              (row) =>
                row.course_code?.toLowerCase() === lower ||
                row.course_name?.toLowerCase() === lower
            )
            if (matched?.course_code) {
              resolvedCourseCode = matched.course_code
            }
          }
        } catch (courseLookupError) {
          console.error('Course lookup failed', courseLookupError)
        }

        const fetchSubjects = async (courseValue) => {
          let subjectsQuery = supabase
            .from('subjects')
            .select(
              'subject_id, subject_code, subject_name, semester_number, course_name, academic_year, category_id'
            )
            .eq('course_name', courseValue)
          if (student.academic_year) {
            subjectsQuery = subjectsQuery.eq('academic_year', student.academic_year)
          }
          return subjectsQuery.order('semester_number', { ascending: true })
        }

        let subjectsRes = await fetchSubjects(resolvedCourseCode)
        if (
          !subjectsRes.error &&
          (!subjectsRes.data || subjectsRes.data.length === 0) &&
          resolvedCourseCode !== courseFilter
        ) {
          subjectsRes = await fetchSubjects(courseFilter)
        }

        if (subjectsRes.error) throw subjectsRes.error

        const categoriesRes = await supabase
          .from('subject_category')
          .select('category_id, category_name')
        const categoryLookup = new Map()
        if (categoriesRes?.data?.length) {
          categoriesRes.data.forEach((category) => {
            if (category?.category_id) {
              categoryLookup.set(String(category.category_id), category.category_name || '')
            }
          })
        }
        if (categoriesRes?.error) {
          console.error('Failed to load subject categories', categoriesRes.error)
        }
        setSubjectGroups(groupSubjectsBySemesterAndCategory(subjectsRes.data || [], categoryLookup))
      } catch (err) {
        console.error(err)
        setSubjectError(err?.message || 'Unable to load subjects right now.')
        setSubjectGroups([])
      } finally {
        setSubjectLoading(false)
      }
    }

    loadSubjects()
  }, [student])

  return (
    <StudentShell>
      <div className="students-section-shell">
        <div className="students-section-shell-header">
          <h2 className="mb-2">Subject list</h2>
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

        {!subjectLoading && !subjectError && tableRows.some((row) => row.type === 'row') && (
          <div className="student-subjects-table-wrapper">
            <table className="student-subjects-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Sub category</th>
                  <th>Subject name</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) =>
                  row.type === 'group' ? (
                    <tr className="student-subjects-table-group" key={row.key}>
                      <td colSpan={3}>
                        <div className="student-subjects-table-group__content">
                          <span className="student-subjects-table-group__label">{row.label}</span>
                          <span className="student-subjects-table-group__count">
                            {row.count} Subjects
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.key}>
                      <td>{row.index}</td>
                      <td>{row.category}</td>
                      <td>{row.subjectName}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </StudentShell>
  )
}
