import { useEffect, useState } from 'react'
import StaffShell from '../../components/StaffShell'
import { supabase } from '../../../supabaseClient'
import './StaffPortal.css'

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
            .from('academic_years')
            .select('year_name')
            .order('year_name', { ascending: true })

        const unique = [...new Set((data || []).map(d => d.year_name))]
        setAcademicYears(unique)
    }

    const fetchGroups = async () => {
        const { data } = await supabase
            .from('classes')
            .select('id, class_name, class_number, category_id')
            .order('class_number', { ascending: true })
        setGroups(data || [])
    }

    const fetchCoursesByGroup = async (groupValue) => {
        setLoading(true)
        const { data } = await supabase
            .from('class_sections')
            .select('id, class_id, section_id, sections(id, section_name)')
            .eq('class_id', Number(groupValue))
            .order('id')

        setCourses((data || []).map((row) => ({
            course_id: row.section_id,
            course_code: row.sections?.section_name || '',
            course_name: row.sections?.section_name || ''
        })))
        setLoading(false)
    }

    const fetchSemestersByCourse = async (courseCode) => {
        setLoading(true)
        const { data } = await supabase
            .from('timetable_sessions')
            .select('term')
            .order('term', { ascending: true })

        const unique = [...new Set((data || []).map(d => d.term))]
        setSemesters(unique)
        setLoading(false)
    }

    /* ===============================
       FETCH STUDENTS (FINAL)
    ================================ */
    useEffect(() => {
        if (academicYear || group || courseCode || semester) {
            fetchStudents()
        } else {
            setStudents([])
        }
    }, [academicYear, group, courseCode, semester])

    const fetchStudents = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('staff')
                .select(`
                    id,
                    staff_id,
                    full_name,
                    gender,
                    date_of_birth,
                    nationality,
                    state,
                    aadhar_number,
                    address,
                    phone_number
                `)

            const { data, error } = await query

            if (!error) {
                setStudents((data || []).map((row) => ({
                    ...row,
                    student_id: row.staff_id,
                    hall_ticket_no: row.staff_id
                })))
            }
        } catch (err) {
            console.error('Error fetching students:', err)
        } finally {
            setLoading(false)
        }
    }
    const filteredStudents = students.filter((s) =>
        String(s.student_id || '').toLowerCase().includes(searchId.toLowerCase())
    )


    return (
        <StaffShell>
            <div className="desktop-container records-page">
                <h3 className="fw-semibold mb-4">STUDENT RECORD</h3>

                {/* FILTER CARD */}
                <div className="card card-soft p-4 mb-4">
                    <div className="records-filters">
                        {/* Academic Year */}
                        <div className="records-filter">
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
                        <div className="records-filter">
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
                                    <option key={g.group_id || g.group_name} value={g.group_id || g.group_name}>
                                        {g.group_name || g.group_code || g.group_id}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Course */}
                        <div className="records-filter">
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
                                    <option key={c.course_id || c.course_code} value={c.course_id || c.course_code}>
                                        {c.course_name || c.course_code || c.course_id}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Semester */}
                        <div className="records-filter">
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
                                            <th className="text-center">Hall Ticket</th>
                                            <th className="records-header--name">Full Name</th>
                                            <th>Gender</th>
                                            <th>DOB</th>
                                            <th>Parent No</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents
                                            .slice()
                                            .sort((a, b) => a.student_id.localeCompare(b.student_id))
                                            .map((s, i) => (
                                                <tr key={s.student_id}>
                                                    <td className="text-center">{i + 1}</td>
                                                    <td className="text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>{s.student_id}</td>
                                                    <td className="text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>{s.hall_ticket_no || '-'}</td>
                                                    <td className="records-cell--name">
                                                        <span className="records-cell-text--name">{s.full_name}</span>
                                                    </td>
                                                    <td>{s.gender}</td>
                                                    <td>{s.date_of_birth ? s.date_of_birth.split('-').reverse().join('-') : '-'}</td>
                                                    <td>{s.Parent_no}</td>
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
