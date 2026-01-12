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
          .select('id, full_name, student_id, course_name, group_name, academic_year')
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
            max_marks,
            result_status,
            created_at,
            subject:subjects (
              subject_name,
              subject_code
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

  const badges = useMemo(() => {
    if (!studentRecord) return []
    return [studentRecord.course_name, studentRecord.group_name, studentRecord.academic_year].filter(Boolean)
  }, [studentRecord])

  const latestExamRows = useMemo(() => {
    if (!marksRows.length) return []
    const latestExamId = marksRows[0]?.exam_id
    if (!latestExamId) return [marksRows[0]]
    return marksRows.filter((row) => row.exam_id === latestExamId)
  }, [marksRows])

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
                    {[studentRecord.course_name, studentRecord.group_name, studentRecord.academic_year]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                </div>
                <div className="parent-marks__status">
                  <span className="parent-marks__status-badge">{summary.status}</span>
                  <div className="parent-marks__score">
                    <span>Percentage</span>
                    <strong>{summary.percentage}%</strong>
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
                          <th>Subject</th>
                          <th>Marks Obtained</th>
                          <th>Max Marks</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestExamRows.map((row, index) => (
                          <tr key={`${row.exam_id || 'exam'}-${index}`}>
                            <td>
                              <div className="parent-marks__subject">{row.subject?.subject_name || 'Unknown Subject'}</div>
                              {row.subject?.subject_code && (
                                <div className="parent-marks__subject-code">{row.subject.subject_code}</div>
                              )}
                            </td>
                            <td className="parent-marks__value">{Number(row.marks_obtained || 0)}</td>
                            <td className="parent-marks__value">{Number(row.max_marks || 0)}</td>
                            <td>
                              <span
                                className={`parent-marks__status-chip ${
                                  (row.result_status || '').toLowerCase() === 'pass'
                                    ? 'parent-marks__status-chip--pass'
                                    : 'parent-marks__status-chip--fail'
                                }`}
                              >
                                {row.result_status || 'N/A'}
                              </span>
                            </td>
                          </tr>
                        ))}
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
