import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'
import { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'

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
      <div className="student-dashboard">
        <div className="student-dashboard__grid">
          <div className="student-card student-card--profile">
            <div className="student-card__header">Student Profile</div>
            <div className="student-card__body">
              {rows.length === 0 ? (
                <div className="student-card__empty">No student details found.</div>
              ) : (
                <div className="student-profile">
                  {rows.map((row) => (
                    <div key={row.label} className="student-profile__row">
                      <div className="student-profile__label">{row.label}</div>
                      <div className="student-profile__colon">:</div>
                      <div className="student-profile__value">{row.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="student-card student-card--status">
            <div className="student-card__body student-card__body--center">
              <div className="student-avatar">
                {photoSrc ? (
                  <img src={photoSrc} alt={student?.full_name || 'Student'} />
                ) : (
                  <div className="student-avatar__fallback">
                    {(student?.full_name || 'ST').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="student-status">Current Status: {statusLabel}</div>
            </div>
          </div>
        </div>
      </div>
    </StudentShell>
  )
}
