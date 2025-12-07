import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import logo from '../assets/media/images.png'

export default function PublicResults() {
  const [hallTicket, setHallTicket] = useState('')
  const [student, setStudent] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!hallTicket.trim()) return

    setLoading(true)
    setError('')
    setStudent(null)
    setResults([])
    setSearched(true)

    try {
      // 1. Find student by Hall Ticket
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .ilike('hall_ticket_no', hallTicket.trim())
        .single()

      if (studentError || !studentData) {
        throw new Error('Student not found with this Hall Ticket Number')
      }

      setStudent(studentData)

      // 2. Fetch results for this student
      // We assume 'results' table contains only published results now.
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select(`
          marks_obtained,
          max_marks,
          exam:exam_master (
            exam_name
          ),
          subject:subjects (
            subject_name,
            subject_code
          )
        `)
        .eq('student_id', studentData.id)
        .order('id', { ascending: true }) // Adjust order as needed

      if (resultsError) throw resultsError

      // Group by Exam? Or just list? 
      // Usually results are shown per exam or semester. 
      // Let's just list them for now, or group by Exam Name if multiple exams exist.
      setResults(resultsData || [])

    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to fetch results')
    } finally {
      setLoading(false)
    }
  }

  // Group results by exam
  const resultsByExam = results.reduce((acc, curr) => {
    const examName = curr.exam?.exam_name || 'Unknown Exam';
    if (!acc[examName]) acc[examName] = [];
    acc[examName].push(curr);
    return acc;
  }, {});

  return (
    <div className="min-vh-100 bg-light py-5">
      <div className="container">

        {/* Header / Logo */}
        <div className="text-center mb-5">
          <img
            src={logo}
            alt="College Logo"
            style={{ height: 80, objectFit: 'contain' }}
            className="mb-3"
          />
          <h2 className="fw-bold text-primary">Vijayam Arts and Science College</h2>
          <h5 className="text-muted">Examination Results Portal</h5>
        </div>

        {/* Search Card */}
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-5">
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-body p-4">
                <form onSubmit={handleSearch}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold text-uppercase small text-muted">Hall Ticket Number</label>
                    <div className="input-group">
                      <span className="input-group-text bg-white text-muted">
                        <i className="bi bi-search"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control form-control-lg"
                        placeholder="e.g. 21ABC123"
                        value={hallTicket}
                        onChange={(e) => setHallTicket(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="d-grid">
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg"
                      disabled={loading || !hallTicket.trim()}
                    >
                      {loading ? 'Searching...' : 'View Results'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="row justify-content-center">
            <div className="col-md-6">
              <div className="alert alert-danger text-center shadow-sm">
                <i className="bi bi-exclamation-circle me-2"></i>
                {error}
              </div>
            </div>
          </div>
        )}

        {/* Student Details & Results */}
        {student && !loading && (
          <div className="row justify-content-center animate__animated animate__fadeIn">
            <div className="col-lg-10">

              {/* Student Info */}
              <div className="card shadow-sm border-0 mb-4">
                <div className="card-body p-4">
                  <h5 className="card-title fw-bold mb-3 border-bottom pb-2">Student Information</h5>
                  <div className="row g-3">
                    <div className="col-sm-6 col-md-3">
                      <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.75rem' }}>Name</small>
                      <span className="fw-semibold">{student.full_name}</span>
                    </div>
                    <div className="col-sm-6 col-md-3">
                      <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.75rem' }}>Hall Ticket No</small>
                      <span className="fw-semibold">{student.hall_ticket_no}</span>
                    </div>
                    <div className="col-sm-6 col-md-3">
                      <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.75rem' }}>Course</small>
                      <span className="fw-semibold">{student.course_name || '-'}</span>
                    </div>
                    <div className="col-sm-6 col-md-3">
                      <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.75rem' }}>Group</small>
                      <span className="fw-semibold">{student.group_name || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results Table(s) */}
              {Object.keys(resultsByExam).length === 0 ? (
                <div className="alert alert-info text-center">
                  No published results found for this student.
                </div>
              ) : (
                Object.entries(resultsByExam).map(([examName, items]) => (
                  <div key={examName} className="card shadow-sm border-0 mb-4">
                    <div className="card-header bg-white py-3">
                      <h5 className="mb-0 fw-bold text-primary">{examName}</h5>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-hover mb-0 align-middle">
                        <thead className="bg-light">
                          <tr>
                            <th className="ps-4">Subject Code</th>
                            <th>Subject Name</th>
                            <th className="text-center">Max Marks</th>
                            <th className="text-center">Marks Obtained</th>
                            <th className="text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((res, idx) => {
                            const isPass = Number(res.marks_obtained) >= 35; // Example pass logic, simplistic
                            // Or use grade if available
                            const status = Number(res.marks_obtained) >= 35 ? 'PASS' : 'FAIL';
                            const rowClass = status === 'FAIL' ? 'table-danger' : '';

                            return (
                              <tr key={idx} className={rowClass}>
                                <td className="ps-4 fw-semibold text-muted">{res.subject?.subject_code || '-'}</td>
                                <td>{res.subject?.subject_name}</td>
                                <td className="text-center">{res.max_marks}</td>
                                <td className="text-center fw-bold">{res.marks_obtained}</td>
                                <td className="text-center">
                                  <span className={`badge ${status === 'PASS' ? 'bg-success' : 'bg-danger'}`}>
                                    {status}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  )
}
