import { useEffect, useMemo, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { libraryNavGroups } from './nav'
import { supabase } from '../../../supabaseClient'

export default function Fines() {
  const [pendingFines, setPendingFines] = useState([])
  const [summary, setSummary] = useState({
    outstanding: null,
    collected: null,
    highPriority: null
  })
  const [fineForm, setFineForm] = useState({
    studentId: '',
    bookTitle: '',
    amount: '100',
    paymentMode: 'Cash',
    remarks: ''
  })
  const [loadingBook, setLoadingBook] = useState(false)
  const [bookStatus, setBookStatus] = useState('')

  const today = useMemo(() => new Date(), [])

  useEffect(() => {
    const loadFines = async () => {
      try {
        const { data, error } = await supabase
          .from('library_fines')
          .select(
            'id, amount, status, created_at, paid_at, student_id, loan_id, students(full_name,student_id), library_loans(due_date, library_book_copies(book_id, library_books(title)))'
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
    }

    loadFines()
  }, [today])

  const formatValue = (value) => (value === null || value === undefined ? '--' : String(value))

  const handleFineChange = (key) => (event) => {
    setFineForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const fetchBorrowedBook = async (studentId) => {
    const trimmed = (studentId || '').trim()
    if (!trimmed) return

    setLoadingBook(true)
    setBookStatus('')
    try {
      const { data, error } = await supabase
        .from('library_loans')
        .select(
          'id, status, issued_at, student_id, library_book_copies(book_id, library_books(title))'
        )
        .eq('student_id', trimmed)
        .eq('status', 'ISSUED')
        .order('issued_at', { ascending: false })
        .limit(1)

      if (error) throw error
      const loan = (data || [])[0]
      if (!loan) {
        setFineForm((prev) => ({ ...prev, bookTitle: '' }))
        setBookStatus('No active loan found for this student.')
        return
      }

      const bookTitle = loan.library_book_copies?.library_books?.title || ''
      setFineForm((prev) => ({ ...prev, bookTitle }))
      setBookStatus(bookTitle ? 'Book details loaded.' : 'Book title not found.')
    } catch (err) {
      console.error('Failed to fetch borrowed book', err)
      setBookStatus('Unable to fetch book details.')
    } finally {
      setLoadingBook(false)
    }
  }
  return (
    <AdminShell
      navGroups={libraryNavGroups}
      brandTitle="Library Management Console"
      brandSubtitle="Vijayam"
      footerTitle="Library Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
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
                <button type="button" className="btn btn-outline-secondary">Reset</button>
              </div>
              <form className="row g-3">
                <div className="col-12">
                  <label className="form-label">Student ID</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="STU-1001"
                    value={fineForm.studentId}
                    onChange={handleFineChange('studentId')}
                    onBlur={(event) => fetchBorrowedBook(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm mt-2"
                    onClick={() => fetchBorrowedBook(fineForm.studentId)}
                    disabled={loadingBook || !fineForm.studentId.trim()}
                  >
                    {loadingBook ? 'Fetching...' : 'Fetch Borrowed Book'}
                  </button>
                  {bookStatus && <div className="form-text text-muted">{bookStatus}</div>}
                </div>
                <div className="col-12">
                  <label className="form-label">Book Title</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Borrowed book title"
                    value={fineForm.bookTitle}
                    onChange={handleFineChange('bookTitle')}
                    readOnly
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Fine Amount (Rs.)</label>
                  <input
                    className="form-control"
                    type="number"
                    value={fineForm.amount}
                    onChange={handleFineChange('amount')}
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
                <div className="col-12">
                  <label className="form-label">Remarks</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Optional note"
                    value={fineForm.remarks}
                    onChange={handleFineChange('remarks')}
                  />
                </div>
                <div className="col-12 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary">Save Draft</button>
                  <button type="submit" className="btn btn-primary">Collect Payment</button>
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
                        const days = dueDate
                          ? Math.max(0, Math.floor((today - new Date(dueDate)) / (1000 * 60 * 60 * 24)))
                          : 0
                        return (
                          <tr key={fine.id}>
                            <td>{student?.full_name || 'Unknown'} ({student?.student_id || '--'})</td>
                            <td>{book?.title || 'Unknown'}</td>
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
        </div>
      </div>
    </AdminShell>
  )
}
