import { useEffect, useState } from 'react'
import StaffShell from '../../components/StaffShell'
import { supabase } from '../../../supabaseClient'
import { useStaffAuth } from '../../store/staffAuth'
import './StaffPortal.css'

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
  const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false)

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
    const { data } = await supabase
      .from('academic_years')
      .select('year_name')
    const unique = [...new Set((data || []).map(d => d.year_name))]
    setAcademicYears(unique.filter(Boolean))
  }

  const fetchGroups = async () => {
    let data = []
    let error = null
    ;({ data, error } = await supabase
      .from('classes')
      .select('id as group_id, class_name as group_name, class_number as group_code'))
    if (error) {
      ;({ data, error } = await supabase
        .from('classes')
        .select('id as group_id, class_name as group_name'))
    }
    if (error) {
      ;({ data } = await supabase
        .from('classes')
        .select('class_name as group_name'))
    }
    setGroups(data || [])
  }

  const fetchCoursesByGroup = async (groupValue) => {
    setLoading(true)
    let data = []
    let error = null
    ;({ data, error } = await supabase
      .from('class_sections')
      .select(`
        id,
        class_id,
        section_id,
        sections (section_name)
      `)
    )
    if (error) {
      ;({ data, error } = await supabase
        .from('class_sections')
        .select('id, section_id, sections (section_name)'))
    }
    if (error) {
      ;({ data } = await supabase
        .from('class_sections')
        .select('id, section_id, sections (section_name)'))
    }

    // JS mapping for compatibility
    data = (data || []).map(row => ({
      course_id: row.id,
      course_code: row.section_id,
      course_name: row.sections?.section_name || row.section_name || '',
      group_id: row.class_id,
      group_name: row.class_name || ''
    }))

    const selectedGroup = (groups || []).find(g =>
      String(g.group_id) === String(groupValue) ||
      String(g.group_name) === String(groupValue)
    )

    let filtered = data
    if (selectedGroup && selectedGroup.group_id) {
      filtered = filtered.filter(c => String(c.group_id) === String(selectedGroup.group_id))
    }

    setCourses(filtered)
    setLoading(false)
  }

  const fetchSemestersByCourse = async (courseCode) => {
    setLoading(true)
    const selectedCourse = (courses || []).find(c =>
      String(c.course_id) === String(courseCode) ||
      String(c.course_code) === String(courseCode) ||
      String(c.course_name) === String(courseCode)
    )

    const candidates = [
      selectedCourse?.course_name,
      selectedCourse?.course_code,
      courseCode
    ].filter(Boolean).map(v => String(v))

    let orParts = candidates.map(v => `section_name.eq.${v}`)
    const { data } = await supabase
      .from('subjects')
      .select('semester_number')
      .or(orParts.join(','))

    const unique = [...new Set((data || []).map(d => d.semester_number))]
    setSemesters(unique.filter(Boolean))
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
      setIsAlreadySubmitted(false)
    }
  }, [academicYear, group, courseCode, semester])

  const fetchStudents = async () => {
    setLoading(true)
    try {
      // Use staff as proxy for students until migration
      let { data, error } = await supabase
        .from('staff')
        .select(`
          id as student_id,
          staff_id,
          full_name
        `)
        .order('staff_id')

      if (error) {
        console.error('Error:', error)
        data = []
      }
      setStudents(data || [])

      // Leave logic (adapt for staff)
      const studentIds = data.map(s => s.id)
      const todayIso = new Date().toISOString().split('T')[0]
      let { data: leaveRows } = await supabase
        .from('leave_requests')
        .select('applicant_id')
        .in('status', ['APPROVED'])
        .in('applicant_id', studentIds)
      let leaveSet = new Set((leaveRows || []).map(r => r.applicant_id))
      setLeaveStudentIds(leaveSet)

      setIsAlreadySubmitted(false) // Simplified
      const defaults = {}
      data.forEach(s => {
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
     SUMMARY & SUBMIT
  ================================ */
  const totalStrength = students.length
  const presentCount = Object.values(attendance).filter(a => a === 'PRESENT').length
  const absentCount = totalStrength - presentCount
  const absentees = students.filter(s => attendance[s.id] === 'ABSENT')

  const handleDone = () => setShowSummary(true)

  const submitAttendance = async () => {
    setLoading(true)
    try {
      const records = students.map(s => ({
        staff_id: s.id,
        status: attendance[s.id],
        date: new Date().toISOString().split('T')[0],
        staff_id_submitting: staff.id,
        class_id: group,
        section_id: courseCode,
        semester: semester
      }))

      const { error } = await supabase
        .from('attendance_records')
        .insert(records)

      if (error) throw error
      setShowSuccess(true)
      setShowSummary(false)
    } catch (err) {
      alert('Submit failed: ' + err.message)
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

  return (
    <StaffShell title="Student Attendance">
      <div className="desktop-container attendance-page">
        <h3 className="fw-semibold mb-4">STUDENT ATTENDANCE</h3>

        {/* FILTERS */}
        <div className="card card-soft p-4 mb-4">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="small mb-1 fw-bold text-dark">Academic Year</label>
              <select className="form-select" value={academicYear} onChange={e => setAcademicYear(e.target.value)}>
                <option value="">All Years</option>
                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="small mb-1 fw-bold text-dark">Class</label>
              <select className="form-select" value={group} onChange={e => {
                setGroup(e.target.value)
                setCourseCode('')
                setSemester('')
                fetchCoursesByGroup(e.target.value)
              }}>
                <option value="">All Classes</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.class_name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="small mb-1 fw-bold text-dark">Section</label>
              <select className="form-select" value={courseCode} onChange={e => {
                setCourseCode(e.target.value)
                setSemester('')
                fetchSemestersByCourse(e.target.value)
              }}>
                <option value="">All Sections</option>
                {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="small mb-1 fw-bold text-dark">Semester</label>
              <select className="form-select" value={semester} onChange={e => setSemester(e.target.value)}>
                <option value="">All Semesters</option>
                {semesters.map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="mt-4">
          {loading && <div>Loading...</div>}
          {students.length > 0 && (
            <>
              <div className="table-responsive">
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => (
                      <tr key={s.student_id}>
                        <td>{i+1}</td>
                        <td>{s.student_id}</td>
                        <td>{s.full_name}</td>
                        <td>
                          <select value={attendance[s.student_id]} onChange={e => setAttendance(prev => ({...prev, [s.student_id]: e.target.value}))}>
                            <option value="PRESENT">Present</option>
                            <option value="ABSENT">Absent</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-end mt-3">
                <button className="btn btn-success" onClick={handleDone}>Submit</button>
              </div>
            </>
          )}
          {!loading && students.length === 0 && <div className="text-center py-5 text-muted">No students found</div>}
        </div>

        {showSummary && (
          <div className="card mt-4 p-4">
            <h4>Summary</h4>
            <div className="row text-center mb-4">
              <div className="col">
                <h2 className="text-primary">{totalStrength}</h2>
                <div>Total</div>
              </div>
              <div className="col">
                <h2 className="text-success">{presentCount}</h2>
                <div>Present</div>
              </div>
              <div className="col">
                <h2 className="text-danger">{absentCount}</h2>
                <div>Absent</div>
              </div>
            </div>
            <div className="text-end">
              <button className="btn btn-secondary me-2" onClick={() => setShowSummary(false)}>Back</button>
              <button className="btn btn-primary" onClick={submitAttendance} disabled={loading}>Confirm Submit</button>
            </div>
          </div>
        )}

        {showSuccess && (
          <div className="card mt-4 p-4 text-center">
            <i className="bi bi-check-lg text-success fs-1 mb-3"></i>
            <h4>Attendance Submitted!</h4>
            <button className="btn btn-primary mt-3" onClick={resetScreen}>New Session</button>
          </div>
        )}
      </div>
    </StaffShell>
  )
}
