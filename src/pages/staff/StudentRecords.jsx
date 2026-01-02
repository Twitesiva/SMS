import { useEffect, useState } from 'react'
import StaffShell from '../../components/StaffShell'
import { supabase } from '../../../supabaseClient'

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
    }
    const filteredStudents = students.filter((s) =>
        s.student_id.toLowerCase().includes(searchId.toLowerCase())
    )


    return (
        <StaffShell>
            <div className="desktop-container">
                <h3 className="fw-semibold mb-4">STUDENT RECORD</h3>

                {/* ===============================
                   FILTER BAR
                ================================ */}
                <div className="card card-soft p-4 mb-4">
                    <div className="row g-3">

                        {/* Academic Year */}
                        <div className="col-md-3">
                            <label className="form-label fw-semibold">
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
                            <label className="form-label fw-semibold">
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
                            <label className="form-label fw-semibold">
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
                            <label className="form-label fw-semibold">
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

                {/* ===============================
                   STUDENT TABLE
                ================================ */}
<style>{`
  .student-table {
    width: 100%;
    border-collapse: collapse;
    background: #ffffff;
  }

  .student-table th,
  .student-table td {
    border: 1px solid #d0d7e2;
    padding: 10px 12px;
    font-size: 0.85rem;
    vertical-align: middle;
    white-space: nowrap;
  }

  .student-table thead th {
    background: #f4f7fb;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.75rem;
    color: #4a5568;
  }

  .student-table tbody tr:nth-child(even) {
    background: #fafcff;
  }

  .student-table tbody tr:hover {
    background: #eef4ff;
  }
`}</style>

{students.length > 0 && (
  <>
<div className="d-flex justify-content-center mb-3">
  <div
    className="input-group"
    style={{ maxWidth: '320px' }}
  >
    <span className="input-group-text bg-white">
      <i className="bi bi-search"></i>
    </span>

    <input
      type="text"
      className="form-control"
      placeholder="Search by Student ID"
      value={searchId}
      onChange={(e) => setSearchId(e.target.value)}
    />
  </div>
</div>


    <div className="card card-soft p-4">
      <div className="table-responsive">
        <table className="student-table">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Student ID</th>
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
              <th>Admission Year</th>
            </tr>
          </thead>
          <tbody>
{filteredStudents
  .slice() // ✅ avoid mutating state
  .sort((a, b) => a.student_id.localeCompare(b.student_id))
  .map((s, i) => (
    <tr key={s.student_id}>
      <td>{i + 1}</td>
      <td>{s.student_id}</td>
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
      <td>{s.address}</td>
      <td>{s.phone_number}</td>
      <td>{s.religion}</td>
      <td>{s.Parent_no}</td>
      <td>{s.admission_year}</td>
    </tr>
))}

          </tbody>
        </table>
      </div>
    </div>
  </>
)}



            </div>
        </StaffShell>
    )
}
