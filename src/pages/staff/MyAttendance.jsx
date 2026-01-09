import React from 'react'
import StaffShell from '../../components/StaffShell'
import './StaffPortal.css'
import '../student/Student.css'

export default function MyAttendance() {
    return (
        <StaffShell title="My Attendance Overview">
            <div className="card card-soft p-4">
                <h3>My Attendance Overview</h3>
                <p>View your own attendance records.</p>
                <div className="alert alert-info">Coming Soon</div>
            </div>
        </StaffShell>
    )
}
