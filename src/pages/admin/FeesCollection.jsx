import { useEffect, useMemo, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const adminNavGroups = [

  {
    title: 'Applications',
    static: true,
    items: [
      {
        to: '/admin-portal/applications',
        label: 'Applications',
        icon: 'bi-inboxes'
      }
    ]
  },
  {
    title: 'Student Portal',
    items: [
      {
        to: '/admin-portal/academic-years',
        label: 'Academic Years',
        icon: 'bi-calendar3'
      },
      {
        to: '/admin-portal/groups-courses',
        label: 'Groups & Courses',
        icon: 'bi-diagram-3'
      },
      {
        to: '/admin-portal/subjects',
        label: 'Subjects',
        icon: 'bi-journal-text'
      }
    ]
  },
  {
    title: 'Fees Creation',
    static: true,
    items: [
      {
        to: '/admin-portal/fees-creation',
        label: 'Student Fees Creation',
        icon: 'bi-currency-rupee'
      }
    ]
  },
  {
    title: 'Fees Collection',
    static: true,
    items: [
      {
        to: '/admin-portal/fees-collection',
        label: 'Fees Collection',
        icon: 'bi-cash-stack'
      }
    ]
  },
  {
    title: 'Profile Creation',
    static: true,
    items: [
      {
        to: '/admin-portal/profile-creation',
        label: 'Staff Profile Creation',
        icon: 'bi-person-plus-fill'
      }
    ]
  },
  {
    title: 'Staff Management',
    static: true,
    items: [
      {
        to: '/admin-portal/subject-mapping',
        label: 'Subject Mapping',
        icon: 'bi-person-lines-fill'
      }
    ]
  },

  {
    title: 'Class Time Table',
    static: true,
    items: [
      {
        to: '/admin-portal/class-time-table',
        label: 'Class Time Table',
        icon: 'bi-calendar-date'
      }
    ]
  },
  {
    title: 'Circulars',
    static: true,
    items: [
      {
        to: '/admin-portal/circulars',
        label: 'Circulars',
        icon: 'bi-megaphone'
      }
    ]
  },
  {
    title: 'Payment Reports',
    static: true,
    items: [
      {
        to: '/admin-portal/payment-reports',
        label: 'Payment Reports',
        icon: 'bi-file-earmark-bar-graph'
      }
    ]
  },

]

const fallbackFeeTypes = [
  { value: 'tuition', label: 'Tuition Fee' },
  { value: 'exam', label: 'Exam Fee' },
  { value: 'hostel', label: 'Hostel Fee' },
  { value: 'other', label: 'Other' }
]

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank', label: 'Bank Transfer' }
]

const formatMoney = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0'
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numeric)
}

const sumFeeBreakdown = (rows = []) =>
  (rows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)

const normalizeCategoryValue = (value) =>
  value === undefined || value === null ? '' : String(value).trim().toUpperCase()

const normalizeFeeKey = (value) =>
  value === undefined || value === null ? '' : String(value).trim().toLowerCase()

const deriveYearOfStudy = (student) => {
  const rawYear = Number(student?.year_of_study)
  if (Number.isFinite(rawYear) && rawYear > 0) return rawYear
  const rawSemester = Number(student?.current_semester)
  if (Number.isFinite(rawSemester) && rawSemester > 0) {
    return Math.ceil(rawSemester / 2)
  }
  return null
}

export default function FeesCollection() {
  const [studentId, setStudentId] = useState('')
  const [loadingStudent, setLoadingStudent] = useState(false)
  const [studentLoaded, setStudentLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [studentInfo, setStudentInfo] = useState(null)
  const [totalPaid, setTotalPaid] = useState(0)
  const [outstanding, setOutstanding] = useState(0)
  const [feeBreakdown, setFeeBreakdown] = useState([])
  const [feeTotal, setFeeTotal] = useState(0)
  const [feeInfoWarning, setFeeInfoWarning] = useState('')
  const [paymentSummaryWarning, setPaymentSummaryWarning] = useState('')
  const [feeStructureId, setFeeStructureId] = useState(null)
  const [paymentTotalsByType, setPaymentTotalsByType] = useState({})
  const [paymentMode, setPaymentMode] = useState('partial')
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    feeType: '',
    method: ''
  })

  const paymentsLocked = !studentLoaded
  const courseLabel = studentInfo?.course_name || 'N/A'
  const academicYearLabel = studentInfo?.academic_year || 'N/A'
  const semesterValue = studentInfo?.current_semester
  const semesterDisplay = semesterValue ? `Semester ${semesterValue}` : 'Semester N/A'
  const statusLabel = studentInfo?.status || 'Active'
  const totalFeeDisplay = feeTotal > 0 ? feeTotal : 0
  const amountLocked = paymentMode === 'full' && totalFeeDisplay > 0
  const remainingByType = useMemo(() => {
    if (feeBreakdown.length === 0) return {}
    const totals = {}
    feeBreakdown.forEach((row) => {
      const key = normalizeFeeKey(row.fee_name)
      if (!key) return
      const amount = Number(row.amount || 0)
      const paid = Number(paymentTotalsByType[key] || 0)
      totals[key] = Math.max(amount - paid, 0)
    })
    return totals
  }, [feeBreakdown, paymentTotalsByType])

  const feeTypeOptions = useMemo(() => {
    if (feeBreakdown.length === 0) return fallbackFeeTypes
    const unique = new Set()
    feeBreakdown.forEach((row) => {
      if (row?.fee_name) unique.add(row.fee_name)
    })
    if (unique.size === 0) return fallbackFeeTypes
    return Array.from(unique).map((name) => ({ value: name, label: name }))
  }, [feeBreakdown])

  const fullFeeLabel = useMemo(() => {
    if (feeBreakdown.length === 0) return 'Full Payment'
    const names = []
    const seen = new Set()
    feeBreakdown.forEach((row) => {
      const label = row?.fee_name
      const key = normalizeFeeKey(label)
      if (!label || seen.has(key)) return
      const remaining = remainingByType[key]
      if (!Number.isFinite(remaining) || remaining > 0) {
        names.push(label)
        seen.add(key)
      }
    })
    if (names.length === 0) return 'Full Payment'
    return names.join(' + ')
  }, [feeBreakdown, remainingByType])

  const handlePaymentChange = (field, value) => {
    setPaymentForm((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    if (paymentMode !== 'full' || totalFeeDisplay <= 0) return
    const nextAmount = Number.isFinite(outstanding) ? outstanding : 0
    setPaymentForm((prev) => ({
      ...prev,
      amount: nextAmount > 0 ? String(nextAmount) : ''
    }))
  }, [paymentMode, outstanding, totalFeeDisplay])

  useEffect(() => {
    if (paymentMode === 'full') {
      setPaymentForm((prev) => ({ ...prev, feeType: fullFeeLabel }))
      return
    }
    setPaymentForm((prev) => ({ ...prev, feeType: '' }))
  }, [paymentMode, fullFeeLabel])

  const fetchPaymentSummary = async (studentRecordId, totalFeeValue, feeId) => {
    let query = supabase
      .from('student_fee_payments')
      .select('amount_paid, fee_type, payment_mode')
      .eq('student_id', studentRecordId)
      .eq('payment_status', 'success')

    if (feeId) {
      query = query.eq('academic_fee_id', feeId)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const totalsByType = {}
    const sum = (data || []).reduce((acc, row) => {
      const amount = Number(row.amount_paid || 0)
      if (row?.payment_mode === 'partial') {
        const key = normalizeFeeKey(row.fee_type)
        if (key) {
          totalsByType[key] = (totalsByType[key] || 0) + amount
        }
      }
      return acc + amount
    }, 0)
    const total = Number(totalFeeValue || 0)
    setPaymentTotalsByType(totalsByType)
    setTotalPaid(sum)
    setOutstanding(Math.max(total - sum, 0))
  }

  const resolveStudentFeeDetails = async (student) => {
    const details = { totalFee: 0, breakdown: [], warning: '', feeId: null }
    if (!student) return details

    let groupId = student.group_id
    let courseId = student.course_id
    let categoryValue = student.Category || student.category || ''

    if (!groupId && student.group_name) {
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('group_id, Category')
        .eq('group_name', student.group_name)
        .maybeSingle()
      if (groupError) throw groupError
      if (groupData) {
        groupId = groupData.group_id
        categoryValue = categoryValue || groupData.Category || ''
      }
    }

    if (!courseId && student.course_name) {
      const { data: courseByName, error: courseError } = await supabase
        .from('courses')
        .select('course_id')
        .eq('course_name', student.course_name)
        .maybeSingle()
      if (courseError) throw courseError
      if (courseByName) {
        courseId = courseByName.course_id
      } else {
        const { data: courseByCode, error: codeError } = await supabase
          .from('courses')
          .select('course_id')
          .eq('course_code', student.course_name)
          .maybeSingle()
        if (codeError) throw codeError
        if (courseByCode) courseId = courseByCode.course_id
      }
    }

    const academicYear = (student.academic_year || '').toString().trim()
    const yearOfStudy = deriveYearOfStudy(student)
    const normalizedCategory = normalizeCategoryValue(categoryValue)

    if (!academicYear || !yearOfStudy) {
      details.warning = 'Fee structure inputs are incomplete for this student.'
      return details
    }

    let feeRow = null
    let breakdown = []
    let academicWarning = ''

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

      const { data: feeData, error: feeError } = await feeQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (feeError) throw feeError
      feeRow = feeData || null

      if (feeRow) {
        const { data: breakdownData, error: breakdownError } = await supabase
          .from('academic_fee_breakdown')
          .select('fee_name, amount')
          .eq('academic_fee_id', feeRow.id)
          .order('fee_name')

        if (breakdownError) throw breakdownError
        breakdown = breakdownData || []
        details.feeId = feeRow.id
      } else {
        academicWarning = 'Academic fee structure not found for this student.'
      }
    } else {
      academicWarning = 'Academic fee structure inputs are incomplete.'
    }

    if (student?.is_hostel) {
      const { data: hostelData, error: hostelError } = await supabase
        .from('hostel_fees')
        .select('hostel_fee')
        .eq('academic_year', academicYear)
        .eq('year_of_study', yearOfStudy)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (hostelError) throw hostelError
      if (hostelData && hostelData.hostel_fee !== undefined && hostelData.hostel_fee !== null) {
        breakdown = [...breakdown, { fee_name: 'Hostel Fees', amount: hostelData.hostel_fee }]
      }
    }

    details.breakdown = breakdown
    const totalFromBreakdown = sumFeeBreakdown(breakdown)
    if (totalFromBreakdown > 0) {
      details.totalFee = totalFromBreakdown
    } else if (feeRow) {
      details.totalFee = Number(feeRow.total_fee || 0)
    }

    if (!breakdown.length) {
      details.warning = academicWarning || 'Fee breakdown is not configured for this student.'
    } else if (academicWarning) {
      details.warning = academicWarning
    }

    return details
  }

  const handleLoadStudent = async () => {

    const trimmed = studentId.trim()
    setLoadError('')
    setPaymentError('')
    setFeeBreakdown([])
    setFeeTotal(0)
    setFeeInfoWarning('')
    setPaymentSummaryWarning('')
    setFeeStructureId(null)
    setPaymentTotalsByType({})
    setPaymentMode('partial')
    setStudentInfo(null)
    setTotalPaid(0)
    setOutstanding(0)
    setStudentLoaded(false)

    if (!trimmed) {
      setLoadError('Enter a valid student ID to continue.')
      setStudentLoaded(false)
      return
    }

    try {
      setLoadingStudent(true)
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, student_id, full_name, academic_year, group_id, group_name, course_id, course_name, current_semester, year_of_study, Category, status, is_hostel')
        .eq('student_id', trimmed)
        .maybeSingle()

      if (studentError) throw studentError
      if (!student) {
        setLoadError('No student found with this ID.')
        setStudentLoaded(false)
        return
      }

      setStudentInfo(student)

      let feeDetails = { totalFee: 0, breakdown: [], warning: '', feeId: null }
      let feeWarning = ''
      try {
        feeDetails = await resolveStudentFeeDetails(student)
        feeWarning = feeDetails.warning || ''
      } catch (error) {
        console.error('Failed to load fee details', error)
        feeWarning = 'Failed to load fee details.'
      }

      setFeeBreakdown(feeDetails.breakdown)
      setFeeInfoWarning(feeWarning)
      setFeeStructureId(feeDetails.feeId || null)
      const totalForSummary = feeDetails.totalFee || 0
      setFeeTotal(totalForSummary)

      try {
        await fetchPaymentSummary(student.id, totalForSummary, feeDetails.feeId)
      } catch (error) {
        console.error('Failed to load payment summary', error)
        setPaymentSummaryWarning('Unable to load payment summary.')
        setTotalPaid(0)
        setOutstanding(Math.max(totalForSummary, 0))
      }

      setStudentLoaded(true)
      setPaymentForm({ amount: '', feeType: '', method: '' })
      setPaymentMode('partial')
    } catch (error) {
      console.error('Failed to load student', error)
      setLoadError(error?.message || 'Failed to load student details.')
      setStudentLoaded(false)
    } finally {
      setLoadingStudent(false)
    }
  }

  const handleSubmitPayment = async (event) => {
    event.preventDefault()
    setPaymentError('')

    if (!studentLoaded || !studentInfo) {
      setPaymentError('Load a student before making a payment.')
      return
    }


    const amountValue = Number(paymentForm.amount)
    const effectiveAmount = paymentMode === 'full' && totalFeeDisplay > 0
      ? Number(outstanding || 0)
      : amountValue
    if (!effectiveAmount || effectiveAmount <= 0) {
      setPaymentError('Enter a valid payment amount.')
      return
    }

    if (paymentMode === 'partial' && !paymentForm.feeType) {
      setPaymentError('Select a fee type for partial payment.')
      return
    }

    if (!paymentForm.method) {
      setPaymentError('Select a payment method.')
      return
    }

    if (totalFeeDisplay > 0 && paymentMode === 'full' && outstanding <= 0) {
      setPaymentError('No outstanding balance for this student.')
      return
    }

    if (totalFeeDisplay > 0 && paymentMode === 'partial' && effectiveAmount > outstanding) {
      setPaymentError('Payment amount exceeds outstanding balance.')
      return
    }

    if (paymentMode === 'partial') {
      const feeKey = normalizeFeeKey(paymentForm.feeType)
      const remainingForType = remainingByType[feeKey]
      if (Number.isFinite(remainingForType) && effectiveAmount > remainingForType) {
        setPaymentError(`Payment exceeds remaining ${paymentForm.feeType} fee.`)
        return
      }
    }

    try {
      const { error } = await supabase
        .from('student_fee_payments')
        .insert([
          {
            student_id: studentInfo.id,
            academic_fee_id: feeStructureId,
            amount_paid: effectiveAmount,
            payment_type: paymentForm.method,
            fee_type: paymentForm.feeType,
            payment_mode: paymentMode,
            payment_status: 'success'
          }
        ])

      if (error) throw error

      await fetchPaymentSummary(studentInfo.id, totalFeeDisplay, feeStructureId)
      toast.success('Payment recorded successfully.')
      setPaymentForm({ amount: '', feeType: '', method: '' })
      setPaymentMode('partial')
    } catch (error) {
      console.error('Failed to record payment', error)
      setPaymentError('Failed to record payment.')
    }
  }

  return (
    <AdminShell
      navGroups={adminNavGroups}
      brandTitle="Admin Management Console"
      brandSubtitle="Chittoor"
      footerTitle="Admin Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <div className="desktop-container" style={{ overflowX: 'hidden' }}>
        <section className="setup-hero mb-4 text-center">
          <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
            <div className="admin-applications__crest mx-auto" aria-hidden="true">
              <img src={crestPrimary} alt="Vijayam crest" />
            </div>
            <h3 className="setup-hero-title mb-2">Vijayam Arts & Science College</h3>
            <p className="setup-hero-copy mb-3">Collect payments, track balances, and issue receipts faster.</p>
            <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
              <span className="setup-hero-chip text-uppercase">SMART EXAMINATION PLATFORM</span>
              <span className="setup-hero-chip text-uppercase">FINANCE OPERATIONS</span>
              <span className="setup-hero-chip text-uppercase">ADMIN CONSOLE</span>
            </div>
          </div>
        </section>

        <div className="row g-4 justify-content-center mx-0">
          <div className="col-12 col-lg-4">
            <div className="students-section-shell card card-soft h-100">
              <div className="students-section-shell-header mb-3">
                <div>
                  <h5 className="section-title mb-1">Find Student</h5>
                  <p className="students-section-copy small mb-0">
                    Enter the student ID to load payment details.
                  </p>
                </div>
              </div>
              <div className="students-section-form row g-3">
                <div className="col-12">
                  <label className="form-label fw-bold mb-1">Student ID</label>
                  <input
                    className="form-control"
                    placeholder="e.g., VJS2025-001"
                    value={studentId}
                    onChange={(event) => setStudentId(event.target.value)}
                  />
                  {loadError && <div className="text-danger small mt-2">{loadError}</div>}
                </div>
                <div className="col-12 d-flex justify-content-end">
                  <button
                    type="button"
                    className="btn btn-primary students-button"
                    onClick={handleLoadStudent}
                    disabled={loadingStudent}
                  >
                    {loadingStudent ? 'Loading...' : 'Load Student'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="students-table-panel card card-soft p-4 h-100">
              <div className="students-table-panel-header mb-3">
                <div>
                  <p className="students-table-panel-title mb-1 text-white">Payment Summary</p>
                  <p className="students-table-panel-copy small mb-0">
                    Review student details before recording payments.
                  </p>
                </div>
              </div>

              {studentLoaded && studentInfo ? (
                <div className="row g-4">
                  <div className="col-12 col-md-5">
                    <div className="card card-soft h-100 p-4">
                      <h6 className="fw-bold mb-4 pb-2 border-bottom">Student Profile</h6>

                      <div className="mb-3 row g-0">
                        <div className="col-5 text-muted small text-uppercase fw-semibold">Student Name</div>
                        <div className="col-7 fw-bold text-dark">: {studentInfo.full_name}</div>
                      </div>

                      <div className="mb-3 row g-0">
                        <div className="col-5 text-muted small text-uppercase fw-semibold">Student ID</div>
                        <div className="col-7 text-dark">: {studentInfo.student_id}</div>
                      </div>

                      <div className="mb-3 row g-0">
                        <div className="col-5 text-muted small text-uppercase fw-semibold">Course</div>
                        <div className="col-7 fw-semibold text-dark">: {courseLabel}</div>
                      </div>

                      <div className="mb-3 row g-0">
                        <div className="col-5 text-muted small text-uppercase fw-semibold">Academic Year</div>
                        <div className="col-7 text-dark">: {academicYearLabel}</div>
                      </div>

                      <div className="mb-3 row g-0">
                        <div className="col-5 text-muted small text-uppercase fw-semibold">Semester</div>
                        <div className="col-7 text-dark">: {semesterDisplay}</div>
                      </div>

                      <div className="row g-0">
                        <div className="col-5 text-muted small text-uppercase fw-semibold">Status</div>
                        <div className="col-7 fw-bold text-success text-uppercase">: {statusLabel}</div>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-7">
                    <div className="card card-soft mb-4 border">
                      <div className="card-header bg-light fw-bold text-uppercase small py-2">
                        Payment Summary
                      </div>
                      <div className="card-body p-0">
                        <ul className="list-group list-group-flush">
                          <li className="list-group-item d-flex justify-content-between align-items-center">
                            <span className="text-muted">Total Fee</span>
                            <span className="fw-semibold">₹ {formatMoney(totalFeeDisplay)}</span>
                          </li>
                          <li className="list-group-item d-flex justify-content-between align-items-center">
                            <span className="text-muted">Total Paid</span>
                            <span className="fw-semibold text-success">₹ {formatMoney(totalPaid)}</span>
                          </li>
                          <li className="list-group-item d-flex justify-content-between align-items-center bg-light">
                            <span className="fw-bold text-dark">Outstanding Balance</span>
                            <span className={`fw-bold fs-5 ${outstanding > 0 ? 'text-danger' : 'text-success'}`}>
                              ₹ {formatMoney(outstanding)}
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>


                    {feeBreakdown.length > 0 && (
                      <div className="card card-soft mb-3 p-3">
                        <div className="text-uppercase text-muted small mb-2">Fee Breakdown</div>
                        <div className="table-responsive">
                          <table className="table table-sm align-middle mb-0">
                            <thead>
                              <tr>
                                <th>Category</th>
                                <th className="text-end">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {feeBreakdown.map((row, index) => (
                                <tr key={`${row.fee_name || 'fee'}-${index}`}>
                                  <td>{row.fee_name || 'Fee'}</td>
                                  <td className="text-end">₹ {formatMoney(row.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {feeInfoWarning && (
                      <div className="text-warning small mb-3">{feeInfoWarning}</div>
                    )}

                    {paymentSummaryWarning && (
                      <div className="text-warning small mb-3">{paymentSummaryWarning}</div>
                    )}

                    <form className="row g-3" onSubmit={handleSubmitPayment}>

                      <div className="col-12">
                        <label className="form-label fw-bold mb-1">Payment Type</label>
                        <div className="d-flex gap-4 flex-wrap">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="paymentMode"
                              id="paymentModeFull"
                              value="full"
                              checked={paymentMode === 'full'}
                              onChange={() => setPaymentMode('full')}
                              disabled={!studentLoaded}
                            />
                            <label className="form-check-label" htmlFor="paymentModeFull">
                              Full payment
                            </label>
                          </div>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="radio"
                              name="paymentMode"
                              id="paymentModePartial"
                              value="partial"
                              checked={paymentMode === 'partial'}
                              onChange={() => setPaymentMode('partial')}
                              disabled={!studentLoaded}
                            />
                            <label className="form-check-label" htmlFor="paymentModePartial">
                              Partial payment
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="col-12">
                        <label className="form-label fw-bold mb-1">Amount</label>
                        <input
                          type="number"
                          min="0"
                          className="form-control"
                          placeholder="Enter amount"
                          value={paymentForm.amount}
                          onChange={(event) => handlePaymentChange('amount', event.target.value)}
                          required
                          disabled={paymentsLocked || amountLocked}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-bold mb-1">Fee Type</label>
                        {paymentMode === 'full' ? (
                          <input
                            className="form-control"
                            value={fullFeeLabel}
                            readOnly
                            disabled
                          />
                        ) : (
                          <select
                            className="form-select"
                            value={paymentForm.feeType}
                            onChange={(event) => handlePaymentChange('feeType', event.target.value)}
                            required
                            disabled={paymentsLocked}
                          >
                            <option value="">Select Fee Type</option>
                            {feeTypeOptions.map((fee) => {
                              const remaining = remainingByType[normalizeFeeKey(fee.value)]
                              const isFullyPaid = Number.isFinite(remaining) && remaining <= 0
                              return (
                                <option key={fee.value} value={fee.value} disabled={isFullyPaid}>
                                  {fee.label}{isFullyPaid ? ' (Paid)' : ''}
                                </option>
                              )
                            })}
                          </select>
                        )}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-bold mb-1">Payment Method</label>
                        <select
                          className="form-select"
                          value={paymentForm.method}
                          onChange={(event) => handlePaymentChange('method', event.target.value)}
                          required
                          disabled={paymentsLocked}
                        >
                          <option value="">Select Method</option>
                          {paymentMethods.map((method) => (
                            <option key={method.value} value={method.value}>
                              {method.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {paymentError && (
                        <div className="col-12">
                          <div className="text-danger small">{paymentError}</div>
                        </div>
                      )}
                      <div className="col-12 d-flex justify-content-end">
                        <button type="submit" className="btn btn-primary students-button" disabled={paymentsLocked}>
                          Record Payment
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <div className="mb-2">
                    <i className="bi bi-cash-stack fs-2"></i>
                  </div>
                  <h5 className="mb-1">No student loaded</h5>
                  <p className="mb-0 small">Enter a student ID to start collecting payments.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </AdminShell>
  )
}

