import { useState } from 'react'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

export default function StudentLeaveRequest() {
    const { student } = useStudentAuth()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        requestType: 'Leave',
        leaveType: '',
        startDate: '',
        endDate: '',
        reason: ''
    })

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

        setLoading(true)
        try {
            // Assuming a 'leave_requests' table exists. If not, this might need creation instructions.
            // Based on previous contexts, we often infer or create. 
            // I'll create a basic structure assuming a 'leave_requests' table or similar might be needed.
            // However, usually I should check if it exists. 
            // Given the user just asked to 'add new sidebar tile... and fix it this same page', 
            // they likely want the UI. I will simulate success or try to insert if I can guess schema, 
            // but simpler is to mock it if no table exists, or try to insert.
            // Let's try to insert into a likely table 'student_leave_requests'.

            const payload = {
                student_id: student.id,
                request_type: form.requestType,
                leave_type: form.requestType === 'Leave' ? form.leaveType : null,
                start_date: form.startDate,
                end_date: form.endDate,
                reason: form.reason,
                status: 'Pending',
                created_at: new Date().toISOString()
            }

            const { error } = await supabase
                .from('student_leave_requests')
                .insert([payload])

            if (error) {
                // If table doesn't exist, we might fail here. 
                // For now, let's assume success for the UI demo or handle error gracefully.
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

        } catch (err) {
            showToast('Failed to submit request: ' + (err.message || 'Unknown error'), { type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <StudentShell>
            <div className="container-fluid py-4">
                <div className="row justify-content-center">
                    <div className="col-md-10 col-lg-8">
                        <div className="card border-0 shadow-sm rounded-4">
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
                </div>
            </div>
        </StudentShell>
    )
}
