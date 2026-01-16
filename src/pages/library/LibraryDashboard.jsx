import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import './Library.css'

const formatDate = (dateStr) => {
  if (!dateStr) return '--'
  return dateStr.slice(0, 10).split('-').reverse().join('/')
}

export default function LibraryDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalBooks: null,
    issuedToday: null,
    overdueItems: null,
    issuedLast30Days: null
  })
  const [recentLoans, setRecentLoans] = useState([])
  const [overdueLoans, setOverdueLoans] = useState([])
  const [activityEvents, setActivityEvents] = useState([])

  const todayString = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date()
        endOfDay.setHours(23, 59, 59, 999)
        const now = new Date()
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(now.getDate() - 30)
        thirtyDaysAgo.setHours(0, 0, 0, 0)

        const [booksRes, issuedLast30DaysRes, issuedTodayRes, overdueRes, loansRes, finesRes] = await Promise.all([
          supabase.from('library_books').select('id', { count: 'exact', head: true }),
          supabase
            .from('library_loans')
            .select('id', { count: 'exact', head: true })
            .gte('issued_at', thirtyDaysAgo.toISOString())
            .lte('issued_at', now.toISOString()),
          supabase
            .from('library_loans')
            .select('id', { count: 'exact', head: true })
            .gte('issued_at', startOfDay.toISOString())
            .lte('issued_at', endOfDay.toISOString()),
          supabase
            .from('library_loans')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'ISSUED')
            .lt('due_date', todayString),
          supabase
            .from('library_loans')
            .select(
              'id, status, issued_at, due_date, returned_at, students(full_name,student_id), library_book_copies(book_id, library_books(title))'
            )
            .order('issued_at', { ascending: false })
            .limit(10),
          supabase
            .from('library_fines')
            .select('id, amount, created_at, status, students(full_name,student_id), library_loans(library_book_copies(book_id, library_books(title)))')
            .order('created_at', { ascending: false })
            .limit(10)
        ])

        if (booksRes.error) throw booksRes.error
        if (issuedLast30DaysRes.error) throw issuedLast30DaysRes.error
        if (issuedTodayRes.error) throw issuedTodayRes.error
        if (overdueRes.error) throw overdueRes.error
        if (loansRes.error) throw loansRes.error
        if (finesRes.error) throw finesRes.error

        const allLoans = loansRes.data || []

        setStats({
          totalBooks: booksRes.count ?? 0,
          issuedToday: issuedTodayRes.count ?? 0,
          overdueItems: overdueRes.count ?? 0,
          issuedLast30Days: issuedLast30DaysRes.count ?? 0
        })

        setRecentLoans(allLoans.slice(0, 5))

        const overdueList = allLoans
          .filter((loan) => loan.status === 'ISSUED' && loan.due_date && loan.due_date < todayString)
          .slice(0, 5)
        setOverdueLoans(overdueList)

        const loanEvents = (allLoans || []).flatMap((loan) => {
          const student = loan.students
          const book = loan.library_book_copies?.library_books
          const events = []
          if (loan.issued_at) {
            events.push({
              id: `loan-issued-${loan.id}`,
              time: loan.issued_at,
              title: 'Book Issued',
              studentName: student?.full_name || 'Unknown',
              studentId: student?.student_id || '--',
              bookTitle: book?.title || 'Unknown'
            })
          }
          if (loan.returned_at) {
            events.push({
              id: `loan-returned-${loan.id}`,
              time: loan.returned_at,
              title: 'Book Returned',
              studentName: student?.full_name || 'Unknown',
              studentId: student?.student_id || '--',
              bookTitle: book?.title || 'Unknown'
            })
          }
          return events
        })

        const fineEvents = (finesRes.data || []).map((fine) => {
          const student = fine.students
          const book = fine.library_loans?.library_book_copies?.library_books
          return {
            id: `fine-${fine.id}`,
            time: fine.created_at,
            title: fine.status === 'PAID' ? 'Fine Collected' : 'Fine Applied',
            studentName: student?.full_name || 'Unknown',
            studentId: student?.student_id || '--',
            bookTitle: book?.title || 'Unknown'
          }
        })

        const mergedEvents = [...loanEvents, ...fineEvents]
          .filter((event) => event.time)
          .sort((a, b) => new Date(b.time) - new Date(a.time))
          .slice(0, 8)
        setActivityEvents(mergedEvents)
      } catch (error) {
        console.error('Failed to load library dashboard', error)
        setStats({ totalBooks: null, issuedToday: null, overdueItems: null, issuedLast30Days: null })
        setRecentLoans([])
        setOverdueLoans([])
        setActivityEvents([])
      }
    }

    loadDashboard()
  }, [todayString])

  const formatStat = (value) => (value === null || value === undefined ? '--' : String(value))

  return (
    <div className="desktop-container library-dashboard-page" style={{ overflowX: 'hidden' }}>
      <section className="library-dashboard-hero">
        <div className="library-dashboard-hero__content">
          <div className="library-dashboard-hero__brand">
            <div className="library-dashboard-hero__crest" aria-hidden="true">
              <img src={crestPrimary} alt="Vijayam crest" />
            </div>
            <div>
              <div className="library-dashboard-hero__eyebrow">Library Control Center</div>
              <h3 className="library-dashboard-hero__title">Vijayam Arts & Science College</h3>
              <p className="library-dashboard-hero__subtitle">
                Manage catalogues, lending, and returns with confidence.
              </p>
            </div>
          </div>
          <div className="library-dashboard-hero__chips">
            <span>Library Services</span>
            <span>Catalog Management</span>
            <span>Issue & Return Desk</span>
          </div>
        </div>
      </section>

      <div className="library-dashboard-stats row g-3 mb-4">
        <div className="col-12 col-md-6 col-xl-3">
          <div 
            className="library-dashboard-stat"
            onClick={() => navigate('/library/inventory')}
            style={{ cursor: 'pointer' }}
          >
            <div className="library-dashboard-stat__label">Total Books Title</div>
            <div className="library-dashboard-stat__value">{formatStat(stats.totalBooks)}</div>
            <div className="library-dashboard-stat__meta">Library inventory</div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div 
            className="library-dashboard-stat"
            onClick={() => navigate('/library/circulation')}
            style={{ cursor: 'pointer' }}
          >
            <div className="library-dashboard-stat__label">Issued Today</div>
            <div className="library-dashboard-stat__value">{formatStat(stats.issuedToday)}</div>
            <div className="library-dashboard-stat__meta">New issues today</div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div 
            className="library-dashboard-stat"
            onClick={() => navigate('/library/circulation')}
            style={{ cursor: 'pointer' }}
          >
            <div className="library-dashboard-stat__label">Overdue Items</div>
            <div className="library-dashboard-stat__value library-dashboard-stat__value--danger">
              {formatStat(stats.overdueItems)}
            </div>
            <div className="library-dashboard-stat__meta">Pending returns</div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div 
            className="library-dashboard-stat"
            onClick={() => navigate('/library/reports')}
            style={{ cursor: 'pointer' }}
          >
            <div className="library-dashboard-stat__label">Overall Issued (last 30 days)</div>
            <div className="library-dashboard-stat__value">{formatStat(stats.issuedLast30Days)}</div>
            <div className="library-dashboard-stat__meta">Total issues in period</div>
          </div>
        </div>
      </div>

      <div className="row g-4 justify-content-center mx-0">
        <div className="col-12 col-lg-7">
          <div className="library-dashboard-panel h-100">
            <div className="library-dashboard-panel__header">
              <div>
                <h5 className="mb-1">Recent Circulation</h5>
                <p className="text-muted mb-0">Latest issue and return activity.</p>
              </div>
              <button type="button" className="btn btn-outline-secondary btn-sm">View All</button>
            </div>
            <div className="table-responsive">
              <table className="table library-dashboard-table mb-0">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Book</th>
                    <th>Status</th>
                    <th className="text-end">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLoans.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-4">No circulation activity yet.</td>
                    </tr>
                  ) : (
                    recentLoans.map((loan) => {
                      const student = loan.students
                      const book = loan.library_book_copies?.library_books
                      return (
                        <tr key={loan.id}>
                          <td>{student?.full_name || 'Unknown'} ({student?.student_id || '--'})</td>
                          <td>{book?.title || 'Unknown'}</td>
                          <td>
                            <span
                              className={`library-status ${loan.status === 'ISSUED' ? 'library-status--issued' : 'library-status--returned'}`}
                            >
                              {loan.status || 'Unknown'}
                            </span>
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
        <div className="col-12 col-lg-5">
          <div className="library-dashboard-panel h-100">
            <div className="library-dashboard-panel__header">
              <div>
                <h5 className="mb-1">Overdue Watchlist</h5>
                <p className="text-muted mb-0">Members with pending returns.</p>
              </div>
            </div>
            {overdueLoans.length === 0 ? (
              <div className="text-center text-muted py-4">No overdue items yet.</div>
            ) : (
              <div className="library-dashboard-overdue-list">
                {overdueLoans.map((loan) => {
                  const student = loan.students
                  const book = loan.library_book_copies?.library_books
                  return (
                    <div key={loan.id} className="library-dashboard-overdue-item">
                      <div>
                        <div className="fw-semibold">{student?.full_name || 'Unknown'} ({student?.student_id || '--'})</div>
                        <div className="text-muted small">{book?.title || 'Unknown'}</div>
                      </div>
                      <span className="library-status library-status--overdue">Overdue</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="library-dashboard-panel mt-4">
        <div className="library-dashboard-panel__header">
          <div>
            <h5 className="mb-1">Activity Log</h5>
            <p className="text-muted mb-0">Latest library actions and updates.</p>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table library-dashboard-table mb-0 activity-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Member</th>
                <th>Book</th>
                <th className="text-end">Time</th>
              </tr>
            </thead>
            <tbody>
              {activityEvents.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center text-muted py-4">No activity yet.</td>
                </tr>
              ) : (
                activityEvents.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <span className={`activity-badge ${event.title === 'Book Issued' ? 'is-issued' : event.title === 'Book Returned' ? 'is-returned' : 'is-fine'}`}>
                        {event.title}
                      </span>
                    </td>
                    <td>
                      <div className="activity-name">
                        {event.studentName || 'Unknown'} <span>({event.studentId || '--'})</span>
                      </div>
                    </td>
                    <td>
                      <div className="activity-book fw-bold text-dark">{event.bookTitle || 'Unknown'}</div>
                    </td>
                    <td className="text-end activity-time">
                      {event.time ? new Date(event.time).toLocaleString('en-GB') : '--'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
