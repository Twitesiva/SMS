import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import StudentShell from '../../components/StudentShell'

const sectionLabels = {
  'personal-details': 'Personal details',
  'course-list': 'Course list',
  'grade-mark': 'Grade / Mark',
  attendance: 'Attendance',
  'exam-result': 'Exam result',
  'time-table': 'Time table',
  'hostel-details': 'Hostel details',
  transport: 'Transport',
  'fee-payment': 'Fee payment',
}

export default function StudentSection() {
  const { section } = useParams()
  const label = useMemo(() => sectionLabels[section] || 'Student Portal', [section])

  return (
    <StudentShell>
      <div className="student-section">
        <div className="student-section__card">
          <h2>{label}</h2>
          <p>Details for {label.toLowerCase()} will appear here.</p>
        </div>
      </div>
    </StudentShell>
  )
}
