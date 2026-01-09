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
          .select('id, full_name, student_id, hall_ticket_no, course_name, group_name, academic_year, current_semester, photo_url')
          .eq('student_id', parent.student_id)
          .maybeSingle()

        if (studentError) throw studentError
        if (!studentRow) throw new Error('Student record not found.')

        if (!active) return
        setStudentRecord(studentRow)
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
    return [studentRecord.course_name, studentRecord.group_name, studentRecord.academic_year].filter(Boolean)
  }, [studentRecord])

  return (
    <ParentShell>
      <div className="students-section-shell">
        <div className="students-section-shell-header">
          <h2 className="mb-2">Student Details</h2>
          <p className="students-section-copy mb-3">
            View your ward&apos;s academic profile and basic details.
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
          <div className="student-card">
            <div className="student-card__header">Profile Summary</div>
            <div className="student-card__body">
              <div className="student-profile__row" style={{ alignItems: 'center', marginBottom: '1rem' }}>
                <div className="student-profile__label">Profile Photo</div>
                <div className="student-profile__colon">:</div>
                <div className="student-profile__value">
                  <div className="student-avatar" style={{ width: '140px', height: '180px' }}>
                    {studentRecord.photo_url ? (
                      <img src={studentRecord.photo_url} alt={studentRecord.full_name || 'Student'} />
                    ) : (
                      <div className="student-avatar__fallback">
                        {(studentRecord.full_name || 'ST').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="student-profile">
                {[
                  { label: 'Student Name', value: studentRecord.full_name },
                  { label: 'Student ID', value: studentRecord.student_id },
                  { label: 'Register No.', value: studentRecord.hall_ticket_no },
                  { label: 'Academic Year', value: studentRecord.academic_year },
                  { label: 'Course', value: studentRecord.course_name },
                  { label: 'Group', value: studentRecord.group_name },
                  { label: 'Semester', value: studentRecord.current_semester }
                ].filter((row) => row.value).map((row) => (
                  <div key={row.label} className="student-profile__row">
                    <div className="student-profile__label">{row.label}</div>
                    <div className="student-profile__colon">:</div>
                    <div className="student-profile__value">{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ParentShell>
  )
}
