import { useState, useEffect } from 'react'
import StaffShell from '../../components/StaffShell'
import { useStaffAuth } from '../../store/staffAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import { useLocation } from 'react-router-dom'

export default function LeaveManagement() {
  const { staff } = useStaffAuth()
  const { search } = useLocation()
  const [activeTab, setActiveTab] = useState('apply') // 'apply' | 'approvals'

  // Application Form State
  const [requestCategory, setRequestCategory] = useState('leave')
  const [leaveType, setLeaveType] = useState('')
  const [odType, setOdType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  // Approval List State
  const [requests, setRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  // My History
  const [myRequests, setMyRequests] = useState([])

  // HOD Actioned History (Approved/Rejected)
  const [actionedRequests, setActionedRequests] = useState([])
  const [loadingActioned, setLoadingActioned] = useState(false)

  const isHOD = staff?.designation === 'HOD'
  const studentRequests = requests.filter((req) => req.applicant_type === 'STUDENT')
  const staffRequests = requests.filter((req) => req.applicant_type === 'STAFF')
  const studentActionedRequests = actionedRequests.filter((req) => req.applicant_type === 'STUDENT')
  const staffActionedRequests = actionedRequests.filter((req) => req.applicant_type === 'STAFF')
  const viewFilter = new URLSearchParams(search).get('view')
  const showStudentSection = viewFilter !== 'staff'
  const showStaffSection = viewFilter !== 'students'
  const pendingCount = viewFilter === 'students'
    ? studentRequests.length
    : viewFilter === 'staff'
      ? staffRequests.length
      : requests.length

  useEffect(() => {
    if (isHOD) {
      setActiveTab('approvals')
    }
  }, [isHOD])

  useEffect(() => {
    if (activeTab === 'apply' || !isHOD) {
      fetchMyHistory()
    }
  }, [activeTab, isHOD])

  const fetchMyHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('applicant_type', 'STAFF')
        .eq('applicant_id', staff.id)
        .order('applied_at', { ascending: false })

      if (error) throw error
      setMyRequests(data || [])
    } catch (err) {
      console.error('Error fetching my history', err)
    }
  }

  useEffect(() => {
    if (isHOD && activeTab === 'approvals') {
      fetchRequests()
    } else if (isHOD && activeTab === 'history') {
      fetchActionedRequests()
    }
  }, [isHOD, activeTab])

  const fetchRequests = async () => {
    setLoadingRequests(true)
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('hod_id', staff.id)
        .eq('status', 'PENDING')
        .order('applied_at', { ascending: false })

      if (error) throw error

      // Manually fetch applicant names if expansion isn't set up
      const enhancedData = await Promise.all(data.map(async (req) => {
        let name = 'Unknown'
        let details = ''
        if (req.applicant_type === 'STUDENT') {
          const { data: st } = await supabase.from('students').select('full_name, group_name').eq('id', req.applicant_id).maybeSingle()
          if (st) { name = st.full_name; details = st.group_name }
        } else if (req.applicant_type === 'STAFF') {
          const { data: st } = await supabase.from('teachers').select('full_name').eq('id', req.applicant_id).maybeSingle()
          if (st) { name = st.full_name; details = 'Staff' }
        }
        return { ...req, applicantName: name, applicantDetails: details }
      }))

      setRequests(enhancedData)
    } catch (err) {
      console.error('Error fetching requests', err)
      showToast('Unable to load leave requests', { type: 'error' })
    } finally {
      setLoadingRequests(false)
    }
  }

  const fetchActionedRequests = async () => {
    setLoadingActioned(true)
    try {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('hod_id', staff.id)
        .in('status', ['APPROVED', 'REJECTED'])
        .order('actioned_at', { ascending: false })

      if (error) throw error

      const enhancedData = await Promise.all(data.map(async (req) => {
        let name = 'Unknown'
        let details = ''
        if (req.applicant_type === 'STUDENT') {
          const { data: st } = await supabase.from('students').select('full_name, group_name').eq('id', req.applicant_id).maybeSingle()
          if (st) { name = st.full_name; details = st.group_name }
        } else if (req.applicant_type === 'STAFF') {
          const { data: st } = await supabase.from('teachers').select('full_name').eq('id', req.applicant_id).maybeSingle()
          if (st) { name = st.full_name; details = 'Staff' }
        }
        return { ...req, applicantName: name, applicantDetails: details }
      }))

      setActionedRequests(enhancedData)
    } catch (err) {
      console.error('Error fetching actioned requests', err)
    } finally {
      setLoadingActioned(false)
    }
  }

  const handleLeaveChange = (value) => {
    if (value === '__REGULAR__' || value === '__SPECIAL__' || value === '__ACADEMIC__') return
    setLeaveType(value)
  }

  const handleSubmit = async () => {
    if (!fromDate || !toDate || !reason) {
      showToast('Please fill in all required fields.', { type: 'warning' })
      return
    }
    if (requestCategory === 'leave' && !leaveType) {
      showToast('Please select a leave type.', { type: 'warning' })
      return
    }

    // Calculate total days
    const start = new Date(fromDate)
    const end = new Date(toDate)
    if (end < start) {
      showToast('End date cannot be before start date.', { type: 'warning' })
      return
    }
    const diffTime = Math.abs(end - start)
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    setLoading(true)
    try {
      // Find Approver (HOD or Principal)
      // If I am HOD, I report to Principal. If I am normal staff, I report to HOD.
      let approverDesignation = isHOD ? 'PRINCIPAL' : 'HOD'

      const { data: approvers, error: approverError } = await supabase
        .from('teachers')
        .select('id')
        .eq('designation', approverDesignation)
        .limit(1)

      // If Principal not found in teachers, maybe checking admin_users table? 
      // But for consistency let's try 'HOD' if Principal fails or just use the first HOD if I am not HOD.

      let approverId = null
      if (approvers && approvers.length > 0) {
        approverId = approvers[0].id
      } else {
        // Fallback: If no Principal/HOD found, maybe allow self or mock.
        // For now, allow submission but warn.
        if (!isHOD) {
          // Try to find ANY HOD
          const { data: anyHod } = await supabase.from('teachers').select('id').eq('designation', 'HOD').limit(1)
          if (anyHod?.length) approverId = anyHod[0].id
        }
      }

      if (!approverId) {
        // If we really can't find an approver, we can't create a request that shows up for someone.
        // But valid SQL requires hod_id. We'll use 0 or a placeholder if needed, likely it will fail FK.
        // We'll throw.
        throw new Error(`No ${approverDesignation} found to approve your request.`)
      }

      const payload = {
        applicant_type: 'STAFF',
        applicant_id: staff.id,
        hod_id: approverId,
        leave_type: requestCategory === 'leave' ? leaveType : 'On-Duty (' + odType + ')',
        reason: reason,
        from_date: fromDate,
        to_date: toDate,
        total_days: totalDays,
        status: 'PENDING'
      }

      const { error } = await supabase.from('leave_requests').insert([payload])
      if (error) throw error

      showToast('Request submitted successfully.', { type: 'success' })
      setReason('')
      setFromDate('')
      setToDate('')
      setLeaveType('')
      setOdType('')
      fetchMyHistory()
    } catch (err) {
      console.error(err)
      showToast('Failed to submit: ' + err.message, { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (reqId, status, remarks = '') => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: status,
          hod_remarks: remarks,
          actioned_at: new Date().toISOString()
        })
        .eq('id', reqId)

      if (error) throw error
      showToast(`Request ${status.toLowerCase()} successfully.`, { type: 'success' })
      fetchRequests() // reload
    } catch (err) {
      showToast('Failed to update request', { type: 'error' })
    }
  }

  return (
    <StaffShell title="Leave & On-Duty Management">
      <div className="container-fluid py-4">

        {isHOD && (
          <ul className="nav nav-tabs mb-4">
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'approvals' ? 'active' : ''}`}
                onClick={() => setActiveTab('approvals')}
              >
                Pending Approvals
                {pendingCount > 0 && <span className="badge bg-danger ms-2">{pendingCount}</span>}
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                Approvals History
              </button>
            </li>
          </ul>
        )}

        {/* APPROVALS TAB */}
        {isHOD && activeTab === 'approvals' && (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h5 className="card-title mb-4">Pending Leave Requests</h5>
              {loadingRequests ? (
                <div className="text-center py-4">Loading...</div>
              ) : requests.length === 0 ? (
                <div className="text-muted text-center py-4">No pending requests</div>
              ) : (
                <>
                  {showStudentSection && (
                    <div className="mb-4">
                      <h6 className="fw-semibold mb-3">Student Leave Requests</h6>
                      {studentRequests.length === 0 ? (
                        <div className="text-muted">No pending student requests.</div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table align-middle">
                            <thead>
                              <tr>
                                <th>Applicant</th>
                                <th>Role</th>
                                <th>Type</th>
                                <th>Dates</th>
                                <th>Days</th>
                                <th>Reason</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {studentRequests.map((req) => (
                                <tr key={req.id}>
                                  <td>
                                    <div className="fw-bold">{req.applicantName}</div>
                                  </td>
                                  <td>
                                    <span className="badge bg-light text-dark border">{req.applicant_type}</span>
                                  </td>
                                  <td>{req.leave_type}</td>
                                  <td>
                                    <div>From: {req.from_date}</div>
                                    <div>To: {req.to_date}</div>
                                  </td>
                                  <td>{req.total_days}</td>
                                  <td style={{ maxWidth: '200px' }}>{req.reason}</td>
                                  <td>
                                    <div className="d-flex gap-2">
                                      <button className="btn btn-sm btn-success" onClick={() => handleApproval(req.id, 'APPROVED')}>Approve</button>
                                      <button className="btn btn-sm btn-danger" onClick={() => handleApproval(req.id, 'REJECTED')}>Reject</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  {showStaffSection && (
                    <div>
                      <h6 className="fw-semibold mb-3">Staff Leave Requests</h6>
                      {staffRequests.length === 0 ? (
                        <div className="text-muted">No pending staff requests.</div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table align-middle">
                            <thead>
                              <tr>
                                <th>Applicant</th>
                                <th>Role</th>
                                <th>Type</th>
                                <th>Dates</th>
                                <th>Days</th>
                                <th>Reason</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {staffRequests.map((req) => (
                                <tr key={req.id}>
                                  <td>
                                    <div className="fw-bold">{req.applicantName}</div>
                                  </td>
                                  <td>
                                    <span className="badge bg-light text-dark border">{req.applicant_type}</span>
                                  </td>
                                  <td>{req.leave_type}</td>
                                  <td>
                                    <div>From: {req.from_date}</div>
                                    <div>To: {req.to_date}</div>
                                  </td>
                                  <td>{req.total_days}</td>
                                  <td style={{ maxWidth: '200px' }}>{req.reason}</td>
                                  <td>
                                    <div className="d-flex gap-2">
                                      <button className="btn btn-sm btn-success" onClick={() => handleApproval(req.id, 'APPROVED')}>Approve</button>
                                      <button className="btn btn-sm btn-danger" onClick={() => handleApproval(req.id, 'REJECTED')}>Reject</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* HISTORY TAB (HOD) */}
        {isHOD && activeTab === 'history' && (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h5 className="card-title mb-4">Actioned Requests History</h5>
              {loadingActioned ? (
                <div className="text-center py-4">Loading...</div>
              ) : actionedRequests.length === 0 ? (
                <div className="text-muted text-center py-4">No history records found</div>
              ) : (
                <>
                  {showStudentSection && (
                    <div className="mb-4">
                      <h6 className="fw-semibold mb-3">Student Leave History</h6>
                      {studentActionedRequests.length === 0 ? (
                        <div className="text-muted">No student history records found.</div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table align-middle">
                            <thead>
                              <tr>
                                <th>Applicant</th>
                                <th>Role</th>
                                <th>Type</th>
                                <th>Dates</th>
                                <th>Status</th>
                                <th>Actioned On</th>
                              </tr>
                            </thead>
                            <tbody>
                              {studentActionedRequests.map((req) => (
                                <tr key={req.id}>
                                  <td>
                                    <div className="fw-semibold">{req.applicantName}</div>
                                    {req.applicantDetails && <div className="small text-muted">{req.applicantDetails}</div>}
                                  </td>
                                  <td>
                                    <span className="badge bg-secondary bg-opacity-10 text-secondary border">{req.applicant_type}</span>
                                  </td>
                                  <td>
                                    <div>{req.leave_type}</div>
                                    <small className="text-muted">{req.total_days} day(s)</small>
                                  </td>
                                  <td>
                                    <div className="small">{req.from_date} to {req.to_date}</div>
                                    <div className="small text-muted fst-italic">"{req.reason}"</div>
                                  </td>
                                  <td>
                                    {req.status === 'APPROVED' ? (
                                      <span className="badge bg-success bg-opacity-10 text-success px-3 py-2">APPROVED</span>
                                    ) : (
                                      <span className="badge bg-danger bg-opacity-10 text-danger px-3 py-2">REJECTED</span>
                                    )}
                                    {req.hod_remarks && <div className="small text-muted mt-1">Note: {req.hod_remarks}</div>}
                                  </td>
                                  <td className="small text-muted">
                                    {req.actioned_at ? new Date(req.actioned_at).toLocaleDateString() : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  {showStaffSection && (
                    <div>
                      <h6 className="fw-semibold mb-3">Staff Leave History</h6>
                      {staffActionedRequests.length === 0 ? (
                        <div className="text-muted">No staff history records found.</div>
                      ) : (
                        <div className="table-responsive">
                          <table className="table align-middle">
                            <thead>
                              <tr>
                                <th>Applicant</th>
                                <th>Role</th>
                                <th>Type</th>
                                <th>Dates</th>
                                <th>Status</th>
                                <th>Actioned On</th>
                              </tr>
                            </thead>
                            <tbody>
                              {staffActionedRequests.map((req) => (
                                <tr key={req.id}>
                                  <td>
                                    <div className="fw-semibold">{req.applicantName}</div>
                                    {req.applicantDetails && <div className="small text-muted">{req.applicantDetails}</div>}
                                  </td>
                                  <td>
                                    <span className="badge bg-secondary bg-opacity-10 text-secondary border">{req.applicant_type}</span>
                                  </td>
                                  <td>
                                    <div>{req.leave_type}</div>
                                    <small className="text-muted">{req.total_days} day(s)</small>
                                  </td>
                                  <td>
                                    <div className="small">{req.from_date} to {req.to_date}</div>
                                    <div className="small text-muted fst-italic">"{req.reason}"</div>
                                  </td>
                                  <td>
                                    {req.status === 'APPROVED' ? (
                                      <span className="badge bg-success bg-opacity-10 text-success px-3 py-2">APPROVED</span>
                                    ) : (
                                      <span className="badge bg-danger bg-opacity-10 text-danger px-3 py-2">REJECTED</span>
                                    )}
                                    {req.hod_remarks && <div className="small text-muted mt-1">Note: {req.hod_remarks}</div>}
                                  </td>
                                  <td className="small text-muted">
                                    {req.actioned_at ? new Date(req.actioned_at).toLocaleDateString() : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* APPLY TAB */}
        {(activeTab === 'apply' || !isHOD) && (
          <div className="row">
            <div className="col-lg-7">
              <div
                className="card card-soft p-4 rounded-4 shadow-sm h-100"
              >
                <h3 className="mb-2">Request Category</h3>
                <p className="text-muted mb-4">
                  Apply for leave or on-duty based on your requirement.
                </p>

                {/* CATEGORY */}
                <div className="mb-4">
                  <label className="me-4 form-check-label fw-bold text-dark">
                    <input
                      type="radio"
                      className="staff-attendance__radio me-2"
                      checked={requestCategory === 'leave'}
                      onChange={() => {
                        setRequestCategory('leave')
                        setOdType('')
                      }}
                    />
                    Leave
                  </label>

                  <label className="form-check-label fw-bold text-dark">
                    <input
                      type="radio"
                      className="staff-attendance__radio me-2"
                      checked={requestCategory === 'od'}
                      onChange={() => {
                        setRequestCategory('od')
                        setLeaveType('')
                      }}
                    />
                    On-Duty
                  </label>
                </div>

                {/* LEAVE TYPE */}
                {requestCategory === 'leave' && (
                  <div className="mb-4">
                    <label className="form-label fw-semibold">Leave Type</label>
                    <select
                      className="form-select"
                      value={leaveType}
                      onChange={(e) => handleLeaveChange(e.target.value)}
                    >
                      <option value="">Select Leave Type</option>

                      <option value="__REGULAR__">
                        ▶ REGULAR LEAVE
                      </option>
                      <option value="casual">Casual Leave</option>
                      <option value="earned">Earned Leave</option>
                      <option value="medical">Medical Leave</option>

                      <option value="__SPECIAL__">
                        ▶ SPECIAL LEAVE
                      </option>
                      <option value="maternity">Maternity / Paternity Leave</option>
                      <option value="childcare">Child Care Leave</option>
                      <option value="compensatory">Compensatory Off</option>

                      <option value="__ACADEMIC__">
                        ▶ ACADEMIC / OFFICIAL
                      </option>
                      <option value="study">Study Leave</option>
                      <option value="sabbatical">Sabbatical Leave</option>
                      <option value="quarantine">Quarantine / Special Medical</option>
                    </select>
                  </div>
                )}

                {/* OD TYPE */}
                {requestCategory === 'od' && (
                  <div className="mb-4">
                    <label className="form-label fw-semibold">On-Duty Type</label>
                    <select
                      className="form-select"
                      value={odType}
                      onChange={(e) => setOdType(e.target.value)}
                    >
                      <option value="">Select On-Duty Type</option>
                      <option value="exam">Exam Duty</option>
                      <option value="workshop">Workshop / FDP</option>
                      <option value="conference">Conference / Seminar</option>
                      <option value="college">Official College Work</option>
                      <option value="external">External Academic Assignment</option>
                    </select>
                  </div>
                )}

                {/* DATES */}
                <div className="row mb-4">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">From Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">To Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* REASON */}
                <div className="mb-4">
                  <label className="form-label fw-semibold">Reason</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="Provide a brief justification for your request"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="text-center mt-4 mb-3">
                  <p style={{ fontWeight: '600', marginBottom: '20px' }} className="text-muted small">
                    Upon submission, this request will be forwarded to the Head of Department (HOD) for approval.
                  </p>

                  <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit for HOD Approval'}
                  </button>
                </div>
              </div>
            </div>

            {/* HISTORY COLUMN */}
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
        )}
      </div>
    </StaffShell>
  )
}
