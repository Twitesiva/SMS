import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabaseClient'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'
import './Student.css'

const formatDateTime = (value) => {
  if (!value) return 'N/A'
  const date = new Date(value)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const formatCurrency = (value) => {
  const num = Number(value)
  if (Number.isNaN(num)) return 'N/A'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num)
}

const formatHostelFloor = (floorNo) => {
  const floor = Number(floorNo)
  if (!Number.isFinite(floor)) return 'N/A'
  if (floor === 0) return 'Ground Floor'
  if (floor === 1) return 'First Floor'
  if (floor === 2) return 'Second Floor'
  return `Floor ${floor}`
}

export default function StudentHostelDetails() {
  const { student } = useStudentAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [studentInfo, setStudentInfo] = useState(null)
  const [currentAllocation, setCurrentAllocation] = useState(null)
  const [hostelPayments, setHostelPayments] = useState([])

  useEffect(() => {
    if (!student?.id) {
      setError('Please sign in to view your hostel allocation.')
      setCurrentAllocation(null)
      setHostelPayments([])
      return
    }

    const loadHostelDetails = async () => {
      setLoading(true)
      setError('')
      setWarning('')
      setCurrentAllocation(null)
      setHostelPayments([])
      try {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id, student_id, full_name, academic_year, current_semester, year_of_study, is_hostel, hostel_ac')
          .eq('id', student.id)
          .maybeSingle()

        if (studentError) throw studentError
        if (!studentData) {
          setWarning('Student details not found.')
          setStudentInfo(null)
          return
        }

        setStudentInfo(studentData)

        if (!studentData.is_hostel) {
          setWarning('Hostel facility is not assigned to this student.')
          return
        }

        const [allocationRes, paymentRes] = await Promise.all([
          supabase
            .from('hostel_allocations')
            .select('academic_year, status, created_at, hostel_beds(bed_no, hostel_rooms(room_no, floor_no, room_type, hostel_blocks(block_name)))')
            .eq('student_id', student.id)
            .eq('status', 'ACTIVE')
            .maybeSingle(),
          supabase
            .from('student_fee_payments')
            .select('id, amount_paid, fee_type, payment_type, payment_mode, payment_status, created_at')
            .eq('student_id', student.id)
            .ilike('fee_type', 'hostel%')
            .order('created_at', { ascending: false })
        ])

        if (allocationRes.error) throw allocationRes.error
        if (paymentRes.error) throw paymentRes.error
        setCurrentAllocation(allocationRes.data || null)
        setHostelPayments(paymentRes.data || [])

      } catch (err) {
        console.error(err)
        setError(err?.message || 'Unable to load hostel allocation right now.')
        setCurrentAllocation(null)
        setHostelPayments([])
      } finally {
        setLoading(false)
      }
    }

    loadHostelDetails()
  }, [student?.id])

  const hostelSummary = useMemo(() => {
    const totalPaid = hostelPayments.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0)
    const lastPayment = hostelPayments[0]
    return {
      totalPaid,
      totalCount: hostelPayments.length,
      lastPaidAt: lastPayment?.created_at || ''
    }
  }, [hostelPayments])

  return (
    <StudentShell>
      <div className="students-section-shell">
        <div className="student-card mb-4">
          <div className="student-card__header">Hostel Allocation</div>
          <div className="student-card__body">
            <p className="students-section-copy mb-0">
              {studentInfo?.is_hostel
                ? 'Review your hostel allocation details.'
                : 'You are not currently registered as a hostel resident.'}
            </p>
          </div>
        </div>

        {studentInfo && (
          <div className="student-details__status mb-3">
            {studentInfo.is_hostel ? 'Hostel student' : 'Day scholar'}
          </div>
        )}

        {warning && !loading && !error && (
          <div className="student-details__status">{warning}</div>
        )}

        {loading && (
          <div className="student-details__loading" role="status" aria-live="polite">
            <div className="student-details__loading-header">
              <div className="student-loader__spinner" aria-hidden="true"></div>
              <div>
                <div className="student-loader__title">Loading hostel fees</div>
                <div className="student-loader__subtitle">Fetching hostel payments and fees.</div>
              </div>
            </div>
            <div className="student-details__loading-grid" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="student-loader-card" key={`hostel-loader-${index}`}>
                  <div className="student-loader-card__header student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                </div>
              ))}
            </div>
            <span className="sr-only">Loading hostel fees...</span>
          </div>
        )}

        {error && !loading && (
          <div className="student-details__status student-details__status--error">{error}</div>
        )}

        {!loading && !error && studentInfo?.is_hostel && !currentAllocation && (
          <div className="student-details__status">No hostel allocation found.</div>
        )}

        {!loading && !error && currentAllocation && (
          <div className="student-card mb-4">
            <div className="student-card__header">Allocation Details</div>
            <div className="student-card__body">
              <div className="student-details-grid">
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Academic Year</div>
                  <div className="student-details-grid__value">{currentAllocation.academic_year || 'N/A'}</div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Block</div>
                  <div className="student-details-grid__value">
                    {currentAllocation.hostel_beds?.hostel_rooms?.hostel_blocks?.block_name || 'N/A'}
                  </div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Room</div>
                  <div className="student-details-grid__value">
                    {currentAllocation.hostel_beds?.hostel_rooms?.room_no || 'N/A'}
                  </div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Bed</div>
                  <div className="student-details-grid__value">
                    {currentAllocation.hostel_beds?.bed_no || 'N/A'}
                  </div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Room Type</div>
                  <div className="student-details-grid__value">
                    {currentAllocation.hostel_beds?.hostel_rooms?.room_type?.replace(/_/g, ' ') || 'N/A'}
                  </div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Floor</div>
                  <div className="student-details-grid__value">
                    {formatHostelFloor(currentAllocation.hostel_beds?.hostel_rooms?.floor_no)}
                  </div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Allocated On</div>
                  <div className="student-details-grid__value">
                    {currentAllocation.created_at ? formatDateTime(currentAllocation.created_at) : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && studentInfo?.is_hostel && (
          <div className="student-card">
            <div className="student-card__header">Hostel Payments</div>
            <div className="student-card__body">
              <div className="student-details-grid mb-3">
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Total Paid</div>
                  <div className="student-details-grid__value">{formatCurrency(hostelSummary.totalPaid)}</div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Payments</div>
                  <div className="student-details-grid__value">{hostelSummary.totalCount}</div>
                </div>
                <div className="student-details-grid__item">
                  <div className="student-details-grid__label">Last Payment</div>
                  <div className="student-details-grid__value">
                    {hostelSummary.lastPaidAt ? formatDateTime(hostelSummary.lastPaidAt) : 'N/A'}
                  </div>
                </div>
              </div>

              {hostelPayments.length === 0 ? (
                <div className="student-details__status">No hostel payment records found.</div>
              ) : (
                <div className="student-payments-table-wrapper">
                  <table className="student-payments-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Fee type</th>
                        <th>Payment type</th>
                        <th>Payment mode</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hostelPayments.map((payment) => {
                        const status = (payment.payment_status || 'pending').toString().toUpperCase()
                        const statusTone = status === 'SUCCESS' ? 'success' : status === 'FAILED' ? 'danger' : 'warning'
                        return (
                          <tr key={payment.id}>
                            <td>{formatDateTime(payment.created_at)}</td>
                            <td>{payment.fee_type || 'Hostel'}</td>
                            <td>{payment.payment_type || 'N/A'}</td>
                            <td>{payment.payment_mode || 'N/A'}</td>
                            <td>{formatCurrency(payment.amount_paid)}</td>
                            <td>
                              <span className={`student-payments-badge student-payments-badge--${statusTone}`}>
                                {status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  )
}
