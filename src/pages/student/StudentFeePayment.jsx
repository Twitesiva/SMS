import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabaseClient'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'

const formatDateTime = (value) => {
  if (!value) return '—'
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
  if (Number.isNaN(num)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num)
}

const normalizeStatus = (value) => {
  const status = (value || 'pending').toString().toLowerCase()
  if (status === 'success') return { label: 'Paid', tone: 'success' }
  if (status === 'failed') return { label: 'Failed', tone: 'danger' }
  return { label: 'Pending', tone: 'warning' }
}

export default function StudentFeePayment() {
  const { student } = useStudentAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!student?.id) {
      setError('Please sign in to view your payment history.')
      setPayments([])
      return
    }

    const loadPayments = async () => {
      setLoading(true)
      setError('')
      try {
        const { data, error: fetchError } = await supabase
          .from('payments')
          .select(
            'id, amount_paid, payment_type, fee_type, payment_status, created_at, exam_registration:exam_registration_id!inner(id, student_id, academic_year, course_name, group_name, semester, total_fee, total_exam_fee, other_fee, status)'
          )
          .eq('exam_registration.student_id', student.id)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        setPayments(data || [])
      } catch (err) {
        console.error(err)
        setError(err?.message || 'Unable to load payment history right now.')
        setPayments([])
      } finally {
        setLoading(false)
      }
    }

    loadPayments()
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

  return (
    <StudentShell>
      <div className="students-section-shell">
        <div className="students-section-shell-header">
          <h2 className="mb-2">Fee payment</h2>
          <p className="students-section-copy mb-0">
            Review your semester-wise payment history and transaction status.
          </p>
        </div>

        <div className="student-payments-summary">
          <div className="student-payments-card">
            <div className="student-payments-card__label">Total Paid</div>
            <div className="student-payments-card__value">
              {formatCurrency(summary.totalPaid)}
            </div>
          </div>
          <div className="student-payments-card">
            <div className="student-payments-card__label">Payments</div>
            <div className="student-payments-card__value">{summary.totalCount}</div>
          </div>
          <div className="student-payments-card">
            <div className="student-payments-card__label">Last Payment</div>
            <div className="student-payments-card__value">
              {summary.lastPaidAt ? formatDateTime(summary.lastPaidAt) : '—'}
            </div>
          </div>
        </div>

        {loading && (
          <div className="student-details__loading" role="status" aria-live="polite">
            <div className="student-details__loading-header">
              <div className="student-loader__spinner" aria-hidden="true"></div>
              <div>
                <div className="student-loader__title">Loading payments</div>
                <div className="student-loader__subtitle">Fetching your transactions.</div>
              </div>
            </div>
            <div className="student-details__loading-grid" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="student-loader-card" key={`payment-loader-${index}`}>
                  <div className="student-loader-card__header student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                </div>
              ))}
            </div>
            <span className="sr-only">Loading payments...</span>
          </div>
        )}

        {error && !loading && (
          <div className="student-details__status student-details__status--error">{error}</div>
        )}

        {!loading && !error && payments.length === 0 && (
          <div className="student-details__status">No payment records found.</div>
        )}

        {!loading && !error && payments.length > 0 && (
          <div className="student-payments-table-wrapper">
            <table className="student-payments-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Academic year</th>
                  <th>Semester</th>
                  <th>Fee type</th>
                  <th>Payment type</th>
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
                      <td>{payment.exam_registration?.academic_year || '—'}</td>
                      <td>
                        {payment.exam_registration?.semester
                          ? `Semester ${payment.exam_registration.semester}`
                          : '—'}
                      </td>
                      <td>{payment.fee_type || '—'}</td>
                      <td>{payment.payment_type || '—'}</td>
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
