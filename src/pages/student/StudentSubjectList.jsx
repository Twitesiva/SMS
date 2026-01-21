import { useEffect, useMemo, useState } from 'react'
import StudentShell from '../../components/StudentShell'
import { supabase } from '../../../supabaseClient'
import { useStudentAuth } from '../../store/studentAuth'
import './Student.css'

const getFileName = (url = '') => {
  if (url.startsWith('data:')) {
    return 'Learning Material'
  }
  const cleaned = url.split('?')[0]
  const parts = cleaned.split('/')
  const name = parts[parts.length - 1] || ''
  return decodeURIComponent(name.replace(/[-_]/g, ' '))
}

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
    subjectCode
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
          subjects: subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName))
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
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const subjectRowsBySemester = useMemo(() => {
    const map = new Map()
    subjectGroups.forEach((group) => {
      const rows = []
      let rowIndex = 0
      group.categories.forEach((category) => {
        category.subjects.forEach((subject) => {
          rowIndex += 1
          rows.push({
            key: `${group.semester}-${category.name}-${subject.id}`,
            index: rowIndex,
            category: category.name,
            subjectName: subject.subjectName
          })
        })
      })
      map.set(group.semester, rows)
    })
    return map
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
            let acYear = String(student.academic_year).trim()
            if (acYear.match(/^\d{4}$/)) {
              acYear = `${parseInt(acYear) - 1}-${acYear}`
            }
            subjectsQuery = subjectsQuery.eq('academic_year', acYear)
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

  useEffect(() => {
    const loadMaterials = async () => {
      if (!student?.current_semester) {
        setError('Student semester details are incomplete.')
        setMaterials([])
        return
      }

      setLoading(true)
      setError('')
      try {
        let resolvedCourseId = student?.course_id || null
        let resolvedGroupId = student?.group_id || null

        if (!resolvedCourseId) {
          // Gather all possible course identifier strings from the student object
          const candidates = [
            student.course_name,
            student.course,
            student.Program, // Sometimes saved as 'Program'
            student.course_code
          ].filter(Boolean).map(s => String(s).trim());

          if (candidates.length > 0) {
            // Try to find a match in the courses table for ANY of these candidates
            // We'll search by code OR name
            const { data: courseRows } = await supabase
              .from('courses')
              .select('course_id, course_code, course_name, group_name')

            if (courseRows?.length) {
              // simple in-memory find due to potential multiple candidates
              for (const val of candidates) {
                const lower = val.toLowerCase();
                const matched = courseRows.find(row =>
                  (row.course_code && row.course_code.toLowerCase() === lower) ||
                  (row.course_name && row.course_name.toLowerCase() === lower) ||
                  // Check against ID if candidate is numeric
                  (String(row.course_id) === val)
                );
                if (matched) {
                  resolvedCourseId = matched.course_id;
                  // If group_name is available in the course, and we don't have a group yet, store it for lookup
                  if (!student.group_name && !student.group && matched.group_name) {
                    student.inferred_group_name = matched.group_name;
                  }
                  break;
                }
              }
            }
          }
        }

        // If Group ID missing, try to infer from Course (via courses table)
        if (!resolvedGroupId && resolvedCourseId) {
          const { data: cRow } = await supabase
            .from('courses')
            .select('group_name')
            .eq('course_id', resolvedCourseId)
            .maybeSingle();

          const targetGroupName = cRow?.group_name || student.inferred_group_name;

          if (targetGroupName) {
            const { data: gRow } = await supabase
              .from('groups')
              .select('group_id')
              .ilike('group_name', targetGroupName.trim())
              .maybeSingle();
            if (gRow) resolvedGroupId = gRow.group_id;
          }
        }

        if (!resolvedGroupId && student?.group_name) {
          const { data: groupRows } = await supabase
            .from('groups')
            .select('group_id, group_name')
            .ilike('group_name', student.group_name.trim())
          if (groupRows?.length) {
            resolvedGroupId = groupRows[0]?.group_id || null
          }
        }

        if (!resolvedCourseId || !resolvedGroupId) {
          setError('Student course details are incomplete.')
          setMaterials([])
          return
        }

        // Parse semester to handle "I SEMESTER" or Roman numerals
        let semesterVal = student.current_semester
        if (typeof semesterVal === 'string') {
          const romanMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8 }
          const firstWord = semesterVal.split(' ')[0].toUpperCase()
          if (romanMap[firstWord]) {
            semesterVal = romanMap[firstWord]
          } else {
            const parsed = parseInt(semesterVal)
            if (!isNaN(parsed)) semesterVal = parsed
          }
        }

        const { data: mappingRows, error: mappingError } = await supabase
          .from('teacher_subject_mapping')
          .select('id, subject_id, course_id, group_id, semester, is_active')
          .eq('course_id', resolvedCourseId)
          .eq('group_id', resolvedGroupId)
          .eq('semester', Number(semesterVal))
          .eq('is_active', true)

        if (mappingError) throw mappingError

        const mappingIds = (mappingRows || []).map((row) => row.id).filter(Boolean)
        const subjectIds = (mappingRows || []).map((row) => row.subject_id).filter(Boolean)

        if (!mappingIds.length) {
          setMaterials([])
          return
        }

        const { data: subjectRows, error: subjectError } = await supabase
          .from('subjects')
          .select('subject_id, subject_name, subject_code')
          .in('subject_id', subjectIds)

        if (subjectError) throw subjectError

        const subjectMap = new Map()
          ; (subjectRows || []).forEach((row) => {
            subjectMap.set(row.subject_id, row)
          })

        const { data: materialRows, error: materialError } = await supabase
          .from('learning_materials')
          .select('id, teacher_subject_mapping_id, file_url, created_at')
          .in('teacher_subject_mapping_id', mappingIds)
          .order('created_at', { ascending: false })

        if (materialError) throw materialError

        const mapped = (materialRows || []).map((row) => {
          const mapping = mappingRows.find((item) => item.id === row.teacher_subject_mapping_id)
          const subject = mapping ? subjectMap.get(mapping.subject_id) : null
          return {
            id: row.id,
            fileUrl: row.file_url,
            fileName: row.file_url ? getFileName(row.file_url) : 'Untitled file',
            subjectName: subject?.subject_name || 'General',
            subjectCode: subject?.subject_code || '',
            createdAt: row.created_at
          }
        })

        setMaterials(mapped)
      } catch (err) {
        console.error('Failed to load learning materials', err)
        setError('Unable to load learning materials right now.')
        setMaterials([])
      } finally {
        setLoading(false)
      }
    }

    loadMaterials()
  }, [student])

  const stats = useMemo(() => {
    const availableResources = materials.length
    const totalSubjects = subjectGroups.reduce((sum, group) => sum + (group.totalCount || 0), 0)
    return { availableResources, totalSubjects }
  }, [materials, subjectGroups])

  const materialSubjectSet = useMemo(() => {
    const set = new Set()
    materials.forEach((item) => {
      if (item.subjectName) {
        set.add(item.subjectName.toLowerCase())
      }
    })
    return set
  }, [materials])

  const materialUrlBySubject = useMemo(() => {
    const map = new Map()
    materials.forEach((item) => {
      const key = String(item.subjectName || '').toLowerCase()
      if (!key || map.has(key)) return
      map.set(key, item.fileUrl)
    })
    return map
  }, [materials])

  const handleOpenFile = (url) => {
    if (!url) return
    if (url.startsWith('data:')) {
      const win = window.open()
      if (win) {
        win.document.write(
          `
            <html>
              <head>
                <title>View Material</title>
                <style>
                  body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
                  iframe { width: 100%; height: 100%; border: none; }
                </style>
              </head>
              <body>
                <iframe src="${url}" allowfullscreen></iframe>
              </body>
            </html>
          `
        )
      }
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <StudentShell>
      <div className="student-details">
        <div className="student-details__header">
          <h2>Subjects & Learning Materials</h2>
        </div>

        <div className="student-details__grid">
          <div className="student-card">
            <div className="student-card__header">Overview</div>
            <div className="student-card__body">
              <div className="student-detail-list">
                <div className="student-detail-row">
                  <div className="student-detail-label">Total Subjects</div>
                  <div className="student-detail-colon">:</div>
                  <div className="student-detail-value">{stats.totalSubjects}</div>
                </div>
                <div className="student-detail-row">
                  <div className="student-detail-label">Available Resources</div>
                  <div className="student-detail-colon">:</div>
                  <div className="student-detail-value">{stats.availableResources}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="student-card">
            <div className="student-card__header">Subjects</div>
            <div className="student-card__body">

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
                <div className="student-subjects-accordion">
                  {subjectGroups.map((group) => {
                    const rows = subjectRowsBySemester.get(group.semester) || []
                    return (
                      <div key={`semester-${group.semester}`} className="student-subjects-accordion__item">
                        <div className="student-subjects-accordion__trigger">
                          <div>
                            <div className="student-subjects-accordion__label">
                              {formatSemesterLabel(group.semester)}
                            </div>
                            <div className="student-subjects-accordion__meta">
                              {group.totalCount} Subjects
                            </div>
                          </div>
                        </div>
                        <div className="student-subjects-accordion__panel">
                          <table className="student-subjects-accordion__table">
                            <thead>
                              <tr>
                                <th>Serial No</th>
                                <th>Sub category</th>
                                <th>Subject name</th>
                                <th className="text-end">Materials</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => (
                                <tr key={row.key}>
                                  <td>{row.index}</td>
                                  <td>{row.category}</td>
                                  <td>{row.subjectName}</td>
                                  <td className="text-end">
                                    {materialSubjectSet.has(String(row.subjectName || '').toLowerCase()) ? (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-primary fw-bold"
                                        onClick={() =>
                                          handleOpenFile(
                                            materialUrlBySubject.get(
                                              String(row.subjectName || '').toLowerCase()
                                            )
                                          )
                                        }
                                      >
                                        View
                                      </button>
                                    ) : (
                                      <span className="student-subjects-accordion__muted">No materials</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </StudentShell>
  )
}
