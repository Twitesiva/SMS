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

const deriveYearOfStudy = (student) => {
  const rawYear = Number(student?.year_of_study)
  if (Number.isFinite(rawYear) && rawYear > 0) return rawYear
  const rawSemester = Number(student?.current_semester)
  if (Number.isFinite(rawSemester) && rawSemester > 0) {
    return Math.ceil(rawSemester / 2)
  }
  return null
}

const normalizeStatus = (value) => {
  const status = (value || 'pending').toString().toLowerCase()
  if (status === 'success') return { label: 'Paid', tone: 'success' }
  if (status === 'failed') return { label: 'Failed', tone: 'danger' }
  return { label: 'Pending', tone: 'warning' }
}

export default function StudentHostelDetails() {
  const { student } = useStudentAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [studentInfo, setStudentInfo] = useState(null)
  const [hostelFee, setHostelFee] = useState(null)
  const [payments, setPayments] = useState([])

  useEffect(() => {
    if (!student?.id) {
      setError('Please sign in to view your hostel fees.')
      setPayments([])
      return
    }

    const loadHostelDetails = async () => {
      setLoading(true)
      setError('')
      setWarning('')
      setHostelFee(null)
      setPayments([])
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
        }

        const academicYear = (studentData.academic_year || '').toString().trim()
        const yearOfStudy = deriveYearOfStudy(studentData)

        if (studentData.is_hostel && academicYear) {
          const studentType = studentData.hostel_ac ? 'AC' : 'NON_AC'
          const { data: hostelData, error: hostelError } = await supabase
            .from('hostel_fees')
            .select('hostel_fee')
            .eq('academic_year', academicYear)
            .eq('hostel_type', studentType)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (hostelError) throw hostelError
          if (hostelData && hostelData.hostel_fee !== undefined && hostelData.hostel_fee !== null) {
            setHostelFee(Number(hostelData.hostel_fee || 0))
          } else {
            setWarning('Hostel fee is not configured for the current year.')
          }
        } else if (studentData.is_hostel) {
          setWarning('Academic year or year of study is missing for hostel fee lookup.')
        }

        const { data: paymentRows, error: paymentError } = await supabase
          .from('student_fee_payments')
          .select('id, amount_paid, payment_type, payment_mode, payment_status, fee_type, created_at')
          .eq('student_id', student.id)
          .ilike('fee_type', '%hostel%')
          .order('created_at', { ascending: false })

        if (paymentError) throw paymentError
        setPayments(paymentRows || [])
      } catch (err) {
        console.error(err)
        setError(err?.message || 'Unable to load hostel fees right now.')
        setPayments([])
      } finally {
        setLoading(false)
      }
    }

    loadHostelDetails()
  }, [student?.id])

  const summary = useMemo(() => {
    const totalPaid = payments.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0)
    const lastPayment = payments[0]
    return {
      totalPaid,
      totalCount: payments.length,
      lastPaidAt: lastPayment?.created_at || '',
    }
  }, [payments])

  const balance = useMemo(() => {
    if (hostelFee === null) return null
    return Math.max(hostelFee - summary.totalPaid, 0)
  }, [hostelFee, summary.totalPaid])

  const hostelFeeDisplay = hostelFee === null ? 'N/A' : formatCurrency(hostelFee)
  const balanceDisplay = hostelFee === null ? 'N/A' : formatCurrency(balance)

  return (
    <StudentShell>
      <div className="students-section-shell">
        <div className="student-card mb-4">
          <div className="student-card__header">Hostel Fees</div>
          <div className="student-card__body">
            <p className="students-section-copy mb-0">
              Review hostel fee information and payment history.
            </p>
          </div>
        </div>

        <div className="student-payments-summary">
          <div className="student-payments-card">
            <div className="student-payments-card__label">Hostel Fee</div>
            <div className="student-payments-card__value">{hostelFeeDisplay}</div>
          </div>
          <div className="student-payments-card">
            <div className="student-payments-card__label">Total Paid</div>
            <div className="student-payments-card__value">
              {formatCurrency(summary.totalPaid)}
            </div>
          </div>
          <div className="student-payments-card">
            <div className="student-payments-card__label">Balance</div>
            <div className="student-payments-card__value">{balanceDisplay}</div>
          </div>
          <div className="student-payments-card">
            <div className="student-payments-card__label">Payments</div>
            <div className="student-payments-card__value">{summary.totalCount}</div>
          </div>
          <div className="student-payments-card">
            <div className="student-payments-card__label">Last Payment</div>
            <div className="student-payments-card__value">
              {summary.lastPaidAt ? formatDateTime(summary.lastPaidAt) : 'N/A'}
            </div>
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

        {!loading && !error && payments.length === 0 && (
          <div className="student-details__status">No hostel payment records found.</div>
        )}

        {!loading && !error && payments.length > 0 && (
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
                {payments.map((payment) => {
                  const status = normalizeStatus(payment.payment_status)
                  return (
                    <tr key={payment.id}>
                      <td>{formatDateTime(payment.created_at)}</td>
                      <td>{payment.fee_type || 'Hostel Fee'}</td>
                      <td>{payment.payment_type || 'N/A'}</td>
                      <td>{payment.payment_mode || 'N/A'}</td>
                      <td>{formatCurrency(payment.amount_paid)}</td>
                      <td>
                        <span className={`student-payments-badge student-payments-badge--${status.tone}`}>
                          {status.label}
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
    </StudentShell>
  )
}
