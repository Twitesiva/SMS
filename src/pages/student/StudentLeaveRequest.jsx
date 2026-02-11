import { useState, useEffect } from 'react'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'
import './Student.css'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

export default function StudentLeaveRequest() {
    const { student } = useStudentAuth()
    const [loading, setLoading] = useState(false)
    const [myRequests, setMyRequests] = useState([])
    const [showAll, setShowAll] = useState(false)
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
                        <div className="student-card h-100">
                            <div className="student-card__header">Request Category</div>
                            <div className="student-card__body pb-0">
                                <p className="students-section-copy mb-0">Apply for leave or on-duty based on your requirement.</p>
                            </div>

                            <div className="p-3">
                                <form onSubmit={handleSubmit}>
                                    {/* CATEGORY */}
                                    <div className="mb-4 p-2 rounded-2" style={{ backgroundColor: '#f1f5f9' }}>
                                        <div className="d-flex gap-4">
                                            <div className="form-check form-check-inline m-0">
                                                <input
                                                    className="staff-attendance__radio me-2"
                                                    type="radio"
                                                    name="requestType"
                                                    id="typeLeave"
                                                    value="Leave"
                                                    checked={form.requestType === 'Leave'}
                                                    onChange={handleChange}
                                                />
                                                <label className="form-check-label fw-bold text-dark cursor-pointer" htmlFor="typeLeave">Leave</label>
                                            </div>
                                            <div className="form-check form-check-inline m-0">
                                                <input
                                                    className="staff-attendance__radio me-2"
                                                    type="radio"
                                                    name="requestType"
                                                    id="typeOD"
                                                    value="On-Duty"
                                                    checked={form.requestType === 'On-Duty'}
                                                    onChange={handleChange}
                                                />
                                                <label className="form-check-label fw-bold text-dark cursor-pointer" htmlFor="typeOD">On-Duty</label>
                                            </div>
                                        </div>
                                    </div>

                                    {form.requestType === 'Leave' && (
                                        <div className="mb-3">
                                            <label className="form-label fw-bold text-dark small">Leave Type *</label>
                                            <select
                                                className="form-select form-select-sm"
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

                                    <div className="row g-3 mb-3">
                                        <div className="col-md-6">
                                            <div className="p-2 rounded-2" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                <label className="form-label fw-bold text-dark small mb-1">From Date *</label>
                                                <input
                                                    type="date"
                                                    className="form-control form-control-sm"
                                                    name="startDate"
                                                    value={form.startDate}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="p-2 rounded-2" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                <label className="form-label fw-bold text-dark small mb-1">To Date *</label>
                                                <input
                                                    type="date"
                                                    className="form-control form-control-sm"
                                                    name="endDate"
                                                    value={form.endDate}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-bold text-dark small">Reason *</label>
                                        <textarea
                                            className="form-control form-control-sm"
                                            rows="3"
                                            name="reason"
                                            placeholder="Provide a brief justification"
                                            value={form.reason}
                                            onChange={handleChange}
                                        ></textarea>
                                    </div>

                                    <div className="mt-4 pt-3 border-top text-center">
                                        <div className="d-flex align-items-start gap-2 mb-3 p-2 rounded-2 text-start" style={{ backgroundColor: '#eff6ff' }}>
                                            <i className="bi bi-info-circle text-primary mt-1"></i>
                                            <p className="text-muted small mb-0" style={{ lineHeight: '1.4' }}>
                                                Upon submission, this request will be forwarded to the Head of Department (HOD) for approval.
                                            </p>
                                        </div>

                                        <button type="submit" className="btn btn-primary px-5 py-2 fw-bold" disabled={loading}>
                                            {loading ? 'Submitting...' : 'SUBMIT FOR HOD APPROVAL'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* Notifications / History */}
                    <div className="col-lg-5">
                        <div className="student-card h-100">
                            <div className="student-card__header">Request History</div>
                            <div className="student-card__body">
                                <p className="students-section-copy mb-4">Track your status updates</p>

                                {/* Requests List */}
                                {myRequests.length === 0 ? (
                                    <div className="text-center text-muted py-5">
                                        <div className="mb-3">
                                            <i className="bi bi-inbox-fill text-secondary opacity-25" style={{ fontSize: '3rem' }}></i>
                                        </div>
                                        <h6 className="fw-semibold">No requests yet</h6>
                                        <p className="small mb-0">Your leave history will appear here.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="vstack gap-3">
                                            {myRequests.slice(0, showAll ? undefined : 2).map((req) => {
                                                const isPending = req.status === 'PENDING';
                                                const isApproved = req.status === 'APPROVED';
                                                const isRejected = req.status === 'REJECTED';

                                                const statusColor = isPending ? 'warning' : isApproved ? 'success' : 'danger';

                                                return (
                                                    <div key={req.id} className="p-3 rounded-3 border" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <span className="fw-bold text-dark small">{req.leave_type}</span>
                                                            <span className={`badge bg-${statusColor}-subtle text-${statusColor} border border-${statusColor}-subtle`}>
                                                                {isPending ? 'Pending' : isApproved ? 'Approved' : 'Rejected'}
                                                            </span>
                                                        </div>

                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <div className="small text-muted">
                                                                <div>From: <span className="fw-semibold text-dark">{new Date(req.from_date).toLocaleDateString('en-GB')}</span></div>
                                                            </div>
                                                            <div className="small text-muted">
                                                                <div>To: <span className="fw-semibold text-dark">{new Date(req.to_date).toLocaleDateString('en-GB')}</span></div>
                                                            </div>
                                                        </div>

                                                        <div className="p-2 rounded bg-white border border-light-subtle small text-muted fst-italic">
                                                            "{req.reason}"
                                                        </div>

                                                        <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top border-light-subtle">
                                                            <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                                Applied: {new Date(req.applied_at).toLocaleDateString('en-GB')}
                                                            </span>
                                                            <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                                {req.total_days} Day(s)
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {myRequests.length > 2 && (
                                            <div className="text-center mt-3 pt-2">
                                                <button
                                                    className="btn btn-sm btn-link text-decoration-none fw-bold"
                                                    onClick={() => setShowAll(!showAll)}
                                                >
                                                    {showAll ? 'Show Less' : 'View All Request History'} <i className={`bi ${showAll ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </StudentShell>
    )
}

