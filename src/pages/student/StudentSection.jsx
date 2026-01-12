import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import StudentShell from '../../components/StudentShell'
import './Student.css'

const sectionLabels = {
  'personal-details': 'Personal details',
  'grade-mark': 'Grade / Mark',
  attendance: 'Attendance',
  'exam-result': 'Results',
  results: 'Results',
  'time-table': 'Time table',
  'hostel-details': 'Hostel fees',
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
