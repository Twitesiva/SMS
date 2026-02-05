import { useEffect, useState } from 'react'
import StaffShell from '../../components/StaffShell'
import { supabase } from '../../../supabaseClient'
import { useStaffAuth } from '../../store/staffAuth'
import './StaffPortal.css'
import '../student/Student.css'

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
    const { data } = await supabase.from('students').select('academic_year')
    const unique = [...new Set((data || []).map(d => d.academic_year))]
    setAcademicYears(unique)
  }

  const fetchGroups = async () => {
    let data = []
    let error = null
    ;({ data, error } = await supabase.from('groups').select('group_id, group_name, group_code'))
    if (error) {
      ;({ data, error } = await supabase.from('groups').select('group_id, group_name'))
    }
    if (error) {
      ;({ data } = await supabase.from('groups').select('group_name'))
    }
    setGroups(data || [])
  }

  const fetchCoursesByGroup = async (groupValue) => {
    setLoading(true)
    let data = []
    let error = null
    ;({ data, error } = await supabase
      .from('courses')
      .select('course_id, course_code, course_name, group_id, group_name'))
    if (error) {
      ;({ data, error } = await supabase
        .from('courses')
        .select('course_id, course_code, course_name, group_name'))
    }
    if (error) {
      ;({ data, error } = await supabase
        .from('courses')
        .select('course_id, course_code, course_name, group_id'))
    }
    if (error) {
      ;({ data } = await supabase
        .from('courses')
        .select('course_id, course_code, course_name'))
    }

    const selectedGroup = (groups || []).find(g =>
      String(g.group_id) === String(groupValue) ||
      String(g.group_name) === String(groupValue) ||
      String(g.group_code) === String(groupValue)
    )

    let filtered = data || []
    if (selectedGroup) {
      const hasGroupId = (data || []).some(c => c.group_id !== undefined && c.group_id !== null)
      const hasGroupName = (data || []).some(c => c.group_name)

      if (hasGroupId || hasGroupName) {
        filtered = (data || []).filter(c => {
          if (selectedGroup?.group_id && c.group_id) {
            return String(c.group_id) === String(selectedGroup.group_id)
          }
          if (selectedGroup?.group_name && c.group_name) {
            return String(c.group_name) === String(selectedGroup.group_name)
          }
          if (selectedGroup?.group_code && c.group_name) {
            return String(c.group_name) === String(selectedGroup.group_code)
          }
          return false
        })
      } else {
        // Fallback: derive courses from subjects (if group info exists there)
        let subjectRows = []
        let subjectError = null

        if (selectedGroup?.group_id) {
          ;({ data: subjectRows, error: subjectError } = await supabase
            .from('subjects')
            .select('course_name')
            .eq('group_id', selectedGroup.group_id))
        }

        if ((subjectError || !subjectRows?.length) && selectedGroup?.group_name) {
          ;({ data: subjectRows, error: subjectError } = await supabase
            .from('subjects')
            .select('course_name')
            .eq('group_name', selectedGroup.group_name))
        }

        if ((subjectError || !subjectRows?.length) && selectedGroup?.group_code) {
          ;({ data: subjectRows, error: subjectError } = await supabase
            .from('subjects')
            .select('course_name')
            .eq('group_name', selectedGroup.group_code))
        }

        if (!subjectError && subjectRows?.length) {
          const courseKeys = new Set(subjectRows.map(r => String(r.course_name)))
          filtered = (data || []).filter(c =>
            courseKeys.has(String(c.course_name)) ||
            courseKeys.has(String(c.course_code)) ||
            courseKeys.has(String(c.course_id))
          )
        } else {
          filtered = []
        }
      }
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
      selectedCourse?.course_id,
      courseCode
    ]
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
      .map((v) => String(v))

    const orParts = candidates.map((v) => `course_name.eq."${v.replace(/"/g, '\\"')}"`)
    const { data } = await supabase
      .from('subjects')
      .select('semester_number, course_name')
      .or(orParts.join(','))

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
      setIsAlreadySubmitted(false)
    }
  }, [academicYear, group, courseCode, semester])

  const fetchStudents = async () => {
    setLoading(true)
    try {
      const orValue = (value) => `"${String(value ?? '').replace(/"/g, '\\"')}"`
      let query = supabase
        .from('students')
        .select('id, student_id, full_name')
        .order('student_id', { ascending: true })

      if (academicYear) {
        query = query.eq('academic_year', academicYear)
      }

      if (group) {
        const selectedGroup = (groups || []).find(g =>
          String(g.group_id) === String(group) ||
          String(g.group_name) === String(group) ||
          String(g.group_code) === String(group)
        )
        if (selectedGroup?.group_id) {
          const orParts = [`group_id.eq.${selectedGroup.group_id}`]
          if (selectedGroup.group_name) orParts.push(`group_name.eq.${orValue(selectedGroup.group_name)}`)
          if (selectedGroup.group_code) orParts.push(`group_name.eq.${orValue(selectedGroup.group_code)}`)
          query = query.or(orParts.join(','))
        } else if (selectedGroup?.group_name) {
          query = query.eq('group_name', selectedGroup.group_name)
        } else {
          query = query.eq('group_name', group)
        }
      }

      if (courseCode) {
        const selectedCourse = (courses || []).find(c =>
          String(c.course_id) === String(courseCode) ||
          String(c.course_code) === String(courseCode) ||
          String(c.course_name) === String(courseCode)
        )
        if (selectedCourse?.course_id) {
          const orParts = [`course_id.eq.${selectedCourse.course_id}`]
          if (selectedCourse.course_name) orParts.push(`course_name.eq.${orValue(selectedCourse.course_name)}`)
          if (selectedCourse.course_code) orParts.push(`course_name.eq.${orValue(selectedCourse.course_code)}`)
          query = query.or(orParts.join(','))
        } else if (selectedCourse?.course_name) {
          query = query.eq('course_name', selectedCourse.course_name)
        } else {
          query = query.eq('course_name', courseCode)
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

      // --- CHECK IF ALREADY SUBMITTED FOR TODAY ---
      let alreadySubmitted = false
      if (academicYear && group && courseCode && semester && staff?.id) {
        let courseRow = null
        const selectedCourse = (courses || []).find(c =>
          String(c.course_id) === String(courseCode) ||
          String(c.course_code) === String(courseCode) ||
          String(c.course_name) === String(courseCode)
        )
        if (selectedCourse?.course_id) {
          courseRow = { course_id: selectedCourse.course_id }
        } else if (selectedCourse?.course_code) {
          const { data } = await supabase
            .from('courses')
            .select('course_id')
            .eq('course_code', selectedCourse.course_code)
            .maybeSingle()
          courseRow = data || null
        } else if (selectedCourse?.course_name) {
          const { data } = await supabase
            .from('courses')
            .select('course_id')
            .eq('course_name', selectedCourse.course_name)
            .maybeSingle()
          courseRow = data || null
        } else {
          const { data } = await supabase
            .from('courses')
            .select('course_id')
            .eq('course_code', courseCode)
            .maybeSingle()
          courseRow = data || null
        }

        if (courseRow) {
          const { data: mapping } = await supabase
            .from('teacher_subject_mapping')
            .select('subject_id')
            .eq('teacher_id', staff.id)
            .eq('course_id', courseRow.course_id)
            .eq('semester', Number(semester))
            .eq('is_active', true)
            .maybeSingle()

          if (mapping) {
            const { data: session } = await supabase
              .from('attendance_sessions')
              .select('id')
              .eq('academic_year', academicYear)
              .eq('semester', Number(semester))
              .eq('subject_id', mapping.subject_id)
              .eq('teacher_id', staff.id)
              .eq('attendance_date', todayIso)
              .maybeSingle()

            if (session) {
              alreadySubmitted = true
              // Also load existing attendance values if we want to show them
              const { data: existingRecords } = await supabase
                .from('attendance_records')
                .select('student_id, status')
                .eq('attendance_session_id', session.id)

              if (existingRecords) {
                const loadedAttendance = {}
                existingRecords.forEach(r => {
                  loadedAttendance[r.student_id] = r.status
                })
                setAttendance(loadedAttendance)
              }
            }
          }
        }
      }
      setIsAlreadySubmitted(alreadySubmitted)

      if (!alreadySubmitted) {
        const defaults = {}
          ; (data || []).forEach(s => {
            defaults[s.id] = leaveSet.has(s.id) ? 'ABSENT' : 'PRESENT'
          })
        setAttendance(defaults)
      }
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
      let courseRow = null
      const selectedCourse = (courses || []).find(c =>
        String(c.course_id) === String(courseCode) ||
        String(c.course_code) === String(courseCode) ||
        String(c.course_name) === String(courseCode)
      )
      if (selectedCourse?.course_id) {
        courseRow = { course_id: selectedCourse.course_id }
      } else if (selectedCourse?.course_code) {
        const { data } = await supabase
          .from('courses')
          .select('course_id')
          .eq('course_code', selectedCourse.course_code)
          .maybeSingle()
        courseRow = data || null
      } else if (selectedCourse?.course_name) {
        const { data } = await supabase
          .from('courses')
          .select('course_id')
          .eq('course_name', selectedCourse.course_name)
          .maybeSingle()
        courseRow = data || null
      } else {
        const { data } = await supabase
          .from('courses')
          .select('course_id')
          .eq('course_code', courseCode)
          .maybeSingle()
        courseRow = data || null
      }

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

      const today = new Date().toISOString().split('T')[0]

      // 1. Check if session already exists to avoid 409 Conflict
      let { data: session, error: findError } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('academic_year', academicYear)
        .eq('semester', Number(semester))
        .eq('subject_id', mapping.subject_id)
        .eq('teacher_id', staff.id)
        .eq('attendance_date', today)
        .maybeSingle()

      if (findError) throw findError

      // 2. If not found, create it
      if (!session) {
        const { data: newSession, error: sessionError } = await supabase
          .from('attendance_sessions')
          .insert({
            academic_year: academicYear,
            semester: Number(semester),
            subject_id: mapping.subject_id,
            teacher_id: staff.id,
            attendance_date: today
          })
          .select()
          .single()

        if (sessionError) throw sessionError
        session = newSession
      }

      // 3. Upsert records (Update if exists, Insert if new)
      const records = students.map(s => ({
        attendance_session_id: session.id,
        student_id: s.id,
        status: attendance[s.id]
      }))

      // First delete existing records for this session to ensure a clean state
      // (Supabase upsert requires a unique constraint which might not be on student_id + session_id)
      const { error: deleteError } = await supabase
        .from('attendance_records')
        .delete()
        .eq('attendance_session_id', session.id)

      if (deleteError) throw deleteError

      const { error: insertError } = await supabase
        .from('attendance_records')
        .insert(records)

      if (insertError) throw insertError

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
                  <option key={g.group_id || g.group_name} value={g.group_id || g.group_name}>
                    {g.group_name || g.group_code || g.group_id}
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
                  <option key={c.course_id || c.course_code} value={c.course_id || c.course_code}>
                    {c.course_name || c.course_code || c.course_id}
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

        {/* DATA SECTION (No Card) */}
        <div className="mt-4">
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
              {isAlreadySubmitted && (
                <div className="alert alert-info d-flex align-items-center mb-4 border-0 shadow-sm rounded-3">
                  <i className="bi bi-check-circle-fill fs-4 me-3"></i>
                  <div>
                    <h6 className="mb-0 fw-bold">Attendance Already Recorded</h6>
                    <small>The attendance for this class has already been submitted for today.</small>
                  </div>
                </div>
              )}

              <table className="table table-bordered staff-attendance-table">
                <thead>
                  <tr>
                    <th className="text-center" style={{ width: '80px' }}>S.No</th>
                    <th className="text-center" style={{ width: '15%' }}>Student ID</th>
                    <th style={{ width: '35%' }}>Full Name</th>
                    <th className="text-center" style={{ width: '40%' }}>Attendance</th>
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
                          <div className="attendance-options-grid">
                            <label className={`attendance-label attendance-label--present ${isAlreadySubmitted ? 'opacity-75 cursor-not-allowed' : ''}`}>
                              <input
                                type="radio"
                                checked={attendance[s.id] === 'PRESENT'}
                                onChange={() =>
                                  !isAlreadySubmitted && setAttendance({ ...attendance, [s.id]: 'PRESENT' })}
                                disabled={isAlreadySubmitted}
                              /> Present
                            </label>
                            <label className={`attendance-label attendance-label--absent ${isAlreadySubmitted ? 'opacity-75 cursor-not-allowed' : ''}`}>
                              <input
                                type="radio"
                                checked={attendance[s.id] === 'ABSENT'}
                                onChange={() =>
                                  !isAlreadySubmitted && setAttendance({ ...attendance, [s.id]: 'ABSENT' })}
                                disabled={isAlreadySubmitted}
                              /> Absent
                            </label>
                            <div className="text-start">
                              {onApprovedLeave && (
                                <div className="attendance-status-label m-0">Approved Leave</div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="text-end mt-3">
                {academicYear && group && courseCode && semester && !isAlreadySubmitted && (
                  <button className="btn btn-success px-5 fw-bold" onClick={handleDone}>
                    DONE
                  </button>
                )}
              </div>
            </>
          )}

          {!loading && !students.length && !showSummary && !showSuccess && (
            <div className="text-center py-5 text-muted bg-white rounded-3 border">
              <i className="bi bi-people fs-1 d-block mb-2 opacity-25"></i>
              Please select all filters to load student list
            </div>
          )}
        </div>

        {/* SUMMARY SCREEN */}
        {showSummary && (
          <div className="card card-soft p-4">
            <h4 className="fw-bold text-dark mb-4 text-center">Attendance Summary</h4>

            <div className="attendance-summary-grid">
              <div className="attendance-summary-item attendance-summary-item--total">
                <span className="attendance-summary-label">Total Strength</span>
                <span className="attendance-summary-value">{totalStrength}</span>
              </div>
              <div className="attendance-summary-item attendance-summary-item--present">
                <span className="attendance-summary-label">Present</span>
                <span className="attendance-summary-value">{presentCount}</span>
              </div>
              <div className="attendance-summary-item attendance-summary-item--absent">
                <span className="attendance-summary-label">Absent</span>
                <span className="attendance-summary-value">{absentCount}</span>
              </div>
            </div>

            {absentees.length > 0 && (
              <div className="absentees-section">
                <div className="absentees-title">Absentees List</div>
                <ul className="absentees-list">
                  {absentees.map(s => (
                    <li key={s.id} className="absentee-item">
                      {s.student_id} - {s.full_name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="d-flex justify-content-center gap-3 mt-5">
              <button
                className="btn btn-outline-secondary px-5 py-2 fw-bold"
                onClick={goBackToAttendance}
                disabled={loading}
              >
                ← BACK
              </button>

              <button
                className="btn btn-primary px-5 py-2 fw-bold"
                onClick={submitAttendance}
                disabled={loading}
              >
                {loading ? 'SUBMITTING...' : 'CONFIRM & SUBMIT'}
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
