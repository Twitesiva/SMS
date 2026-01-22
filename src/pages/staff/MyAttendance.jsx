import React from 'react'
import StaffShell from '../../components/StaffShell'
import './StaffPortal.css'
import '../student/Student.css'

export default function MyAttendance() {
    return (
        <StaffShell title="My Attendance Overview">
            <div className="students-section-shell">
                <div className="student-card mb-4">
                    <div className="student-card__header">My Attendance Overview</div>
                    <div className="student-card__body">
                        <p className="students-section-copy mb-3">View your own attendance records.</p>
                        <div className="alert alert-info mb-0">Coming Soon</div>
                    </div>
                </div>
            </div>
        </StaffShell>
    )
}
