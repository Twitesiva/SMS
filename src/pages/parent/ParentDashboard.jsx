import React from 'react'
import ParentShell from '../../components/ParentShell'
import { useParentAuth } from '../../store/parentAuth'

export default function ParentDashboard() {
    const { parent } = useParentAuth()

    return (
        <ParentShell>
            <div className="card card-soft p-4 mb-4">
                <h2 className="fw-bold mb-3">Welcome, Parent</h2>
                <p className="text-muted">
                    You are viewing the details for <strong>{parent?.full_name}</strong> ({parent?.student_id}).
                </p>
            </div>

            <div className="row g-4">
                <div className="col-md-4">
                    <div className="card p-4 h-100 border-0 shadow-sm">
                        <div className="d-flex align-items-center mb-3">
                            <div className="bg-primary bg-opacity-10 p-3 rounded-circle text-primary me-3">
                                <i className="bi bi-person-badge fs-4"></i>
                            </div>
                            <h5 className="mb-0 fw-bold">Student Profile</h5>
                        </div>
                        <p className="text-muted small">View personal and academic details of your ward.</p>
                        <div className="mt-auto">
                            <span className="badge bg-light text-dark border">Course: {parent?.course_name}</span>
                        </div>
                    </div>
                </div>

                <div className="col-md-4">
                    <div className="card p-4 h-100 border-0 shadow-sm">
                        <div className="d-flex align-items-center mb-3">
                            <div className="bg-success bg-opacity-10 p-3 rounded-circle text-success me-3">
                                <i className="bi bi-calendar-check fs-4"></i>
                            </div>
                            <h5 className="mb-0 fw-bold">Attendance</h5>
                        </div>
                        <p className="text-muted small">Check daily attendance records and statistics.</p>
                    </div>
                </div>

                <div className="col-md-4">
                    <div className="card p-4 h-100 border-0 shadow-sm">
                        <div className="d-flex align-items-center mb-3">
                            <div className="bg-warning bg-opacity-10 p-3 rounded-circle text-warning me-3">
                                <i className="bi bi-file-earmark-bar-graph fs-4"></i>
                            </div>
                            <h5 className="mb-0 fw-bold">Results</h5>
                        </div>
                        <p className="text-muted small">View semester-wise examination results and grades.</p>
                    </div>
                </div>
            </div>
        </ParentShell>
    )
}
