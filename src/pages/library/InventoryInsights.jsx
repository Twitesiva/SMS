import { useEffect, useMemo, useState } from 'react'
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

  const todayString = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    const loadInsights = async () => {
      setLoading(true)
      try {
        const [booksRes, copiesRes, issuedRes] = await Promise.all([
          supabase
            .from('library_books')
            .select('id, title, published_year, shelf_code, status')
            .order('created_at', { ascending: false }),
          supabase.from('library_book_copies').select('id, book_id'),
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
          return {
            id: book.id,
            title: book.title || 'Untitled',
            shelf: book.shelf_code || '--',
            total,
            issued: issuedCount,
            available: Math.max(0, total - issuedCount)
          }
        })

        const overdueCount = issued.filter((loan) => loan.due_date && loan.due_date < todayString).length

        const totalBooks = books.length
        const totalCopies = copies.length
        const issuedCopies = issued.length
        const availableBalance = Math.max(0, totalCopies - issuedCopies)

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
              <table className="table library-insights-table mb-0">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Shelf</th>
                    <th>Total</th>
                    <th>Issued</th>
                    <th className="text-end">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">Loading balance...</td>
                    </tr>
                  ) : balanceRows.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">No balance data available.</td>
                    </tr>
                  ) : (
                    balanceRows.slice(0, 10).map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="library-insights-title">{row.title}</div>
                        </td>
                        <td>{row.shelf}</td>
                        <td>{row.total}</td>
                        <td>{row.issued}</td>
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

    </div>
  )
}
