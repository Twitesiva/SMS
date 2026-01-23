import { useEffect, useMemo, useState, useCallback } from 'react'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dateStr.slice(0, 10).split('-').reverse().join('/')
}

const missingReasonOptions = [
  'Declared lost by member',
  'Severe page or print damage',
  'Water or moisture exposure',
  'Cover or binding failure',
  'Supplementary material missing'
]

const initialMissingForm = {
  studentId: '',
  loanId: '',
  condition: 'MISSING',
  reason: missingReasonOptions[0],
  amount: '500'
}

export default function Fines() {
  const [pendingFines, setPendingFines] = useState([])
  const [summary, setSummary] = useState({
    outstanding: null,
    collected: null,
    highPriority: null
  })
  const [loadingBook, setLoadingBook] = useState(false)
  const [bookStatus, setBookStatus] = useState('')
  const [studentFines, setStudentFines] = useState([])
  const [fineForm, setFineForm] = useState({
    studentId: '',
    fineId: '',
    bookTitle: '',
    amount: '100',
    paymentMode: 'Cash'
  })
  
  // Separate states for Missing and Damaged forms
  const [missingBookForm, setMissingBookForm] = useState({
    studentId: '',
    loanId: '',
    condition: 'MISSING',
    reason: missingReasonOptions[0],
    amount: '500'
  })
  const [damagedBookForm, setDamagedBookForm] = useState({
    studentId: '',
    loanId: '',
    condition: 'DAMAGED',
    reason: missingReasonOptions[0],
    amount: '500'
  })

  const [missingBookLoans, setMissingBookLoans] = useState([])
  const [damagedBookLoans, setDamagedBookLoans] = useState([])
  
  const [reasonCharges, setReasonCharges] = useState([])
  const [fineChargeDefaults, setFineChargeDefaults] = useState({ missing: 500, damaged: 500 })
  const [savingMissing, setSavingMissing] = useState(false)
  const [savingDamaged, setSavingDamaged] = useState(false)
  const [collecting, setCollecting] = useState(false)
  
  // States for Other Fines
  const [otherChargeCategories, setOtherChargeCategories] = useState([])
  const [savingOther, setSavingOther] = useState(false)
  const [otherFineForm, setOtherFineForm] = useState({
    studentId: '',
    categoryId: '',
    amount: '0'
  })

  const today = useMemo(() => new Date(), [])

  const loadOtherCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('library_charge_categories')
        .select('*')
        .order('name', { ascending: true })
      if (!error) setOtherChargeCategories(data || [])
    } catch (err) {
      console.error('Failed to load other categories', err)
    }
  }, [])

  const resolveFineAmount = useCallback(
    (reasonValue, conditionValue) => {
      const normalizedReason = (reasonValue || '').toLowerCase()
      const normalizedCondition = (conditionValue || 'MISSING').toUpperCase()

      const matched = (reasonCharges || []).find((row) => {
        const matchesReason = (row.reason || '').toLowerCase() === normalizedReason
        const matchesCondition = row.condition
          ? String(row.condition).toUpperCase() === normalizedCondition
          : true
        return matchesReason && matchesCondition
      })

      if (matched && Number.isFinite(Number(matched.amount))) {
        return String(Number(matched.amount))
      }

      const fallback = normalizedCondition === 'DAMAGED' ? fineChargeDefaults.damaged : fineChargeDefaults.missing
      return String(Number.isFinite(Number(fallback)) ? Number(fallback) : 0)
    },
    [reasonCharges, fineChargeDefaults]
  )

  const loadFineCharges = useCallback(async () => {
    try {
      const { data: defaultsData, error: defaultsError } = await supabase
        .from('global_settings')
        .select('missing_amount, damaged_amount')
        .order('id', { ascending: true })
        .limit(1)
        .single()

      if (!defaultsError && defaultsData) {
        setFineChargeDefaults({
          missing: Number(defaultsData.missing_amount ?? 500),
          damaged: Number(defaultsData.damaged_amount ?? 500)
        })
      } else if (defaultsError) {
        console.error('Unable to load default fine amounts', defaultsError)
      }
      
      // Table library_fine_reasons does not exist yet, using defaults.
      setReasonCharges([])
    } catch (err) {
      console.error('Failed to load fine configuration', err)
    }
  }, [])

  useEffect(() => {
    loadFineCharges()
    loadOtherCategories()
  }, [loadFineCharges, loadOtherCategories])

  // Update amounts when dependencies change
  useEffect(() => {
    setMissingBookForm((prev) => {
      const amount = resolveFineAmount(prev.reason, 'MISSING')
      return { ...prev, amount }
    })
    setDamagedBookForm((prev) => {
      const amount = resolveFineAmount(prev.reason, 'DAMAGED')
      return { ...prev, amount }
    })
  }, [resolveFineAmount])

  const loadFines = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('library_fines')
        .select(
          'id, amount, status, created_at, paid_at, student_id, loan_id, description, students(full_name,student_id), library_loans(status, due_date, library_book_copies(book_id, library_books(title)))'
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      const pending = (data || []).filter((row) => row.status === 'PENDING')
      setPendingFines(pending)

      const outstanding = pending.reduce((sum, row) => sum + Number(row.amount || 0), 0)

      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
      const collected = (data || [])
        .filter((row) => row.status === 'PAID' && row.paid_at && String(row.paid_at).slice(0, 7) === monthKey)
        .reduce((sum, row) => sum + Number(row.amount || 0), 0)

      const highPriority = pending.filter((row) => {
        const dueDate = row.library_loans?.due_date
        if (!dueDate) return false
        const diff = Math.floor((today - new Date(dueDate)) / (1000 * 60 * 60 * 24))
        return diff > 10
      }).length

      setSummary({
        outstanding,
        collected,
        highPriority
      })
    } catch (err) {
      console.error('Failed to load fines', err)
      setPendingFines([])
      setSummary({ outstanding: null, collected: null, highPriority: null })
    }
  }, [today])

  useEffect(() => {
    loadFines()
  }, [loadFines])

  const formatValue = (value) => (value === null || value === undefined ? '--' : String(value))

  const handleFineChange = (key) => (event) => {
    const value = event.target.value
    setFineForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'fineId') {
        const selected = studentFines.find(f => String(f.id) === String(value))
        if (selected) {
          next.bookTitle = selected.library_loans?.library_book_copies?.library_books?.title || selected.description || 'Unknown'
          next.amount = String(selected.amount || 0)
        } else {
          next.bookTitle = ''
          next.amount = '0'
        }
      }
      return next
    })
  }

  const fetchStudentDues = async (studentId) => {
    const trimmed = (studentId || '').trim()
    if (!trimmed) {
      setStudentFines([])
      return
    }

    setLoadingBook(true)
    setBookStatus('')
    try {
      const { data, error } = await supabase
        .from('library_fines')
        .select(`
          id, 
          amount, 
          status, 
          description,
          library_loans (
            id,
            library_book_copies (
              library_books (title)
            )
          )
        `)
        .eq('student_id', trimmed)
        .eq('status', 'PENDING')

      if (error) throw error
      setStudentFines(data || [])
      if ((data || []).length === 0) {
        setBookStatus('No pending fines found for this student.')
      } else {
        setBookStatus(`${data.length} pending fine(s) found.`)
        if (data.length === 1) {
          const f = data[0]
          setFineForm(prev => ({
            ...prev,
            fineId: String(f.id),
            bookTitle: f.library_loans?.library_book_copies?.library_books?.title || f.description || 'Unknown',
            amount: String(f.amount || 0)
          }))
        }
      }
    } catch (err) {
      console.error('Failed to fetch student fines', err)
      setBookStatus('Unable to fetch fine details.')
    } finally {
      setLoadingBook(false)
    }
  }

  const handleCollectPayment = async (e) => {
    if (e) e.preventDefault()
    if (!fineForm.fineId) {
      showToast('Select a fine to collect.', { type: 'warning' })
      return
    }

    setCollecting(true)
    try {
      const { error } = await supabase
        .from('library_fines')
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString()
        })
        .eq('id', fineForm.fineId)

      if (error) throw error

      showToast('Payment collected successfully.', { type: 'success' })
      setFineForm({
        studentId: '',
        fineId: '',
        bookTitle: '',
        amount: '100',
        paymentMode: 'Cash'
      })
      setStudentFines([])
      setBookStatus('')
      loadFines()
    } catch (err) {
      console.error('Failed to collect payment', err)
      showToast('Unable to process payment.', { type: 'danger' })
    } finally {
      setCollecting(false)
    }
  }

  const handleOtherFormChange = (key) => (event) => {
    const value = event.target.value
    setOtherFineForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'categoryId') {
        const cat = otherChargeCategories.find(c => String(c.id) === String(value))
        if (cat) next.amount = String(cat.amount)
      }
      return next
    })
  }

  const handleOtherFineSubmit = async (e) => {
    e.preventDefault()
    const trimmedStu = otherFineForm.studentId.trim()
    if (!trimmedStu) return showToast('Enter Student ID.', { type: 'warning' })
    if (!otherFineForm.categoryId) return showToast('Select a category.', { type: 'warning' })
    
    const category = otherChargeCategories.find(c => String(c.id) === String(otherFineForm.categoryId))
    
    setSavingOther(true)
    try {
      const { error } = await supabase.from('library_fines').insert([{
        student_id: trimmedStu,
        amount: Number(otherFineForm.amount),
        description: category?.name || 'Other Charge',
        status: 'PENDING'
      }])
      if (error) throw error
      showToast('Fine recorded.', { type: 'success' })
      setOtherFineForm({ studentId: '', categoryId: '', amount: '0' })
      loadFines()
    } catch (err) {
      console.error('Failed to save other fine', err)
      showToast('Unable to record fine.', { type: 'danger' })
    } finally {
      setSavingOther(false)
    }
  }

  // Generic fetch for both forms
  const fetchStudentLoans = async (studentId, type) => {
    const trimmed = (studentId || '').trim()
    const setLoans = type === 'MISSING' ? setMissingBookLoans : setDamagedBookLoans
    const setForm = type === 'MISSING' ? setMissingBookForm : setDamagedBookForm
    const defaultReason = missingReasonOptions[0]
    
    if (!trimmed) {
      setLoans([])
      setForm((prev) => ({
        ...prev,
        loanId: '',
        amount: resolveFineAmount(prev.reason || defaultReason, type)
      }))
      return
    }
    try {
      const { data, error } = await supabase
        .from('library_loans')
        .select('id, student_id, status, due_date, library_book_copies(id, library_books(title))')
        .eq('student_id', trimmed)
        .eq('status', 'ISSUED')
        .order('issued_at', { ascending: false })

      if (error) throw error
      setLoans(data || [])
      if ((data || []).length === 1) {
        const loneId = String(data[0].id)
        setForm((prev) => ({
          ...prev,
          loanId: loneId,
          amount: resolveFineAmount(prev.reason || defaultReason, type)
        }))
      } else {
        setForm((prev) => ({ ...prev, loanId: '' }))
      }
    } catch (err) {
      console.error(`Failed to load loans for ${type}`, err)
      setLoans([])
    }
  }

  const handleBookReportChange = (type) => (key) => (event) => {
    const value = event.target.value
    const setForm = type === 'MISSING' ? setMissingBookForm : setDamagedBookForm
    const setLoans = type === 'MISSING' ? setMissingBookLoans : setDamagedBookLoans
    
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'studentId') {
        next.loanId = ''
      }
      if (key === 'reason') {
        next.amount = resolveFineAmount(value, type)
      }
      return next
    })
    
    if (key === 'studentId') {
      setLoans([])
    }
  }

  const handleBookReportSubmit = (type) => async (event) => {
    event.preventDefault()
    const form = type === 'MISSING' ? missingBookForm : damagedBookForm
    const setSaving = type === 'MISSING' ? setSavingMissing : setSavingDamaged
    const setForm = type === 'MISSING' ? setMissingBookForm : setDamagedBookForm
    const setLoans = type === 'MISSING' ? setMissingBookLoans : setDamagedBookLoans
    const loans = type === 'MISSING' ? missingBookLoans : damagedBookLoans

    const trimmedStudentId = form.studentId.trim()
    if (!trimmedStudentId) {
      showToast('Enter a student ID.', { type: 'warning' })
      return
    }

    const loanIdNum = Number(form.loanId || 0)
    if (!Number.isFinite(loanIdNum) || loanIdNum <= 0) {
      showToast('Select at least one issued book to mark.', { type: 'warning' })
      return
    }

    const amountNum = Number(form.amount || 0)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      showToast('Enter a valid fine amount.', { type: 'warning' })
      return
    }

    setSaving(true)
    const successes = []
    const failures = []
    
    // Process logic similar to before
    try {
      const loanRow = loans.find((l) => l.id === loanIdNum)
      const copyId = loanRow?.library_book_copies?.id

      const { error: loanError } = await supabase
        .from('library_loans')
        .update({ status: type, returned_at: new Date().toISOString() })
        .eq('id', loanIdNum)
      if (loanError) throw loanError

      if (copyId) {
        const { error: copyError } = await supabase
          .from('library_book_copies')
          .update({ availability: type })
          .eq('id', copyId)
        if (copyError) throw copyError
      }

      const payload = {
        loan_id: loanIdNum,
        amount: amountNum,
        student_id: trimmedStudentId,
        status: 'PENDING'
      }

      const { error: fineError } = await supabase.from('library_fines').insert([payload])
      if (fineError) throw fineError

      successes.push(loanIdNum)
      
      showToast(`${type === 'MISSING' ? 'Missing' : 'Damaged'} book reported and fine raised.`, { type: 'success' })
      
      // Reset form
      setForm({
        studentId: '',
        loanId: '',
        condition: type,
        reason: missingReasonOptions[0],
        amount: resolveFineAmount(missingReasonOptions[0], type)
      })
      setLoans([])
      loadFines()

    } catch (err) {
      console.error(`Failed to mark ${type}`, err)
      showToast(`Unable to update ${type.toLowerCase()} book.`, { type: 'danger' })
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="desktop-container" style={{ overflowX: 'hidden' }}>

      <div className="row g-4 justify-content-center mx-0 mb-4">
        <div className="col-12 col-md-4">
          <div className="card card-soft p-3 h-100">
            <div className="text-muted small">Outstanding Fines</div>
            <div className="fs-3 fw-bold">{summary.outstanding === null ? '--' : `Rs. ${summary.outstanding}`}</div>
            <div className="small text-muted">Pending payments</div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card card-soft p-3 h-100">
            <div className="text-muted small">Collected This Month</div>
            <div className="fs-3 fw-bold">{summary.collected === null ? '--' : `Rs. ${summary.collected}`}</div>
            <div className="small text-muted">Paid fines</div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card card-soft p-3 h-100">
            <div className="text-muted small">High Priority</div>
            <div className="fs-3 fw-bold text-danger">{formatValue(summary.highPriority)}</div>
            <div className="small text-muted">Over 10 days</div>
          </div>
        </div>
      </div>

      <div className="row g-4 justify-content-center mx-0 mb-4">
        <div className="col-12 col-lg-6">
          <div className="card card-soft p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h4 className="mb-1">Collect Fine</h4>
                <p className="text-muted mb-0">Record payment details.</p>
              </div>
              <button 
                type="button" 
                className="btn btn-outline-secondary"
                onClick={() => {
                  setFineForm({ studentId: '', fineId: '', bookTitle: '', amount: '100', paymentMode: 'Cash' })
                  setStudentFines([])
                  setBookStatus('')
                }}
              >
                Reset
              </button>
            </div>
            <form className="row g-3" onSubmit={handleCollectPayment}>
              <div className="col-12">
                <label className="form-label">Student ID</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    type="text"
                    placeholder="STU-1001"
                    value={fineForm.studentId}
                    onChange={handleFineChange('studentId')}
                    onBlur={(event) => fetchStudentDues(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => fetchStudentDues(fineForm.studentId)}
                    disabled={loadingBook || !fineForm.studentId.trim()}
                  >
                    {loadingBook ? '...' : 'Fetch'}
                  </button>
                </div>
                {bookStatus && <div className="form-text text-muted">{bookStatus}</div>}
              </div>

              <div className="col-12">
                <label className="form-label">Select Fine</label>
                <select 
                  className="form-select" 
                  value={fineForm.fineId} 
                  onChange={handleFineChange('fineId')}
                  disabled={!studentFines.length}
                >
                  <option value="">{studentFines.length ? 'Select pending fine' : 'Enter student ID first'}</option>
                  {studentFines.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.library_loans?.library_book_copies?.library_books?.title || 'Unknown'} - Rs. {f.amount}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12">
                <label className="form-label">Book Title</label>
                <input
                  className="form-control"
                  type="text"
                  value={fineForm.bookTitle}
                  readOnly
                  disabled
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Fine Amount (Rs.)</label>
                <input
                  className="form-control"
                  type="number"
                  value={fineForm.amount}
                  readOnly
                  disabled
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Payment Mode</label>
                <select className="form-select" value={fineForm.paymentMode} onChange={handleFineChange('paymentMode')}>
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Card</option>
                </select>
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                <button type="submit" className="btn btn-primary" disabled={collecting || !fineForm.fineId}>
                  {collecting ? 'Processing...' : 'Collect Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card card-soft p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h4 className="mb-1">Pending Fines</h4>
                <p className="text-muted mb-0">Members with unpaid dues.</p>
              </div>
              <button type="button" className="btn btn-outline-secondary btn-sm">Export</button>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Student</th>
                    <th>Book</th>
                    <th>Reason</th>
                    <th>Days</th>
                    <th className="text-end">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingFines.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">No pending fines loaded.</td>
                    </tr>
                  ) : (
                    pendingFines.map((fine) => {
                      const student = fine.students
                      const book = fine.library_loans?.library_book_copies?.library_books
                      const dueDate = fine.library_loans?.due_date
                      const loanStatus = fine.library_loans?.status
                      const days = dueDate
                        ? Math.max(0, Math.floor((today - new Date(dueDate)) / (1000 * 60 * 60 * 24)))
                        : 0
                      let reason = fine.reason || fine.description || null
                      if (!reason) {
                        if (loanStatus === 'MISSING') reason = 'Missing'
                        else if (loanStatus === 'DAMAGED') reason = 'Damaged'
                        else if (dueDate && new Date(dueDate) < today) {
                            reason = `Delayed${days > 0 ? ` (${days} days)` : ''}`
                        } else {
                          reason = 'Fine'
                        }
                      }
                      return (
                        <tr key={fine.id}>
                          <td>{student?.full_name || 'Unknown'} ({student?.student_id || '--'})</td>
                          <td>{book?.title || '--'}</td>
                          <td>{reason}</td>
                          <td>{days || '--'}</td>
                          <td className="text-end">Rs. {fine.amount || 0}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 justify-content-center mx-0 mb-4">
        <div className="col-12 col-lg-6">
          <div className="card card-soft p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h4 className="mb-1">Report Missing Book</h4>
                <p className="text-muted mb-0">Mark copies as missing and raise fine.</p>
              </div>
            </div>
            <form className="row g-3" onSubmit={handleBookReportSubmit('MISSING')}>
              <div className="col-12">
                <label className="form-label">Student ID</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    type="text"
                    placeholder="STU-1001"
                    value={missingBookForm.studentId}
                    onChange={handleBookReportChange('MISSING')('studentId')}
                    onBlur={(event) => fetchStudentLoans(event.target.value, 'MISSING')}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => fetchStudentLoans(missingBookForm.studentId, 'MISSING')}
                    disabled={!missingBookForm.studentId.trim()}
                  >
                    Load
                  </button>
                </div>
              </div>
              <div className="col-12">
                <label className="form-label">Issued Book</label>
                <select
                  className="form-select"
                  value={missingBookForm.loanId}
                  onChange={handleBookReportChange('MISSING')('loanId')}
                  disabled={!missingBookLoans.length}
                >
                  <option value="">
                    {missingBookForm.studentId.trim()
                      ? missingBookLoans.length
                        ? 'Select a loan'
                        : 'No active loans'
                      : 'Enter student ID'}
                  </option>
                  {missingBookLoans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.library_book_copies?.library_books?.title || 'Unknown'} · Due {formatDate(loan.due_date)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Reason</label>
                <select
                  className="form-select"
                  value={missingBookForm.reason}
                  onChange={handleBookReportChange('MISSING')('reason')}
                >
                  {missingReasonOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Condition</label>
                <input className="form-control" type="text" value="Missing" disabled readOnly />
              </div>
              <div className="col-md-6">
                <label className="form-label">Fine (Rs.)</label>
                <input
                  className="form-control"
                  type="number"
                  value={missingBookForm.amount}
                  onChange={handleBookReportChange('MISSING')('amount')}
                  min="0"
                />
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setMissingBookForm({
                      studentId: '',
                      loanId: '',
                      condition: 'MISSING',
                      reason: missingReasonOptions[0],
                      amount: resolveFineAmount(missingReasonOptions[0], 'MISSING')
                    })
                    setMissingBookLoans([])
                  }}
                >
                  Reset
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingMissing}>
                  {savingMissing ? 'Saving...' : 'Mark Missing'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card card-soft p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h4 className="mb-1">Report Damaged Book</h4>
                <p className="text-muted mb-0">Mark copies as damaged and raise fine.</p>
              </div>
            </div>
            <form className="row g-3" onSubmit={handleBookReportSubmit('DAMAGED')}>
              <div className="col-12">
                <label className="form-label">Student ID</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    type="text"
                    placeholder="STU-1001"
                    value={damagedBookForm.studentId}
                    onChange={handleBookReportChange('DAMAGED')('studentId')}
                    onBlur={(event) => fetchStudentLoans(event.target.value, 'DAMAGED')}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => fetchStudentLoans(damagedBookForm.studentId, 'DAMAGED')}
                    disabled={!damagedBookForm.studentId.trim()}
                  >
                    Load
                  </button>
                </div>
              </div>
              <div className="col-12">
                <label className="form-label">Issued Book</label>
                <select
                  className="form-select"
                  value={damagedBookForm.loanId}
                  onChange={handleBookReportChange('DAMAGED')('loanId')}
                  disabled={!damagedBookLoans.length}
                >
                  <option value="">
                    {damagedBookForm.studentId.trim()
                      ? damagedBookLoans.length
                        ? 'Select a loan'
                        : 'No active loans'
                      : 'Enter student ID'}
                  </option>
                  {damagedBookLoans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.library_book_copies?.library_books?.title || 'Unknown'} · Due {formatDate(loan.due_date)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label">Reason</label>
                <select
                  className="form-select"
                  value={damagedBookForm.reason}
                  onChange={handleBookReportChange('DAMAGED')('reason')}
                >
                  {missingReasonOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Condition</label>
                <input className="form-control" type="text" value="Damaged" disabled readOnly />
              </div>
              <div className="col-md-6">
                <label className="form-label">Fine (Rs.)</label>
                <input
                  className="form-control"
                  type="number"
                  value={damagedBookForm.amount}
                  onChange={handleBookReportChange('DAMAGED')('amount')}
                  min="0"
                />
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setDamagedBookForm({
                      studentId: '',
                      loanId: '',
                      condition: 'DAMAGED',
                      reason: missingReasonOptions[0],
                      amount: resolveFineAmount(missingReasonOptions[0], 'DAMAGED')
                    })
                    setDamagedBookLoans([])
                  }}
                >
                  Reset
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingDamaged}>
                  {savingDamaged ? 'Saving...' : 'Mark Damaged'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="row g-4 justify-content-center mx-0 mb-4">
        <div className="col-12 col-lg-8">
          <div className="card card-soft p-4 h-100">
            <div>
              <h4 className="mb-1">Other Fines & Charges</h4>
              <p className="text-muted mb-3">Record miscellaneous library charges.</p>
            </div>
            <form className="row g-3" onSubmit={handleOtherFineSubmit}>
              <div className="col-md-6">
                <label className="form-label">Student ID</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="STU-1001"
                  value={otherFineForm.studentId}
                  onChange={(e) => setOtherFineForm(p => ({ ...p, studentId: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={otherFineForm.categoryId}
                  onChange={handleOtherFormChange('categoryId')}
                >
                  <option value="">Select Category</option>
                  {otherChargeCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Fine Amount (Rs.)</label>
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  value={otherFineForm.amount}
                  onChange={handleOtherFormChange('amount')}
                />
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <button 
                  type="submit" 
                  className="btn btn-primary w-100"
                  disabled={savingOther}
                >
                  {savingOther ? 'Saving...' : 'Record Other Fine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

