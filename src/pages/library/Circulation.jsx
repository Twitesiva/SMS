import { useEffect, useState, useMemo, useRef } from 'react'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'
import LibraryPreloader from '../../components/LibraryPreloader'

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dateStr.slice(0, 10).split('-').reverse().join('/')
}

export default function Circulation() {
  const [activeLoans, setActiveLoans] = useState([])
  const [showAllLoans, setShowAllLoans] = useState(false)
  const [depositAmount, setDepositAmount] = useState(0)
  const [loading, setLoading] = useState(true)

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

  const createIssueRow = () => ({
    bookRef: ''
  })

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
    dueDate: buildDefaultDueDate()
  })
  const [issueBooks, setIssueBooks] = useState([createIssueRow()])
  const [returnForm, setReturnForm] = useState({
    studentId: ''
  })
  const [returnItems, setReturnItems] = useState([{ loanId: '' }])
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

  const loadDeposit = async () => {
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('deposit_amount')
        .order('id', { ascending: true })
        .limit(1)
        .single()
      if (error) throw error
      const amt = Number(data?.deposit_amount || 0)
      setDepositAmount(Number.isFinite(amt) ? amt : 0)
    } catch (err) {
      console.error('Failed to load deposit amount', err)
      setDepositAmount(0)
    }
  }

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true)
      try {
        await Promise.all([loadLoans(), loadDeposit()])
      } finally {
        setLoading(false)
      }
    }
    loadInitial()
  }, [])

  const issueCount = useMemo(
    () => issueBooks.filter((item) => (item.bookRef || '').trim().length > 0).length,
    [issueBooks]
  )

  const depositDue = useMemo(() => {
    const amt = Number(depositAmount || 0)
    if (!Number.isFinite(amt) || amt <= 0) return 0
    return issueCount > 0 ? amt : 0
  }, [depositAmount, issueCount])

  const handleChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleIssueBookChange = (index) => (event) => {
    const value = event.target.value
    setIssueBooks((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], bookRef: value }
      return next
    })
  }

  const addIssueBook = () => {
    setIssueBooks((prev) => [...prev, createIssueRow()])
  }

  const removeIssueBook = (index) => {
    setIssueBooks((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== index) : prev))
  }

  const handleReturnChange = (key) => (event) => {
    setReturnForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleReturnItemChange = (index) => (event) => {
    const value = event.target.value
    setReturnItems((prev) => {
      const next = [...prev]
      next[index] = { loanId: value }
      return next
    })
  }

  const addReturnItem = () =>
    setReturnItems((prev) => {
      if (!returnLoans.length || prev.length >= returnLoans.length) return prev
      return [...prev, { loanId: '' }]
    })
  const removeReturnItem = (index) => setReturnItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))

  const resetForm = () => {
    setForm({
      studentId: '',
      dueDate: buildDefaultDueDate()
    })
    setIssueBooks([createIssueRow()])
    setReturnForm({
      studentId: ''
    })
    setReturnItems([{ loanId: '' }])
    setReturnLoans([])
  }

  const resolveBookCopy = async (bookRef, excludeCopyIds = []) => {
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

    let copyQuery = supabase
      .from('library_book_copies')
      .select('id, availability')
      .eq('book_id', bookRow.id)
      .eq('availability', 'AVAILABLE')

    if (excludeCopyIds.length > 0) {
      copyQuery = copyQuery.not('id', 'in', `(${excludeCopyIds.join(',')})`)
    }

    const { data: copyRows, error: copyError } = await copyQuery.order('id', { ascending: true }).limit(1)

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
    const preparedBooks = issueBooks
      .map((item) => (item.bookRef || '').trim())
      .filter((ref) => ref.length > 0)

    if (preparedBooks.length === 0) {
      showToast('Enter at least one book ID or ISBN.', { type: 'warning' })
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

      const dueDate = form.dueDate ? form.dueDate : null
      if (!dueDate) {
        showToast('Select a due date.', { type: 'warning' })
        setSaving(false)
        return
      }

      const usedCopyIds = new Set()
      const assignments = []
      const failures = []

      for (const ref of preparedBooks) {
        const resolved = await resolveBookCopy(ref, Array.from(usedCopyIds))
        if (!resolved || !resolved.book) {
          failures.push(`Book not found for "${ref}".`)
          continue
        }
        if (resolved.book.status === 'PRIVATE') {
          failures.push(`Book "${resolved.book.title || resolved.book.id}" is Private and cannot be issued.`)
          continue
        }
        if (!resolved.copy) {
          failures.push(`No available copies for "${resolved.book.title || resolved.book.id}".`)
          continue
        }
        usedCopyIds.add(resolved.copy.id)
        assignments.push({
          book: resolved.book,
          copyId: resolved.copy.id
        })
      }

      if (assignments.length === 0) {
        showToast(failures[0] || 'No books could be issued.', { type: 'warning' })
        setSaving(false)
        return
      }

      const loanRows = assignments.map((item) => ({
        student_id: studentRow.student_id,
        book_copy_id: item.copyId,
        due_date: dueDate,
        status: 'ISSUED'
      }))

      const { error: insertError } = await supabase.from('library_loans').insert(loanRows)
      if (insertError) throw insertError

      const copyIds = assignments.map((item) => item.copyId)
      const { error: copyUpdateError } = await supabase
        .from('library_book_copies')
        .update({ availability: 'ISSUED' })
        .in('id', copyIds)

      if (copyUpdateError) throw copyUpdateError

      const successCount = assignments.length
      const failCount = failures.length
      if (failCount > 0) {
        showToast(`Issued ${successCount} book(s). ${failCount} skipped: ${failures[0]}`, { type: 'warning' })
      } else {
        const depositMsg = depositDue > 0 ? ` Deposit: Rs. ${depositDue}.` : ''
        showToast(`Issued ${successCount} book(s) successfully.${depositMsg}`, { type: 'success' })
      }

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

    const selectedLoanIds = returnItems
      .map((item) => Number(item.loanId || 0))
      .filter((id) => Number.isFinite(id) && id > 0)

    if (selectedLoanIds.length === 0) {
      showToast('Select at least one book to return.', { type: 'warning' })
      return
    }

    setReturning(true)
    try {
      const timestamp = new Date().toISOString()
      const { error: loanUpdateError } = await supabase
        .from('library_loans')
        .update({ status: 'RETURNED', returned_at: timestamp })
        .in('id', selectedLoanIds)

      if (loanUpdateError) throw loanUpdateError

      const copyIds = returnLoans
        .filter((loan) => selectedLoanIds.includes(loan.id))
        .map((loan) => loan.book_copy_id)
        .filter(Boolean)

      if (copyIds.length > 0) {
        const { error: copyUpdateError } = await supabase
          .from('library_book_copies')
          .update({ availability: 'AVAILABLE' })
          .in('id', copyIds)

        if (copyUpdateError) throw copyUpdateError
      }

      showToast(`Returned ${selectedLoanIds.length} book(s) successfully.`, { type: 'success' })
      setReturnForm({ studentId: '' })
      setReturnItems([{ loanId: '' }])
      setReturnLoans([])
      loadLoans()
    } catch (err) {
      console.error('Failed to return book', err)
      showToast('Unable to process return right now.', { type: 'danger' })
    } finally {
      setReturning(false)
    }
  }
  if (loading && activeLoans.length === 0) {
    return (
      <LibraryPreloader
        title="Loading circulation desk"
        subtitle="Preparing issue and return registers."
        statCount={2}
        panelCount={2}
        rowCount={4}
      />
    )
  }

  return (
    <div className="desktop-container" style={{ overflowX: 'hidden' }}>

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
                <label className="form-label d-flex justify-content-between align-items-center">
                  <span>Book ID / ISBN</span>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addIssueBook}>
                    Add another
                  </button>
                </label>
                <div className="d-flex flex-column gap-2">
                  {issueBooks.map((item, idx) => (
                    <div className="input-group" key={`issue-book-${idx}`}>
                      <input
                        className="form-control"
                        type="text"
                        placeholder="Enter Book ID or ISBN"
                        value={item.bookRef}
                        onChange={handleIssueBookChange(idx)}
                      />
                      {issueBooks.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-outline-danger"
                          onClick={() => removeIssueBook(idx)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="col-md-6">
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
              <div className="col-md-6">
                <label className="form-label">Deposit</label>
                <div className="d-flex align-items-center justify-content-between border rounded px-3 py-2 bg-light">
                  <div>
                    <div className="small text-muted">Required</div>
                    <div className="fw-semibold">Rs. {Number(depositAmount || 0)}</div>
                  </div>
                  <div className="text-end">
                    <div className="small text-muted">For this issue</div>
                    <div className="fw-bold">Rs. {depositDue}</div>
                  </div>
                </div>
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
                    setReturnForm((prev) => ({ ...prev, studentId: value }))
                    setReturnLoans([])
                    setReturnItems([{ loanId: '' }])
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
                        setReturnItems([{ loanId: String(loanRows[0].id) }])
                      } else {
                        setReturnItems([{ loanId: '' }])
                      }
                    } catch (err) {
                      console.error('Failed to load return loans', err)
                      setReturnLoans([])
                      setReturnItems([{ loanId: '' }])
                    }
                  }}
                />
              </div>
              <div className="col-12">
                <label className="form-label d-flex justify-content-between align-items-center">
                  <span>Issued Book(s)</span>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={addReturnItem}
                    disabled={!returnLoans.length || returnItems.length >= returnLoans.length}
                  >
                    Add another
                  </button>
                </label>
                <div className="d-flex flex-column gap-2">
                  {returnItems.map((item, idx) => (
                    <div className="input-group" key={`return-item-${idx}`}>
                      <select
                        className="form-select"
                        value={item.loanId}
                        onChange={handleReturnItemChange(idx)}
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
                          const isSelectedElsewhere = returnItems.some(
                            (ri, i) => i !== idx && String(ri.loanId) === String(loan.id)
                          )
                          return (
                            <option key={loan.id} value={loan.id} disabled={isSelectedElsewhere}>
                              {bookTitle} - Due {dueDate}
                              {isSelectedElsewhere ? ' (already selected)' : ''}
                            </option>
                          )
                        })}
                      </select>
                      {returnItems.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-outline-danger"
                          onClick={() => removeReturnItem(idx)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
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
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 library-circulation-table">
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
                                    .filter((c) => ['MISSING', 'DAMAGED'].includes((c.availability || '').toUpperCase()))
                                    .map((copy) => {
                                      const issueLoan = bookDetails.issueLoans?.find(
                                        (l) => l.library_book_copies?.id === copy.id
                                      )
                                      return (
                                        <tr key={copy.id}>
                                          <td className="fw-bold text-primary">{issueLoan?.students?.student_id || '-'}</td>
                                          <td className="small">{issueLoan?.students?.full_name || '-'}</td>
                                          <td className="font-monospace">{copy.id}</td>
                                          <td>
                                            <span
                                              className={`badge ${
                                                copy.availability === 'MISSING' ? 'bg-danger' : 'bg-warning text-dark'
                                              }`}
                                            >
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










