import { useEffect, useMemo, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { libraryNavGroups } from './nav'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

export default function Reports() {
  const [monthlySummary, setMonthlySummary] = useState([])
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const monthLabels = useMemo(() => {
    const now = new Date()
    const labels = []
    for (let i = 0; i < 3; i += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      labels.push({
        key,
        label: date.toLocaleString('en-US', { month: 'long' })
      })
    }
    return labels
  }, [])

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
        .select('id, title, author, language, publisher, published_year, shelf_code, status')
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
      const rows = (books || []).map((book) => ([
        book.title || '',
        book.author || '',
        book.language || '',
        book.publisher || '',
        book.published_year || '',
        book.shelf_code || '',
        book.status || '',
        copiesByBook[String(book.id)] || 0
      ]))

      downloadCsv('library-summary.csv', headers, rows)
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
          'issued_at, returned_at, due_date, status, students(full_name,student_id), library_book_copies(book_id, library_books(title))'
        )
        .order('issued_at', { ascending: false })

      if (error) throw error

      const headers = ['Student', 'Student ID', 'Book', 'Issued At', 'Returned At', 'Due Date', 'Status']
      const rows = (loans || []).map((loan) => ([
        loan.students?.full_name || '',
        loan.students?.student_id || '',
        loan.library_book_copies?.library_books?.title || '',
        loan.issued_at || '',
        loan.returned_at || '',
        loan.due_date || '',
        loan.status || ''
      ]))

      downloadCsv('circulation-report.csv', headers, rows)
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
      const rows = (loans || []).map((loan) => {
        const dueDateValue = loan.due_date ? new Date(loan.due_date) : null
        const daysOverdue = dueDateValue ? Math.max(0, Math.floor((today - dueDateValue) / (1000 * 60 * 60 * 24))) : 0
        return [
          loan.students?.full_name || '',
          loan.students?.student_id || '',
          loan.library_book_copies?.library_books?.title || '',
          loan.due_date || '',
          daysOverdue
        ]
      })

      downloadCsv('overdue-report.csv', headers, rows)
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
        .select('library_book_copies(book_id, library_books(title))')

      if (error) throw error

      const counts = (loans || []).reduce((acc, loan) => {
        const bookTitle = loan.library_book_copies?.library_books?.title || 'Unknown'
        acc[bookTitle] = (acc[bookTitle] || 0) + 1
        return acc
      }, {})

      const rows = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([title, total]) => [title, total])

      downloadCsv('top-borrowed.csv', ['Book Title', 'Total Issued'], rows)
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
          const issued = (loanRows || []).filter((loan) => String(loan.issued_at || '').slice(0, 7) === month.key).length
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
              <button className="btn btn-outline-primary w-100" type="button" onClick={handleLibrarySummaryDownload}>
                Download
              </button>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card card-soft p-4 h-100">
              <h5 className="mb-2">Circulation Report</h5>
              <p className="text-muted small mb-3">Issued, returned, and renewals.</p>
              <button className="btn btn-outline-primary w-100" type="button" onClick={handleCirculationDownload}>
                Download
              </button>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card card-soft p-4 h-100">
              <h5 className="mb-2">Overdue Report</h5>
              <p className="text-muted small mb-3">Pending returns and fine amounts.</p>
              <button className="btn btn-outline-primary w-100" type="button" onClick={handleOverdueDownload}>
                Download
              </button>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card card-soft p-4 h-100">
              <h5 className="mb-2">Top Borrowed</h5>
              <p className="text-muted small mb-3">Most issued titles and trends.</p>
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
              <p className="text-muted mb-0">Overview of library performance.</p>
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
                    <tr key={row.key}>
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
      </div>
    </AdminShell>
  )
}
