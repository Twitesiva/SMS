import { useEffect, useMemo, useState } from 'react'
import ParentShell from '../../components/ParentShell'
import { supabase } from '../../../supabaseClient'
import { useParentAuth } from '../../store/parentAuth'
import '../student/Student.css'

export default function ParentMarks() {
  const { parent } = useParentAuth()
  const [studentRecord, setStudentRecord] = useState(null)
  const [marksRows, setMarksRows] = useState([])
  const [summary, setSummary] = useState({ percentage: '0.0', latestExam: 'N/A', status: 'N/A' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gradeMaster, setGradeMaster] = useState([])

  useEffect(() => {
    let active = true
    const loadMarks = async () => {
      if (!parent?.student_id) {
        setError('Student ID not available for this parent.')
        return
      }

      setLoading(true)
      setError('')
      try {
        const { data: studentRow, error: studentError } = await supabase
          .from('students')
          .select('id, full_name, student_id, course_name, group_name, academic_year, current_semester')
          .eq('student_id', parent.student_id)
          .maybeSingle()

        if (studentError) throw studentError
        if (!studentRow) throw new Error('Student record not found.')

        if (!active) return
        setStudentRecord(studentRow)

        const { data: resultRows, error: resultsError } = await supabase
          .from('results')
          .select(`
            exam_id,
            marks_obtained,
            internal_marks,
            theory_marks,
            max_marks,
            result_status,
            semester,
            created_at,
            subject:subjects (
              subject_name,
              subject_code,
              semester_number,
              category:subject_category (
                credits
              )
            )
          `)
          .eq('student_id', studentRow.id)
          .order('created_at', { ascending: false })

        if (resultsError) throw resultsError
        const rows = resultRows || []
        if (active) setMarksRows(rows)

        if (rows.length) {
          const latestExamId = rows[0]?.exam_id
          const latestRows = latestExamId ? rows.filter((row) => row.exam_id === latestExamId) : rows
          const totalObtained = latestRows.reduce((sum, row) => sum + Number(row.marks_obtained || 0), 0)
          const totalMax = latestRows.reduce((sum, row) => sum + Number(row.max_marks || 0), 0)
          const percentage = totalMax ? ((totalObtained / totalMax) * 100).toFixed(1) : '0.0'

          let latestExam = 'Latest Exam'
          if (latestExamId) {
            const { data: examRow } = await supabase
              .from('exam_master')
              .select('exam_name')
              .eq('id', latestExamId)
              .maybeSingle()
            if (examRow?.exam_name) latestExam = examRow.exam_name
          }

          if (active) {
            setSummary({
              percentage,
              latestExam,
              status: latestRows[0]?.result_status || 'N/A'
            })
          }
        }
      } catch (err) {
        if (active) setError(err?.message || 'Unable to load marks.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadMarks()
    return () => {
      active = false
    }
  }, [parent?.student_id])

  useEffect(() => {
    let active = true
    const fetchGrades = async () => {
      try {
        const { data, error: gradeError } = await supabase.from('grade_master').select('*')
        if (gradeError) throw gradeError
        if (active && data) setGradeMaster(data)
      } catch (err) {
        console.error('Error fetching grades:', err)
      }
    }
    fetchGrades()
    return () => {
      active = false
    }
  }, [])

  const badges = useMemo(() => {
    if (!studentRecord) return []
    return [studentRecord.course_name, studentRecord.group_name, studentRecord.academic_year].filter(Boolean)
  }, [studentRecord])

  const metaBase = useMemo(() => {
    if (!studentRecord) return ''
    return [studentRecord.course_name, studentRecord.group_name, studentRecord.academic_year].filter(Boolean).join(' • ')
  }, [studentRecord])

  const latestExamRows = useMemo(() => {
    if (!marksRows.length) return []
    const latestExamId = marksRows[0]?.exam_id
    if (!latestExamId) return [marksRows[0]]
    return marksRows.filter((row) => row.exam_id === latestExamId)
  }, [marksRows])

  const getGradeInfo = (marks) => {
    const m = Number(marks)
    if (Number.isNaN(m)) return null
    return gradeMaster.find((g) => m >= Number(g.min_marks) && m <= Number(g.max_marks))
  }

  const calculateGPA = (resultList) => {
    let totalCredits = 0
    let totalPoints = 0
    resultList.forEach((res) => {
      const credits = Number(res.subject?.category?.credits || 0)
      const gradeInfo = getGradeInfo(res.marks_obtained)
      const points = gradeInfo ? Number(gradeInfo.grade_point) : 0
      if (credits > 0) {
        totalCredits += credits
        totalPoints += credits * points
      }
    })
    if (!totalCredits) return '0.00'
    return (totalPoints / totalCredits).toFixed(2)
  }

  const cgpa = useMemo(() => calculateGPA(marksRows), [marksRows, gradeMaster])

  return (
    <ParentShell>
      <div className="students-section-shell mb-3">
        <div className="students-section-shell-header">
          <h2 className="mb-2">Marks</h2>
          <p className="students-section-copy mb-3">
            Review latest exam results and overall performance.
          </p>
          {badges.length > 0 && (
            <div className="d-flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span key={badge} className="students-section-badge students-section-badge-course">
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="students-section-shell">
        {loading && (
          <div className="student-details__loading" role="status" aria-live="polite">
            <div className="student-details__loading-header">
              <div className="student-loader__spinner" aria-hidden="true"></div>
              <div>
                <div className="student-loader__title">Loading marks</div>
                <div className="student-loader__subtitle">Fetching exam results.</div>
              </div>
            </div>
            <span className="sr-only">Loading marks...</span>
          </div>
        )}

        {error && !loading && (
          <div className="student-details__status student-details__status--error">{error}</div>
        )}

        {!loading && !error && studentRecord && (
          <div className="parent-marks__layout">
            <div className="parent-marks__statement">
              <div className="parent-marks__hero">
                <div>
                  <div className="parent-marks__eyebrow">Exam Statement</div>
                  <div className="parent-marks__title">{summary.latestExam}</div>
                  <div className="parent-marks__meta">
                    {metaBase && <span>{metaBase}</span>}
                    {studentRecord?.current_semester && (
                      <>
                        {metaBase ? ' • ' : ''}
                        <strong className="parent-marks__meta-strong">{`Semester ${studentRecord.current_semester}`}</strong>
                      </>
                    )}
                  </div>
                </div>
                <div className="parent-marks__status">
                  <div className="parent-marks__score">
                    <span>Percentage</span>
                    <strong>{summary.percentage}%</strong>
                  </div>
                  <div className="parent-marks__score">
                    <span>CGPA</span>
                    <strong>{cgpa}</strong>
                  </div>
                </div>
              </div>

              <div className="parent-marks__card">
                <div className="parent-marks__card-head">
                  <div>
                    <div className="parent-marks__card-title">Subject-wise Scores</div>
                    <div className="parent-marks__card-sub">Exam: {summary.latestExam}</div>
                  </div>
                  <div className="parent-marks__card-badge">Latest Release</div>
                </div>

                {latestExamRows.length ? (
                  <div className="parent-marks__table-wrapper">
                    <table className="parent-marks__table">
                      <thead>
                        <tr>
                          <th className="text-center">S.No</th>
                          <th className="text-center">Subject Code</th>
                          <th>Subject</th>
                          <th className="text-center">Semester</th>
                          <th className="text-center">Internal</th>
                          <th className="text-center">Theory</th>
                          <th className="text-center">Total</th>
                          <th className="text-center">Max Marks</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestExamRows.map((row, index) => {
                          const semesterLabel = row.subject?.semester_number || row.semester || '—'
                          const status = (row.result_status || '').toLowerCase() === 'pass' ? 'pass' : 'fail'
                          return (
                            <tr key={`${row.exam_id || 'exam'}-${index}`}>
                              <td className="text-center parent-marks__value">{index + 1}</td>
                              <td className="text-center parent-marks__value">
                                {row.subject?.subject_code || '—'}
                              </td>
                              <td>
                                <div className="parent-marks__subject">{row.subject?.subject_name || 'Unknown Subject'}</div>
                              </td>
                              <td className="text-center parent-marks__value">{semesterLabel}</td>
                              <td className="text-center parent-marks__value">{Number(row.internal_marks || 0)}</td>
                              <td className="text-center parent-marks__value">{Number(row.theory_marks || 0)}</td>
                              <td className="text-center parent-marks__value">{Number(row.marks_obtained || 0)}</td>
                              <td className="text-center parent-marks__value">{Number(row.max_marks || 0)}</td>
                              <td>
                                <span
                                  className={`parent-marks__status-chip ${
                                    status === 'pass'
                                      ? 'parent-marks__status-chip--pass'
                                      : 'parent-marks__status-chip--fail'
                                  }`}
                                >
                                  {row.result_status || 'N/A'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="student-card__empty">No marks available yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ParentShell>
  )
}
