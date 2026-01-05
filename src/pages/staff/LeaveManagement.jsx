import { useState } from 'react'
import StaffShell from '../../components/StaffShell'

export default function LeaveManagement() {
  const [requestCategory, setRequestCategory] = useState('leave')
  const [leaveType, setLeaveType] = useState('')
  const [odType, setOdType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reason, setReason] = useState('')

  const handleLeaveChange = (value) => {
    // prevent selecting header rows
    if (
      value === '__REGULAR__' ||
      value === '__SPECIAL__' ||
      value === '__ACADEMIC__'
    ) {
      return
    }
    setLeaveType(value)
  }

  return (
    <StaffShell title="Leave & On-Duty Management">
      <div
        style={{
          minHeight: 'calc(100vh - 140px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: '40px'
        }}
      >
        <div
          className="card card-soft p-4"
          style={{
            width: '100%',
            maxWidth: '800px',
            borderRadius: '16px'
          }}
        >
          <h3 className="mb-2">Request Category</h3>
          <p className="text-muted mb-4">
            Apply for leave or on-duty based on your requirement.
          </p>

          {/* CATEGORY */}
          <div className="mb-4">
            <label className="me-4">
              <input
                type="radio"
                checked={requestCategory === 'leave'}
                onChange={() => {
                  setRequestCategory('leave')
                  setOdType('')
                }}
              />{' '}
              Leave
            </label>

            <label>
              <input
                type="radio"
                checked={requestCategory === 'od'}
                onChange={() => {
                  setRequestCategory('od')
                  setLeaveType('')
                }}
              />{' '}
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
  <p style={{ fontWeight: '600', marginBottom: '20px' }}>
    Upon submission, this request will be forwarded to the Head of Department (HOD) for approval.
  </p>

  <button className="btn btn-primary">
    Submit for HOD Approval
  </button>
</div>



        </div>
      </div>
    </StaffShell>
  )
}
