import { useState, useEffect } from 'react'
import AdminShell from "../../components/AdminShell";
import { supabase } from '../../../supabaseClient'

export default function Practical() {
    const [exams, setExams] = useState([])
    const [selectedExamId, setSelectedExamId] = useState('')
    const [loading, setLoading] = useState(true)

    const [dates, setDates] = useState([])
    const [selectedDate, setSelectedDate] = useState('')

    const [scheduleItems, setScheduleItems] = useState([])
    const [subjects, setSubjects] = useState([])
    const [selectedSubject, setSelectedSubject] = useState('')

    useEffect(() => {
        fetchExams()
    }, [])

    useEffect(() => {
        if (selectedExamId) {
            fetchDatesForExam(selectedExamId)
        } else {
            setDates([])
            setSelectedDate('')
            setScheduleItems([])
        }
    }, [selectedExamId])

    useEffect(() => {
        if (selectedDate && scheduleItems.length > 0) {
            const fetchRelevantSubjects = async () => {
                const relevantItems = scheduleItems.filter(i => i.exam_date === selectedDate)
                const codes = [...new Set(relevantItems.map(i => i.subject_code))]

                if (codes.length > 0) {
                    const { data, error } = await supabase
                        .from('subjects')
                        .select('subject_code, subject_name')
                        .in('subject_code', codes)

                    if (!error && data) {
                        // Deduplicate by subject_code
                        const uniqueSubjects = []
                        const seenCodes = new Set()
                        data.forEach(sub => {
                            if (!seenCodes.has(sub.subject_code)) {
                                seenCodes.add(sub.subject_code)
                                uniqueSubjects.push(sub)
                            }
                        })
                        setSubjects(uniqueSubjects)
                    }
                } else {
                    setSubjects([])
                }
            }
            fetchRelevantSubjects()
        } else {
            setSubjects([])
        }
        setSelectedSubject('')
    }, [selectedDate, scheduleItems])

    const fetchExams = async () => {
        try {
            const { data, error } = await supabase
                .from('exam_master')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            setExams(data || [])

            // Auto-select the latest exam if available
            if (data && data.length > 0) {
                setSelectedExamId(data[0].id)
            }
        } catch (error) {
            console.error('Error fetching exams:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchDatesForExam = async (examId) => {
        try {
            const { data, error } = await supabase
                .from('exam_schedule')
                .select('exam_date, subject_code')
                .eq('exam_master_id', examId)

            if (error) throw error

            // Filter for practical subjects (ending in 'P')
            const practicalSchedules = data.filter(item =>
                item.subject_code && item.subject_code.trim().toUpperCase().endsWith('P')
            );

            setScheduleItems(practicalSchedules)

            // Get unique dates
            const uniqueDates = [...new Set(practicalSchedules.filter(d => d.exam_date).map(d => d.exam_date))]
            // Sort dates
            uniqueDates.sort((a, b) => new Date(a) - new Date(b))

            setDates(uniqueDates)
            setSelectedDate('') // Reset date selection when exam changes
        } catch (error) {
            console.error('Error fetching dates:', error)
            setDates([])
            setScheduleItems([])
        }
    }

    const [studentsList, setStudentsList] = useState([])
    const [loadingStudents, setLoadingStudents] = useState(false)

    useEffect(() => {
        if (selectedExamId && selectedDate && selectedSubject) {
            fetchStudents()
        } else {
            setStudentsList([])
        }
    }, [selectedExamId, selectedDate, selectedSubject])

    const fetchStudents = async () => {
        setLoadingStudents(true)
        try {
            // 1. Get subject IDs for the selected code
            const { data: subjectData, error: subjError } = await supabase
                .from('subjects')
                .select('subject_id')
                .eq('subject_code', selectedSubject)

            if (subjError) throw subjError
            const subjectIds = subjectData.map(s => s.subject_id)

            if (subjectIds.length === 0) {
                setStudentsList([])
                return
            }

            // 2. Get all registrations for this exam
            const { data: registrations, error: regError } = await supabase
                .from('exam_registrations')
                .select('id, student_id')
                .eq('exam_id', selectedExamId)

            if (regError) throw regError

            if (!registrations || registrations.length === 0) {
                setStudentsList([])
                return
            }

            const registrationIds = registrations.map(r => r.id)
            const regMap = new Map(registrations.map(r => [r.id, r.student_id]))

            // 3. Filter for those registered for this subject
            const { data: validRegSubjects, error: vrsError } = await supabase
                .from('exam_registration_subjects')
                .select('exam_registration_id, subject_id')
                .in('exam_registration_id', registrationIds)
                .in('subject_id', subjectIds)

            if (vrsError) throw vrsError

            const validStudentIds = []
            const studentSubjectMap = new Map() // Map student_id -> subject_id

            validRegSubjects.forEach(v => {
                const sId = regMap.get(v.exam_registration_id)
                if (sId) {
                    validStudentIds.push(sId)
                    studentSubjectMap.set(sId, v.subject_id)
                }
            })

            // Deduplicate ids just in case
            const uniqueStudentIds = [...new Set(validStudentIds)]

            if (uniqueStudentIds.length === 0) {
                setStudentsList([])
                return
            }

            // 4. Get student details
            const { data: students, error: studError } = await supabase
                .from('students')
                .select('id, hall_ticket_no, full_name, group_name')
                .in('id', uniqueStudentIds)
                .order('hall_ticket_no', { ascending: true })

            if (studError) throw studError

            // 5. Fetch existing marks for these students and subject
            const { data: existingMarks, error: marksError } = await supabase
                .from('marks')
                .select('id, student_id, subject_id, theory_marks')
                .in('student_id', uniqueStudentIds)
                .in('subject_id', subjectIds)

            if (marksError) throw marksError

            const marksMap = new Map()
            if (existingMarks) {
                existingMarks.forEach(m => {
                    const key = `${m.student_id}-${m.subject_id}`
                    marksMap.set(key, m)
                })
            }

            const formattedStudents = (students || []).map(stud => {
                const sId = stud.id
                const subId = studentSubjectMap.get(sId)
                const key = `${sId}-${subId}`
                const markEntry = marksMap.get(key)

                return {
                    ...stud,
                    subject_id: subId,
                    marks: markEntry ? markEntry.theory_marks : '',
                    mark_id: markEntry ? markEntry.id : null,
                    isSaved: !!markEntry,
                    error: null
                }
            })

            setStudentsList(formattedStudents)

        } catch (error) {
            console.error('Error fetching students:', error)
            setStudentsList([])
        } finally {
            setLoadingStudents(false)
        }
    }

    const handleSaveMark = async (student) => {
        try {
            if (student.marks === '' || student.marks === null) return;
            const marksValue = Number(student.marks);

            if (!student.subject_id) {
                alert("Subject ID missing for student")
                return
            }

            let error;
            let data;

            if (student.mark_id) {
                // Update existing mark
                const { data: updateData, error: updateError } = await supabase
                    .from('marks')
                    .update({
                        theory_marks: marksValue,
                    })
                    .eq('id', student.mark_id)
                    .select('id')

                error = updateError;
                data = updateData;
            } else {
                // Insert new mark
                const { data: insertData, error: insertError } = await supabase
                    .from('marks')
                    .insert({
                        student_id: student.id,
                        subject_id: student.subject_id,
                        theory_marks: marksValue,
                    })
                    .select('id')

                error = insertError;
                data = insertData;
            }

            if (error) {
                if (error.message && error.message.includes('column "id" does not exist')) {
                    console.error("DB ERROR: Check 'marks' table triggers (e.g. set_max_marks_by_subject). Likely referencing invalid column 'id' on 'subjects' table.");
                    alert("Database Error: Trigger function likely references missing column 'id'. Please check schema.");
                }
                throw error
            }

            // Update local state
            setStudentsList(prev => prev.map(s => {
                if (s.id === student.id) {
                    return {
                        ...s,
                        isSaved: true,
                        mark_id: data && data[0] ? data[0].id : s.mark_id // Update the mark_id from response
                    }
                }
                return s
            }))

        } catch (error) {
            console.error('Error saving mark:', error)
            alert(`Failed to save mark: ${error.message}`)
        }
    }

    return (
        <AdminShell>
            <div className="container-fluid px-4">
                <div className="d-flex justify-content-between align-items-center mb-4 mt-4">
                    <div>
                        <h2 className="fw-bold mb-1">Practical</h2>
                        <p className="text-muted mb-0">Manage practical exams and schedules</p>
                    </div>
                </div>

                <div className="card shadow-sm border-0 mb-4">
                    <div className="card-body">
                        <div className="row g-3">
                            <div className="col-md-4">
                                <label className="form-label">Exam Name</label>
                                <select
                                    className="form-select"
                                    value={selectedExamId}
                                    onChange={(e) => setSelectedExamId(e.target.value)}
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
                            <div className="col-md-4">
                                <label className="form-label">Date</label>
                                <select
                                    className="form-select"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    disabled={!selectedExamId}
                                >
                                    <option value="">Select Date</option>
                                    {dates.map((date) => (
                                        <option key={date} value={date}>
                                            {new Date(date).toLocaleDateString()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label">Subject</label>
                                <select
                                    className="form-select"
                                    value={selectedSubject}
                                    onChange={(e) => setSelectedSubject(e.target.value)}
                                    disabled={!selectedDate || subjects.length === 0}
                                >
                                    <option value="">Select Subject</option>
                                    {subjects.map((subj) => (
                                        <option key={subj.subject_code} value={subj.subject_code}>
                                            {subj.subject_name} ({subj.subject_code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card shadow-sm border-0">
                    <div className="card-header bg-white py-3">
                        <h5 className="mb-0 fw-bold">Student List</h5>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-hover table-striped mb-0 align-middle">
                            <thead className="activity-table-header">
                                <tr>
                                    <th width="5%" className="text-center">S.No</th>
                                    <th width="20%">Hall Ticket No</th>
                                    <th width="35%">Student Name</th>
                                    <th width="20%">Marks</th>
                                    <th width="15%">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingStudents ? (
                                    <tr>
                                        <td colSpan="4" className="text-center py-5">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : studentsList.length > 0 ? (
                                    studentsList.map((student, index) => (
                                        <tr key={student.id}>
                                            <td className="text-center">{index + 1}</td>
                                            <td className="fw-semibold">{student.hall_ticket_no}</td>
                                            <td>{student.full_name}</td>
                                            <td>
                                                <div className="d-flex flex-column">
                                                    <input
                                                        type="number"
                                                        className={`form-control form-control-sm ${student.error ? 'is-invalid' : ''}`}
                                                        style={{ width: "100px" }}
                                                        placeholder="Marks"
                                                        min="0"
                                                        max="70"
                                                        disabled={student.isSaved}
                                                        value={student.marks}
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            const numVal = Number(newVal);

                                                            let error = null;
                                                            if (newVal !== '' && (numVal < 0 || numVal > 70)) {
                                                                error = "Invalid marks";
                                                            }

                                                            setStudentsList(prev => prev.map(s =>
                                                                s.id === student.id ? { ...s, marks: newVal, error: error } : s
                                                            ));
                                                        }}
                                                    />
                                                    {student.error && (
                                                        <small className="text-danger mt-1" style={{ fontSize: '0.75rem' }}>
                                                            {student.error}
                                                        </small>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                {student.isSaved ? (
                                                    <span className="badge bg-success">Submitted</span>
                                                ) : (
                                                    <button
                                                        className="btn btn-sm btn-success"
                                                        disabled={!!student.error || student.marks === ''}
                                                        onClick={() => handleSaveMark(student)}
                                                    >
                                                        Submit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="text-center py-5 text-muted">
                                            {selectedDate && selectedSubject
                                                ? "No students found allocated for this subject."
                                                : "Please select all filters to view students."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminShell>
    );
}
