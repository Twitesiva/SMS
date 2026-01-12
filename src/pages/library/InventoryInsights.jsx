import { useEffect, useMemo, useState, useRef } from 'react'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

export default function InventoryInsights() {
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalCopies: 0,
    issuedCopies: 0,
    availableBalance: 0,
    overdueCount: 0
  })
  const [balanceRows, setBalanceRows] = useState([])
  const [issuedLoans, setIssuedLoans] = useState([])
  const [loading, setLoading] = useState(false)

  const [selectedBook, setSelectedBook] = useState(null)
  const [modalTab, setModalTab] = useState('all') // 'all', 'issued', 'damaged'
  const [bookDetails, setBookDetails] = useState({ copies: [], loans: [] })
  const [loadingDetails, setLoadingDetails] = useState(false)

  const activeLoansRef = useRef(null)
  const issuesRef = useRef(null)

  const todayString = useMemo(() => new Date().toISOString().slice(0, 10), [])

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
      // We join library_book_copies to filter by book_id
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

  useEffect(() => {
    const loadInsights = async () => {
      setLoading(true)
      try {
        const [booksRes, copiesRes, issuedRes] = await Promise.all([
          supabase
            .from('library_books')
            .select('id, title, author, published_year, shelf_code, status')
            .order('created_at', { ascending: false }),
          supabase.from('library_book_copies').select('id, book_id, availability'),
          supabase
            .from('library_loans')
            .select(
              'id, status, due_date, issued_at, students(full_name,student_id), library_book_copies(book_id, library_books(title))'
            )
            .eq('status', 'ISSUED')
            .order('issued_at', { ascending: false })
        ])

        if (booksRes.error) throw booksRes.error
        if (copiesRes.error) throw copiesRes.error
        if (issuedRes.error) throw issuedRes.error

        const books = booksRes.data || []
        const copies = copiesRes.data || []
        const issued = issuedRes.data || []

        const copiesByBook = copies.reduce((acc, row) => {
          const key = String(row.book_id)
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {})

        const damagedByBook = copies.reduce((acc, row) => {
          if (['MISSING', 'DAMAGED'].includes((row.availability || '').toUpperCase())) {
            const key = String(row.book_id)
            acc[key] = (acc[key] || 0) + 1
          }
          return acc
        }, {})

        const issuedByBook = issued.reduce((acc, loan) => {
          const bookId = loan.library_book_copies?.book_id
          if (!bookId) return acc
          const key = String(bookId)
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {})

        const balance = books.map((book) => {
          const bookId = String(book.id)
          const total = copiesByBook[bookId] || 0
          const issuedCount = issuedByBook[bookId] || 0
          const damagedCount = damagedByBook[bookId] || 0
          return {
            id: book.id,
            title: book.title || 'Untitled',
            author: book.author || 'Unknown Author',
            shelf: book.shelf_code || '--',
            total,
            issued: issuedCount,
            damaged: damagedCount,
            available: Math.max(0, total - issuedCount - damagedCount)
          }
        })

        const overdueCount = issued.filter((loan) => loan.due_date && loan.due_date < todayString).length

        const totalBooks = books.length
        const totalCopies = copies.length
        const issuedCopies = issued.length
        const availableBalance = balance.reduce((sum, b) => sum + b.available, 0)

        setStats({
          totalBooks,
          totalCopies,
          issuedCopies,
          availableBalance,
          overdueCount
        })
        setBalanceRows(balance)
        setIssuedLoans(issued.slice(0, 8))
      } catch (error) {
        console.error('Failed to load inventory insights', error)
        showToast('Unable to load inventory insights.', { type: 'danger' })
        setStats({
          totalBooks: 0,
          totalCopies: 0,
          issuedCopies: 0,
          availableBalance: 0,
          overdueCount: 0
        })
        setBalanceRows([])
        setIssuedLoans([])
      } finally {
        setLoading(false)
      }
    }

    loadInsights()
  }, [todayString])

  return (
    <div className="desktop-container library-insights-page" style={{ overflowX: 'hidden' }}>
      <section className="library-insights-hero">
        <div className="library-insights-hero__content">
          <div className="library-insights-hero__brand">
            <div className="library-insights-hero__crest" aria-hidden="true">
              <img src={crestPrimary} alt="Vijayam crest" />
            </div>
            <div>
              <div className="library-insights-hero__eyebrow">Library Insights</div>
              <h3 className="library-insights-hero__title">Book Balance & Issuance</h3>
              <p className="library-insights-hero__subtitle">
                Track available balance, issued copies, and aging titles with clarity.
              </p>
            </div>
          </div>
          <div className="library-insights-hero__chips">
            <span>Availability</span>
            <span>Issued Books</span>
            <span>Outdated Titles</span>
          </div>
        </div>
      </section>

      <div className="library-insights-stats row g-3 mb-4">
        <div className="col-12 col-md-6 col-xl-3">
          <div className="library-insights-stat">
            <div className="library-insights-stat__label">Total Books</div>
            <div className="library-insights-stat__value">{stats.totalBooks}</div>
            <div className="library-insights-stat__meta">Catalogued titles</div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="library-insights-stat">
            <div className="library-insights-stat__label">Total Copies</div>
            <div className="library-insights-stat__value">{stats.totalCopies}</div>
            <div className="library-insights-stat__meta">All physical copies</div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <div className="library-insights-stat">
            <div className="library-insights-stat__label">Available Balance</div>
            <div className="library-insights-stat__value">{stats.availableBalance}</div>
            <div className="library-insights-stat__meta">Copies ready to issue</div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <div className="library-insights-stat">
            <div className="library-insights-stat__label">Issued Books</div>
            <div className="library-insights-stat__value">{stats.issuedCopies}</div>
            <div className="library-insights-stat__meta">Currently with members</div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <div className="library-insights-stat">
            <div className="library-insights-stat__label">Overdue Items</div>
            <div className="library-insights-stat__value library-insights-stat__value--danger">
              {stats.overdueCount}
            </div>
            <div className="library-insights-stat__meta">Past due date</div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <div className="library-insights-panel h-100">
            <div className="library-insights-panel__header">
              <div>
                <h5 className="mb-1">Book Balance Overview</h5>
                <p className="text-muted mb-0">Availability per title with issued counts.</p>
              </div>
              <span className="library-insights-panel__meta">
                {loading ? 'Loading...' : `${balanceRows.length} titles`}
              </span>
            </div>
            <div className="table-responsive">
              <table className="table library-insights-table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Shelf</th>
                    <th>Total</th>
                    <th>Issued</th>
                    <th>Damaged / Missed</th>
                    <th className="text-end">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">Loading balance...</td>
                    </tr>
                  ) : balanceRows.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">No balance data available.</td>
                    </tr>
                  ) : (
                    balanceRows.slice(0, 10).map((row) => (
                      <tr 
                        key={row.id} 
                        style={{ cursor: 'pointer' }}
                      >
                        <td onClick={() => handleBookClick(row, 'all')}>
                          <div className="library-insights-title">{row.title}</div>
                        </td>
                        <td onClick={() => handleBookClick(row, 'all')}>{row.shelf}</td>
                        <td onClick={() => handleBookClick(row, 'all')}>{row.total}</td>
                        <td onClick={() => handleBookClick(row, 'issued')} className="text-primary fw-bold">{row.issued}</td>
                        <td onClick={() => handleBookClick(row, 'damaged')} className="text-danger fw-bold">{row.damaged}</td>
                        <td className="text-end" onClick={() => handleBookClick(row, 'all')}>
                          <span className="library-insights-badge">{row.available}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="library-insights-panel h-100">
            <div className="library-insights-panel__header">
              <div>
                <h5 className="mb-1">Issued Books</h5>
                <p className="text-muted mb-0">Currently issued to members.</p>
              </div>
              <span className="library-insights-panel__meta">
                {loading ? 'Loading...' : `${issuedLoans.length} listed`}
              </span>
            </div>
            {issuedLoans.length === 0 ? (
              <div className="text-center text-muted py-4">No active issues yet.</div>
            ) : (
              <div className="library-insights-issued-list">
                {issuedLoans.map((loan) => {
                  // Construct a book object compatible with handleBookClick
                  const bookData = loan.library_book_copies?.library_books
                  const bookId = loan.library_book_copies?.book_id
                  const bookObj = bookData ? { 
                    id: bookId, 
                    title: bookData.title, 
                    author: bookData.author,
                    shelf: bookData.shelf_code,
                    // We don't have total/issued/damaged counts here easily without full balance rows,
                    // but the modal fetches fresh details anyway. We can pass minimal needed or try to find in balanceRows.
                    ...balanceRows.find(b => String(b.id) === String(bookId))
                  } : null

                  return (
                    <div 
                      key={loan.id} 
                      className="library-insights-issued-item"
                      onClick={() => bookObj && handleBookClick(bookObj, 'issued')}
                      style={{ cursor: bookObj ? 'pointer' : 'default' }}
                    >
                      <div>
                        <div className="fw-semibold">
                          {loan.students?.full_name || 'Unknown'} ({loan.students?.student_id || '--'})
                        </div>
                        <div className="text-muted small">{loan.library_book_copies?.library_books?.title || 'Unknown'}</div>
                      </div>
                      <span className="library-status library-status--issued">
                        Due {loan.due_date || '--'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
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
                    {/* Book Title Section */}
                    <div className="mb-4 px-4">
                      <div className="text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.15em' }}>
                        Book Title
                      </div>
                      <h4 className="fw-bold text-dark mb-0" style={{ fontSize: '1.5rem' }}>
                        {selectedBook.title}
                      </h4>
                    </div>
                    
                    {/* Info Bar */}
                    <div className="row g-0 border-top border-bottom py-3 bg-light w-100">
                      <div className="col-6 border-end px-2">
                        <div className="text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.12em' }}>
                          Author
                        </div>
                        <div className="fw-semibold text-primary" style={{ fontSize: '1.05rem' }}>
                          {selectedBook.author}
                        </div>
                      </div>
                      <div className="col-6 px-2">
                        <div className="text-uppercase fw-bold text-muted mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.12em' }}>
                          Shelf Reference
                        </div>
                        <div className="fw-semibold text-dark" style={{ fontSize: '1.05rem' }}>
                          {selectedBook.shelf}
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
                            <div className="fs-4 fw-bold">{selectedBook.total}</div>
                          </div>
                        </div>
                        <div className="col-6 col-sm-3">
                          <div 
                            className={`p-3 border rounded text-center ${modalTab === 'issued' ? 'bg-primary text-white' : 'bg-light'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setModalTab('issued')}
                          >
                            <div className={`small text-uppercase fw-bold ${modalTab === 'issued' ? 'text-white-50' : 'text-muted'}`}>Issued</div>
                            <div className={`fs-4 fw-bold ${modalTab === 'issued' ? 'text-white' : 'text-primary'}`}>{selectedBook.issued}</div>
                          </div>
                        </div>
                        <div className="col-6 col-sm-3">
                          <div 
                            className={`p-3 border rounded text-center ${modalTab === 'damaged' ? 'bg-primary text-white' : 'bg-light'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setModalTab('damaged')}
                          >
                            <div className={`small text-uppercase fw-bold ${modalTab === 'damaged' ? 'text-white-50' : 'text-muted'}`}>Damaged</div>
                            <div className={`fs-4 fw-bold ${modalTab === 'damaged' ? 'text-white' : 'text-danger'}`}>{selectedBook.damaged}</div>
                          </div>
                        </div>
                        <div className="col-6 col-sm-3">
                          <div className="p-3 border rounded bg-light text-center">
                            <div className="small text-muted text-uppercase fw-bold">Balance</div>
                            <div className="fs-4 fw-bold text-success">{selectedBook.available}</div>
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
                                      <td>{loan.issued_at?.slice(0, 10)}</td>
                                      <td className={loan.due_date < todayString ? 'text-danger fw-bold' : ''}>
                                        {loan.due_date}
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