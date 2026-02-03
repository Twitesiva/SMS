import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../supabaseClient'
import StudentShell from '../../components/StudentShell'
import { useStudentAuth } from '../../store/studentAuth'
import './Student.css'

const formatDate = (value) => {
  if (!value) return 'N/A'
  return value.slice(0, 10).split('-').reverse().join('/')
}

export default function StudentLibrary() {
  const { student } = useStudentAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [loans, setLoans] = useState([])

  useEffect(() => {
    if (!student?.id) {
      setError('Please sign in to view your library details.')
      setLoans([])
      setFines([])
      return
    }

    const loadLibraryDetails = async () => {
      setLoading(true)
      setError('')
      setWarning('')
      setLoans([])

      try {
        const studentKey = (student.student_id || student.id || '').toString().trim()
        if (!studentKey) {
          setWarning('Student ID is not available for library lookup.')
          return
        }

        const { data: loanRows, error: loanError } = await supabase
          .from('library_loans')
          .select(`
            id,
            status,
            issued_at,
            due_date,
            returned_at,
            library_book_copies (
              library_books (title)
            )
          `)
          .eq('student_id', studentKey)
          .order('issued_at', { ascending: false })

        if (loanError) throw loanError
        setLoans(loanRows || [])

      } catch (err) {
        console.error(err)
        setError(err?.message || 'Unable to load library details right now.')
        setLoans([])
      } finally {
        setLoading(false)
      }
    }

    loadLibraryDetails()
  }, [student?.id, student?.student_id])

  const issuedLoans = useMemo(
    () => loans.filter((loan) => (loan.status || '').toUpperCase() === 'ISSUED'),
    [loans]
  )

  const overdueLoans = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return issuedLoans.filter((loan) => loan.due_date && loan.due_date < today)
  }, [issuedLoans])

  const returnedLoans = useMemo(
    () =>
      loans.filter((loan) => {
        const status = (loan.status || '').toString().toUpperCase()
        return status === 'RETURNED' || status === 'MISSING' || status === 'DAMAGED'
      }),
    [loans]
  )

  const nextDueDate = useMemo(() => {
    const dueDates = issuedLoans.map((loan) => loan.due_date).filter(Boolean)
    if (!dueDates.length) return 'N/A'
    return formatDate(dueDates.sort()[0])
  }, [issuedLoans])

  const lastIssuedDate = useMemo(() => {
    const issuedDates = loans.map((loan) => loan.issued_at).filter(Boolean)
    if (!issuedDates.length) return 'N/A'
    return formatDate(issuedDates.sort().reverse()[0])
  }, [loans])

  const lastReturnedDate = useMemo(() => {
    const returnedDates = loans
      .map((loan) => loan.returned_at)
      .filter(Boolean)
    if (!returnedDates.length) return 'N/A'
    return formatDate(returnedDates.sort().reverse()[0])
  }, [loans])

  return (
    <StudentShell>
      <div className="students-section-shell">
        {warning && !loading && !error && (
          <div className="student-details__status">{warning}</div>
        )}

        {loading && (
          <div className="student-details__loading" role="status" aria-live="polite">
            <div className="student-details__loading-header">
              <div className="student-loader__spinner" aria-hidden="true"></div>
              <div>
                <div className="student-loader__title">Loading library data</div>
                <div className="student-loader__subtitle">Fetching loans and fines.</div>
              </div>
            </div>
            <div className="student-details__loading-grid" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="student-loader-card" key={`library-loader-${index}`}>
                  <div className="student-loader-card__header student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                  <div className="student-loader-card__line student-loader__shimmer"></div>
                </div>
              ))}
            </div>
            <span className="sr-only">Loading library details...</span>
          </div>
        )}

        {error && !loading && (
          <div className="student-details__status student-details__status--error">{error}</div>
        )}

        {!loading && !error && (
          <>
            <div className="student-card mb-4">
              <div className="student-card__header">Library Details</div>
              <div className="student-card__body">
                <div className="student-details-grid">
                  <div className="student-details-grid__item">
                    <div className="student-details-grid__label">Active Loans</div>
                    <div className="student-details-grid__value">{issuedLoans.length}</div>
                  </div>
                  <div className="student-details-grid__item">
                    <div className="student-details-grid__label">Overdue</div>
                    <div className="student-details-grid__value">{overdueLoans.length}</div>
                  </div>
                  <div className="student-details-grid__item">
                    <div className="student-details-grid__label">Last Issued</div>
                    <div className="student-details-grid__value">{lastIssuedDate}</div>
                  </div>
                  <div className="student-details-grid__item">
                    <div className="student-details-grid__label">Next Due Date</div>
                    <div className="student-details-grid__value">{nextDueDate}</div>
                  </div>
                  <div className="student-details-grid__item">
                    <div className="student-details-grid__label">Last Returned</div>
                    <div className="student-details-grid__value">{lastReturnedDate}</div>
                  </div>
                </div>
              </div>
            </div>

            {issuedLoans.length === 0 ? (
              <div className="student-details__status">No active library loans found.</div>
            ) : (
              <div className="student-payments-table-wrapper mb-4">
                <table className="student-payments-table">
                  <thead>
                    <tr>
                      <th>Book Title</th>
                      <th>Issued Date</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issuedLoans.map((loan) => {
                      const isOverdue = overdueLoans.includes(loan)
                      return (
                        <tr key={loan.id}>
                          <td>{loan.library_book_copies?.library_books?.title || 'Unknown'}</td>
                          <td>{formatDate(loan.issued_at)}</td>
                          <td style={{ color: isOverdue ? '#b91c1c' : undefined, fontWeight: isOverdue ? 700 : 500 }}>
                            {formatDate(loan.due_date)}
                          </td>
                          <td>
                            <span className={`student-payments-badge student-payments-badge--${isOverdue ? 'warning' : 'success'}`}>
                              {isOverdue ? 'Overdue' : 'Issued'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {overdueLoans.length === 0 ? (
              <div className="student-details__status">No overdue books found.</div>
            ) : (
              <div className="student-payments-table-wrapper mb-4">
                <table className="student-payments-table">
                  <thead>
                    <tr>
                      <th>Book Title</th>
                      <th>Issued Date</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueLoans.map((loan) => (
                      <tr key={`overdue-${loan.id}`}>
                        <td>{loan.library_book_copies?.library_books?.title || 'Unknown'}</td>
                        <td>{formatDate(loan.issued_at)}</td>
                        <td style={{ color: '#b91c1c', fontWeight: 700 }}>{formatDate(loan.due_date)}</td>
                        <td>
                          <span className="student-payments-badge student-payments-badge--warning">Overdue</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {returnedLoans.length === 0 ? (
              <div className="student-details__status">No return history found.</div>
            ) : (
              <div className="student-payments-table-wrapper">
                <table className="student-payments-table">
                  <thead>
                    <tr>
                      <th>Book Title</th>
                      <th>Issued Date</th>
                      <th>Returned Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnedLoans.map((loan) => (
                      <tr key={`returned-${loan.id}`}>
                        <td>{loan.library_book_copies?.library_books?.title || 'Unknown'}</td>
                        <td>{formatDate(loan.issued_at)}</td>
                        <td>{formatDate(loan.returned_at)}</td>
                        <td>
                          <span className="student-payments-badge student-payments-badge--success">
                            {(loan.status || 'Returned').toString().toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </StudentShell>
  )
}
