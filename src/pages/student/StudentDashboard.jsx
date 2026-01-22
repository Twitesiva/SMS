import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'
import { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import './Student.css'

const buildProfileRows = (student, enriched) => [
  { label: 'Student Name', value: student?.full_name },
  { label: 'Student ID', value: student?.student_id },
  { label: 'Register No.', value: student?.hall_ticket_no },
  { label: 'Mobile Number', value: student?.phone_number },
  { label: 'Academic Year', value: student?.academic_year },
  { label: 'Course', value: enriched?.course_name || student?.course_display || student?.course_name },
  { label: 'Group', value: enriched?.group_name || student?.group_display || student?.group_name },
  { label: 'Semester', value: student?.current_semester },
]

export default function StudentDashboard() {
  const { student } = useStudentAuth()
  const [enriched, setEnriched] = useState({})

  useEffect(() => {
    if (!student) return

    const fetchDetails = async () => {
      const updates = {}

      // Fetch Course Name if needed
      if (student.course_name) {
        const { data } = await supabase
          .from('courses')
          .select('course_name')
          .eq('course_code', student.course_name)
          .maybeSingle()
        if (data) updates.course_name = data.course_name
      }

      // Fetch Group Name if needed
      if (student.group_name) {
        const { data } = await supabase
          .from('groups')
          .select('group_name')
          .eq('group_code', student.group_name)
          .maybeSingle()
        if (data) updates.group_name = data.group_name
      }

      setEnriched(updates)
    }

    fetchDetails()
  }, [student])

  const rows = buildProfileRows(student, enriched).filter((row) => row.value)
  const statusRaw = student?.status ? student.status.toString() : 'Active'
  const normalizedStatus = statusRaw.trim().toLowerCase() === 'continue' ? 'active' : statusRaw
  const statusLabel = normalizedStatus
    ? normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1).toLowerCase()
    : 'Active'
  const photoSrc = student?.photo_url || student?.photo || ''

  return (
    <StudentShell>
      <div className="students-section-shell">
        <div className="student-dashboard__grid">
          <div className="student-card student-card--profile h-100">
            <div className="student-card__header">Student Profile</div>
            <div className="student-card__body p-4">
              {rows.length === 0 ? (
                <div className="text-muted text-center py-5">No student details found.</div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {rows.map((row) => (
                    <div key={row.label} className="d-flex border-bottom pb-2">
                      <div className="fw-bold text-secondary" style={{ width: '160px' }}>{row.label}</div>
                      <div className="me-3">:</div>
                      <div className="fw-semibold text-dark">{row.value}</div>
                    </div>
                  ))}
                </div>
              )}
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
                {photoSrc ? (
                  <img
                    src={photoSrc}
                    alt={student?.full_name || 'Student'}
                    className="w-100 h-100"
                    style={{ objectFit: 'cover', objectPosition: 'top' }}
                  />
                ) : (
                  <div className="w-100 h-100 bg-light d-flex align-items-center justify-content-center display-4 fw-bold text-primary opacity-50">
                    {(student?.full_name || 'ST').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="text-center">
                <div className="text-uppercase small text-muted letter-spacing-2 mb-1">Current Status</div>
                <div className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill">
                  <i className="bi bi-circle-fill me-2 small"></i>
                  {statusLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudentShell>
  )
}
