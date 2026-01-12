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
  const [bookDetails, setBookDetails] = useState({ copies: [], loans: [] })
  const [loadingDetails, setLoadingDetails] = useState(false)

  const activeLoansRef = useRef(null)
  const issuesRef = useRef(null)

  const todayString = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const handleBookClick = async (book) => {
    setSelectedBook(book)
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
            .select('id, title, published_year, shelf_code, status')
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
                        onClick={() => handleBookClick(row)} 
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div className="library-insights-title">{row.title}</div>
                        </td>
                        <td>{row.shelf}</td>
                        <td>{row.total}</td>
                        <td>{row.issued}</td>
                        <td>{row.damaged}</td>
                        <td className="text-end">
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
                {issuedLoans.map((loan) => (
                  <div key={loan.id} className="library-insights-issued-item">
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
                ))}
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
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title fw-bold">{selectedBook.title}</h5>
                    <div className="text-muted small">Shelf: {selectedBook.shelf}</div>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setSelectedBook(null)}></button>
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
                          <div className="p-3 border rounded bg-light text-center">
                            <div className="small text-muted text-uppercase fw-bold">Total</div>
                            <div className="fs-4 fw-bold">{selectedBook.total}</div>
                          </div>
                        </div>
                        <div className="col-6 col-sm-3">
                          <div 
                            className="p-3 border rounded bg-light text-center" 
                            style={{ cursor: 'pointer' }}
                            onClick={() => activeLoansRef.current?.scrollIntoView({ behavior: 'smooth' })}
                          >
                            <div className="small text-muted text-uppercase fw-bold">Issued</div>
                            <div className="fs-4 fw-bold text-primary">{selectedBook.issued}</div>
                          </div>
                        </div>
                        <div className="col-6 col-sm-3">
                          <div 
                            className="p-3 border rounded bg-light text-center" 
                            style={{ cursor: 'pointer' }}
                            onClick={() => issuesRef.current?.scrollIntoView({ behavior: 'smooth' })}
                          >
                            <div className="small text-muted text-uppercase fw-bold">Damaged</div>
                            <div className="fs-4 fw-bold text-danger">{selectedBook.damaged}</div>
                          </div>
                        </div>
                        <div className="col-6 col-sm-3">
                          <div className="p-3 border rounded bg-light text-center">
                            <div className="small text-muted text-uppercase fw-bold">Balance</div>
                            <div className="fs-4 fw-bold text-success">{selectedBook.available}</div>
                          </div>
                        </div>
                      </div>

                      {/* Active Loans */}
                      <div ref={activeLoansRef}>
                        <h6 className="fw-bold mb-3 border-bottom pb-2">Active Loans</h6>
                        {bookDetails.loans.length > 0 ? (
                          <div className="table-responsive">
                            <table className="table table-sm table-hover align-middle">
                              <thead className="table-light">
                                <tr>
                                  <th>Student</th>
                                  <th>Loan Date</th>
                                  <th>Due Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bookDetails.loans.map(loan => (
                                  <tr key={loan.id}>
                                    <td>
                                      <div className="fw-semibold">{loan.students?.full_name || 'Unknown'}</div>
                                      <div className="small text-muted">{loan.students?.student_id}</div>
                                    </td>
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

                      {/* Copies with Issues */}
                      <div ref={issuesRef}>
                        <h6 className="fw-bold mb-3 border-bottom pb-2">Copies with Issues</h6>
                        {bookDetails.copies.filter(c => ['MISSING', 'DAMAGED'].includes((c.availability || '').toUpperCase())).length > 0 ? (
                          <div className="table-responsive">
                            <table className="table table-sm table-hover align-middle">
                              <thead className="table-light">
                                <tr>
                                  <th>Copy ID</th>
                                  <th>Status</th>
                                  <th>Student ID</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bookDetails.copies
                                  .filter(c => ['MISSING', 'DAMAGED'].includes((c.availability || '').toUpperCase()))
                                  .map(copy => {
                                    const issueLoan = bookDetails.issueLoans?.find(l => l.library_book_copies?.id === copy.id)
                                    return (
                                      <tr key={copy.id}>
                                        <td className="font-monospace">{copy.id}</td>
                                        <td>
                                          <span className={`badge ${copy.availability === 'MISSING' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                            {copy.availability}
                                          </span>
                                        </td>
                                        <td className="small text-muted">
                                          {issueLoan ? (
                                            <>
                                              <div>{issueLoan.students?.full_name}</div>
                                              <div>{issueLoan.students?.student_id}</div>
                                            </>
                                          ) : '-'}
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