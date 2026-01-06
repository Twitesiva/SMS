import React from 'react'
import StaffShell from '../../components/StaffShell'

export default function Announcements() {
    return (
        <StaffShell title="Circulars">
            <div className="card card-soft p-4">
                <h3>Circulars</h3>
                <p>View circulars.</p>
                <div className="alert alert-info">Coming Soon</div>
            </div>
        </StaffShell>
    )
}
