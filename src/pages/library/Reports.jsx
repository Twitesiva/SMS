import { useEffect, useMemo, useState } from 'react'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dateStr.slice(0, 10).split('-').reverse().join('/')
}

export default function Reports() {
  const [monthlySummary, setMonthlySummary] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [reportDetails, setReportDetails] = useState({
    issued: [],
    returned: [],
    overdue: [],
    damaged: [],
    missing: [],
    loading: false
  })
  const [activeTab, setActiveTab] = useState('issued')
  const [summaryFilter, setSummaryFilter] = useState('all')
  const [circulationFilter, setCirculationFilter] = useState('all')
  const [overdueFilter, setOverdueFilter] = useState('all')
  const [topBorrowedLimit, setTopBorrowedLimit] = useState('20')
  const [monthFilter, setMonthFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const monthOptions = useMemo(
    () => [
      { value: 'all', label: 'All months' },
      { value: '01', label: 'Jan' },
      { value: '02', label: 'Feb' },
      { value: '03', label: 'Mar' },
      { value: '04', label: 'Apr' },
      { value: '05', label: 'May' },
      { value: '06', label: 'Jun' },
      { value: '07', label: 'Jul' },
      { value: '08', label: 'Aug' },
      { value: '09', label: 'Sep' },
      { value: '10', label: 'Oct' },
      { value: '11', label: 'Nov' },
      { value: '12', label: 'Dec' }
    ],
    []
  )

  const matchesMonthYear = (value) => {
    const key = String(value || '').slice(0, 7)
    const [year, month] = key.split('-')
    if (yearFilter && yearFilter !== 'all' && year !== yearFilter) return false
    if (monthFilter !== 'all' && month !== monthFilter) return false
    return true
  }
  const monthLabels = useMemo(() => {
    const now = new Date()
    const labels = []
    for (let i = 0; i < 3; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      labels.push({
        key,
        label: date.toLocaleString('en-US', { month: 'short', year: 'numeric' })
      })
    }
    return labels
  }, [])

  const handleMonthClick = async (month) => {
    setSelectedMonth(month)
    setReportDetails({
      issued: [],
      returned: [],
      overdue: [],
      damaged: [],
      missing: [],
      loading: true
    })
    setActiveTab('issued')

    try {
      const [year, m] = month.key.split('-').map(Number)
      const startDate = new Date(year, m - 1, 1).toISOString().slice(0, 10)
      const endDate = new Date(year, m, 1).toISOString().slice(0, 10)

      const selectQuery = `
        id,
        issued_at,
        returned_at,
        due_date,
        status,
        students (full_name, student_id),
        library_book_copies (
          book_id,
          library_books (title, author, shelf_code)
        )
      `

      const [issuedRes, returnedRes, overdueRes, damagedRes, missingRes] = await Promise.all([
        supabase
          .from('library_loans')
          .select(selectQuery)
          .gte('issued_at', startDate)
          .lt('issued_at', endDate)
          .eq('status', 'ISSUED')
          .order('issued_at', { ascending: false }),
        supabase
          .from('library_loans')
          .select(selectQuery)
          .gte('returned_at', startDate)
          .lt('returned_at', endDate)
          .order('returned_at', { ascending: false }),
        supabase
          .from('library_loans')
          .select(selectQuery)
          .eq('status', 'ISSUED')
          .gte('due_date', startDate)
          .lt('due_date', endDate)
          .order('due_date', { ascending: true }),
        supabase
          .from('library_loans')
          .select(selectQuery)
          .gte('issued_at', startDate)
          .lt('issued_at', endDate)
          .eq('status', 'DAMAGED')
          .order('issued_at', { ascending: false }),
        supabase
          .from('library_loans')
          .select(selectQuery)
          .gte('issued_at', startDate)
          .lt('issued_at', endDate)
          .eq('status', 'MISSING')
          .order('issued_at', { ascending: false })
      ])

      if (issuedRes.error) throw issuedRes.error
      if (returnedRes.error) throw returnedRes.error
      if (overdueRes.error) throw overdueRes.error
      if (damagedRes.error) throw damagedRes.error
      if (missingRes.error) throw missingRes.error

      setReportDetails({
        issued: issuedRes.data || [],
        returned: returnedRes.data || [],
        overdue: overdueRes.data || [],
        damaged: damagedRes.data || [],
        missing: missingRes.data || [],
        loading: false
      })
    } catch (error) {
      console.error('Failed to fetch month details', error)
      showToast('Unable to load details.', { type: 'danger' })
      setReportDetails((prev) => ({ ...prev, loading: false }))
    }
  }

  const closeReportModal = () => {
    setSelectedMonth(null)
    setReportDetails({
      issued: [],
      returned: [],
      overdue: [],
      damaged: [],
      missing: [],
      loading: false
    })
  }

  const downloadCsv = (filename, headers, rows) => {
    const escapeCell = (value) => {
      const safe = value === null || value === undefined ? '' : String(value)
      return `"${safe.replace(/"/g, '""')}"`
    }
    const csv = [
      headers.map(escapeCell).join(','),
      ...rows.map((row) => row.map(escapeCell).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleLibrarySummaryDownload = async () => {
    try {
      const { data: books, error: bookError } = await supabase
        .from('library_books')
        .select('id, title, author, language, publisher, published_year, shelf_code, status, created_at')
        .order('created_at', { ascending: false })

      if (bookError) throw bookError

      const bookIds = (books || []).map((row) => row.id)
      let copiesByBook = {}
      if (bookIds.length > 0) {
        const { data: copies, error: copyError } = await supabase
          .from('library_book_copies')
          .select('book_id')
          .in('book_id', bookIds)

        if (copyError) throw copyError
        copiesByBook = (copies || []).reduce((acc, row) => {
          const key = String(row.book_id)
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {})
      }

      const headers = ['Title', 'Author', 'Language', 'Publisher', 'Year', 'Shelf', 'Status', 'Copies']
      const filteredBooks = (books || []).filter((book) => {
        const copyCount = copiesByBook[String(book.id)] || 0
        const statusValue = (book.status || '').toUpperCase()
        if (!matchesMonthYear(book.created_at)) return false
        if (summaryFilter === 'available') return copyCount > 0
        if (summaryFilter === 'out') return copyCount === 0
        if (summaryFilter === 'public') return statusValue === 'PUBLIC'
        if (summaryFilter === 'private') return statusValue === 'PRIVATE'
        return true
      })

      if (filteredBooks.length === 0) {
        showToast('No records match the selected filter.', { type: 'warning' })
        return
      }

      const rows = filteredBooks.map((book) => ([
        book.title || '',
        book.author || '',
        book.language || '',
        book.publisher || '',
        book.published_year || '',
        book.shelf_code || '',
        book.status || '',
        copiesByBook[String(book.id)] || 0
      ]))

      const suffix = summaryFilter === 'all' ? '' : `-${summaryFilter}`
      downloadCsv(`library-summary${suffix}.csv`, headers, rows)
      showToast('Library summary downloaded.', { type: 'success' })
    } catch (error) {
      console.error('Failed to download library summary', error)
      showToast('Unable to download library summary.', { type: 'danger' })
    }
  }

  const handleCirculationDownload = async () => {
    try {
      const { data: loans, error } = await supabase
        .from('library_loans')
        .select(
          'issued_at, returned_at, due_date, status, students(full_name,student_id), library_book_copies(book_id, library_books(title, author, shelf_code))'
        )
        .order('issued_at', { ascending: false })

      if (error) throw error

      const filteredLoans = (loans || []).filter((loan) => {
        const status = (loan.status || '').toUpperCase()
        const dueDateValue = loan.due_date ? new Date(loan.due_date) : null
        const isOverdue = dueDateValue ? (new Date(todayIso) > dueDateValue && status === 'ISSUED') : false

        if (!matchesMonthYear(loan.issued_at || loan.returned_at || loan.due_date)) return false

        if (circulationFilter === 'issued') return status === 'ISSUED'
        if (circulationFilter === 'returned') return status === 'RETURNED'
        if (circulationFilter === 'damaged') return status === 'DAMAGED'
        if (circulationFilter === 'missing') return status === 'MISSING'
        if (circulationFilter === 'overdue') return isOverdue
        return true
      })

      if (filteredLoans.length === 0) {
        showToast('No circulation records match the selected filter.', { type: 'warning' })
        return
      }

      const headers = ['Student', 'Student ID', 'Book', 'Author', 'Shelf', 'Issued At', 'Returned At', 'Due Date', 'Status']
      const rows = filteredLoans.map((loan) => ([
        loan.students?.full_name || '',
        loan.students?.student_id || '',
        loan.library_book_copies?.library_books?.title || '',
        loan.library_book_copies?.library_books?.author || '',
        loan.library_book_copies?.library_books?.shelf_code || '',
        formatDate(loan.issued_at),
        formatDate(loan.returned_at),
        formatDate(loan.due_date),
        loan.status || ''
      ]))

      const suffix = circulationFilter === 'all' ? '' : `-${circulationFilter}`
      downloadCsv(`circulation-report${suffix}.csv`, headers, rows)
      showToast('Circulation report downloaded.', { type: 'success' })
    } catch (error) {
      console.error('Failed to download circulation report', error)
      showToast('Unable to download circulation report.', { type: 'danger' })
    }
  }

  const handleOverdueDownload = async () => {
    try {
      const { data: loans, error } = await supabase
        .from('library_loans')
        .select(
          'due_date, status, students(full_name,student_id), library_book_copies(book_id, library_books(title))'
        )
        .eq('status', 'ISSUED')
        .lt('due_date', todayIso)
        .order('due_date', { ascending: true })

      if (error) throw error

      const headers = ['Student', 'Student ID', 'Book', 'Due Date', 'Days Overdue']
      const today = new Date()
      const filtered = (loans || []).map((loan) => {
        const dueDateValue = loan.due_date ? new Date(loan.due_date) : null
        const daysOverdue = dueDateValue ? Math.max(0, Math.floor((today - dueDateValue) / (1000 * 60 * 60 * 24))) : 0
        return {
          row: [
            loan.students?.full_name || '',
            loan.students?.student_id || '',
            loan.library_book_copies?.library_books?.title || '',
            formatDate(loan.due_date),
            daysOverdue
          ],
          daysOverdue,
          dueKey: String(loan.due_date || '').slice(0, 7)
        }
      }).filter(({ daysOverdue, dueKey }) => {
        if (!matchesMonthYear(`${dueKey}-01`)) return false
        if (overdueFilter === 'week') return daysOverdue <= 7
        if (overdueFilter === 'month') return daysOverdue > 7 && daysOverdue <= 30
        if (overdueFilter === 'overMonth') return daysOverdue > 30
        return true
      })

      if (filtered.length === 0) {
        showToast('No overdue records match the selected filter.', { type: 'warning' })
        return
      }

      const rows = filtered.map(({ row }) => row)

      const suffix = overdueFilter === 'all' ? '' : `-${overdueFilter}`
      downloadCsv(`overdue-report${suffix}.csv`, headers, rows)
      showToast('Overdue report downloaded.', { type: 'success' })
    } catch (error) {
      console.error('Failed to download overdue report', error)
      showToast('Unable to download overdue report.', { type: 'danger' })
    }
  }

  const handleTopBorrowedDownload = async () => {
    try {
      const { data: loans, error } = await supabase
        .from('library_loans')
        .select('issued_at, library_book_copies(book_id, library_books(title))')

      if (error) throw error

      const counts = (loans || []).reduce((acc, loan) => {
        if (!matchesMonthYear(loan.issued_at)) return acc
        const bookTitle = loan.library_book_copies?.library_books?.title || 'Unknown'
        acc[bookTitle] = (acc[bookTitle] || 0) + 1
        return acc
      }, {})

      const rows = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topBorrowedLimit === 'all' ? undefined : Number(topBorrowedLimit))
        .map(([title, total]) => [title, total])

      if (rows.length === 0) {
        showToast('No borrowed records available.', { type: 'warning' })
        return
      }

      const suffix = topBorrowedLimit === 'all' ? '' : `-top${topBorrowedLimit}`
      downloadCsv(`top-borrowed${suffix}.csv`, ['Book Title', 'Total Issued'], rows)
      showToast('Top borrowed report downloaded.', { type: 'success' })
    } catch (error) {
      console.error('Failed to download top borrowed report', error)
      showToast('Unable to download top borrowed report.', { type: 'danger' })
    }
  }

  useEffect(() => {
    const loadReports = async () => {
      try {
        const { data: loanRows, error: loanError } = await supabase
          .from('library_loans')
          .select('issued_at, returned_at, due_date, status')

        if (loanError) throw loanError

        const { data: fineRows, error: fineError } = await supabase
          .from('library_fines')
          .select('paid_at, amount, status')

        if (fineError) throw fineError

        const summary = monthLabels.map((month) => {
          const issued = (loanRows || []).filter((loan) => String(loan.issued_at || '').slice(0, 7) === month.key && loan.status === 'ISSUED').length
          const returned = (loanRows || []).filter((loan) => String(loan.returned_at || '').slice(0, 7) === month.key).length
          const overdue = (loanRows || []).filter((loan) => {
            const dueKey = String(loan.due_date || '').slice(0, 7)
            return dueKey === month.key && loan.status === 'ISSUED'
          }).length
          const fines = (fineRows || [])
            .filter((fine) => fine.status === 'PAID' && String(fine.paid_at || '').slice(0, 7) === month.key)
            .reduce((sum, fine) => sum + Number(fine.amount || 0), 0)

          return {
            key: month.key,
            label: month.label,
            issued,
            returned,
            overdue,
            fines
          }
        })

        setMonthlySummary(summary)
      } catch (error) {
        console.error('Failed to load reports', error)
        setMonthlySummary([])
      }
    }

    loadReports()
  }, [monthLabels])
  return (
    <div className="desktop-container" style={{ overflowX: 'hidden' }}>
      <section className="setup-hero mb-4 text-center">
        <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
          <div className="admin-applications__crest mx-auto" aria-hidden="true">
            <img src={crestPrimary} alt="Vijayam crest" />
          </div>
          <h3 className="setup-hero-title mb-2">Library Reports</h3>
          <p className="setup-hero-copy mb-3">Generate insight reports for inventory and circulation.</p>
          <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
            <span className="setup-hero-chip text-uppercase">INVENTORY</span>
            <span className="setup-hero-chip text-uppercase">CIRCULATION</span>
            <span className="setup-hero-chip text-uppercase">ANALYTICS</span>
          </div>
        </div>
      </section>

      <div className="row g-4 justify-content-center mx-0">
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card card-soft p-4 h-100">
            <h5 className="mb-2">Library Summary</h5>
            <p className="text-muted small mb-3">Stock by category, location, and status.</p>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Filter</label>
              <select
                className="form-select form-select-sm"
                value={summaryFilter}
                onChange={(e) => setSummaryFilter(e.target.value)}
              >
                <option value="all">All stock</option>
                <option value="available">Available copies</option>
                <option value="out">Out of stock</option>
                <option value="public">Public status</option>
                <option value="private">Private status</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Month</label>
              <select
                className="form-select form-select-sm"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Year</label>
              <input
                className="form-control form-control-sm"
                type="number"
                min="1900"
                max="9999"
                placeholder="All years"
                value={yearFilter === 'all' ? '' : yearFilter}
                onChange={(e) => setYearFilter(e.target.value.trim() || 'all')}
              />
            </div>
            <button className="btn btn-outline-primary w-100" type="button" onClick={handleLibrarySummaryDownload}>
              Download
            </button>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card card-soft p-4 h-100">
            <h5 className="mb-2">Circulation Report</h5>
            <p className="text-muted small mb-3">Issued, returned, and renewals.</p>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Filter</label>
              <select
                className="form-select form-select-sm"
                value={circulationFilter}
                onChange={(e) => setCirculationFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="issued">Issued</option>
                <option value="returned">Returned</option>
                <option value="overdue">Overdue</option>
                <option value="damaged">Damaged</option>
                <option value="missing">Missing</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Month</label>
              <select
                className="form-select form-select-sm"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Year</label>
              <input
                className="form-control form-control-sm"
                type="number"
                min="1900"
                max="9999"
                placeholder="All years"
                value={yearFilter === 'all' ? '' : yearFilter}
                onChange={(e) => setYearFilter(e.target.value.trim() || 'all')}
              />
            </div>
            <button className="btn btn-outline-primary w-100" type="button" onClick={handleCirculationDownload}>
              Download
            </button>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card card-soft p-4 h-100">
            <h5 className="mb-2">Overdue Report</h5>
            <p className="text-muted small mb-3">Pending returns and fine amounts.</p>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Filter</label>
              <select
                className="form-select form-select-sm"
                value={overdueFilter}
                onChange={(e) => setOverdueFilter(e.target.value)}
              >
                <option value="all">All overdue</option>
                <option value="week">Up to 7 days</option>
                <option value="month">8-30 days</option>
                <option value="overMonth">Over 30 days</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Month</label>
              <select
                className="form-select form-select-sm"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Year</label>
              <input
                className="form-control form-control-sm"
                type="number"
                min="1900"
                max="9999"
                placeholder="All years"
                value={yearFilter === 'all' ? '' : yearFilter}
                onChange={(e) => setYearFilter(e.target.value.trim() || 'all')}
              />
            </div>
            <button className="btn btn-outline-primary w-100" type="button" onClick={handleOverdueDownload}>
              Download
            </button>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <div className="card card-soft p-4 h-100">
            <h5 className="mb-2">Top Borrowed</h5>
            <p className="text-muted small mb-3">Most issued titles and trends.</p>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Limit</label>
              <select
                className="form-select form-select-sm"
                value={topBorrowedLimit}
                onChange={(e) => setTopBorrowedLimit(e.target.value)}
              >
                <option value="10">Top 10</option>
                <option value="20">Top 20</option>
                <option value="50">Top 50</option>
                <option value="100">Top 100</option>
                <option value="all">All</option>
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Month</label>
              <select
                className="form-select form-select-sm"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small text-muted mb-1">Year</label>
              <input
                className="form-control form-control-sm"
                type="number"
                min="1900"
                max="9999"
                placeholder="All years"
                value={yearFilter === 'all' ? '' : yearFilter}
                onChange={(e) => setYearFilter(e.target.value.trim() || 'all')}
              />
            </div>
            <button className="btn btn-outline-primary w-100" type="button" onClick={handleTopBorrowedDownload}>
              Download
            </button>
          </div>
        </div>
      </div>

      <div className="card card-soft p-4 mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h5 className="mb-1">Monthly Summary</h5>
            <p className="text-muted mb-0">Last 3 months overview.</p>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm">Export</button>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Month</th>
                <th>Issued</th>
                <th>Returned</th>
                <th>Overdue</th>
                <th className="text-end">Fines</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted py-4">No report data loaded.</td>
                </tr>
              ) : (
                monthlySummary.map((row) => (
                  <tr
                    key={row.key}
                    onClick={() => handleMonthClick(row)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{row.label}</td>
                    <td>{row.issued}</td>
                    <td>{row.returned}</td>
                    <td>{row.overdue}</td>
                    <td className="text-end">Rs. {row.fines}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedMonth && (
        <div className="students-modal-overlay">
          <div className="students-modal-dialog" style={{ maxWidth: '900px' }}>
            <div className="students-modal-content">
              <div className="students-modal-header">
                <div>
                  <div className="students-modal-header-eyebrow">MONTHLY REPORT</div>
                  <div className="students-modal-header-title">{selectedMonth.label}</div>
                </div>
                <button className="students-modal-close" onClick={closeReportModal}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
              <div className="students-modal-body">
                {reportDetails.loading ? (
                  <div className="text-center py-5 text-muted">Loading details...</div>
                ) : (
                  <>
                    <div className="d-flex gap-2 mb-3">
                      <button
                        className={`btn btn-sm ${activeTab === 'issued' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('issued')}
                      >
                        Issued ({reportDetails.issued.length})
                      </button>
                      <button
                        className={`btn btn-sm ${activeTab === 'returned' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('returned')}
                      >
                        Returned ({reportDetails.returned.length})
                      </button>
                      <button
                        className={`btn btn-sm ${activeTab === 'overdue' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('overdue')}
                      >
                        Overdue ({reportDetails.overdue.length})
                      </button>
                      <button
                        className={`btn btn-sm ${activeTab === 'damaged' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('damaged')}
                      >
                        Damaged ({reportDetails.damaged.length})
                      </button>
                      <button
                        className={`btn btn-sm ${activeTab === 'missing' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('missing')}
                      >
                        Missed ({reportDetails.missing.length})
                      </button>
                    </div>

                    <div className="table-responsive bg-white rounded border">
                      <table className="table table-hover mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Issued</th>
                            <th>Returned</th>
                            <th>Student</th>
                            <th>Book Title</th>
                            <th>Author</th>
                            <th>Shelf</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reportDetails[activeTab] || []).length === 0 ? (
                            <tr>
                              <td colSpan="7" className="text-center py-4 text-muted">
                                No records found for this category.
                              </td>
                            </tr>
                          ) : (
                            (reportDetails[activeTab] || []).map((item) => (
                              <tr key={item.id}>
                                <td>{formatDate(item.issued_at)}</td>
                                <td>{formatDate(item.returned_at)}</td>
                                <td>
                                  <div className="fw-semibold">{item.students?.full_name || 'Unknown'}</div>
                                  <div className="small text-muted">{item.students?.student_id || '-'}</div>
                                </td>
                                <td>{item.library_book_copies?.library_books?.title || 'Unknown Title'}</td>
                                <td>{item.library_book_copies?.library_books?.author || '-'}</td>
                                <td>{item.library_book_copies?.library_books?.shelf_code || '-'}</td>
                                <td>
                                  <span className={`badge ${ 
                                    item.status === 'ISSUED' ? 'bg-warning text-dark' :
                                    item.status === 'RETURNED' ? 'bg-success' :
                                    item.status === 'DAMAGED' ? 'bg-danger' :
                                    item.status === 'MISSING' ? 'bg-dark' : 'bg-secondary'
                                  }`}> 
                                    {item.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
