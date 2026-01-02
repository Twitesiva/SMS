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
       STUDENT DATA
    ================================ */
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(false)

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
            .from('students')
            .select('academic_year')

        const unique = [...new Set((data || []).map(d => d.academic_year))]
        setAcademicYears(unique)
    }

    const fetchGroups = async () => {
        const { data } = await supabase
            .from('groups')
            .select('group_name')

        setGroups(data || [])
    }

    const fetchCoursesByGroup = async (groupName) => {
        const { data } = await supabase
            .from('courses')
            .select('course_code, course_name')
            .eq('group_name', groupName)

        setCourses(data || [])
    }

    const fetchSemestersByCourse = async (courseCode) => {
        const { data } = await supabase
            .from('subjects')
            .select('semester_number')
            .eq('course_name', courseCode)

        const unique = [...new Set((data || []).map(d => d.semester_number))]
        setSemesters(unique)
    }

    /* ===============================
       FETCH STUDENTS
    ================================ */
    useEffect(() => {
        if (academicYear && group && courseCode && semester) {
            fetchStudents()
        } else {
            setStudents([])
        }
    }, [academicYear, group, courseCode, semester])

    const fetchStudents = async () => {
        const courseName =
            courses.find(c => c.course_code === courseCode)?.course_name

        if (!courseName) return

        const { data } = await supabase
            .from('students')
            .select('student_id, full_name')
            .eq('academic_year', academicYear)
            .eq('group_name', group)
            .eq('course_name', courseName)
            .eq('current_semester', Number(semester))
            .order('student_id', { ascending: true })

        setStudents(data || [])
    }

    /* ===============================
       SUBMIT ATTENDANCE SESSION
    ================================ */
    const submitAttendanceSession = async () => {
        if (!staff?.id) {
            alert('Staff not logged in')
            return
        }

        setLoading(true)

        try {
            /* 1️⃣ Get subject_id from teacher_subject_mapping */
const { data: mapping, error: mapError } = await supabase
  .from('teacher_subject_mapping')
  .select('subject_id')
  .eq('teacher_id', staff.id)
  .eq('course_code', courseCode)
  .eq('semester', Number(semester))
  .eq('is_active', true)
  .limit(1)


if (mapError || !mapping || mapping.length === 0) {
    throw new Error('No subject mapped for this course & semester')
}


            /* 2️⃣ Insert attendance session */
            const { error: insertError } = await supabase
                .from('attendance_sessions')
                .insert({
                    academic_year: academicYear,
                    semester: Number(semester),
                    subject_id: mapping.subject_id,
                    teacher_id: staff.id,
                    attendance_date: new Date().toISOString().split('T')[0]
                })

            if (insertError) {
                throw insertError
            }

            alert('Attendance session created successfully ✅')
        } catch (err) {
            console.error(err)
            alert(err.message || 'Failed to create attendance session')
        } finally {
            setLoading(false)
        }
    }

    return (
        <StaffShell title="Student Attendance">
            <div className="desktop-container">

                <h3 className="fw-semibold mb-4">STUDENT ATTENDANCE</h3>

                {/* ===============================
                   FILTER BAR
                ================================ */}
                <div className="card card-soft p-4 mb-4">
                    <div className="row g-3">

                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Academic Year *</label>
                            <select
                                className="form-select"
                                value={academicYear}
                                onChange={(e) => setAcademicYear(e.target.value)}
                            >
                                <option value="">Select Academic Year</option>
                                {academicYears.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Group *</label>
                            <select
                                className="form-select"
                                value={group}
                                onChange={(e) => {
                                    setGroup(e.target.value)
                                    setCourseCode('')
                                    setSemester('')
                                    setStudents([])
                                    fetchCoursesByGroup(e.target.value)
                                }}
                            >
                                <option value="">Select Group</option>
                                {groups.map(g => (
                                    <option key={g.group_name} value={g.group_name}>
                                        {g.group_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Course *</label>
                            <select
                                className="form-select"
                                value={courseCode}
                                onChange={(e) => {
                                    setCourseCode(e.target.value)
                                    setSemester('')
                                    setStudents([])
                                    fetchSemestersByCourse(e.target.value)
                                }}
                            >
                                <option value="">Select Course</option>
                                {courses.map(c => (
                                    <option key={c.course_code} value={c.course_code}>
                                        {c.course_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-3">
                            <label className="form-label fw-semibold">Semester *</label>
                            <select
                                className="form-select"
                                value={semester}
                                onChange={(e) => setSemester(e.target.value)}
                            >
                                <option value="">Select Semester</option>
                                {semesters.map(s => (
                                    <option key={s} value={s}>Semester {s}</option>
                                ))}
                            </select>
                        </div>

                    </div>
                </div>

                {/* ===============================
                   STUDENT TABLE
                ================================ */}
                {students.length > 0 && (
                    <div className="card card-soft p-4">
                        <div className="table-responsive">
                            <table className="table table-bordered table-sm">
                                <thead>
                                    <tr>
                                        <th>S.No</th>
                                        <th>Student ID</th>
                                        <th>Full Name</th>
                                        <th>Attendance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((s, i) => (
                                        <tr key={s.student_id}>
                                            <td>{i + 1}</td>
                                            <td>{s.student_id}</td>
                                            <td>{s.full_name}</td>
                                            <td>
                                                <label className="me-3 fw-semibold fs-6">
                                                    <input type="radio" checked readOnly /> Present
                                                </label>
                                                <label className="fw-semibold fs-6">
                                                    <input type="radio" readOnly /> Absent
                                                </label>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="text-end mt-3">
                            <button
                                className="btn btn-primary"
                                onClick={submitAttendanceSession}
                                disabled={loading}
                            >
                                {loading ? 'Submitting...' : 'Submit Attendance'}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </StaffShell>
    )
}
