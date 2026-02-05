import { useEffect, useMemo, useState } from 'react'
import ParentShell from '../../components/ParentShell'
import { supabase } from '../../../supabaseClient'
import { useParentAuth } from '../../store/parentAuth'
import '../student/Student.css'

export default function ParentStudentDetails() {
  const { parent } = useParentAuth()
  const [studentRecord, setStudentRecord] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const loadStudent = async () => {
      if (!parent?.student_id) {
        setError('Student ID not available for this parent.')
        return
      }

      setLoading(true)
      setError('')
      try {
        const { data: studentRow, error: studentError } = await supabase
          .from('students')
          .select('id, full_name, student_id, hall_ticket_no, course_id, group_id, course_name, group_name, academic_year, current_semester, photo_url')
          .eq('student_id', parent.student_id)
          .maybeSingle()

        if (studentError) throw studentError
        if (!studentRow) throw new Error('Student record not found.')

        const isNumeric = (value) => String(value ?? '').trim() !== '' && !Number.isNaN(Number(value))

        let courseDisplay = studentRow.course_name
        let groupDisplay = studentRow.group_name

        const courseId = studentRow.course_id || (isNumeric(studentRow.course_name) ? Number(studentRow.course_name) : null)
        const groupId = studentRow.group_id || (isNumeric(studentRow.group_name) ? Number(studentRow.group_name) : null)

        const resolveCourse = async () => {
          const select = 'course_name, course_code'
          if (courseId) {
            const { data } = await supabase.from('courses').select(select).eq('course_id', courseId).maybeSingle()
            if (data) return data
          }
          if (studentRow.course_name) {
            const { data: byIdString } = await supabase.from('courses').select(select).eq('course_id', String(studentRow.course_name)).maybeSingle()
            if (byIdString) return byIdString
            const { data: byCode } = await supabase.from('courses').select(select).eq('course_code', String(studentRow.course_name)).maybeSingle()
            if (byCode) return byCode
          }
          return null
        }

        const resolveGroup = async () => {
          const select = 'group_name, group_code'
          if (groupId) {
            const { data } = await supabase.from('groups').select(select).eq('group_id', groupId).maybeSingle()
            if (data) return data
          }
          if (studentRow.group_name) {
            const { data: byIdString } = await supabase.from('groups').select(select).eq('group_id', String(studentRow.group_name)).maybeSingle()
            if (byIdString) return byIdString
            const { data: byCode } = await supabase.from('groups').select(select).eq('group_code', String(studentRow.group_name)).maybeSingle()
            if (byCode) return byCode
          }
          return null
        }

        const [courseRow, groupRow] = await Promise.all([resolveCourse(), resolveGroup()])

        courseDisplay = courseRow?.course_name || courseRow?.course_code || courseDisplay
        groupDisplay = groupRow?.group_name || groupRow?.group_code || groupDisplay

        if (!active) return
        setStudentRecord({
          ...studentRow,
          course_display: courseDisplay,
          group_display: groupDisplay
        })
      } catch (err) {
        if (active) setError(err?.message || 'Unable to load student details.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadStudent()
    return () => {
      active = false
    }
  }, [parent?.student_id])

  const badges = useMemo(() => {
    if (!studentRecord) return []
    return [
      studentRecord.course_display || studentRecord.course_name,
      studentRecord.group_display || studentRecord.group_name,
      studentRecord.academic_year
    ].filter(Boolean)
  }, [studentRecord])

  return (
    <ParentShell>
      <div className="students-section-shell">

        {loading && (
          <div className="student-details__loading" role="status" aria-live="polite">
            <div className="student-details__loading-header">
              <div className="student-loader__spinner" aria-hidden="true"></div>
              <div>
                <div className="student-loader__title">Loading student details</div>
                <div className="student-loader__subtitle">Fetching profile data.</div>
              </div>
            </div>
            <span className="sr-only">Loading student details...</span>
          </div>
        )}

        {error && !loading && (
          <div className="student-details__status student-details__status--error">{error}</div>
        )}

        {!loading && !error && studentRecord && (
          <div className="student-dashboard__grid">
            <div className="student-card student-card--profile h-100">
              <div className="student-card__header">Student Profile</div>
              <div className="student-card__body p-4">
                <div className="d-flex flex-column gap-3">
                  {[
                    { label: 'Student Name', value: studentRecord.full_name },
                    { label: 'Student ID', value: studentRecord.student_id },
                    { label: 'Register No.', value: studentRecord.hall_ticket_no },
                    { label: 'Academic Year', value: studentRecord.academic_year },
                    { label: 'Course', value: studentRecord.course_display || studentRecord.course_name },
                    { label: 'Group', value: studentRecord.group_display || studentRecord.group_name },
                    { label: 'Semester', value: studentRecord.current_semester }
                  ].filter((row) => row.value).map((row) => (
                    <div key={row.label} className="d-flex border-bottom pb-2">
                      <div className="fw-bold text-secondary" style={{ width: '160px' }}>{row.label}</div>
                      <div className="me-3">:</div>
                      <div className="fw-semibold text-dark">{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="student-card h-100">
              <div className="student-card__body d-flex flex-column align-items-center justify-content-center p-5 gap-4">
                <div
                  className="rounded-circle shadow-sm"
                  style={{
                    width: '180px',
                    height: '180px',
                    borderRadius: '50%',
                    border: '5px solid #fff',
                    overflow: 'hidden',
                    margin: '0 auto'
                  }}
                >
                  {studentRecord.photo_url ? (
                    <img
                      src={studentRecord.photo_url}
                      alt={studentRecord.full_name || 'Student'}
                      className="w-100 h-100"
                      style={{ objectFit: 'cover', objectPosition: 'top' }}
                    />
                  ) : (
                    <div className="w-100 h-100 bg-light d-flex align-items-center justify-content-center display-4 fw-bold text-primary opacity-50">
                      {(studentRecord.full_name || 'ST').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <div className="text-uppercase small text-muted letter-spacing-2 mb-1">Current Status</div>
                  <div className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill">
                    <i className="bi bi-circle-fill me-2 small"></i>
                    Active
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ParentShell>
  )
}
