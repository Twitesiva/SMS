import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { libraryNavGroups } from './nav'
import { supabase } from '../../../supabaseClient'

export default function LibraryDashboard() {
  const nav = useNavigate()
  const [stats, setStats] = useState({
    totalBooks: null,
    issuedToday: null,
    overdueItems: null,
    activeMembers: null
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

        const [booksRes, studentsRes, issuedTodayRes, overdueRes, loansRes, finesRes] = await Promise.all([
          supabase.from('library_books').select('id', { count: 'exact', head: true }),
          supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
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
        if (studentsRes.error) throw studentsRes.error
        if (issuedTodayRes.error) throw issuedTodayRes.error
        if (overdueRes.error) throw overdueRes.error
        if (loansRes.error) throw loansRes.error
        if (finesRes.error) throw finesRes.error

        const allLoans = loansRes.data || []

        setStats({
          totalBooks: booksRes.count ?? 0,
          issuedToday: issuedTodayRes.count ?? 0,
          overdueItems: overdueRes.count ?? 0,
          activeMembers: studentsRes.count ?? 0
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
              detail: `${student?.full_name || 'Unknown'} (${student?.student_id || '--'}) · ${book?.title || 'Unknown'}`
            })
          }
          if (loan.returned_at) {
            events.push({
              id: `loan-returned-${loan.id}`,
              time: loan.returned_at,
              title: 'Book Returned',
              detail: `${student?.full_name || 'Unknown'} (${student?.student_id || '--'}) · ${book?.title || 'Unknown'}`
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
            detail: `${student?.full_name || 'Unknown'} (${student?.student_id || '--'}) · ${book?.title || 'Unknown'}`
          }
        })

        const mergedEvents = [...loanEvents, ...fineEvents]
          .filter((event) => event.time)
          .sort((a, b) => new Date(b.time) - new Date(a.time))
          .slice(0, 8)
        setActivityEvents(mergedEvents)
      } catch (error) {
        console.error('Failed to load library dashboard', error)
        setStats({ totalBooks: null, issuedToday: null, overdueItems: null, activeMembers: null })
        setRecentLoans([])
        setOverdueLoans([])
        setActivityEvents([])
      }
    }

    loadDashboard()
  }, [todayString])

  const formatStat = (value) => (value === null || value === undefined ? '--' : String(value))

  return (
    <AdminShell
      onSignOut={() => {
        nav('/roles')
        return true
      }}
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
            <h3 className="setup-hero-title mb-2">Vijayam Arts & Science College</h3>
            <p className="setup-hero-copy mb-3">Manage catalogues, lending, and returns with confidence.</p>
            <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
              <span className="setup-hero-chip text-uppercase">LIBRARY SERVICES</span>
              <span className="setup-hero-chip text-uppercase">CATALOG MANAGEMENT</span>
              <span className="setup-hero-chip text-uppercase">ISSUE & RETURN DESK</span>
            </div>
          </div>
        </section>

        <div className="row g-4 justify-content-center mx-0 mb-4">
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card card-soft p-3 h-100">
              <div className="text-muted small">Total Books</div>
              <div className="fs-3 fw-bold">{formatStat(stats.totalBooks)}</div>
              <div className="small text-muted">Library inventory</div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card card-soft p-3 h-100">
              <div className="text-muted small">Issued Today</div>
              <div className="fs-3 fw-bold">{formatStat(stats.issuedToday)}</div>
              <div className="small text-muted">New issues today</div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card card-soft p-3 h-100">
              <div className="text-muted small">Overdue Items</div>
              <div className="fs-3 fw-bold text-danger">{formatStat(stats.overdueItems)}</div>
              <div className="small text-muted">Pending returns</div>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card card-soft p-3 h-100">
              <div className="text-muted small">Active Members</div>
              <div className="fs-3 fw-bold">{formatStat(stats.activeMembers)}</div>
              <div className="small text-muted">Registered students</div>
            </div>
          </div>
        </div>

        <div className="row g-4 justify-content-center mx-0">
          <div className="col-12 col-lg-7">
            <div className="card card-soft p-4 h-100">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h5 className="mb-1">Recent Circulation</h5>
                  <p className="text-muted mb-0">Latest issue and return activity.</p>
                </div>
                <button type="button" className="btn btn-outline-secondary btn-sm">View All</button>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
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
                              <span className={`badge ${loan.status === 'ISSUED' ? 'bg-success-subtle text-success' : 'bg-info-subtle text-info'}`}>
                                {loan.status || 'Unknown'}
                              </span>
                            </td>
                            <td className="text-end">{loan.due_date || '--'}</td>
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
            <div className="card card-soft p-4 h-100">
              <h5 className="mb-3">Overdue Watchlist</h5>
              {overdueLoans.length === 0 ? (
                <div className="text-center text-muted py-4">No overdue items yet.</div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {overdueLoans.map((loan) => {
                    const student = loan.students
                    const book = loan.library_book_copies?.library_books
                    return (
                      <div key={loan.id} className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-semibold">{student?.full_name || 'Unknown'} ({student?.student_id || '--'})</div>
                          <div className="text-muted small">{book?.title || 'Unknown'}</div>
                        </div>
                        <span className="badge bg-danger">Overdue</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card card-soft p-4 mt-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-1">Activity Log</h5>
              <p className="text-muted mb-0">Latest library actions and updates.</p>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Activity</th>
                  <th>Details</th>
                  <th className="text-end">Time</th>
                </tr>
              </thead>
              <tbody>
                {activityEvents.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center text-muted py-4">No activity yet.</td>
                  </tr>
                ) : (
                  activityEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{event.title}</td>
                      <td>{event.detail}</td>
                      <td className="text-end">{event.time ? new Date(event.time).toLocaleString() : '--'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
