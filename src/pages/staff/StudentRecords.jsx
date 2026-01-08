import { useEffect, useState } from 'react'
import StaffShell from '../../components/StaffShell'
import { supabase } from '../../../supabaseClient'
import { trackPromise } from '../../store/ui'

export default function StudentRecords() {
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
    const [searchId, setSearchId] = useState('')


    /* ===============================
       DATA STATE
    ================================ */
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(false)

    /* ===============================
       INITIAL LOAD
    ================================ */
    useEffect(() => {
        const init = async () => {
            setLoading(true)
            await Promise.all([fetchAcademicYears(), fetchGroups()])
            setLoading(false)
        }
        init()
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
       FETCH STUDENTS (FINAL)
    ================================ */
    useEffect(() => {
        if (academicYear && group && courseCode && semester) {
            fetchStudents()
        } else {
            setStudents([])
        }
    }, [academicYear, group, courseCode, semester])

    const fetchStudents = async () => {
        const courseNameLabel =
            courses.find(c => c.course_code === courseCode)?.course_name

        if (!courseNameLabel) return

        setLoading(true)
        const { data, error } = await supabase
            .from('students')
            .select(`
                student_id,
                full_name,
                group_name,
                course_name,
                gender,
                date_of_birth,
                father_name,
                mother_name,
                nationality,
                state,
                aadhar_number,
                address,
                phone_number,
                religion,
                Parent_no,
                admission_year
            `)
            .eq('academic_year', academicYear)
            .eq('group_name', group)
            .eq('course_name', courseNameLabel)
            .eq('current_semester', Number(semester))


        if (!error) setStudents(data || [])
        setLoading(false)
    }
    const filteredStudents = students.filter((s) =>
        s.student_id.toLowerCase().includes(searchId.toLowerCase())
    )


    return (
        <StaffShell>
            <div className="desktop-container records-page">
                <h3 className="fw-semibold mb-4">STUDENT RECORD</h3>

                {/* FILTER CARD */}
                <div className="card card-soft p-4 mb-4">
                    <div className="row g-3">
                        {/* Academic Year */}
                        <div className="col-md-3">
                            <label className="form-label fw-bold text-dark">
                                Academic Year <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={academicYear}
                                onChange={e => setAcademicYear(e.target.value)}
                            >
                                <option value="">Select Academic Year</option>
                                {academicYears.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        {/* Group */}
                        <div className="col-md-3">
                            <label className="form-label fw-bold text-dark">
                                Group <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={group}
                                onChange={e => {
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

                        {/* Course */}
                        <div className="col-md-3">
                            <label className="form-label fw-bold text-dark">
                                Course <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={courseCode}
                                onChange={e => {
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

                        {/* Semester */}
                        <div className="col-md-3">
                            <label className="form-label fw-bold text-dark">
                                Semester <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={semester}
                                onChange={e => setSemester(e.target.value)}
                            >
                                <option value="">Select Semester</option>
                                {semesters.map(s => (
                                    <option key={s} value={s}>
                                        Semester {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* DATA CARD */}
                <div className="card card-soft p-4">
                    {loading && (
                        <div className="student-details__loading" role="status" aria-live="polite">
                            <div className="student-details__loading-header">
                                <div className="student-loader__spinner" aria-hidden="true"></div>
                                <div>
                                    <div className="student-loader__title">Loading student records</div>
                                    <div className="student-loader__subtitle">Preparing detailed information grid.</div>
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
                    {students.length > 0 && !loading && (
                        <>
                            <div className="search-container">
                                <div className="input-group">
                                    <span className="input-group-text bg-white border-end-0">
                                        <i className="bi bi-search"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0"
                                        placeholder="Search by Student ID..."
                                        value={searchId}
                                        onChange={(e) => setSearchId(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="table-responsive">
                                <table className="table table-bordered mb-0">
                                    <thead>
                                        <tr>
                                            <th className="text-center">S.No</th>
                                            <th className="text-center">Student ID</th>
                                            <th>Full Name</th>
                                            <th>Group</th>
                                            <th>Course</th>
                                            <th>Gender</th>
                                            <th>DOB</th>
                                            <th>Father</th>
                                            <th>Mother</th>
                                            <th>Nationality</th>
                                            <th>State</th>
                                            <th>Aadhar</th>
                                            <th>Address</th>
                                            <th>Phone</th>
                                            <th>Religion</th>
                                            <th>Parent No</th>
                                            <th className="text-center">Admission Year</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents
                                            .slice()
                                            .sort((a, b) => a.student_id.localeCompare(b.student_id))
                                            .map((s, i) => (
                                                <tr key={s.student_id}>
                                                    <td className="text-center">{i + 1}</td>
                                                    <td className="text-center">{s.student_id}</td>
                                                    <td>{s.full_name}</td>
                                                    <td>{s.group_name}</td>
                                                    <td>{s.course_name}</td>
                                                    <td>{s.gender}</td>
                                                    <td>{s.date_of_birth}</td>
                                                    <td>{s.father_name}</td>
                                                    <td>{s.mother_name}</td>
                                                    <td>{s.nationality}</td>
                                                    <td>{s.state}</td>
                                                    <td>{s.aadhar_number}</td>
                                                    <td className="address-cell">{s.address}</td>
                                                    <td>{s.phone_number}</td>
                                                    <td>{s.religion}</td>
                                                    <td>{s.Parent_no}</td>
                                                    <td className="text-center">{s.admission_year}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {!loading && !students.length && (
                        <div className="text-center py-5 text-muted">
                            <i className="bi bi-search fs-1 d-block mb-2 opacity-25"></i>
                            Select filters to view student records
                        </div>
                    )}
                </div>
            </div>
        </StaffShell>
    )
}