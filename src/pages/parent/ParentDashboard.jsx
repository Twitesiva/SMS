import { Link } from 'react-router-dom'
import ParentShell from '../../components/ParentShell'
import { useParentAuth } from '../../store/parentAuth'
import '../student/Student.css'

export default function ParentDashboard() {
    const { parent } = useParentAuth()

    return (
        <ParentShell>
            <div className="students-section-shell">
                <div className="students-section-shell-header">
                    <h2 className="mb-2">Parent Dashboard</h2>
                    <p className="students-section-copy mb-3">
                        Welcome, {parent?.full_name || 'Parent'}. Select a section to continue.
                    </p>
                </div>

                <div className="student-dashboard__grid">
                    <Link to="/parent/student-details" className="student-card student-card--profile text-decoration-none text-reset">
                        <div className="student-card__header">Student Details</div>
                        <div className="student-card__body">
                            Review your ward&apos;s profile and academic details.
                        </div>
                    </Link>

                    <Link to="/parent/attendance" className="student-card student-card--profile text-decoration-none text-reset">
                        <div className="student-card__header">Attendance</div>
                        <div className="student-card__body">
                            Track attendance summary and recent absences.
                        </div>
                    </Link>

                    <Link to="/parent/marks" className="student-card student-card--profile text-decoration-none text-reset">
                        <div className="student-card__header">Marks</div>
                        <div className="student-card__body">
                            View latest exam results and performance.
                        </div>
                    </Link>

                    <Link to="/parent/notifications" className="student-card student-card--profile text-decoration-none text-reset">
                        <div className="student-card__header">Notifications</div>
                        <div className="student-card__body">
                            See recent attendance alerts and updates.
                        </div>
                    </Link>
                </div>
            </div>
        </ParentShell>
    )
}
