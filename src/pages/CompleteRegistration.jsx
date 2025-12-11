import AdminShell from '../components/AdminShell'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/mockApi'
import { showToast } from '../store/ui.js'
import { supabase } from '../../supabaseClient'
import { TIME_SLOTS } from '../lib/timeSlots'

const EXAM_NAME_PREFIX = 'Regular and Supplementary Examinations - '

export default function CompleteRegistration() {
    const [exams, setExams] = useState([])
    const [examsLoading, setExamsLoading] = useState(false)
    const [completeRegistrationModalOpen, setCompleteRegistrationModalOpen] = useState(false)
    const [completionTargetExam, setCompletionTargetExam] = useState(null)
    const [timetableModalState, setTimetableModalState] = useState({
        open: false,
        exam: null,
        schedules: [],
        loading: false,
    })
    const [subjects, setSubjects] = useState([])
    const [groups, setGroups] = useState([])
    const [courses, setCourses] = useState([])

    const refreshExams = useCallback(async () => {
        setExamsLoading(true)
        try {
            const { data, error } = await supabase
                .from('exam_master')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setExams(data || [])
        } catch (error) {
            console.error('Error fetching exams:', error)
            showToast('Failed to load exams. Please try again later.', { type: 'error' })
        } finally {
            setExamsLoading(false)
        }
    }, [])

    useEffect(() => {
        refreshExams()
    }, [refreshExams])

    useEffect(() => {
        let mounted = true
        Promise.all([
            api.listSubjects(),
            api.listGroups(),
            api.listCourses()
        ])
            .then(([subjectList, groupList, courseList]) => {
                if (mounted) {
                    setSubjects(subjectList || [])
                    setGroups(groupList || [])
                    setCourses(courseList || [])
                }
            })
            .catch((err) => {
                console.error('Failed to load data for timetable view:', err)
            })
        return () => {
            mounted = false
        }
    }, [])



    const openCompleteRegistrationModal = (exam) => {
        setCompletionTargetExam(exam)
        setCompleteRegistrationModalOpen(true)
    }

    const closeCompleteRegistrationModal = () => {
        setCompleteRegistrationModalOpen(false)
        setCompletionTargetExam(null)
    }

    const openTimetableModal = async (exam) => {
        setTimetableModalState({ open: true, exam, schedules: [], loading: true })
        try {
            const { data, error } = await supabase
                .from('exam_schedule')
                .select('*')
                .eq('exam_master_id', exam.id)
                .order('exam_date', { ascending: true })
                .order('exam_start_time', { ascending: true })

            if (error) throw error
            setTimetableModalState({ open: true, exam, schedules: data || [], loading: false })
        } catch (error) {
            console.error('Failed to fetch timetable:', error)
            showToast('Failed to load timetable.', { type: 'error' })
            setTimetableModalState({ open: false, exam: null, schedules: [], loading: false })
        }
    }

    const closeTimetableModal = () => {
        setTimetableModalState({ open: false, exam: null, schedules: [], loading: false })
    }

    const assignSeatNumbersForExam = useCallback(async (examMasterId) => {
        if (!examMasterId) {
            console.error('No exam master ID provided for seat assignment')
            return 0
        }

        const { data: registrations, error: regError } = await supabase
            .from('exam_registrations')
            .select('id, student_id, exam_id')
            .eq('exam_id', examMasterId)
            .not('student_id', 'is', null)
            .not('exam_id', 'is', null)

        if (regError) {
            console.error('Error fetching exam registrations:', regError)
            throw new Error('Failed to fetch exam registrations')
        }
        const registrationIds = (registrations || [])
            .map((registration) => registration?.id)
            .filter(Boolean)
        if (!registrationIds.length) {
            return 0
        }
        const studentIds = Array.from(
            new Set(
                (registrations || [])
                    .map((registration) => registration?.student_id)
                    .filter(Boolean)
            )
        )
        let studentLookup = new Map()
        if (studentIds.length) {
            const { data: studentRows, error: studentsError } = await supabase
                .from('students')
                .select('id, full_name, student_id')
                .in('id', studentIds)
                .order('full_name', { ascending: true })
            if (studentsError) throw studentsError
            studentLookup = new Map(
                (studentRows || []).map((student) => [String(student.id), student])
            )
        }
        const { data: subjectRows, error: subjectsError } = await supabase
            .from('exam_registration_subjects')
            .select('exam_registration_id, subject_id')
            .in('exam_registration_id', registrationIds)
        if (subjectsError) throw subjectsError
        const validEntries = (subjectRows || [])
            .map((entry) => {
                const registration = (registrations || []).find(
                    (reg) => reg?.id === entry?.exam_registration_id
                )
                if (!registration || !entry?.subject_id) return null
                const student = studentLookup.get(String(registration.student_id))
                const name = (
                    student?.full_name ||
                    student?.student_id ||
                    ''
                )
                    .toString()
                    .trim()
                    .toLowerCase()
                return {
                    ...entry,
                    student_id: registration.student_id,
                    exam_id: registration.exam_id,
                    studentName: name,
                }
            })
            .filter(Boolean)
        if (!validEntries.length) {
            return 0
        }
        const { data: scheduleData, error: scheduleError } = await supabase
            .from('exam_schedule')
            .select('subject_code, exam_date')
            .eq('exam_master_id', examMasterId)

        if (scheduleError) {
            console.error('Error fetching exam schedules:', scheduleError)
            throw new Error('Failed to fetch exam schedules')
        }

        const subjectDateMap = new Map()
        if (scheduleData) {
            scheduleData.forEach((sch) => {
                if (sch.subject_code) {
                    subjectDateMap.set(sch.subject_code.trim().toUpperCase(), sch.exam_date)
                }
            })
        }

        const subjectIds = Array.from(new Set(validEntries.map((e) => e.subject_id)))
        const { data: subjectDetails, error: subjectDetailsError } = await supabase
            .from('subjects')
            .select('subject_id, subject_code')
            .in('subject_id', subjectIds)

        if (subjectDetailsError) throw subjectDetailsError

        const subjectIdToCodeMap = new Map()
        subjectDetails.forEach((s) => {
            if (s.subject_code) subjectIdToCodeMap.set(s.subject_id, s.subject_code.trim().toUpperCase())
        })

        const entriesByDate = new Map()
        const unscheduledEntries = []

        validEntries.forEach((entry) => {
            const code = subjectIdToCodeMap.get(entry.subject_id)
            const date = code ? subjectDateMap.get(code) : null
            if (date) {
                if (!entriesByDate.has(date)) entriesByDate.set(date, [])
                entriesByDate.get(date).push(entry)
            } else {
                unscheduledEntries.push(entry)
            }
        })

        const seatAssignments = []

        entriesByDate.forEach((entries, date) => {
            entries.sort((a, b) => a.studentName.localeCompare(b.studentName))
            entries.forEach((entry, index) => {
                seatAssignments.push({
                    exam_id: examMasterId,
                    student_id: entry.student_id,
                    subject_id: entry.subject_id,
                    seat_number: `S${String(index + 1).padStart(4, '0')}`,
                })
            })
        })

        if (unscheduledEntries.length > 0) {
            unscheduledEntries.sort((a, b) => a.studentName.localeCompare(b.studentName))
            unscheduledEntries.forEach((entry, index) => {
                seatAssignments.push({
                    exam_id: examMasterId,
                    student_id: entry.student_id,
                    subject_id: entry.subject_id,
                    seat_number: `U${String(index + 1).padStart(4, '0')}`,
                })
            })
        }
        const { error: deleteError } = await supabase
            .from('student_subject_seats')
            .delete()
            .eq('exam_id', examMasterId)

        if (deleteError) {
            console.error('Error deleting existing seat assignments:', deleteError)
            throw new Error('Failed to clear existing seat assignments')
        }

        const BATCH_SIZE = 100
        for (let i = 0; i < seatAssignments.length; i += BATCH_SIZE) {
            const batch = seatAssignments.slice(i, i + BATCH_SIZE)
            const { error: insertError } = await supabase
                .from('student_subject_seats')
                .insert(batch)
            if (insertError) {
                console.error('Error inserting seat assignments batch:', insertError)
                throw new Error(`Failed to save seat assignments (batch ${i / BATCH_SIZE + 1})`)
            }
        }
        return seatAssignments.length
    }, [])

    const handleCompleteRegistrationConfirm = async () => {
        if (!completionTargetExam?.id) {
            showToast('No exam selected for registration', { type: 'warning' })
            return
        }

        closeCompleteRegistrationModal()

        try {
            showToast('Starting registration process...', { type: 'info', autoClose: 2000 })

            const { count: registrationCount } = await supabase
                .from('exam_registrations')
                .select('*', { count: 'exact', head: true })
                .eq('exam_id', completionTargetExam.id)

            if (!registrationCount) {
                showToast('No student registrations found for this exam', { type: 'warning' })
                return
            }

            const assignedCount = await assignSeatNumbersForExam(completionTargetExam.id)

            const { error: updateError } = await supabase
                .from('exam_master')
                .update({ registration_completed: true })
                .eq('id', completionTargetExam.id)

            if (updateError) throw updateError

            const message = assignedCount > 0
                ? `Successfully assigned ${assignedCount} seat numbers for the exam.`
                : 'No seat assignments were needed.'

            showToast(message, {
                type: 'success',
                title: 'Registration Completed',
                autoClose: 5000,
            })

            await refreshExams()
        } catch (error) {
            console.error('Registration failed:', error)
            const errorMessage = error.message || 'An unknown error occurred during registration'
            showToast(`Registration failed: ${errorMessage}`, {
                type: 'danger',
                title: 'Registration Error',
                autoClose: 10000,
            })
        }
    }

    return (
        <AdminShell>
            <div className="container py-4">
                <h2 className="fw-bold mb-1">Complete Registration & View Time table</h2>
                <p className="text-muted mb-4">
                </p>
                <div className="card card-soft p-3 mb-4">
                    <div className="mt-3">
                        <div className="fw-bold fs-5 mb-1">Exam Names</div>
                        <div className="list-group list-group-flush">
                            {examsLoading ? (
                                <div className="text-muted small px-3 py-2">Loading exams...</div>
                            ) : exams.length ? (
                                exams.map((exam, index) => (
                                    <div
                                        key={exam.id}
                                        className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2"
                                    >
                                        <div className="d-flex align-items-center gap-3 w-100 w-md-auto">
                                            <div className="fw-bold text-muted text-end" style={{ minWidth: '24px' }}>
                                                {index + 1}.
                                            </div>
                                            <div className="fw-semibold">
                                                {exam.exam_name.startsWith(EXAM_NAME_PREFIX)
                                                    ? exam.exam_name
                                                    : `${EXAM_NAME_PREFIX}${exam.exam_name}`}
                                            </div>
                                        </div>
                                        <div className="d-flex flex-wrap gap-2 justify-content-end w-100 w-md-auto">
                                            <button
                                                type="button"
                                                className={`btn btn-sm rounded-pill px-3 ${exam.registration_completed ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                                                onClick={() => openCompleteRegistrationModal(exam)}
                                                disabled={!!exam.registration_completed}
                                            >
                                                {exam.registration_completed ? 'Completed' : 'Complete Registration'}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-info rounded-pill px-3"
                                                onClick={() => openTimetableModal(exam)}
                                            >
                                                View Time Table
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-muted small px-3 py-2">No exams saved yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {completeRegistrationModalOpen && (
                <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-0">
                                <h5 className="modal-title fw-bold">Complete Exam Registration</h5>
                                <button type="button" className="btn-close" aria-label="Close" onClick={closeCompleteRegistrationModal}></button>
                            </div>
                            <div className="modal-body">
                                <p className="text-muted">
                                    This will assign seat numbers to all registered students for{' '}
                                    <strong>{completionTargetExam?.exam_name}</strong>.
                                </p>
                                <p className="text-muted small mb-0">
                                    Seat assignments may take a few moments. You can safely leave this dialog open.
                                </p>
                            </div>
                            <div className="modal-footer border-0 pt-0">
                                <button type="button" className="btn btn-outline-secondary" onClick={closeCompleteRegistrationModal}>
                                    Cancel
                                </button>
                                <button type="button" className="btn btn-success" onClick={handleCompleteRegistrationConfirm}>
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {timetableModalState.open && (
                <div
                    className="modal d-block"
                    tabIndex="-1"
                    role="dialog"
                    aria-modal="true"
                    style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                >
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-0 pb-0">
                                <div>
                                    <h5 className="modal-title fw-bold">Exam Time Table</h5>
                                    <p className="text-muted small mb-0">{timetableModalState.exam?.exam_name}</p>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    aria-label="Close"
                                    onClick={closeTimetableModal}
                                ></button>
                            </div>
                            <div className="modal-body">
                                {timetableModalState.loading ? (
                                    <div className="text-center py-4">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                ) : timetableModalState.schedules.length === 0 ? (
                                    <div className="text-center py-4 text-muted">No schedules found for this exam.</div>
                                ) : (
                                    <div className="table-responsive">
                                        {(() => {
                                            // Group schedules by group_code and course_code strictly based on subject association
                                            // If schedule has them, user them. But user requested "based on subject id" (likely subject code link)
                                            // So we prioritize looking up the subject first.

                                            const grouped = {}

                                            timetableModalState.schedules.forEach(sch => {
                                                // Find the subject to get accurate group/course info
                                                const foundSubject = subjects.find(
                                                    (s) =>
                                                        s.subjectCode === sch.subject_code ||
                                                        (s.subjectCodes && s.subjectCodes.includes(sch.subject_code)) ||
                                                        s.subject_code === sch.subject_code
                                                )

                                                // Determine Group and Course codes
                                                // Priority: Subject's Group/Course -> Schedule's Group/Course -> Course's Group -> 'N/A'
                                                let cCode = foundSubject?.courseCode || foundSubject?.course_code || sch.course_code || null
                                                let gCode = foundSubject?.groupCode || foundSubject?.group_code || sch.group_code || null

                                                // If Group is missing but we have Course, try to find Group from Course list
                                                if ((!gCode || gCode === 'N/A') && cCode) {
                                                    const linkedCourse = courses.find(c => c.code === cCode || c.courseCode === cCode || c.course_code === cCode || c.courseName === cCode || c.name === cCode)
                                                    if (linkedCourse) {
                                                        gCode = linkedCourse.group_code || linkedCourse.groupCode || linkedCourse.group_name
                                                        // Also standardize course code if we found the object
                                                        if (!cCode) cCode = linkedCourse.courseCode || linkedCourse.code
                                                    }
                                                }

                                                gCode = gCode || 'N/A'
                                                cCode = cCode || 'N/A'

                                                const key = `${gCode}|${cCode}`

                                                if (!grouped[key]) grouped[key] = []
                                                grouped[key].push(sch)
                                            })

                                            const sortedKeys = Object.keys(grouped).sort()

                                            if (sortedKeys.length === 0) return <div className="text-center text-muted">No valid schedules found.</div>

                                            return sortedKeys.map((key) => {
                                                const [gCode, cCode] = key.split('|')
                                                // Look up display names
                                                const groupObj = groups.find(g => g.code === gCode || g.group_code === gCode)
                                                const courseObj = courses.find(c => c.code === cCode || c.courseCode === cCode || c.course_code === cCode)

                                                const groupName = groupObj?.name || groupObj?.group_name || gCode
                                                const courseName = courseObj?.name || courseObj?.courseName || courseObj?.course_name || cCode

                                                const groupSchedules = grouped[key]

                                                return (
                                                    <div key={key} className="mb-4">
                                                        <div className="alert alert-soft-primary px-3 py-2 mb-2 d-flex align-items-center gap-2">
                                                            <h6 className="fw-bold mb-0 text-primary">
                                                                {groupName}
                                                            </h6>
                                                            <span className="text-muted mx-1">•</span>
                                                            <h6 className="fw-bold mb-0 text-dark">
                                                                {courseName}
                                                            </h6>
                                                        </div>
                                                        <table className="table table-bordered table-sm align-middle mb-0">
                                                            <thead className="bg-light">
                                                                <tr>
                                                                    <th style={{ width: '60px' }}>S.No</th>
                                                                    <th style={{ width: '120px' }}>Date</th>
                                                                    <th style={{ width: '150px' }}>Time</th>
                                                                    <th>Subject</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {groupSchedules.map((sch, index) => {
                                                                    const foundSubject = subjects.find(
                                                                        (s) =>
                                                                            s.subjectCode === sch.subject_code ||
                                                                            (s.subjectCodes && s.subjectCodes.includes(sch.subject_code)) ||
                                                                            s.subject_code === sch.subject_code
                                                                    )
                                                                    let subjectName = '-'
                                                                    if (foundSubject) {
                                                                        // Try to find the specific name if it's a composite subject
                                                                        if (foundSubject.subjectNames && foundSubject.subjectCodes) {
                                                                            const idx = foundSubject.subjectCodes.indexOf(sch.subject_code)
                                                                            if (idx !== -1) subjectName = foundSubject.subjectNames[idx]
                                                                        }
                                                                        // Fallback to main name
                                                                        if (subjectName === '-') {
                                                                            subjectName = foundSubject.subjectName || foundSubject.subject_name || '-'
                                                                        }
                                                                    }

                                                                    const dateStr = sch.exam_date ? new Date(sch.exam_date).toLocaleDateString('en-GB') : '-'
                                                                    const startTime = TIME_SLOTS.find((t) => t.value === sch.exam_start_time.slice(0, 5))?.displayTime || sch.exam_start_time
                                                                    const endTime = TIME_SLOTS.find((t) => t.value === sch.exam_end_time.slice(0, 5))?.displayTime || sch.exam_end_time

                                                                    return (
                                                                        <tr key={sch.schedule_id}>
                                                                            <td className="text-center">{index + 1}</td>
                                                                            <td>{dateStr}</td>
                                                                            <td>{startTime} - {endTime}</td>
                                                                            <td>
                                                                                <span className="fw-semibold text-dark">{sch.subject_code}</span>
                                                                                <br />
                                                                                <small className="text-muted">{subjectName}</small>
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )
                                            })
                                        })()}
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-0 pt-0">
                                <button type="button" className="btn btn-outline-secondary" onClick={closeTimetableModal}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


        </AdminShell>
    )
}
