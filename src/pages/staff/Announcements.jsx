import React from 'react'
import StaffShell from '../../components/StaffShell'

export default function Announcements() {
    return (
        <StaffShell title="Official Announcements">
            <div className="card card-soft p-4">
                <h3>Official Announcements</h3>
                <p>View official announcements.</p>
                <div className="alert alert-info">Coming Soon</div>
            </div>
        </StaffShell>
    )
}
