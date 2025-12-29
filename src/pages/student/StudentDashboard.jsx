import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'

const buildProfileRows = (student) => [
  { label: 'Student Name', value: student?.full_name },
  { label: 'Student ID', value: student?.student_id },
  { label: 'Register No.', value: student?.hall_ticket_no },
  { label: 'Mobile Number', value: student?.phone_number },
  { label: 'Academic Year', value: student?.academic_year },
  { label: 'Course', value: student?.course_name || student?.course },
  { label: 'Group', value: student?.group_name || student?.group },
  { label: 'Semester', value: student?.current_semester },
]

export default function StudentDashboard() {
  const { student } = useStudentAuth()
  const rows = buildProfileRows(student).filter((row) => row.value)
  const statusRaw = student?.status ? student.status.toString() : 'Active'
  const statusLabel = statusRaw
    ? statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1).toLowerCase()
    : 'Active'

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
                {student?.photo_url ? (
                  <img src={student.photo_url} alt={student?.full_name || 'Student'} />
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
