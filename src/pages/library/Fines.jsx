import { useEffect, useMemo, useState, useCallback } from 'react'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dateStr.slice(0, 10).split('-').reverse().join('/')
}

const missingReasonOptions = [
  'Reported lost by borrower',
  'Pages damaged/defaced',
  'Water or liquid damage',
  'Cover or binding damaged',
  'Supplementary materials missing'
]

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
  const [missingForm, setMissingForm] = useState({
    studentId: '',
    loanId: '',
    condition: 'MISSING',
    reason: missingReasonOptions[0],
    amount: '500'
  })
  const [missingLoans, setMissingLoans] = useState([])
  const [savingMissing, setSavingMissing] = useState(false)
  const [collecting, setCollecting] = useState(false)

  const today = useMemo(() => new Date(), [])

  const loadFines = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('library_fines')
        .select(
          'id, amount, status, created_at, paid_at, student_id, loan_id, students(full_name,student_id), library_loans(status, due_date, library_book_copies(book_id, library_books(title)))'
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
          next.bookTitle = selected.library_loans?.library_book_copies?.library_books?.title || 'Unknown'
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
            bookTitle: f.library_loans?.library_book_copies?.library_books?.title || 'Unknown',
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

  const fetchMissingLoans = async (studentId) => {
    const trimmed = (studentId || '').trim()
    if (!trimmed) {
      setMissingLoans([])
      setMissingForm((prev) => ({ ...prev, loanId: '' }))
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
      setMissingLoans(data || [])
      if ((data || []).length === 1) {
        setMissingForm((prev) => ({ ...prev, loanId: String(data[0].id) }))
      } else {
        setMissingForm((prev) => ({ ...prev, loanId: '' }))
      }
    } catch (err) {
      console.error('Failed to load loans for missing/damaged', err)
      setMissingLoans([])
      setMissingForm((prev) => ({ ...prev, loanId: '' }))
    }
  }

  const handleMissingChange = (key) => (event) => {
    setMissingForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleMissingSubmit = async (event) => {
    event.preventDefault()
    if (!missingForm.studentId.trim()) {
      showToast('Enter a student ID.', { type: 'warning' })
      return
    }
    if (!missingForm.loanId) {
      showToast('Select a loan.', { type: 'warning' })
      return
    }

    const amount = Number(missingForm.amount || 0)
    if (Number.isNaN(amount) || amount <= 0) {
      showToast('Enter a valid fine amount.', { type: 'warning' })
      return
    }

    setSavingMissing(true)
    try {
      const loanId = Number(missingForm.loanId)
      const loanRow = missingLoans.find((l) => l.id === loanId)
      const copyId = loanRow?.library_book_copies?.id
      const condition = (missingForm.condition || 'MISSING').toUpperCase()

      const { error: loanError } = await supabase
        .from('library_loans')
        .update({ status: condition, returned_at: new Date().toISOString() })
        .eq('id', loanId)
      if (loanError) throw loanError

      if (copyId) {
        const { error: copyError } = await supabase
          .from('library_book_copies')
          .update({ availability: condition })
          .eq('id', copyId)
        if (copyError) throw copyError
      }

      // Try inserting with 'reason' field if schema allows
        const payload = { 
          loan_id: loanId, 
          amount, 
          student_id: missingForm.studentId.trim(), 
          status: 'PENDING'
        }
        if (missingForm.reason) payload.reason = missingForm.reason

      const { error: fineError } = await supabase
        .from('library_fines')
        .insert([payload])
      
      if (fineError) throw fineError

      showToast('Recorded as missing/damaged and fine created.', { type: 'success' })
      setMissingForm({ studentId: '', loanId: '', condition: 'MISSING', reason: missingReasonOptions[0], amount: '500' })
      setMissingLoans([])
      loadFines()
    } catch (err) {
      console.error('Failed to mark missing/damaged', err)
      // Fallback: If 'reason' column fails, try inserting without it
      if (err.message?.includes('reason')) {
         try {
            const payload = { 
              loan_id: Number(missingForm.loanId), 
              amount: Number(missingForm.amount || 0), 
              student_id: missingForm.studentId.trim(), 
              status: 'PENDING'
            }
            const { error: retryError } = await supabase.from('library_fines').insert([payload])
            if (retryError) throw retryError
            
            showToast('Recorded without reason (schema limitation).', { type: 'warning' })
            setMissingForm({ studentId: '', loanId: '', condition: 'MISSING', reason: '', amount: '500' })
            setMissingLoans([])
            loadFines()
            setSavingMissing(false)
            return
         } catch (retryErr) {
            console.error('Retry failed', retryErr)
         }
      }
      showToast('Unable to update missing/damaged book right now.', { type: 'danger' })
    } finally {
      setSavingMissing(false)
    }
  }
  return (
    <div className="desktop-container" style={{ overflowX: 'hidden' }}>
      <section className="setup-hero mb-4 text-center">
        <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
          <div className="admin-applications__crest mx-auto" aria-hidden="true">
            <img src={crestPrimary} alt="Vijayam crest" />
          </div>
          <h3 className="setup-hero-title mb-2">Library Fines</h3>
          <p className="setup-hero-copy mb-3">Track penalties and record collections.</p>
          <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
            <span className="setup-hero-chip text-uppercase">PENALTIES</span>
            <span className="setup-hero-chip text-uppercase">COLLECTIONS</span>
            <span className="setup-hero-chip text-uppercase">OVERDUE</span>
          </div>
        </div>
      </section>

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

      <div className="row g-4 justify-content-center mx-0">
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
                      <td colSpan="4" className="text-center text-muted py-4">No pending fines loaded.</td>
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
                      let reason = '—'
                      if (loanStatus === 'MISSING') reason = 'Missing'
                      else if (loanStatus === 'DAMAGED') reason = 'Damaged'
                      else if (dueDate && new Date(dueDate) < today) {
                        reason = `Delayed${days > 0 ? ` (${days} days)` : ''}`
                      }
                      return (
                        <tr key={fine.id}>
                          <td>{student?.full_name || 'Unknown'} ({student?.student_id || '--'})</td>
                          <td>{book?.title || 'Unknown'}</td>
                          <td>{reason}</td>
                          <td>{days}</td>
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
        <div className="col-12">
          <div className="card card-soft p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h4 className="mb-1">Missing / Damaged Books</h4>
                <p className="text-muted mb-0">Mark copies as missing or damaged and raise fines.</p>
              </div>
            </div>
            <form className="row g-3" onSubmit={handleMissingSubmit}>
              <div className="col-md-4">
                <label className="form-label">Student ID</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="STU-1001"
                  value={missingForm.studentId}
                  onChange={handleMissingChange('studentId')}
                  onBlur={(event) => fetchMissingLoans(event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm mt-2"
                  onClick={() => fetchMissingLoans(missingForm.studentId)}
                  disabled={!missingForm.studentId.trim()}
                >
                  Load Loans
                </button>
              </div>
              <div className="col-md-4">
                <label className="form-label">Issued Book</label>
                <select
                  className="form-select"
                  value={missingForm.loanId}
                  onChange={handleMissingChange('loanId')}
                  disabled={!missingLoans.length}
                >
                  <option value="">
                    {missingForm.studentId.trim()
                      ? missingLoans.length
                        ? 'Select a loan'
                        : 'No active loans'
                      : 'Enter student ID'}
                  </option>
                  {missingLoans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.library_book_copies?.library_books?.title || 'Unknown'} · Due {formatDate(loan.due_date)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Reason</label>
                <select
                  className="form-select"
                  value={missingForm.reason}
                  onChange={handleMissingChange('reason')}
                >
                  {missingReasonOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Condition</label>
                <select className="form-select" value={missingForm.condition} onChange={handleMissingChange('condition')}>
                  <option value="MISSING">Missing</option>
                  <option value="DAMAGED">Damaged</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Fine (Rs.)</label>
                <input
                  className="form-control"
                  type="number"
                  value={missingForm.amount}
                  onChange={handleMissingChange('amount')}
                  min="0"
                />
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setMissingForm({ studentId: '', loanId: '', condition: 'MISSING', reason: missingReasonOptions[0], amount: '500' })
                    setMissingLoans([])
                  }}
                >
                  Reset
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingMissing}>
                  {savingMissing ? 'Saving...' : 'Mark & Fine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
