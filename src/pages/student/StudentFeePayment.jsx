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

const normalizeCategoryValue = (value) =>
  value === undefined || value === null ? '' : String(value).trim().toUpperCase()

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

const formatAcademicYear = (val) => {
  if (!val) return ''
  const s = String(val).trim()
  // If it's a 4-digit year (e.g. 2026), convert to range (e.g. 2025-2026)
  if (s.match(/^\d{4}$/)) {
    return `${parseInt(s) - 1}-${s}`
  }
  return s
}

export default function StudentFeePayment() {
  const { student } = useStudentAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [totalFee, setTotalFee] = useState(null)
  const [feeWarning, setFeeWarning] = useState('')

  useEffect(() => {
    if (!student?.id) {
      setError('Please sign in to view your payment history.')
      setPayments([])
      return
    }

    const loadPayments = async () => {
      setLoading(true)
      setError('')
      setFeeWarning('')
      setTotalFee(null)
      try {
        // 1. Get Application ID to find initial admission payments
        const { data: admData } = await supabase
          .from('admissions')
          .select('application_id')
          .eq('student_id', student.id)
          .maybeSingle()

        const appId = admData?.application_id

        let query = supabase
          .from('student_fee_payments')
          .select(
            'id, amount_paid, payment_type, fee_type, payment_mode, payment_status, created_at, academic_fee:academic_fee_id(academic_year, year_of_study, category), application:application_id(admission_year), student:student_id(academic_year)'
          )

        if (appId) {
          // Fetch by Student ID OR Application ID
          query = query.or(`student_id.eq.${student.id},application_id.eq.${appId}`)
        } else {
          query = query.eq('student_id', student.id)
        }

        const { data, error: fetchError } = await query.order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        setPayments(data || [])
      } catch (err) {
        console.error(err)
        setError(err?.message || 'Unable to load payment history right now.')
        setPayments([])
      }

      try {
        const summary = await resolveFeeSummary(student.id)
        setTotalFee(summary.totalFee)
        setFeeWarning(summary.warning)
      } catch (err) {
        console.error(err)
        setFeeWarning(err?.message || 'Unable to load fee summary.')
      } finally {
        setLoading(false)
      }
    }

    loadPayments()
  }, [student?.id])

  const resolveFeeSummary = async (studentRecordId) => {
    const details = { totalFee: null, warning: '' }
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select(
        'id, academic_year, group_id, group_name, course_id, course_name, current_semester, year_of_study, Category, is_hostel, hostel_ac'
      )
      .eq('id', studentRecordId)
      .maybeSingle()

    if (studentError) throw studentError
    if (!studentData) {
      details.warning = 'Student details not found for fee summary.'
      return details
    }

    let groupId = studentData.group_id
    let courseId = studentData.course_id
    let categoryValue = studentData.Category || ''

    if (!groupId && studentData.group_name) {
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('group_id, Category')
        .eq('group_name', studentData.group_name)
        .maybeSingle()
      if (groupError) throw groupError
      if (groupData) {
        groupId = groupData.group_id
        categoryValue = categoryValue || groupData.Category || ''
      }
    }

    if (!courseId && studentData.course_name) {
      const { data: courseByName, error: courseError } = await supabase
        .from('courses')
        .select('course_id')
        .eq('course_name', studentData.course_name)
        .maybeSingle()
      if (courseError) throw courseError
      if (courseByName) {
        courseId = courseByName.course_id
      } else {
        const { data: courseByCode, error: codeError } = await supabase
          .from('courses')
          .select('course_id')
          .eq('course_code', studentData.course_name)
          .maybeSingle()
        if (codeError) throw codeError
        if (courseByCode) courseId = courseByCode.course_id
      }
    }

    const academicYear = (studentData.academic_year || '').toString().trim()
    const yearOfStudy = deriveYearOfStudy(studentData)
    const normalizedCategory = normalizeCategoryValue(categoryValue)

    if (!academicYear || !yearOfStudy) {
      details.warning = 'Fee structure inputs are incomplete.'
      return details
    }

    let academicTotal = 0
    let hostelTotal = 0
    let warning = ''

    if (groupId && courseId) {
      let feeQuery = supabase
        .from('academic_fees')
        .select('id, total_fee')
        .eq('academic_year', academicYear)
        .eq('group_id', groupId)
        .eq('course_id', courseId)
        .eq('year_of_study', yearOfStudy)

      if (normalizedCategory) {
        feeQuery = feeQuery.eq('category', normalizedCategory)
      }

      const { data: feeRow, error: feeError } = await feeQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (feeError) throw feeError

      if (feeRow) {
        const { data: breakdownRows, error: breakdownError } = await supabase
          .from('academic_fee_breakdown')
          .select('amount')
          .eq('academic_fee_id', feeRow.id)

        if (breakdownError) throw breakdownError

        const breakdownTotal = (breakdownRows || []).reduce(
          (sum, row) => sum + Number(row.amount || 0),
          0
        )

        academicTotal = breakdownTotal > 0 ? breakdownTotal : Number(feeRow.total_fee || 0)
      } else {
        warning = 'No academic fee structure found.'
      }
    } else {
      warning = 'Academic fee inputs are incomplete.'
    }

    if (studentData?.is_hostel) {
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
        hostelTotal = Number(hostelData.hostel_fee || 0)
      } else if (!warning) {
        warning = 'Hostel fee not found for the selected year.'
      }
    }

    const combinedTotal = academicTotal + hostelTotal
    details.totalFee = combinedTotal > 0 ? combinedTotal : 0
    details.warning = warning
    return details
  }

  const summary = useMemo(() => {
    const totalPaid = payments.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0)
    const lastPayment = payments[0]
    return {
      totalPaid,
      totalCount: payments.length,
      lastPaidAt: lastPayment?.created_at || '',
    }
  }, [payments])

  const outstanding = useMemo(() => {
    if (totalFee === null) return null
    return Math.max(totalFee - summary.totalPaid, 0)
  }, [totalFee, summary.totalPaid])

  const totalFeeDisplay = totalFee === null ? 'N/A' : formatCurrency(totalFee)
  const outstandingDisplay = totalFee === null ? 'N/A' : formatCurrency(outstanding)

  return (
    <StudentShell>
      <div className="students-section-shell">
        <div className="student-card mb-4">
          <div className="student-card__header">Fee payment</div>
          <div className="student-card__body">
            <p className="students-section-copy mb-0">
              Review your fee payment history and transaction status.
            </p>
          </div>
        </div>

        <div className="student-payments-summary">
          <div className="student-payments-card">
            <div className="student-payments-card__label">Total Fee</div>
            <div className="student-payments-card__value">
              {totalFeeDisplay}
            </div>
          </div>
          <div className="student-payments-card">
            <div className="student-payments-card__label">Total Paid</div>
            <div className="student-payments-card__value">
              {formatCurrency(summary.totalPaid)}
            </div>
          </div>
          <div className="student-payments-card">
            <div className="student-payments-card__label">Balance</div>
            <div className="student-payments-card__value">
              {outstandingDisplay}
            </div>
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

        {feeWarning && !loading && !error && (
          <div className="student-details__status">{feeWarning}</div>
        )}

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
                  <th>Year of study</th>
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
                      <td>{formatAcademicYear(payment.academic_fee?.academic_year || payment.student?.academic_year || payment.application?.admission_year || student?.academic_year || 'N/A')}</td>
                      <td>{payment.academic_fee?.year_of_study || (payment.application ? 1 : 'N/A')}</td>
                      <td>{payment.fee_type || 'N/A'}</td>
                      <td>{payment.payment_type ? (payment.payment_type.toLowerCase() === 'full' ? 'Full' : payment.payment_type.toUpperCase()) : 'N/A'}</td>
                      <td>{payment.payment_mode ? (payment.payment_mode.toLowerCase() === 'upi' ? 'UPI' : payment.payment_mode.charAt(0).toUpperCase() + payment.payment_mode.slice(1).toLowerCase()) : 'N/A'}</td>
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
