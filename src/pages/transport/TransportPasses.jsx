import React from 'react'
import TransportShell from '../../components/TransportShell'

export default function TransportPasses() {
    return (
        <TransportShell>
            <div className="container-fluid">
                <div className="card shadow-sm border-0">
                    <div className="card-body p-5 text-center">
                        <h1 className="display-4 text-muted mb-4"><i className="bi bi-ticket-detailed"></i></h1>
                        <h2 className="mb-3">Bus Passes</h2>
                        <p className="lead text-muted">Bus Pass Management module is coming soon.</p>
                    </div>
                </div>
            </div>
        </TransportShell>
    )
}
