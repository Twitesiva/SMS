import StaffShell from '../../components/StaffShell'
import { useState } from 'react'

export default function StudentRecords() {
    const [academicYear, setAcademicYear] = useState('')
    const [group, setGroup] = useState('')
    const [course, setCourse] = useState('')
    const [semester, setSemester] = useState('')

    return (
        <StaffShell>
            <div className="student-content__page">
                {/* Page Header */}
                <div className="student-page-header">
                    <h2 className="student-page-title">Student Records</h2>
                    <p className="student-page-subtitle">
                        View and manage student academic details
                    </p>
                </div>

                {/* Filters Bar */}
                <div className="student-filters">
                    <div className="student-filter">
                        <label>Academic Year</label>
                        <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                            <option value="">Select</option>
                            <option value="2024-25">2024 - 25</option>
                            <option value="2025-26">2025 - 26</option>
                        </select>
                    </div>

                    <div className="student-filter">
                        <label>Group</label>
                        <select value={group} onChange={(e) => setGroup(e.target.value)}>
                            <option value="">Select</option>
                            <option value="A">Group A</option>
                            <option value="B">Group B</option>
                        </select>
                    </div>

                    <div className="student-filter">
                        <label>Course</label>
                        <select value={course} onChange={(e) => setCourse(e.target.value)}>
                            <option value="">Select</option>
                            <option value="BSC-CS">B.Sc Computer Science</option>
                            <option value="BCA">BCA</option>
                        </select>
                    </div>

                    <div className="student-filter">
                        <label>Semester</label>
                        <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                            <option value="">Select</option>
                            <option value="1">Semester 1</option>
                            <option value="2">Semester 2</option>
                            <option value="3">Semester 3</option>
                            <option value="4">Semester 4</option>
                            <option value="5">Semester 5</option>
                            <option value="6">Semester 6</option>
                        </select>
                    </div>
                </div>
            </div>
        </StaffShell>
    )
}
