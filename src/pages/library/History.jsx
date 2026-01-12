import { useState } from 'react'
import crestPrimary from '../../assets/media/images.png'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../store/ui'

export default function History() {
  const [studentId, setStudentId] = useState('')
  const [studentData, setStudentData] = useState(null)
  const [history, setHistory] = useState({
    returned: [],
    issued: [],
    fines: [],
    overdue: []
  })
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!studentId.trim()) {
      showToast('Please enter a Student ID.', { type: 'warning' })
      return
    }

    setLoading(true)
    setSearched(true)
    setStudentData(null)
    setHistory({ returned: [], issued: [], fines: [], overdue: [] })

    try {
      // 1. Fetch Student Details
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('student_id', studentId.trim())
        .maybeSingle()

      if (studentError) throw studentError
      if (!student) {
        showToast('Student not found.', { type: 'error' })
        setLoading(false)
        return
      }
      setStudentData(student)

      // 2. Fetch Loans (Issued & Returned)
      const { data: loans, error: loansError } = await supabase
        .from('library_loans')
        .select(`
          id,
          status,
          issued_at,
          returned_at,
          due_date,
          library_book_copies (
            book_id,
            library_books (title, author, shelf_code)
          )
        `)
        .eq('student_id', student.student_id)
        .order('issued_at', { ascending: false })

      if (loansError) throw loansError

      const issued = loans.filter(l => l.status === 'ISSUED')
      const returned = loans.filter(l => l.status === 'RETURNED' || l.status === 'MISSING' || l.status === 'DAMAGED') // Include other terminal statuses
      
      const today = new Date().toISOString().slice(0, 10)
      const overdue = issued.filter(l => l.due_date && l.due_date < today)

      // 3. Fetch Fines
      const { data: fines, error: finesError } = await supabase
        .from('library_fines')
        .select(`
          id,
          amount,
          status,
          created_at,
          paid_at,
          library_loans (
            status,
            library_book_copies (
              library_books (title)
            )
          )
        `)
        .eq('student_id', student.student_id)
        .order('created_at', { ascending: false })

      if (finesError) throw finesError

      setHistory({
        issued,
        returned,
        overdue,
        fines: fines || []
      })

    } catch (err) {
      console.error('Error fetching history:', err)
      showToast('Failed to load student history.', { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="desktop-container" style={{ overflowX: 'hidden' }}>
      <section className="setup-hero mb-4 text-center">
        <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
          <div className="admin-applications__crest mx-auto" aria-hidden="true">
            <img src={crestPrimary} alt="Vijayam crest" />
          </div>
          <h3 className="setup-hero-title mb-2">For No Dues and History</h3>
          <p className="setup-hero-copy mb-3">View complete library activity for a student.</p>
        </div>
      </section>

      {/* Search Section */}
      <div className="row justify-content-center mb-4">
        <div className="col-12 col-md-6">
          <div className="card card-soft p-4">
            <form onSubmit={handleSearch} className="d-flex gap-2">
              <input
                type="text"
                className="form-control"
                placeholder="Enter Student ID (e.g., STU-1001)"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {studentData && (
        <div className="animate__animated animate__fadeIn">
          {/* Student Profile */}
          <div className="card card-soft p-4 mb-4">
            <h5 className="mb-3 fw-bold border-bottom pb-2">Student Profile</h5>
            <div className="row g-3">
              <div className="col-md-4">
                <div className="small text-muted text-uppercase fw-bold">Name</div>
                <div className="fs-5">{studentData.full_name}</div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted text-uppercase fw-bold">Student ID</div>
                <div className="fs-5">{studentData.student_id}</div>
              </div>
              <div className="col-md-4">
                <div className="small text-muted text-uppercase fw-bold">Course / Group</div>
                <div className="fs-5">{studentData.course_name || '-'} / {studentData.group_name || '-'}</div>
              </div>
            </div>
          </div>

          <div className="row g-4">
            {/* Active / Issued Loans */}
            <div className="col-12 col-lg-6">
              <div className="card card-soft p-4 h-100">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0 fw-bold">Active Issued Books</h5>
                  <span className="badge bg-primary rounded-pill">{history.issued.length}</span>
                </div>
                {history.issued.length === 0 ? (
                  <p className="text-muted fst-italic">No active loans.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Book Title</th>
                          <th>Issued Date</th>
                          <th>Due Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.issued.map(loan => (
                          <tr key={loan.id}>
                            <td>
                              <div className="fw-semibold">{loan.library_book_copies?.library_books?.title || 'Unknown'}</div>
                              <div className="small text-muted">{loan.library_book_copies?.library_books?.shelf_code}</div>
                            </td>
                            <td>{loan.issued_at?.slice(0, 10)}</td>
                            <td className={history.overdue.includes(loan) ? 'text-danger fw-bold' : ''}>
                              {loan.due_date}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Returned History */}
            <div className="col-12 col-lg-6">
              <div className="card card-soft p-4 h-100">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0 fw-bold">Return History</h5>
                  <span className="badge bg-secondary rounded-pill">{history.returned.length}</span>
                </div>
                {history.returned.length === 0 ? (
                  <p className="text-muted fst-italic">No return history found.</p>
                ) : (
                  <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="table table-sm table-hover align-middle">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th>Book Title</th>
                          <th>Returned Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.returned.map(loan => (
                          <tr key={loan.id}>
                            <td>{loan.library_book_copies?.library_books?.title || 'Unknown'}</td>
                            <td>{loan.returned_at?.slice(0, 10) || '-'}</td>
                            <td>
                              <span className={`badge ${loan.status === 'RETURNED' ? 'bg-success' : 'bg-danger'}`}>
                                {loan.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Fines & Dues */}
            <div className="col-12">
              <div className="card card-soft p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0 fw-bold">Fine History</h5>
                  <span className="badge bg-warning text-dark rounded-pill">{history.fines.length}</span>
                </div>
                {history.fines.length === 0 ? (
                  <p className="text-muted fst-italic">No fine records found.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Date</th>
                          <th>Book</th>
                          <th>Reason/Status</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Paid Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.fines.map(fine => (
                          <tr key={fine.id}>
                            <td>{fine.created_at?.slice(0, 10)}</td>
                            <td>{fine.library_loans?.library_book_copies?.library_books?.title || 'Unknown'}</td>
                            <td>{fine.library_loans?.status || '-'}</td>
                            <td className="fw-bold">Rs. {fine.amount}</td>
                            <td>
                              <span className={`badge ${fine.status === 'PAID' ? 'bg-success' : 'bg-danger'}`}>
                                {fine.status}
                              </span>
                            </td>
                            <td>{fine.paid_at?.slice(0, 10) || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {searched && !studentData && !loading && (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-search fs-1 mb-3 d-block"></i>
          <p>No records found. Try a different Student ID.</p>
        </div>
      )}
    </div>
  )
}
