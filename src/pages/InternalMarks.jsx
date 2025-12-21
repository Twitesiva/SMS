import { useState, useEffect } from 'react'
import AdminShell from '../components/AdminShell'
import { supabase } from '../../supabaseClient'

export default function InternalMarks() {
    const [exams, setExams] = useState([])
    const [selectedExamId, setSelectedExamId] = useState('')
    const [loading, setLoading] = useState(true)
    const [examDates, setExamDates] = useState([])
    const [selectedDate, setSelectedDate] = useState('')
    const [loadingDates, setLoadingDates] = useState(false)
    const [subjects, setSubjects] = useState([])
    const [selectedSubjectId, setSelectedSubjectId] = useState('')
    const [loadingSubjects, setLoadingSubjects] = useState(false)

    useEffect(() => {
        fetchExams()
    }, [])

    useEffect(() => {
        if (selectedExamId) {
            fetchExamDates(selectedExamId)
            setSubjects([])
            setSelectedSubjectId('')
        } else {
            setExamDates([])
            setSelectedDate('')
            setSubjects([])
            setSelectedSubjectId('')
        }
    }, [selectedExamId])

    useEffect(() => {
        if (selectedExamId && selectedDate) {
            fetchSubjects(selectedExamId, selectedDate)
            setSelectedSubjectId('')
        } else {
            setSubjects([])
            setSelectedSubjectId('')
        }
    }, [selectedExamId, selectedDate])

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

    const fetchExamDates = async (examId) => {
        setLoadingDates(true)
        try {
            const { data, error } = await supabase
                .from('exam_schedule')
                .select('exam_date')
                .eq('exam_master_id', examId)
                .order('exam_date', { ascending: true })

            if (error) throw error

            const uniqueDates = [...new Set(data.map(item => item.exam_date))]
            setExamDates(uniqueDates)
        } catch (error) {
            console.error('Error fetching exam dates:', error)
        } finally {
            setLoadingDates(false)
        }
    }

    const fetchSubjects = async (examId, date) => {
        setLoadingSubjects(true)
        try {
            // First fetch subject codes from exam_schedule for the selected date and exam
            const { data: scheduleData, error: scheduleError } = await supabase
                .from('exam_schedule')
                .select('subject_code')
                .eq('exam_master_id', examId)
                .eq('exam_date', date)

            if (scheduleError) throw scheduleError

            const subjectCodes = [...new Set(scheduleData.map(item => item.subject_code))]

            if (subjectCodes.length > 0) {
                // Then fetch subject details from subjects table using the codes
                const { data: subjectData, error: subjectError } = await supabase
                    .from('subjects')
                    .select('subject_id, subject_name, subject_code')
                    .in('subject_code', subjectCodes)

                if (subjectError) throw subjectError

                // Filter out duplicate subject codes associated to different IDs if needed, or simply trust database uniqueness
                // To be safe against multiple subject entries with same code but different IDs (e.g. different years), we deduplicate by code for display
                const uniqueSubjects = []
                const seenCodes = new Set()

                if (subjectData) {
                    subjectData.forEach(subj => {
                        if (!seenCodes.has(subj.subject_code)) {
                            seenCodes.add(subj.subject_code)
                            uniqueSubjects.push(subj)
                        }
                    })
                }

                setSubjects(uniqueSubjects)
            } else {
                setSubjects([])
            }
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
                            <div className="col-md-4">
                                <label className="form-label">Exam Name</label>
                                <select
                                    className="form-select"
                                    value={selectedExamId}
                                    onChange={(e) => {
                                        setSelectedExamId(e.target.value)
                                        setSelectedDate('')
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
                            <div className="col-md-4">
                                <label className="form-label">Exam Date</label>
                                <select
                                    className="form-select"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    disabled={!selectedExamId || loadingDates}
                                >
                                    <option value="">Select Date</option>
                                    {examDates.map((date) => (
                                        <option key={date} value={date}>
                                            {new Date(date).toLocaleDateString('en-GB')}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-4">
                                <label className="form-label">Subject</label>
                                <select
                                    className="form-select"
                                    value={selectedSubjectId}
                                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                                    disabled={!selectedDate || loadingSubjects}
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
                        <p className="mb-0 text-muted">
                            {selectedExamId && selectedDate && selectedSubjectId ? "Internal marks entry form will appear here." : "Please select an exam, date and subject to proceed."}
                        </p>
                    </div>
                </div>
            </div>
        </AdminShell>
    )
}
