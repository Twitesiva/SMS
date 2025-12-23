import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import logo from '../assets/media/images.png'

export default function PublicResults() {
  const [hallTicket, setHallTicket] = useState('')
  const [student, setStudent] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [gradeMaster, setGradeMaster] = useState([])

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const { data, error } = await supabase.from('grade_master').select('*')
        if (error) throw error
        if (data) setGradeMaster(data)
      } catch (err) {
        console.error('Error fetching grades:', err)
      }
    }
    fetchGrades()
  }, [])

  const getGradeInfo = (marks) => {
    const m = Number(marks)
    if (isNaN(m)) return null
    return gradeMaster.find((g) => m >= Number(g.min_marks) && m <= Number(g.max_marks))
  }

  const getGrade = (marks) => {
    const found = getGradeInfo(marks)
    return found ? found.grade : marks
  }

  const calculateGPA = (resultList) => {
    let totalCredits = 0
    let totalPoints = 0

    resultList.forEach((res) => {
      const credits = Number(res.subject?.category?.credits || 0)
      const gradeInfo = getGradeInfo(res.marks_obtained)
      const points = gradeInfo ? Number(gradeInfo.grade_point) : 0

      // Only consider if credits > 0 and we successfully found grade points
      // Also typically failed subjects (credits > 0, points = 0) count towards SGPA/CGPA denominator
      if (credits > 0) {
        totalCredits += credits
        totalPoints += (credits * points)
      }
    })

    if (totalCredits === 0) return '0.00'
    return (totalPoints / totalCredits).toFixed(2)
  }

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
        .select(`
          *,
          group:groups!students_group_id_fkey (
            group_name
          ),
          course:courses!fk_students_course (
            course_name
          )
        `)
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
          internal_marks,
          theory_marks,
          max_marks,
          semester,
          exam:exam_master (
            exam_name
          ),
          subject:subjects (
            subject_name,
            subject_code,
            subject_name,
            subject_code,
            semester_number,
            category:subject_category (
              credits
            )
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
                  <div className="d-flex flex-column gap-2">
                    <div className="row">
                      <div className="col-md-3 col-4 text-muted text-uppercase small">Student Name</div>
                      <div className="col-md-9 col-8 fw-semibold text-dark">: {student.full_name}</div>
                    </div>
                    <div className="row">
                      <div className="col-md-3 col-4 text-muted text-uppercase small">Hall Ticket No</div>
                      <div className="col-md-9 col-8 fw-semibold text-dark">: {student.hall_ticket_no}</div>
                    </div>
                    <div className="row">
                      <div className="col-md-3 col-4 text-muted text-uppercase small">Group</div>
                      <div className="col-md-9 col-8 fw-semibold text-dark">: {student.group?.group_name || student.group_name || '-'}</div>
                    </div>
                    <div className="row">
                      <div className="col-md-3 col-4 text-muted text-uppercase small">Course</div>
                      <div className="col-md-9 col-8 fw-semibold text-dark">: {student.course?.course_name || student.course_name || '-'}</div>
                    </div>
                    <div className="row">
                      <div className="col-md-3 col-4 text-muted text-uppercase small">Semester</div>
                      <div className="col-md-9 col-8 fw-semibold text-dark">: {student.current_semester || '-'}</div>
                    </div>
                    <div className="row">
                      <div className="col-md-3 col-4 text-muted text-uppercase small">Cumulative GPA (CGPA)</div>
                      <div className="col-md-9 col-8 fw-semibold text-dark">: {calculateGPA(results)}</div>
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
                <>
                  {Object.entries(resultsByExam).map(([examName, items]) => (
                    <div key={examName} className="card shadow-sm border-0 mb-4">
                      <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                        <h5 className="mb-0 fw-bold text-primary">{examName}</h5>
                        <div className="fw-semibold text-dark">
                          SGPA : {calculateGPA(items)}
                        </div>
                      </div>
                      <div className="table-responsive">
                        {/* Inline style for strict table borders */}
                        <style>
                          {`
                            .custom-table-bordered {
                              border-collapse: collapse !important;
                              width: 100%;
                            }
                            .custom-table-bordered th, 
                            .custom-table-bordered td {
                              border: 1px solid black !important;
                              vertical-align: middle;
                            }
                          `}
                        </style>
                        <table className="table mb-0 align-middle custom-table-bordered" style={{ minWidth: '800px' }}>
                          <thead className="bg-light">
                            <tr className="align-middle">
                              <th className="text-center fw-bold text-uppercase" style={{ width: '60px', color: 'black' }}>S.No</th>
                              <th className="ps-3 fw-bold text-uppercase" style={{ color: 'black' }}>Subject</th>
                              <th className="text-center fw-bold text-uppercase" style={{ color: 'black' }}>Semester</th>
                              <th className="text-center fw-bold text-uppercase" style={{ color: 'black' }}>Internal</th>
                              <th className="text-center fw-bold text-uppercase" style={{ color: 'black' }}>Theory</th>
                              <th className="text-center fw-bold text-uppercase" style={{ color: 'black' }}>Total</th>
                              <th className="text-center fw-bold text-uppercase" style={{ color: 'black' }}>Credit Points</th>
                              <th className="text-center fw-bold text-uppercase" style={{ color: 'black' }}>Grade</th>
                              <th className="text-center fw-bold text-uppercase" style={{ color: 'black' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((res, idx) => {
                              const status = Number(res.marks_obtained) >= 35 ? 'PASS' : 'FAIL';
                              return (
                                <tr key={idx}>
                                  <td className="text-center text-dark fw-medium">{idx + 1}</td>
                                  <td className="ps-3 text-dark fw-medium">
                                    {res.subject?.subject_code || '-'} - {res.subject?.subject_name}
                                  </td>
                                  <td className="text-center text-dark fw-medium">
                                    {res.subject?.semester_number || res.semester || '-'}
                                  </td>
                                  <td className="text-center text-dark fw-medium">{res.internal_marks}</td>
                                  <td className="text-center text-dark fw-medium">{res.theory_marks}</td>
                                  <td className="text-center text-dark fw-medium">{res.marks_obtained}</td>
                                  <td className="text-center text-dark fw-medium">{res.subject?.category?.credits || '-'}</td>
                                  <td className="text-center text-dark fw-bold">{getGrade(res.marks_obtained)}</td>
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
                  }
                </>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  )
}
