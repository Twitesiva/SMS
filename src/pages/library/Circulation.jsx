import { useEffect, useState, useMemo, useRef } from 'react'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dateStr.slice(0, 10).split('-').reverse().join('/')
}

export default function Circulation() {
  const [activeLoans, setActiveLoans] = useState([])
  const [showAllLoans, setShowAllLoans] = useState(false)

  const [selectedBook, setSelectedBook] = useState(null)
  const [modalTab, setModalTab] = useState('all') // 'all', 'issued', 'damaged'
  const [bookDetails, setBookDetails] = useState({ copies: [], loans: [], issueLoans: [] })
  const [loadingDetails, setLoadingDetails] = useState(false)

  const activeLoansRef = useRef(null)
  const issuesRef = useRef(null)

  const todayString = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const buildDefaultDueDate = () => {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    return date.toISOString().slice(0, 10)
  }

  const handleBookClick = async (book, tab = 'all') => {
    setSelectedBook(book)
    setModalTab(tab)
    setLoadingDetails(true)
    try {
      // Fetch all copies for this book
      const { data: copies, error: copiesError } = await supabase
        .from('library_book_copies')
        .select('*')
        .eq('book_id', book.id)
        .order('id')

      if (copiesError) throw copiesError

      // Fetch active loans for this book
      const { data: loans, error: loansError } = await supabase
        .from('library_loans')
        .select(`
          id,
          status,
          due_date,
          issued_at,
          students (full_name, student_id),
          library_book_copies!inner (id, book_id)
        `)
        .eq('status', 'ISSUED')
        .eq('library_book_copies.book_id', book.id)
        .order('issued_at', { ascending: false })

      if (loansError) throw loansError

      // Fetch loans for missing/damaged copies
      const { data: issueLoans, error: issueLoansError } = await supabase
        .from('library_loans')
        .select(`
          id,
          status,
          issued_at,
          students (full_name, student_id),
          library_book_copies!inner (id)
        `)
        .in('status', ['MISSING', 'DAMAGED'])
        .eq('library_book_copies.book_id', book.id)
        .order('issued_at', { ascending: false })

      if (issueLoansError) throw issueLoansError

      setBookDetails({
        copies: copies || [],
        loans: loans || [],
        issueLoans: issueLoans || []
      })
    } catch (err) {
      console.error('Error fetching book details:', err)
      showToast('Failed to load book details.', { type: 'error' })
    } finally {
      setLoadingDetails(false)
    }
  }

  const [form, setForm] = useState({
    studentId: '',
    bookRef: '',
    dueDate: buildDefaultDueDate()
  })
  const [returnForm, setReturnForm] = useState({
    studentId: '',
    loanId: ''
  })
  const [returnLoans, setReturnLoans] = useState([])
  const [saving, setSaving] = useState(false)
  const [returning, setReturning] = useState(false)

  const loadLoans = async () => {
    try {
      const { data, error } = await supabase
        .from('library_loans')
        .select(
          'id, status, due_date, issued_at, students(full_name,student_id), library_book_copies(book_id, library_books(title, author, shelf_code))'
        )
        .eq('status', 'ISSUED')
        .order('due_date', { ascending: true })

      if (error) throw error
      setActiveLoans(data || [])
    } catch (err) {
      console.error('Failed to load active loans', err)
      setActiveLoans([])
    }
  }

  useEffect(() => {
    loadLoans()
  }, [])

  const handleChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleReturnChange = (key) => (event) => {
    setReturnForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const resetForm = () => {
    setForm({
      studentId: '',
      bookRef: '',
      dueDate: buildDefaultDueDate()
    })
    setReturnForm({
      studentId: '',
      loanId: ''
    })
    setReturnLoans([])
  }

  const resolveBookCopy = async (bookRef) => {
    const trimmed = bookRef.trim()
    if (!trimmed) return null

    const numericId = Number(trimmed)
    let bookQuery = supabase.from('library_books').select('id, title, status')

    if (Number.isFinite(numericId) && String(numericId) === trimmed) {
      bookQuery = bookQuery.eq('id', numericId)
    } else {
      bookQuery = bookQuery.or(`isbn.eq.${trimmed},title.ilike.%${trimmed}%`)
    }

    const { data: bookRows, error: bookError } = await bookQuery.limit(1)
    if (bookError) throw bookError
    const bookRow = (bookRows || [])[0]
    if (!bookRow) return null

    const { data: copyRows, error: copyError } = await supabase
      .from('library_book_copies')
      .select('id, availability')
      .eq('book_id', bookRow.id)
      .eq('availability', 'AVAILABLE')
      .order('id', { ascending: true })
      .limit(1)

    if (copyError) throw copyError
    const copyRow = (copyRows || [])[0]
    if (!copyRow) return { book: bookRow, copy: null }

    return { book: bookRow, copy: copyRow }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.studentId.trim()) {
      showToast('Enter a student ID.', { type: 'warning' })
      return
    }
    if (!form.bookRef.trim()) {
      showToast('Enter a book ID or ISBN.', { type: 'warning' })
      return
    }

    setSaving(true)
    try {
      const { data: studentRows, error: studentError } = await supabase
        .from('students')
        .select('student_id')
        .eq('student_id', form.studentId.trim())
        .limit(1)

      if (studentError) throw studentError
      const studentRow = (studentRows || [])[0]
      if (!studentRow) {
        showToast('Student not found.', { type: 'warning' })
        setSaving(false)
        return
      }

      const resolved = await resolveBookCopy(form.bookRef)
      if (!resolved || !resolved.book) {
        showToast('Book not found.', { type: 'warning' })
        setSaving(false)
        return
      }

      if (resolved.book.status === 'PRIVATE') {
        showToast('This book is Private and cannot be issued.', { type: 'warning' })
        setSaving(false)
        return
      }

      if (!resolved.copy) {
        showToast('No available copies for this book.', { type: 'warning' })
        setSaving(false)
        return
      }

      const dueDate = form.dueDate ? form.dueDate : null
      if (!dueDate) {
        showToast('Select a due date.', { type: 'warning' })
        setSaving(false)
        return
      }

      const { error: insertError } = await supabase
        .from('library_loans')
        .insert([
          {
            student_id: studentRow.student_id,
            book_copy_id: resolved.copy.id,
            due_date: dueDate,
            status: 'ISSUED'
          }
        ])

      if (insertError) throw insertError

      const { error: copyUpdateError } = await supabase
        .from('library_book_copies')
        .update({ availability: 'ISSUED' })
        .eq('id', resolved.copy.id)

      if (copyUpdateError) throw copyUpdateError

      showToast('Book issued successfully.', { type: 'success' })

      resetForm()
      loadLoans()
    } catch (err) {
      console.error('Failed to update circulation', err)
      showToast('Unable to update circulation right now.', { type: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const handleReturn = async (event) => {
    event.preventDefault()
    if (!returnForm.studentId.trim()) {
      showToast('Enter a student ID.', { type: 'warning' })
      return
    }
    if (!returnForm.loanId) {
      showToast('Select a book to return.', { type: 'warning' })
      return
    }

    setReturning(true)
    try {
      const loanId = Number(returnForm.loanId)
      const { error: loanUpdateError } = await supabase
        .from('library_loans')
        .update({ status: 'RETURNED', returned_at: new Date().toISOString() })
        .eq('id', loanId)

      if (loanUpdateError) throw loanUpdateError

      const loanMatch = returnLoans.find((loan) => loan.id === loanId)
      const copyId = loanMatch?.book_copy_id
      if (!copyId) {
        showToast('Book copy not found for this loan.', { type: 'warning' })
        setReturning(false)
        return
      }

      const { error: copyUpdateError } = await supabase
        .from('library_book_copies')
        .update({ availability: 'AVAILABLE' })
        .eq('id', copyId)

      if (copyUpdateError) throw copyUpdateError

      showToast('Book returned successfully.', { type: 'success' })
      setReturnForm({ studentId: '', loanId: '' })
      setReturnLoans([])
      loadLoans()
    } catch (err) {
      console.error('Failed to return book', err)
      showToast('Unable to process return right now.', { type: 'danger' })
    } finally {
      setReturning(false)
    }
  }
  return (
    <div className="desktop-container" style={{ overflowX: 'hidden' }}>
      <section className="setup-hero mb-4 text-center">
        <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
          <div className="admin-applications__crest mx-auto" aria-hidden="true">
            <img src={crestPrimary} alt="Vijayam crest" />
          </div>
          <h3 className="setup-hero-title mb-2">Book Outgoing</h3>
          <p className="setup-hero-copy mb-3">Book issue &amp; return.</p>
          <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
            <span className="setup-hero-chip text-uppercase">ISSUE DESK</span>
            <span className="setup-hero-chip text-uppercase">RETURNS</span>
            <span className="setup-hero-chip text-uppercase">RENEWALS</span>
          </div>
        </div>
      </section>

      <div className="row g-4 justify-content-center mx-0">
        <div className="col-12 col-lg-6">
          <div className="card card-soft p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h4 className="mb-1">Issue Book</h4>
                <p className="text-muted mb-0">Issue desk for outgoing books.</p>
              </div>
              <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
                Reset
              </button>
            </div>
            <form className="row g-3" onSubmit={handleSubmit}>
              <div className="col-12">
                <div className="text-uppercase text-muted small fw-semibold">Issue Book</div>
              </div>
              <div className="col-12">
                <label className="form-label">Student ID</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="STU-1001"
                  value={form.studentId}
                  onChange={handleChange('studentId')}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Book ID / ISBN</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="Enter Book ID or ISBN"
                  value={form.bookRef}
                  onChange={handleChange('bookRef')}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Due Date</label>
                <input
                  className="form-control"
                  type="date"
                  value={form.dueDate}
                  onChange={handleChange('dueDate')}
                  readOnly
                  disabled
                />
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
                  Clear
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card card-soft p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h4 className="mb-1">Return Books</h4>
                <p className="text-muted mb-0">Receive books back from members.</p>
              </div>
            </div>
            <form className="row g-3" onSubmit={handleReturn}>
              <div className="col-12">
                <label className="form-label">Student ID</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="STU-1001"
                  value={returnForm.studentId}
                  onChange={(event) => {
                    const value = event.target.value
                    setReturnForm((prev) => ({ ...prev, studentId: value, loanId: '' }))
                    setReturnLoans([])
                  }}
                  onBlur={async () => {
                    if (!returnForm.studentId.trim()) return
                    try {
                      const { data: loanRows, error: loanError } = await supabase
                        .from('library_loans')
                        .select(
                          'id, book_copy_id, due_date, students(full_name,student_id), library_book_copies(book_id, library_books(title))'
                        )
                        .eq('student_id', returnForm.studentId.trim())
                        .eq('status', 'ISSUED')
                        .order('issued_at', { ascending: false })

                      if (loanError) throw loanError
                      setReturnLoans(loanRows || [])
                      if ((loanRows || []).length === 1) {
                        setReturnForm((prev) => ({ ...prev, loanId: String(loanRows[0].id) }))
                      }
                    } catch (err) {
                      console.error('Failed to load return loans', err)
                      setReturnLoans([])
                    }
                  }}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Issued Book</label>
                <select
                  className="form-select"
                  value={returnForm.loanId}
                  onChange={handleReturnChange('loanId')}
                  disabled={!returnLoans.length}
                >
                  <option value="">
                    {returnForm.studentId.trim()
                      ? returnLoans.length
                        ? 'Select a book'
                        : 'No active loans found'
                      : 'Enter student ID to load books'}
                  </option>
                  {returnLoans.map((loan) => {
                    const bookTitle = loan.library_book_copies?.library_books?.title || 'Unknown'
                    const dueDate = formatDate(loan.due_date)
                    return (
                      <option key={loan.id} value={loan.id}>
                        {bookTitle} • Due {dueDate}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>
                  Clear
                </button>
                <button type="submit" className="btn btn-primary" disabled={returning}>
                  {returning ? 'Processing...' : 'Receive Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="row g-4 justify-content-center mx-0 mt-1">
        <div className="col-12">
          <div className="card card-soft p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h4 className="mb-1">Active Loans</h4>
                <p className="text-muted mb-0">Monitor currently issued books.</p>
              </div>
              <div className="d-flex gap-2">
                {activeLoans.length > 2 && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowAllLoans((prev) => !prev)}
                  >
                    {showAllLoans ? 'Show less' : 'View more'}
                  </button>
                )}
                <button type="button" className="btn btn-outline-secondary btn-sm">Export</button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Student</th>
                    <th>Book</th>
                    <th>Status</th>
                    <th className="text-end">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLoans.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-4">No active loans loaded.</td>
                    </tr>
                  ) : (
                    (showAllLoans ? activeLoans : activeLoans.slice(0, 2)).map((loan) => {
                      const student = loan.students
                      const bookData = loan.library_book_copies?.library_books
                      const bookId = loan.library_book_copies?.book_id
                      
                      const bookObj = bookData ? {
                        id: bookId,
                        title: bookData.title,
                        author: bookData.author,
                        shelf: bookData.shelf_code
                      } : null

                      return (
                        <tr key={loan.id}>
                          <td>{student?.full_name || 'Unknown'} ({student?.student_id || '--'})</td>
                          <td 
                            onClick={() => bookObj && handleBookClick(bookObj, 'issued')}
                            style={{ cursor: bookObj ? 'pointer' : 'default' }}
                            className={bookObj ? 'text-primary fw-semibold' : ''}
                          >
                            {bookData?.title || 'Unknown'}
                          </td>
                          <td>
                            <span className="badge bg-success-subtle text-success">Issued</span>
                          </td>
                          <td className="text-end">{formatDate(loan.due_date)}</td>
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

      {selectedBook && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header d-flex flex-column align-items-center border-bottom-0 pt-4 pb-0 position-relative">
                  <div className="text-center w-100">
                    <div className="mb-4 px-4">
                      <div className="text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.15em' }}>
                        Book Title
                      </div>
                      <h4 className="fw-bold text-dark mb-0" style={{ fontSize: '1.5rem' }}>
                        {selectedBook.title}
                      </h4>
                    </div>
                    
                    <div className="row g-0 border-top border-bottom py-3 bg-light w-100">
                      <div className="col-6 border-end px-2">
                        <div className="text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.12em' }}>
                          Author
                        </div>
                        <div className="fw-semibold text-primary" style={{ fontSize: '1.05rem' }}>
                          {selectedBook.author || 'Unknown'}
                        </div>
                      </div>
                      <div className="col-6 px-2">
                        <div className="text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.12em' }}>
                          Shelf Reference
                        </div>
                        <div className="fw-semibold text-dark" style={{ fontSize: '1.05rem' }}>
                          {selectedBook.shelf || '--'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn-close position-absolute" 
                    style={{ right: '1.25rem', top: '1.25rem' }} 
                    onClick={() => setSelectedBook(null)}
                  ></button>
                </div>
                <div className="modal-body">
                  {loadingDetails ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-primary" role="status"></div>
                      <p className="mt-2 text-muted">Loading details...</p>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-4">
                      {/* Stats Row */}
                      <div className="row g-3">
                        <div className="col-6 col-sm-3">
                          <div 
                            className={`p-3 border rounded text-center ${modalTab === 'all' ? 'bg-primary text-white' : 'bg-light'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setModalTab('all')}
                          >
                            <div className={`small text-uppercase fw-bold ${modalTab === 'all' ? 'text-white-50' : 'text-muted'}`}>Total</div>
                            <div className="fs-4 fw-bold">{bookDetails.copies.length}</div>
                          </div>
                        </div>
                        <div className="col-6 col-sm-3">
                          <div 
                            className={`p-3 border rounded text-center ${modalTab === 'issued' ? 'bg-primary text-white' : 'bg-light'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setModalTab('issued')}
                          >
                            <div className={`small text-uppercase fw-bold ${modalTab === 'issued' ? 'text-white-50' : 'text-muted'}`}>Issued</div>
                            <div className={`fs-4 fw-bold ${modalTab === 'issued' ? 'text-white' : 'text-primary'}`}>{bookDetails.loans.length}</div>
                          </div>
                        </div>
                        <div className="col-6 col-sm-3">
                          <div 
                            className={`p-3 border rounded text-center ${modalTab === 'damaged' ? 'bg-primary text-white' : 'bg-light'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setModalTab('damaged')}
                          >
                            <div className={`small text-uppercase fw-bold ${modalTab === 'damaged' ? 'text-white-50' : 'text-muted'}`}>Damaged</div>
                            <div className={`fs-4 fw-bold ${modalTab === 'damaged' ? 'text-white' : 'text-danger'}`}>
                              {bookDetails.copies.filter(c => ['MISSING', 'DAMAGED'].includes((c.availability || '').toUpperCase())).length}
                            </div>
                          </div>
                        </div>
                        <div className="col-6 col-sm-3">
                          <div className="p-3 border rounded bg-light text-center">
                            <div className="small text-muted text-uppercase fw-bold">Balance</div>
                            <div className="fs-4 fw-bold text-success">
                              {bookDetails.copies.length - bookDetails.loans.length - bookDetails.copies.filter(c => ['MISSING', 'DAMAGED'].includes((c.availability || '').toUpperCase())).length}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Filtered Sections */}
                      {(modalTab === 'all' || modalTab === 'issued') && (
                        <div>
                          <h6 className="fw-bold mb-3 border-bottom pb-2">Active Loans</h6>
                          {bookDetails.loans.length > 0 ? (
                            <div className="table-responsive">
                              <table className="table table-sm table-hover align-middle">
                                <thead className="table-light">
                                  <tr>
                                    <th>Student ID</th>
                                    <th>Student Name</th>
                                    <th>Loan Date</th>
                                    <th>Due Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bookDetails.loans.map(loan => (
                                    <tr key={loan.id}>
                                      <td className="fw-bold text-primary">{loan.students?.student_id}</td>
                                      <td>{loan.students?.full_name || 'Unknown'}</td>
                                      <td>{formatDate(loan.issued_at)}</td>
                                      <td className={loan.due_date < todayString ? 'text-danger fw-bold' : ''}>
                                        {formatDate(loan.due_date)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-muted fst-italic mb-0">No active loans for this title.</p>
                          )}
                        </div>
                      )}

                      {(modalTab === 'all' || modalTab === 'damaged') && (
                        <div>
                          <h6 className="fw-bold mb-3 border-bottom pb-2">Copies with Issues</h6>
                          {bookDetails.copies.filter(c => ['MISSING', 'DAMAGED'].includes((c.availability || '').toUpperCase())).length > 0 ? (
                            <div className="table-responsive">
                              <table className="table table-sm table-hover align-middle">
                                <thead className="table-light">
                                  <tr>
                                    <th>Student ID</th>
                                    <th>Student Name</th>
                                    <th>Copy ID</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bookDetails.copies
                                    .filter(c => ['MISSING', 'DAMAGED'].includes((c.availability || '').toUpperCase()))
                                    .map(copy => {
                                      const issueLoan = bookDetails.issueLoans?.find(l => l.library_book_copies?.id === copy.id)
                                      return (
                                        <tr key={copy.id}>
                                          <td className="fw-bold text-primary">{issueLoan?.students?.student_id || '-'}</td>
                                          <td className="small">{issueLoan?.students?.full_name || '-'}</td>
                                          <td className="font-monospace">{copy.id}</td>
                                          <td>
                                            <span className={`badge ${copy.availability === 'MISSING' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                              {copy.availability}
                                            </span>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-muted fst-italic mb-0">No damaged or missing copies reported.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedBook(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
