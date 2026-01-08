import { useEffect, useState } from 'react'
import StaffShell from '../../components/StaffShell'
import { supabase } from '../../../supabaseClient'
import { useStaffAuth } from '../../store/staffAuth'

export default function StudentAttendance() {
  const { staff } = useStaffAuth()

  /* ===============================
     FILTER STATE
  ================================ */
  const [academicYears, setAcademicYears] = useState([])
  const [groups, setGroups] = useState([])
  const [courses, setCourses] = useState([])
  const [semesters, setSemesters] = useState([])

  const [academicYear, setAcademicYear] = useState('')
  const [group, setGroup] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [semester, setSemester] = useState('')

  /* ===============================
     STUDENT + ATTENDANCE STATE
  ================================ */
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({})
  const [leaveStudentIds, setLeaveStudentIds] = useState(new Set())
  const [loading, setLoading] = useState(false)

  /* ===============================
     UI FLOW STATE (NEW)
  ================================ */
  const [showSummary, setShowSummary] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  /* ===============================
     INITIAL LOAD
  ================================ */
  useEffect(() => {
    fetchAcademicYears()
    fetchGroups()
  }, [])

  /* ===============================
     FETCH FILTER DATA
  ================================ */
  const fetchAcademicYears = async () => {
    const { data } = await supabase.from('students').select('academic_year')
    const unique = [...new Set((data || []).map(d => d.academic_year))]
    setAcademicYears(unique)
  }

  const fetchGroups = async () => {
    const { data } = await supabase.from('groups').select('group_name')
    setGroups(data || [])
  }

  const fetchCoursesByGroup = async (groupName) => {
    setLoading(true)
    const { data } = await supabase
      .from('courses')
      .select('course_code, course_name')
      .eq('group_name', groupName)
    setCourses(data || [])
    setLoading(false)
  }

  const fetchSemestersByCourse = async (courseCode) => {
    setLoading(true)
    const { data } = await supabase
      .from('subjects')
      .select('semester_number')
      .eq('course_name', courseCode)

    const unique = [...new Set((data || []).map(d => d.semester_number))]
    setSemesters(unique)
    setLoading(false)
  }

  /* ===============================
     FETCH STUDENTS
  ================================ */
  useEffect(() => {
    if (academicYear || group || courseCode || semester) {
      fetchStudents()
    } else {
      setStudents([])
      setAttendance({})
    }
  }, [academicYear, group, courseCode, semester])

  const fetchStudents = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('students')
        .select('id, student_id, full_name')
        .order('student_id', { ascending: true })

      if (academicYear) {
        query = query.eq('academic_year', academicYear)
      }

      if (group) {
        query = query.eq('group_name', group)
      }

      if (courseCode) {
        const courseName = courses.find(c => c.course_code === courseCode)?.course_name
        if (courseName) {
          query = query.eq('course_name', courseName)
        }
      }

      if (semester) {
        query = query.eq('current_semester', Number(semester))
      }

      const { data } = await query
      setStudents(data || [])

      const studentIds = (data || []).map(s => s.id)
      const todayIso = new Date().toISOString().split('T')[0]
      let leaveSet = new Set()

      if (studentIds.length > 0) {
        const { data: leaveRows, error: leaveError } = await supabase
          .from('leave_requests')
          .select('applicant_id, from_date, to_date')
          .eq('applicant_type', 'STUDENT')
          .in('status', ['APPROVED', 'HOD_APPROVED', 'APPROVED_BY_HOD'])
          .in('applicant_id', studentIds)
          .lte('from_date', todayIso)
          .gte('to_date', todayIso)

        if (!leaveError) {
          leaveSet = new Set((leaveRows || []).map(r => r.applicant_id))
        }
      }

      setLeaveStudentIds(leaveSet)

      const defaults = {}
      ;(data || []).forEach(s => {
        defaults[s.id] = leaveSet.has(s.id) ? 'ABSENT' : 'PRESENT'
      })
      setAttendance(defaults)
    } catch (err) {
      console.error('Error fetching students:', err)
    } finally {
      setLoading(false)
    }
  }

  /* ===============================
     SUMMARY LOGIC (NEW)
  ================================ */
  const totalStrength = students.length
  const presentCount = Object.values(attendance).filter(a => a === 'PRESENT').length
  const absentCount = totalStrength - presentCount

  const absentees = students.filter(
    s => attendance[s.id] === 'ABSENT'
  )

  const handleDone = () => {
    setShowSummary(true)
  }

  /* ===============================
     SUBMIT ATTENDANCE (UNCHANGED CORE)
  ================================ */
  const submitAttendance = async () => {
    if (!staff?.id) {
      alert('Staff not logged in')
      return
    }

    setLoading(true)

    try {
      const { data: courseRow } = await supabase
        .from('courses')
        .select('course_id')
        .eq('course_code', courseCode)
        .maybeSingle()

      if (!courseRow) throw new Error('Course not found')

      const { data: mapping } = await supabase
        .from('teacher_subject_mapping')
        .select('subject_id')
        .eq('teacher_id', staff.id)
        .eq('course_id', courseRow.course_id)
        .eq('semester', Number(semester))
        .eq('is_active', true)
        .maybeSingle()

      if (!mapping) {
        throw new Error('No subject mapped for this course & semester')
      }

      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .insert({
          academic_year: academicYear,
          semester: Number(semester),
          subject_id: mapping.subject_id,
          teacher_id: staff.id,
          attendance_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      const records = students.map(s => ({
        attendance_session_id: session.id,
        student_id: s.id,
        status: attendance[s.id]
      }))

      const { error } = await supabase
        .from('attendance_records')
        .insert(records)

      if (error) throw error

      setShowSummary(false)
      setShowSuccess(true)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const resetScreen = () => {
    setStudents([])
    setAttendance({})
    setShowSummary(false)
    setShowSuccess(false)
  }
const goBackToAttendance = () => {
  setShowSummary(false)
}

  return (
    <StaffShell title="Student Attendance">
      <div className="desktop-container attendance-page">
        <h3 className="fw-semibold mb-4">STUDENT ATTENDANCE</h3>

        {/* FILTER CARD */}
        <div className="card card-soft p-4 mb-4">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="small mb-1 fw-bold text-dark">Academic Year *</label>
              <select className="form-select" value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}>
                <option value="">Select Academic Year</option>
                {academicYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="small mb-1 fw-bold text-dark">Group *</label>
              <select className="form-select" value={group}
                onChange={e => {
                  setGroup(e.target.value)
                  setCourseCode('')
                  setSemester('')
                  setStudents([])
                  fetchCoursesByGroup(e.target.value)
                }}>
                <option value="">Select Group</option>
                {groups.map(g => (
                  <option key={g.group_name} value={g.group_name}>
                    {g.group_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="small mb-1 fw-bold text-dark">Course *</label>
              <select className="form-select" value={courseCode}
                onChange={e => {
                  setCourseCode(e.target.value)
                  setSemester('')
                  setStudents([])
                  fetchSemestersByCourse(e.target.value)
                }}>
                <option value="">Select Course</option>
                {courses.map(c => (
                  <option key={c.course_code} value={c.course_code}>
                    {c.course_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="small mb-1 fw-bold text-dark">Semester *</label>
              <select className="form-select" value={semester}
                onChange={e => setSemester(e.target.value)}>
                <option value="">Select Semester</option>
                {semesters.map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* DATA CARD */}
        <div className="card card-soft p-4">
          {loading && !showSummary && !showSuccess && (
            <div className="student-details__loading" role="status" aria-live="polite">
              <div className="student-details__loading-header">
                <div className="student-loader__spinner" aria-hidden="true"></div>
                <div>
                  <div className="student-loader__title">Loading attendance data</div>
                  <div className="student-loader__subtitle">Preparing student list and leave status.</div>
                </div>
              </div>
              <div className="student-details__loading-grid" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className="student-loader-card" key={`loader-card-${index}`}>
                    <div className="student-loader-card__header student-loader__shimmer"></div>
                    <div className="student-loader-card__line student-loader__shimmer"></div>
                    <div className="student-loader-card__line student-loader__shimmer"></div>
                  </div>
                ))}
              </div>
              <span className="sr-only">Loading details...</span>
            </div>
          )}

          {/* STUDENT TABLE */}
          {students.length > 0 && !showSummary && !showSuccess && !loading && (
            <>
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Student ID</th>
                    <th>Full Name</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const onApprovedLeave = leaveStudentIds.has(s.id)
                    return (
                    <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td>{s.student_id}</td>
                      <td>{s.full_name}</td>
                      <td>
                        <div className="attendance-vertical-stack">
                          <label className="attendance-label attendance-label--present">
                            <input
                              type="radio"
                              checked={attendance[s.id] === 'PRESENT'}
                              onChange={() =>
                                setAttendance({ ...attendance, [s.id]: 'PRESENT' })}
                            /> Present
                          </label>
                          <label className="attendance-label attendance-label--absent">
                            <input
                              type="radio"
                              checked={attendance[s.id] === 'ABSENT'}
                              onChange={() =>
                                setAttendance({ ...attendance, [s.id]: 'ABSENT' })}
                            /> Absent
                          </label>
                          {onApprovedLeave && (
                            <div className="attendance-status-label">Approved Leave</div>
                          )}
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>

                            <div className="text-end mt-3">
                              {academicYear && group && courseCode && semester && (
                                <button className="btn btn-success px-5 fw-bold" onClick={handleDone}>
                                  DONE
                                </button>
                              )}
                            </div>            </>
          )}

          {!loading && !students.length && !showSummary && !showSuccess && (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-people fs-1 d-block mb-2 opacity-25"></i>
              Please select all filters to load student list
            </div>
          )}
        </div>

        {/* SUMMARY SCREEN */}
        {showSummary && (
          <div className="card card-soft p-4 text-center">
            <h4>Attendance Summary</h4>
            <p>Total Strength: <b>{totalStrength}</b></p>
            <p>Present: <b>{presentCount}</b></p>
            <p>Absent: <b>{absentCount}</b></p>

            {absentees.length > 0 && (
              <>
                <h6>Absentees</h6>
                <ul className="list-unstyled">
                  {absentees.map(s => (
                    <li key={s.id}>
                      {s.student_id} - {s.full_name}
                    </li>
                  ))}
                </ul>
              </>
            )}

<div className="d-flex justify-content-center gap-3 mt-3">
  <button
    className="btn btn-outline-secondary px-4"
    onClick={goBackToAttendance}
    disabled={loading}
  >
    ← Back
  </button>

  <button
    className="btn btn-primary px-4"
    onClick={submitAttendance}
    disabled={loading}
  >
    {loading ? 'Submitting...' : 'Submit Attendance'}
  </button>
</div>


          </div>
        )}

        {/* SUCCESS SCREEN */}
{showSuccess && (
  <div className="card card-soft p-4 text-center">
    <h4 className="mb-3">Attendance submitted successfully ✅</h4>

    <div className="d-flex justify-content-center">
      <button
        className="btn btn-secondary px-4"
        onClick={resetScreen}
      >
        OK
      </button>
    </div>
  </div>
)}


      </div>
    </StaffShell>
  )
}
