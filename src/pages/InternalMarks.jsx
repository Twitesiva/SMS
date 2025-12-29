import { useState, useEffect } from 'react'
import AdminShell from '../components/AdminShell'
import { supabase } from '../../supabaseClient'
import { showToast } from '../store/ui'

export default function InternalMarks() {
    const [exams, setExams] = useState([])
    const [selectedExamId, setSelectedExamId] = useState('')
    const [loading, setLoading] = useState(true)

    const [groups, setGroups] = useState([])
    const [selectedGroup, setSelectedGroup] = useState('')
    const [courses, setCourses] = useState([])
    const [selectedCourse, setSelectedCourse] = useState('')

    const [semesters, setSemesters] = useState([])
    const [selectedSemester, setSelectedSemester] = useState('')

    const [subjects, setSubjects] = useState([])
    const [selectedSubjectId, setSelectedSubjectId] = useState('')
    const [loadingSubjects, setLoadingSubjects] = useState(false)

    const [studentList, setStudentList] = useState([])
    const [loadingStudents, setLoadingStudents] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        fetchExams()
        fetchGroups()
    }, [])

    useEffect(() => {
        if (selectedGroup) {
            fetchCourses(selectedGroup)
            setSelectedCourse('')
            setSemesters([])
            setSelectedSemester('')
            setSubjects([])
            setSelectedSubjectId('')
        } else {
            setCourses([])
            setSelectedCourse('')
            setSemesters([])
            setSelectedSemester('')
            setSubjects([])
            setSelectedSubjectId('')
        }
    }, [selectedGroup])

    useEffect(() => {
        let isActive = true

        const fetchSemestersForExam = async () => {
            // Reset downstream selections
            if (isActive) {
                setSemesters([])
                setSelectedSemester('')
                setSubjects([])
                setSelectedSubjectId('')
            }

            if (!selectedCourse || !selectedExamId) {
                return
            }

            try {
                // 1. Get all subject codes scheduled for this exam
                const { data: scheduleData, error: schedError } = await supabase
                    .from('exam_schedule')
                    .select('subject_code')
                    .eq('exam_master_id', selectedExamId)

                if (schedError) throw schedError

                if (!scheduleData || scheduleData.length === 0) {
                    // No subjects scheduled for this exam at all
                    return
                }

                const scheduledCodes = scheduleData.map(s => s.subject_code)

                // 2. Find which semesters these subjects belong to (for the selected course)
                const { data: subjectData, error: subjError } = await supabase
                    .from('subjects')
                    .select('semester_number')
                    .eq('course_name', selectedCourse) // course_name FK refers to course_code
                    .in('subject_code', scheduledCodes)

                if (subjError) throw subjError

                if (isActive && subjectData) {
                    const distinctSemesters = [...new Set(subjectData.map(s => s.semester_number))]
                    distinctSemesters.sort((a, b) => a - b)
                    setSemesters(distinctSemesters)
                }

            } catch (err) {
                console.error("Error fetching semesters:", err)
            }
        }

        fetchSemestersForExam()

        return () => { isActive = false }
    }, [selectedCourse, selectedExamId])

    useEffect(() => {
        if (selectedExamId && selectedCourse && selectedSemester) {
            fetchSubjects(selectedExamId, selectedCourse, selectedSemester)
            setSelectedSubjectId('')
        } else {
            setSubjects([])
            setSelectedSubjectId('')
        }
    }, [selectedExamId, selectedCourse, selectedSemester])

    useEffect(() => {
        let isActive = true

        const loadStudentData = async () => {
            if (selectedExamId && selectedGroup && selectedCourse && selectedSemester && selectedSubjectId) {
                setLoadingStudents(true)
                try {
                    // Resolve Subject Code
                    const selectedSubjectObj = subjects.find(s => s.subject_id.toString() === selectedSubjectId.toString())
                    if (!selectedSubjectObj) {
                        console.error("Selected subject not found in lookup")
                        if (isActive) {
                            setStudentList([])
                            setLoadingStudents(false)
                        }
                        return
                    }
                    const targetSubjectCode = selectedSubjectObj.subject_code

                    const data = await fetchStudentsData(selectedExamId, targetSubjectCode)

                    if (isActive) {
                        setStudentList(data)
                    }
                } catch (error) {
                    console.error("Error loading students:", error)
                    if (isActive) setStudentList([])
                } finally {
                    if (isActive) setLoadingStudents(false)
                }
            } else {
                setStudentList([])
            }
        }

        loadStudentData()

        return () => { isActive = false }
    }, [selectedExamId, selectedGroup, selectedCourse, selectedSemester, selectedSubjectId, subjects])

    const fetchStudentsData = async (examId, subjectCode) => {
        try {
            // 0. Fetch ALL subject IDs that match this code
            const { data: matchingSubjects, error: subjErr } = await supabase
                .from('subjects')
                .select('subject_id')
                .eq('subject_code', subjectCode)

            if (subjErr) throw subjErr
            const validSubjectIds = matchingSubjects.map(s => s.subject_id)

            // 1. Get all registrations for this exam
            const { data: registrations, error: regError } = await supabase
                .from('exam_registrations')
                .select('id, student_id')
                .eq('exam_id', examId)

            if (regError) throw regError

            if (!registrations || registrations.length === 0) {
                return []
            }

            const regIds = registrations.map(r => r.id)
            const studentIdMap = {}
            registrations.forEach(r => {
                studentIdMap[r.id] = r.student_id
            })

            // 2. Get exam_registration_subjects
            const { data: registrationSubjects, error: subError } = await supabase
                .from('exam_registration_subjects')
                .select(`
                    id,
                    exam_registration_id,
                    subject_id
                `)
                .in('subject_id', validSubjectIds)
                .in('exam_registration_id', regIds)

            if (subError) throw subError

            if (!registrationSubjects || registrationSubjects.length === 0) {
                return []
            }

            // 3. Get student details & existing marks
            const studentIdsToFetch = [...new Set(registrationSubjects.map(rs => studentIdMap[rs.exam_registration_id]))]

            // Parallel fetch
            const [studentsResult, marksResult] = await Promise.all([
                supabase
                    .from('students')
                    .select('id, full_name, hall_ticket_no')
                    .in('id', studentIdsToFetch),
                supabase
                    .from('marks')
                    .select('student_id, subject_id, internal_marks, theory_marks')
                    .in('student_id', studentIdsToFetch)
                    .in('subject_id', validSubjectIds)
            ])

            if (studentsResult.error) throw studentsResult.error
            if (marksResult.error) throw marksResult.error

            const studentsMap = {}
            if (studentsResult.data) {
                studentsResult.data.forEach(s => studentsMap[s.id] = s)
            }

            const marksMap = {} // key: `${studentId}-${subjectId}`
            if (marksResult.data) {
                marksResult.data.forEach(m => {
                    marksMap[`${m.student_id}-${m.subject_id}`] = m
                })
            }

            // 4. Combine everything
            const formattedList = registrationSubjects.map(rs => {
                const sId = studentIdMap[rs.exam_registration_id]
                const student = studentsMap[sId]
                // Key for marks lookup
                const markKey = `${sId}-${rs.subject_id}`
                const existingMark = marksMap[markKey]

                return {
                    id: rs.id, // exam_registration_subjects id
                    studentId: sId,
                    subjectId: rs.subject_id,
                    studentName: student?.full_name || 'Unknown',
                    hallTicketNo: student?.hall_ticket_no || 'N/A',
                    internalMarks: existingMark ? existingMark.internal_marks : '',
                    theoryMarks: existingMark ? existingMark.theory_marks : 0, // Store theory marks for total calculation
                    isSaved: !!existingMark,
                    error: null
                }
            })

            // Sort by Hall Ticket
            formattedList.sort((a, b) => a.hallTicketNo.localeCompare(b.hallTicketNo, undefined, { numeric: true }))

            return formattedList

        } catch (error) {
            console.error('Fetch logic error:', error)
            return []
        }
    }

    const handleSaveMarks = async () => {
        setIsSaving(true)
        try {
            // Prepare payload
            // Upsert based on (student_id, subject_id)
            const updates = studentList.map(student => {
                const internal = student.internalMarks === '' ? 0 : Number(student.internalMarks)
                const theory = Number(student.theoryMarks) || 0
                return {
                    student_id: student.studentId,
                    subject_id: student.subjectId,
                    internal_marks: internal,
                }
            })

            const { error } = await supabase
                .from('marks')
                .upsert(updates, { onConflict: 'student_id, subject_id' })

            if (error) throw error

            showToast('Internal marks saved successfully!', { type: 'success' })
            setSelectedSubjectId('')
        } catch (error) {
            console.error('Error saving marks:', error)
            showToast('Failed to save marks.', { type: 'error' })
        } finally {
            setIsSaving(false)
        }
    }

    const fetchExams = async () => {
        try {
            const { data, error } = await supabase
                .from('exam_master')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            setExams(data || [])
        } catch (error) {
            console.error('Error fetching exams:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchGroups = async () => {
        try {
            const { data, error } = await supabase
                .from('groups')
                .select('group_name')
                .order('group_name')

            if (error) throw error
            const uniqueGroups = [...new Set(data.map(g => g.group_name))]
            setGroups(uniqueGroups)
        } catch (error) {
            console.error('Error fetching groups:', error)
        }
    }

    const fetchCourses = async (groupName) => {
        try {
            const { data, error } = await supabase
                .from('courses')
                .select('course_id, course_name, course_code, no_of_semesters')
                .eq('group_name', groupName)
                .order('course_name')

            if (error) throw error
            setCourses(data || [])
        } catch (error) {
            console.error('Error fetching courses:', error)
        }
    }

    const fetchSubjects = async (examId, courseCode, semester) => {
        setLoadingSubjects(true)
        try {
            const { data: scheduleData, error: scheduleError } = await supabase
                .from('exam_schedule')
                .select('subject_code')
                .eq('exam_master_id', examId)

            if (scheduleError) throw scheduleError

            const examSubjectCodes = new Set(scheduleData.map(item => item.subject_code))

            if (examSubjectCodes.size === 0) {
                setSubjects([])
                setLoadingSubjects(false)
                return
            }

            const { data: subjectData, error: subjectError } = await supabase
                .from('subjects')
                .select('subject_id, subject_name, subject_code')
                .eq('course_name', courseCode)
                .eq('semester_number', semester)

            if (subjectError) throw subjectError

            const uniqueSubjects = []
            const seenCodes = new Set()

            if (subjectData) {
                subjectData.forEach(subj => {
                    const code = subj.subject_code
                    if (examSubjectCodes.has(code) && !seenCodes.has(code)) {
                        // Filter out practical subjects (ending with 'P')
                        if (!code.trim().toUpperCase().endsWith('P')) {
                            seenCodes.add(code)
                            uniqueSubjects.push(subj)
                        }
                    }
                })
            }

            setSubjects(uniqueSubjects)
        } catch (error) {
            console.error('Error fetching subjects:', error)
        } finally {
            setLoadingSubjects(false)
        }
    }

    return (
        <AdminShell>
            <div className="container-fluid px-4">
                <h1 className="mt-4">Internal Marks Entry</h1>
                <div className="card mb-4">
                    <div className="card-body">
                        <div className="row mb-3">
                            <div className="col-md-3">
                                <label className="form-label">Exam Name</label>
                                <select
                                    className="form-select"
                                    value={selectedExamId}
                                    onChange={(e) => {
                                        setSelectedExamId(e.target.value)
                                    }}
                                >
                                    <option value="">Select Exam</option>
                                    {exams.map((exam) => (
                                        <option
                                            key={exam.id}
                                            value={exam.id}
                                            disabled={exam.results_published}
                                        >
                                            {exam.exam_name} {exam.results_published ? '(Results Published)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label">Group Name</label>
                                <select
                                    className="form-select"
                                    value={selectedGroup}
                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                >
                                    <option value="">Select Group</option>
                                    {groups.map((group, index) => (
                                        <option key={index} value={group}>
                                            {group}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Course Name</label>
                                <select
                                    className="form-select"
                                    value={selectedCourse}
                                    onChange={(e) => setSelectedCourse(e.target.value)}
                                    disabled={!selectedGroup}
                                >
                                    <option value="">Select Course</option>
                                    {courses.map((course) => (
                                        <option key={course.course_id} value={course.course_code}>
                                            {course.course_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Semester</label>
                                <select
                                    className="form-select"
                                    value={selectedSemester}
                                    onChange={(e) => setSelectedSemester(e.target.value)}
                                    disabled={!selectedCourse}
                                >
                                    <option value="">Select Semester</option>
                                    {semesters.map((sem) => (
                                        <option key={sem} value={sem}>
                                            Semester {sem}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-2">
                                <label className="form-label">Subject</label>
                                <select
                                    className="form-select"
                                    value={selectedSubjectId}
                                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                                    disabled={!selectedSemester || loadingSubjects}
                                >
                                    <option value="">Select Subject</option>
                                    {subjects.map((subject) => (
                                        <option key={subject.subject_id} value={subject.subject_id}>
                                            {subject.subject_code} - {subject.subject_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <hr />

                        {loadingStudents && selectedExamId && selectedGroup && selectedCourse && selectedSemester && selectedSubjectId ? (
                            <div className="text-center py-4">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <p className="mt-2">Loading students...</p>
                            </div>
                        ) : studentList.length > 0 ? (
                            <div className="table-responsive">
                                <table className="table table-bordered table-striped table-hover">
                                    <thead className="table-dark">
                                        <tr>
                                            <th style={{ width: '5%' }}>S.No</th>
                                            <th style={{ width: '20%' }}>Hall Ticket No</th>
                                            <th style={{ width: '35%' }}>Student Name</th>
                                            <th style={{ width: '20%' }}>Internal Marks</th>
                                            <th style={{ width: '20%' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {studentList.map((student, index) => (
                                            <tr key={student.id}>
                                                <td>{index + 1}</td>
                                                <td>{student.hallTicketNo}</td>
                                                <td>
                                                    {student.studentName}
                                                </td>
                                                <td>
                                                    <div className="d-flex flex-column">
                                                        <input
                                                            type="number"
                                                            className={`form-control ${student.error ? 'is-invalid' : ''}`}
                                                            value={student.internalMarks}
                                                            disabled={student.isSaved}
                                                            onChange={(e) => {
                                                                const newValue = e.target.value;
                                                                const numValue = Number(newValue);
                                                                let error = null;
                                                                if (newValue !== '' && (numValue < 0 || numValue > 30)) {
                                                                    error = "Please enter valid marks";
                                                                }
                                                                setStudentList(prev => prev.map((s, i) =>
                                                                    i === index ? { ...s, internalMarks: newValue, error: error } : s
                                                                ));
                                                            }}
                                                            placeholder="Marks"
                                                            max="30"
                                                        />
                                                        {student.error && (
                                                            <small className="text-danger mt-1">
                                                                {student.error}
                                                            </small>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    {student.isSaved ? <span className="badge bg-success">Submitted</span> : <span className="text-muted">-</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="text-end mt-3">
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSaveMarks}
                                        disabled={isSaving || studentList.some(s => s.error)}
                                    >
                                        {isSaving ? 'Saving...' : 'Save Marks'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-5 text-muted">
                                <i className="bi bi-clipboard-data display-1 text-secondary opacity-25 mb-3"></i>
                                <p className="fs-5">
                                    {!selectedExamId ? "Please select an Exam to proceed." :
                                        !selectedGroup ? "Please select a Group." :
                                            !selectedCourse ? "Please select a Course." :
                                                !selectedSemester ? "Please select a Semester." :
                                                    !selectedSubjectId ? "Please select a Subject to view students." :
                                                        "No students found for this subject selection."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminShell >
    )
}
