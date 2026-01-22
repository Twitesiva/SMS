import React from 'react'
import TransportShell from '../../components/TransportShell'

export default function TransportAllocation() {
    return (
        <TransportShell>
            <div className="container-fluid">
                <div className="card shadow-sm border-0">
                    <div className="card-body p-5 text-center">
                        <h1 className="display-4 text-muted mb-4"><i className="bi bi-person-check"></i></h1>
                        <h2 className="mb-3">Student Allocation</h2>
                        <p className="lead text-muted">Student Route Allocation module is coming soon.</p>
                    </div>
                </div>
            </div>
        </TransportShell>
    )
}
