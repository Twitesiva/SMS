import { useEffect, useMemo, useState } from 'react'
import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { libraryNavGroups } from './nav'
import { supabase } from '../../../supabaseClient'

export default function Reports() {
  const [monthlySummary, setMonthlySummary] = useState([])
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
              <h5 className="mb-2">Inventory Summary</h5>
              <p className="text-muted small mb-3">Stock by category, location, and status.</p>
              <button className="btn btn-outline-primary w-100" type="button">Download</button>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card card-soft p-4 h-100">
              <h5 className="mb-2">Circulation Report</h5>
              <p className="text-muted small mb-3">Issued, returned, and renewals.</p>
              <button className="btn btn-outline-primary w-100" type="button">Download</button>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card card-soft p-4 h-100">
              <h5 className="mb-2">Overdue Report</h5>
              <p className="text-muted small mb-3">Pending returns and fine amounts.</p>
              <button className="btn btn-outline-primary w-100" type="button">Download</button>
            </div>
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <div className="card card-soft p-4 h-100">
              <h5 className="mb-2">Top Borrowed</h5>
              <p className="text-muted small mb-3">Most issued titles and trends.</p>
              <button className="btn btn-outline-primary w-100" type="button">Download</button>
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
