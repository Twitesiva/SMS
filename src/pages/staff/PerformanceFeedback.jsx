import React from 'react'
import StaffShell from '../../components/StaffShell'
import './StaffPortal.css'


export default function PerformanceFeedback() {
    return (
        <StaffShell title="Academic Performance Feedback">
            <div className="students-section-shell">
                <div className="student-card mb-4">
                    <div className="student-card__header">Academic Performance Feedback</div>
                    <div className="student-card__body">
                        <p className="students-section-copy mb-3">Provide and view academic performance feedback.</p>
                        <div className="alert alert-info mb-0">Coming Soon</div>
                    </div>
                </div>
            </div>
        </StaffShell>
    )
}
