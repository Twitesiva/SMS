import { useState, useEffect } from 'react'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

export default function StudentLeaveRequest() {
    const { student } = useStudentAuth()
    const [loading, setLoading] = useState(false)
    const [myRequests, setMyRequests] = useState([])
    const [form, setForm] = useState({
        requestType: 'Leave',
        leaveType: '',
        startDate: '',
        endDate: '',
        reason: ''
    })

    useEffect(() => {
        if (student) {
            fetchMyRequests()
        }
    }, [student])

    const fetchMyRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('leave_requests')
                .select('*')
                .eq('applicant_id', student.id)
                .eq('applicant_type', 'STUDENT')
                .order('applied_at', { ascending: false })

            if (error) throw error
            setMyRequests(data || [])
        } catch (err) {
            console.error('Error fetching my requests:', err)
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!form.startDate || !form.endDate || !form.reason) {
            showToast('Please fill in all required fields.', { type: 'warning' })
            return
        }

        if (!form.leaveType && form.requestType === 'Leave') {
            showToast('Please select a leave type.', { type: 'warning' })
            return
        }

        const start = new Date(form.startDate)
        const end = new Date(form.endDate)

        if (end < start) {
            showToast('End date cannot be before start date.', { type: 'warning' })
            return
        }

        const diffTime = Math.abs(end - start)
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

        setLoading(true)
        try {
            // Find HOD. In a real scenario, this should link via Department/Group.
            // Simplified: Fetch the first HOD found. 
            // Ideally: .eq('department', student.group_name) if such column existed.
            const { data: hods, error: hodError } = await supabase
                .from('teachers')
                .select('id, staff_id, full_name')
                .eq('designation', 'HOD')
                .limit(1)

            if (hodError || !hods?.length) {
                throw new Error('HOD not found. Please contact administration.')
            }
            const hodId = hods[0].id

            const payload = {
                applicant_type: 'STUDENT',
                applicant_id: student.id,
                hod_id: hodId,
                leave_type: form.requestType === 'Leave' ? form.leaveType : 'On-Duty',
                reason: form.reason,
                from_date: form.startDate,
                to_date: form.endDate,
                total_days: totalDays,
                status: 'PENDING',
            }

            const { error } = await supabase
                .from('leave_requests')
                .insert([payload])

            if (error) {
                console.error('Error submitting leave request:', error)
                throw error
            }

            showToast('Request submitted successfully for HOD approval.', { type: 'success' })
            setForm({
                requestType: 'Leave',
                leaveType: '',
                startDate: '',
                endDate: '',
                reason: ''
            })
            fetchMyRequests()

        } catch (err) {
            console.error(err)
            showToast('Failed to submit request: ' + (err.message || 'Unknown error'), { type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'APPROVED': return 'bg-success'
            case 'REJECTED': return 'bg-danger'
            default: return 'bg-warning text-dark'
        }
    }

    return (
        <StudentShell>
            <div className="container-fluid py-4">
                <div className="row g-4">
                    {/* Request Form */}
                    <div className="col-lg-7">
                        <div className="card border-0 shadow-sm rounded-4 h-100">
                            <div className="card-body p-4 p-md-5">
                                <h4 className="fw-bold mb-3">Request Category</h4>
                                <p className="text-muted mb-4">Apply for leave or on-duty based on your requirement.</p>

                                <form onSubmit={handleSubmit}>
                                    <div className="mb-4">
                                        <div className="form-check form-check-inline">
                                            <input
                                                className="form-check-input"
                                                type="radio"
                                                name="requestType"
                                                id="typeLeave"
                                                value="Leave"
                                                checked={form.requestType === 'Leave'}
                                                onChange={handleChange}
                                            />
                                            <label className="form-check-label fw-semibold" htmlFor="typeLeave">Leave</label>
                                        </div>
                                        <div className="form-check form-check-inline">
                                            <input
                                                className="form-check-input"
                                                type="radio"
                                                name="requestType"
                                                id="typeOD"
                                                value="On-Duty"
                                                checked={form.requestType === 'On-Duty'}
                                                onChange={handleChange}
                                            />
                                            <label className="form-check-label fw-semibold" htmlFor="typeOD">On-Duty</label>
                                        </div>
                                    </div>

                                    {form.requestType === 'Leave' && (
                                        <div className="mb-4">
                                            <label className="form-label fw-semibold">Leave Type</label>
                                            <select
                                                className="form-select text-muted"
                                                name="leaveType"
                                                value={form.leaveType}
                                                onChange={handleChange}
                                            >
                                                <option value="">Select Leave Type</option>
                                                <option value="Sick Leave">Sick Leave</option>
                                                <option value="Casual Leave">Casual Leave</option>
                                                <option value="Emergency Leave">Emergency Leave</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="row g-3 mb-4">
                                        <div className="col-md-6">
                                            <label className="form-label fw-semibold">From Date</label>
                                            <input
                                                type="date"
                                                className="form-control text-muted"
                                                name="startDate"
                                                value={form.startDate}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label fw-semibold">To Date</label>
                                            <input
                                                type="date"
                                                className="form-control text-muted"
                                                name="endDate"
                                                value={form.endDate}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="form-label fw-semibold">Reason</label>
                                        <textarea
                                            className="form-control text-muted"
                                            rows="4"
                                            name="reason"
                                            placeholder="Provide a brief justification for your request"
                                            value={form.reason}
                                            onChange={handleChange}
                                        ></textarea>
                                    </div>

                                    <div className="text-center mt-5">
                                        <p className="text-muted small mb-3">Upon submission, this request will be forwarded to the Head of Department (HOD) for approval.</p>
                                        <button type="submit" className="btn btn-primary px-5 py-2 fw-semibold" disabled={loading}>
                                            {loading ? 'Submitting...' : 'Submit for HOD Approval'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* Notifications / History */}
                    <div className="col-lg-5">
                        {/* Header Widget */}
                        <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden">
                            <div className="card-body p-3 text-white" style={{ background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' }}>
                                <div className="d-flex align-items-center">
                                    <div className="bg-white bg-opacity-25 rounded-circle p-2 me-3 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
                                        <i className="bi bi-bell-fill fs-5"></i>
                                    </div>
                                    <div>
                                        <h6 className="fw-bold mb-0">Request History</h6>
                                        <div className="small opacity-75" style={{ fontSize: '0.8rem' }}>Track your status updates</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Requests List */}
                        {myRequests.length === 0 ? (
                            <div className="card border-0 shadow-sm rounded-4">
                                <div className="card-body p-5 text-center text-muted">
                                    <div className="mb-3">
                                        <i className="bi bi-inbox-fill text-secondary opacity-25" style={{ fontSize: '4rem' }}></i>
                                    </div>
                                    <h6 className="fw-semibold">No requests yet</h6>
                                    <p className="small mb-0">Your leave history will appear here.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="vstack gap-4">
                                {myRequests.slice(0, 2).map((req) => {
                                    const isPending = req.status === 'PENDING';
                                    const isApproved = req.status === 'APPROVED';
                                    const isRejected = req.status === 'REJECTED';

                                    const borderClass = isPending ? 'border-warning' : isApproved ? 'border-success' : 'border-danger';

                                    return (
                                        <div key={req.id} className={`card border-0 shadow-sm rounded-4 border-start border-4 ${borderClass}`} style={{ backgroundColor: '#ffffff' }}>
                                            <div className="card-body p-3 text-dark">
                                                <div className="d-flex justify-content-between align-items-center mb-3">
                                                    <span className="badge bg-light text-dark border fw-normal px-3 py-2">{req.leave_type}</span>
                                                    <span className="small text-muted fw-bold">{req.total_days} Day(s)</span>
                                                </div>

                                                {/* Mini Timeline */}
                                                <div className="ps-2">
                                                    {/* Step 1: Submitted */}
                                                    <div className="d-flex gap-3 position-relative pb-3">
                                                        <div className="position-absolute start-0 top-0 h-100 border-start border-2 border-secondary border-opacity-10" style={{ left: '11px', zIndex: 0 }}></div>
                                                        <div className="z-1 bg-white border border-secondary border-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px' }}>
                                                            <i className="bi bi-check-circle-fill text-success fs-5"></i>
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-dark small" style={{ fontSize: '0.9rem' }}>Request Submitted</div>
                                                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>{new Date(req.applied_at).toLocaleDateString()}</div>
                                                        </div>
                                                    </div>

                                                    {/* Step 2: Status */}
                                                    <div className="d-flex gap-3 position-relative">
                                                        <div className="z-1 bg-white border border-secondary border-opacity-10 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '24px', height: '24px' }}>
                                                            {isPending && <i className="bi bi-circle-fill text-warning fs-5"></i>}
                                                            {isApproved && <i className="bi bi-check-circle-fill text-success fs-5"></i>}
                                                            {isRejected && <i className="bi bi-x-circle-fill text-danger fs-5"></i>}
                                                        </div>

                                                        <div className="flex-grow-1">
                                                            <div className={`fw-bold small ${isPending ? 'text-warning' : isApproved ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.9rem' }}>
                                                                {isPending ? 'Pending HOD Approval' : isApproved ? 'Approved by HOD' : 'Rejected by HOD'}
                                                            </div>
                                                            {req.actioned_at && (
                                                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>{new Date(req.actioned_at).toLocaleDateString()}</div>
                                                            )}

                                                            {/* Details Box */}
                                                            <div className="mt-2 bg-light p-2 rounded-3 border border-light-subtle">
                                                                <div className="mb-2">
                                                                    <div className="d-flex gap-4">
                                                                        <div>
                                                                            <span className="d-block text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>From</span>
                                                                            <span className="fw-semibold text-dark small">{req.from_date}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="d-block text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>To</span>
                                                                            <span className="fw-semibold text-dark small">{req.to_date}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <span className="d-block text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Reason</span>
                                                                    <p className="mb-0 text-dark small fst-italic">"{req.reason}"</p>
                                                                </div>
                                                                {req.hod_remarks && (
                                                                    <div className="mt-3 pt-2 border-top border-light-subtle text-danger small">
                                                                        <span className="d-block text-muted mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>HOD Remark</span>
                                                                        <strong>{req.hod_remarks}</strong>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </StudentShell>
    )
}
