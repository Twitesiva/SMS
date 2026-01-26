import AdminShell from '../../components/AdminShell'
import { useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useState, useMemo } from 'react'
import { api } from '../../lib/mockApi'
import { showToast } from '../../store/ui.js'
import { supabase } from '../../../supabaseClient'
import { TIME_SLOTS } from '../../lib/timeSlots'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import collegeLogo from '../../assets/media/images.png'
import { logActivity } from '../../lib/logger'
import { useAuth } from '../../store/auth'


const EXAM_NAME_PREFIX = 'Regular and Supplementary Examinations - '

export default function CompleteRegistration() {
    const navigate = useNavigate()
    const { user } = useAuth()
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
    const [timetableFilters, setTimetableFilters] = useState({ group: '', course: '' })

    const [subjects, setSubjects] = useState([])
    const [groups, setGroups] = useState([])
    const [courses, setCourses] = useState([])
    const [subCategories, setSubCategories] = useState([])

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
            api.listCourses(),
            api.listSubCategories(),
        ])
            .then(([subjectList, groupList, courseList, subCategoryList]) => {
                if (mounted) {
                    setSubjects(subjectList || [])
                    setGroups(groupList || [])
                    setCourses(courseList || [])
                    setSubCategories(subCategoryList || [])
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
        setTimetableFilters({ group: '', course: '' })

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

    const [printViewData, setPrintViewData] = useState(null)
    const [isDownloading, setIsDownloading] = useState(false)

    // Memoize the grouped data so we can use it for both display and generating filter options
    const derivedScheduleData = useMemo(() => {
        if (!timetableModalState.open || timetableModalState.loading) return { grouped: {}, sortedKeys: [] }
        return getGroupedSchedules(timetableModalState.schedules, subjects, courses, groups)
    }, [timetableModalState.open, timetableModalState.loading, timetableModalState.schedules, subjects, courses, groups])

    // Derive available filter options from the actual schedule data
    const filterOptions = useMemo(() => {
        const uniqueGroups = new Set()
        const uniqueCourses = []

        derivedScheduleData.sortedKeys.forEach(key => {
            const [gCode, cCode] = key.split('|')
            uniqueGroups.add(gCode)

            // Avoid duplicates for courses
            if (!uniqueCourses.find(c => c.code === cCode)) {
                const courseObj = courses.find(c => c.course_code === cCode || c.code === cCode || c.courseCode === cCode)
                const cName = courseObj?.course_name || courseObj?.courseName || cCode
                uniqueCourses.push({ code: cCode, name: cName, group: gCode })
            }
        })

        return {
            groups: Array.from(uniqueGroups).sort(),
            courses: uniqueCourses.sort((a, b) => a.name.localeCompare(b.name))
        }
    }, [derivedScheduleData, courses])

    useEffect(() => {

        if (!printViewData) return

        const generatePDF = async () => {
            setIsDownloading(true)
            try {
                await new Promise(resolve => setTimeout(resolve, 500)) // Wait for render

                const printContainer = document.getElementById('timetable-print-view')
                if (!printContainer) throw new Error('Print element not found')

                const chunks = printContainer.getElementsByClassName('print-chunk')
                const header = document.getElementById('print-header')
                const footer = document.getElementById('print-footer')

                if (!chunks.length) throw new Error('No content to print')

                const pdf = new jsPDF('p', 'mm', 'a4')
                const pageWidth = pdf.internal.pageSize.getWidth()
                const pageHeight = pdf.internal.pageSize.getHeight()
                const margin = 10
                const contentWidth = pageWidth - (margin * 2)

                let cursorY = margin

                // Helper to capture an element
                const capture = async (el) => {
                    const canvas = await html2canvas(el, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        windowWidth: 1024
                    })
                    const imgData = canvas.toDataURL('image/png')
                    const imgProps = pdf.getImageProperties(imgData)
                    const imgHeight = (imgProps.height * contentWidth) / imgProps.width
                    return { imgData, imgHeight }
                }

                // Capture Header once
                let headerData = null
                if (header) {
                    headerData = await capture(header)
                }

                // Add Border to first page
                pdf.setLineWidth(0.5)
                pdf.rect(5, 5, pageWidth - 10, pageHeight - 10)

                // Add Header to first page
                if (headerData) {
                    pdf.addImage(headerData.imgData, 'PNG', margin, cursorY, contentWidth, headerData.imgHeight)
                    cursorY += headerData.imgHeight + 5
                }

                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const { imgData, imgHeight } = await capture(chunk)

                    // Check if fit on page (allow space for footer)
                    const footerHeightEstimate = 40
                    if (cursorY + imgHeight + footerHeightEstimate > pageHeight - margin) {
                        pdf.addPage()

                        // Add border to new page
                        pdf.rect(5, 5, pageWidth - 10, pageHeight - 10)

                        cursorY = margin

                        // Add Header to new page
                        if (headerData) {
                            pdf.addImage(headerData.imgData, 'PNG', margin, cursorY, contentWidth, headerData.imgHeight)
                            cursorY += headerData.imgHeight + 5
                        }
                    }

                    pdf.addImage(imgData, 'PNG', margin, cursorY, contentWidth, imgHeight)
                    cursorY += imgHeight + 2 // small gap between groups
                }

                // Add Footer at end
                if (footer) {
                    const { imgData, imgHeight } = await capture(footer)

                    // If footer doesn't fit, new page
                    if (cursorY + imgHeight > pageHeight - margin) {
                        pdf.addPage()
                        // Add border to new page
                        pdf.rect(5, 5, pageWidth - 10, pageHeight - 10)

                        cursorY = margin

                        // Add Header to new page (optional for footer-only page? User said "each and every page")
                        if (headerData) {
                            pdf.addImage(headerData.imgData, 'PNG', margin, cursorY, contentWidth, headerData.imgHeight)
                            cursorY += headerData.imgHeight + 5
                        }
                    }

                    pdf.addImage(imgData, 'PNG', margin, cursorY + 10, contentWidth, imgHeight)
                }

                pdf.save(`Exam_Timetable_${printViewData.exam.exam_name}.pdf`)

            } catch (error) {
                console.error('PDF Generation failed', error)
                showToast('Failed to generate PDF', { type: 'error' })
            } finally {
                setIsDownloading(false)
                setPrintViewData(null)
            }
        }

        generatePDF()
    }, [printViewData])

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
            .select('subject_code, exam_date, exam_session')
            .eq('exam_master_id', examMasterId)

        if (scheduleError) {
            console.error('Error fetching exam schedules:', scheduleError)
            throw new Error('Failed to fetch exam schedules')
        }

        const subjectScheduleMap = new Map()
        if (scheduleData) {
            scheduleData.forEach((sch) => {
                if (sch.subject_code) {
                    subjectScheduleMap.set(sch.subject_code.trim().toUpperCase(), {
                        date: sch.exam_date,
                        session: sch.exam_session || 'Morning' // Fallback or derived could be added if needed
                    })
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

        const entriesBySchedule = new Map()
        const unscheduledEntries = []

        validEntries.forEach((entry) => {
            const code = subjectIdToCodeMap.get(entry.subject_id)
            const schedule = code ? subjectScheduleMap.get(code) : null

            if (schedule && schedule.date) {
                // Group by Date + Session + Subject
                // Key format: YYYY-MM-DD|Session|SubjectCode
                const key = `${schedule.date}|${schedule.session}|${code}`
                if (!entriesBySchedule.has(key)) entriesBySchedule.set(key, [])
                entriesBySchedule.get(key).push(entry)
            } else {
                unscheduledEntries.push(entry)
            }
        })

        const seatAssignments = []

        entriesBySchedule.forEach((entries, key) => {
            // Sort alphabetically by student name
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

            await logActivity(supabase, {
                description: `${user?.role || 'User'} completed registration for exam ${completionTargetExam.exam_name}`,
                action: 'UPDATE',
                page: 'Complete Registration & View Time table',
                user: user,
                role: user?.role
            })

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
                                                className="btn btn-sm btn-outline-warning rounded-pill px-3"
                                                onClick={() => navigate('/admin/create-exam', { state: { openPreview: true } })}
                                            >
                                                Edit Time Table
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
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-0 pb-0 d-block">
                                <div className="d-flex justify-content-between align-items-start mb-3">
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
                                <div className="row g-2">
                                    <div className="col-md-4">
                                        <select
                                            className="form-select form-select-sm"
                                            value={timetableFilters.group}
                                            onChange={(e) => setTimetableFilters(prev => ({ ...prev, group: e.target.value, course: '' }))}
                                        >
                                            <option value="">All Groups</option>
                                            {filterOptions.groups.map(gName => (
                                                <option key={gName} value={gName}>{gName}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <select
                                            className="form-select form-select-sm"
                                            value={timetableFilters.course}
                                            onChange={(e) => setTimetableFilters(prev => ({ ...prev, course: e.target.value }))}
                                            disabled={!timetableFilters.group}
                                        >
                                            <option value="">All Courses</option>
                                            {filterOptions.courses
                                                .filter(c => !timetableFilters.group || c.group === timetableFilters.group)
                                                .map(c => (
                                                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                </div>
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
                                        <TimetableList
                                            // Pass pre-calculated data to avoid re-calculation
                                            groupedData={derivedScheduleData}
                                            // Fallback for props that might rely on them, though groupedData supersedes
                                            schedules={timetableModalState.schedules}
                                            subjects={subjects}
                                            courses={courses}
                                            groups={groups}
                                            filterGroup={timetableFilters.group}
                                            filterCourse={timetableFilters.course}
                                            subCategories={subCategories}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-0 pt-0">
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={isDownloading || timetableModalState.loading || timetableModalState.schedules.length === 0}
                                    onClick={() => setPrintViewData({
                                        exam: timetableModalState.exam,
                                        schedules: timetableModalState.schedules,
                                        filterGroup: timetableFilters.group,
                                        filterCourse: timetableFilters.course
                                    })}
                                >
                                    {isDownloading ? 'Downloading...' : 'Download PDF'}
                                </button>
                                <button type="button" className="btn btn-outline-secondary" onClick={closeTimetableModal}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {printViewData && (
                <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                    <div id="timetable-print-view" style={{ width: '210mm', backgroundColor: '#fff', padding: '10mm', minHeight: '297mm' }}>
                        <TimetablePrintTemplate
                            exam={printViewData.exam}
                            schedules={printViewData.schedules}
                            subjects={subjects}
                            courses={courses}
                            groups={groups}
                            filterGroup={printViewData.filterGroup}
                            filterCourse={printViewData.filterCourse}
                            subCategories={subCategories}
                        />
                    </div>
                </div>
            )}
        </AdminShell>
    )
}

const getYearLabelFromSemesterNumber = (semesterNumber) => {
    const num = Number(semesterNumber)
    if (Number.isNaN(num) || num <= 0) return '-'
    if (num <= 2) return '1st Year'
    if (num <= 4) return '2nd Year'
    if (num <= 6) return '3rd Year'
    return `Year ${Math.ceil(num / 2)}`
}

const buildSubCategoryLookup = (subCategories = []) => {
    const lookup = new Map()
    subCategories.forEach((item) => {
        const idKey = item?.id !== undefined && item?.id !== null ? String(item.id).trim() : ''
        const nameKey = item?.name ? String(item.name).trim() : ''
        if (idKey) lookup.set(idKey, item.name || nameKey)
        if (nameKey) lookup.set(nameKey.toLowerCase(), item.name)
    })
    return lookup
}

const resolveSubCategoryName = (value, lookup) => {
    if (value === undefined || value === null) return '-'
    const candidate = String(value).trim()
    if (!candidate) return '-'
    const direct = lookup.get(candidate)
    if (direct) return direct
    const normalized = candidate.toLowerCase()
    const fallback = lookup.get(normalized)
    return fallback || candidate
}

const resolveCategoryFromSubject = (subject, lookup) => {
    if (!subject) return ''
    if (subject.category) {
        const label = resolveSubCategoryName(subject.category, lookup)
        if (label !== '-') return label
        if (subject.category.trim()) return subject.category.trim()
    }
    const candidateId =
        subject.categoryId ??
        subject.category_id ??
        subject.categoryIdRaw ??
        ''
    if (candidateId) {
        const label = resolveSubCategoryName(candidateId, lookup)
        if (label !== '-') return label
    }
    return ''
}

function getGroupedSchedules(schedules, subjects, courses, groups) {
    const grouped = {}

    schedules.forEach(sch => {
        const schSubjectCode = (sch.subject_code || '').trim().toUpperCase()
        const schSemester = sch.semester_number ? String(sch.semester_number) : null

        // Find ALL matching subjects to handle common papers (same code in multiple courses)
        const matchingSubjects = subjects.filter(s => {
            const sCode = (s.subject_code || s.subjectCode || '').trim().toUpperCase()

            let codeMatch = sCode === schSubjectCode
            if (!codeMatch && Array.isArray(s.subjectCodes)) {
                const normalizedCodes = s.subjectCodes.map(c => String(c).trim().toUpperCase())
                codeMatch = normalizedCodes.includes(schSubjectCode)
            }

            if (!codeMatch) return false

            // If schedule is semester-specific, ensure subject matches
            if (schSemester) {
                const sSem = s.semester_number || s.semester
                if (sSem && String(sSem) !== schSemester) return false
            }
            return true
        })

        if (matchingSubjects.length === 0) {
            // Fallback for unmapped subjects
            const gCode = sch.group_code || 'Other'
            const cCode = sch.course_code || 'Other'
            const sem = schSemester || 'N/A'
            const key = `${gCode}|${cCode}|${sem}`
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(sch)
        } else {
            matchingSubjects.forEach(subj => {
                // Resolve Course
                const cCodeFK = subj.course_name || subj.courseCode || subj.course_code || 'N/A'

                // Resolve Group via Course
                const courseObj = courses.find(c =>
                    c.course_code === cCodeFK ||
                    c.courseCode === cCodeFK ||
                    c.code === cCodeFK
                )

                // Group Name / Code
                let gName = courseObj?.group_name || courseObj?.groupName || subj.group_name || 'N/A'

                const keyGroup = gName
                const keyCourse = courseObj?.course_code || cCodeFK
                const keySem = schSemester || subj.semester_number || subj.semester || 'N/A'

                const key = `${keyGroup}|${keyCourse}|${keySem}`

                if (!grouped[key]) grouped[key] = []

                if (!grouped[key].some(x => x.schedule_id === sch.schedule_id)) {
                    grouped[key].push(sch)
                }
            })
        }
    })

    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    })

    return { grouped, sortedKeys }
}

const TimetableList = ({ schedules, subjects, courses, groups, filterGroup, filterCourse, groupedData, subCategories }) => {
    const { grouped, sortedKeys } = groupedData || getGroupedSchedules(schedules, subjects, courses, groups)

    if (sortedKeys.length === 0) return <div className="text-center text-muted">No valid schedules found.</div>

    const subCategoryLookup = useMemo(() => buildSubCategoryLookup(subCategories), [subCategories])

    const filteredKeys = useMemo(() => (
        sortedKeys.filter(key => {
            const [gCode, cCode] = key.split('|')

            const groupObj = groups.find(g => g.group_name === gCode || g.name === gCode || g.code === gCode)
            const courseObj = courses.find(c => c.course_code === cCode || c.code === cCode || c.courseCode === cCode)

            const groupName = groupObj?.name || groupObj?.group_name || gCode
            const courseCodeVal = courseObj?.course_code || cCode

            if (filterGroup && groupName !== filterGroup) return false
            if (filterCourse && courseCodeVal !== filterCourse) return false

            return true
        })
    ), [sortedKeys, groups, courses, filterGroup, filterCourse])

    if (filteredKeys.length === 0) return <div className="text-center text-muted">No schedules match the selected filters.</div>

    const tableRows = useMemo(() => {
        const rows = []

        filteredKeys.forEach(key => {
            const [gCode, cCode, sem] = key.split('|')

            const groupObj = groups.find(g => g.group_name === gCode || g.name === gCode || g.code === gCode)
            const courseObj = courses.find(c => c.course_code === cCode || c.code === cCode || c.courseCode === cCode)

            const groupName = groupObj?.name || groupObj?.group_name || gCode
            const courseName = courseObj?.name || courseObj?.courseName || courseObj?.course_name || cCode
            const semesterLabel = sem === 'N/A' ? '-' : sem

            const groupSchedules = grouped[key] || []

            groupSchedules.forEach(sch => {
                const { subjectName, specificSubject } = getScheduleSubjectInfo(sch, subjects, cCode)
                const dateStr = formatScheduleDate(sch)
                const timeRange = getScheduleTimeRange(sch)
                const subCategoryDisplayName =
                    resolveCategoryFromSubject(specificSubject, subCategoryLookup) ||
                    resolveSubCategoryName(sch.category, subCategoryLookup)

                rows.push({
                    id: sch.schedule_id || `${key}-${rows.length}-${sch.subject_code || 'slot'}`,
                    serial: rows.length + 1,
                    groupName,
                    courseName,
                    semester: semesterLabel,
                    date: dateStr,
                    time: timeRange,
                    subCategory: subCategoryDisplayName,
                    subjectCode: sch.subject_code || '-',
                    subjectName,
                })
            })
        })

        return rows
    }, [filteredKeys, grouped, subjects, courses, groups, subCategoryLookup])

    return (
        <div>
            <div className="mb-3 d-flex flex-wrap gap-2 align-items-center">
                <span className="fw-semibold text-muted">
                    Showing {tableRows.length} schedule slot{tableRows.length === 1 ? '' : 's'}.
                </span>
                <span className="text-muted small">
                    Sorted by date and time.
                </span>
            </div>
            <div className="table-responsive">
                <table className="table table-striped table-hover table-bordered align-middle mb-0 exam-registration-table">
                    <thead className="table-light">
                        <tr className="text-dark">
                            <th style={{ width: '60px' }} className="text-center">S.No</th>
                            <th style={{ minWidth: '130px' }}>Group</th>
                            <th style={{ minWidth: '160px' }}>Course</th>
                            <th style={{ width: '80px' }}>Semester</th>
                            <th style={{ width: '110px' }}>Date</th>
                            <th style={{ minWidth: '150px' }}>Time</th>
                            <th style={{ minWidth: '140px' }}>Sub Category</th>
                            <th>Subject</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableRows.map(row => (
                            <tr key={row.id}>
                                <td className="text-center">{row.serial}</td>
                                <td>{row.groupName}</td>
                                <td>{row.courseName}</td>
                                <td>{row.semester}</td>
                                <td>{row.date}</td>
                                <td>{row.time}</td>
                                <td>{row.subCategory}</td>
                                <td>{row.subjectCode}-{row.subjectName}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

const TimetablePrintTemplate = ({ exam, schedules, subjects, courses, groups, filterGroup, filterCourse, subCategories }) => {
    return (
        <div>
            <div id="print-header" className="d-flex justify-content-between gap-3 flex-wrap align-items-start mb-4">

                <img
                    src={collegeLogo}
                    alt="College logo"
                    style={{ width: 80, height: 80, objectFit: 'contain' }}
                    className="rounded border"
                />
                <div className="text-center flex-grow-1">
                    <div className="text-uppercase text-dark fs-4 fw-bold">
                        Vijayam Arts and Science College
                    </div>
                    <div className="text-muted small fw-semibold">
                        Chittoor - 517001
                    </div>
                    <h5 className="fw-bold mt-2 mb-1">
                        {exam?.exam_name || 'Exam Details'}
                    </h5>
                    <div className="fw-bold fs-5 text-decoration-underline">Exam Time Table</div>
                </div>
                <div style={{ width: 80 }}></div>
            </div>

            <div className="mb-4">
                {/* Reusing TimetableList but modifying it to render cleaner for print or just use it as is but wrapper in chunks?
                    TimetableList maps keys and returns divs. We need to intercept that mapping to add class names. 
                    Since TimetableList is a component, we can't easily inject class names deep inside unless we pass a prop or copy logic.
                    Copying logic for print template is safer to ensure print-specific layout (chunks).
                 */}
                <TimetablePrintItems
                    schedules={schedules}
                    subjects={subjects}
                    courses={courses}
                    groups={groups}
                    filterGroup={filterGroup}
                    filterCourse={filterCourse}
                    subCategories={subCategories}
                />
            </div>

            <div id="print-footer" className="row text-center mt-5 align-items-end" style={{ pageBreakInside: 'avoid' }}>
                <div className="col-6 mb-2 mb-md-0 d-flex flex-column align-items-center justify-content-end" style={{ minHeight: 80 }}>
                    <p className="mb-0 fw-semibold text-dark text-uppercase small">
                    </p>
                </div>
                <div className="col-6 mb-2 mb-md-0 d-flex flex-column align-items-center justify-content-end" style={{ minHeight: 80 }}>

                    <p className="mb-0 fw-bold text-dark open-sans-font small">
                        Controller of Examinations
                    </p>
                </div>
            </div>
        </div>
    )
}

const TimetablePrintItems = ({ schedules, subjects, courses, groups, filterGroup, filterCourse, subCategories }) => {
    const { grouped, sortedKeys } = getGroupedSchedules(schedules, subjects, courses, groups)

    const subCategoryLookup = useMemo(() => buildSubCategoryLookup(subCategories), [subCategories])

    // Filter keys
    const filteredKeys = sortedKeys.filter(key => {
        const [gCode, cCode] = key.split('|')

        const groupObj = groups.find(g => g.group_name === gCode || g.name === gCode || g.code === gCode)
        const courseObj = courses.find(c => c.course_code === cCode || c.code === cCode || c.courseCode === cCode)

        const groupName = groupObj?.name || groupObj?.group_name || gCode
        const courseCodeVal = courseObj?.course_code || cCode

        if (filterGroup && groupName !== filterGroup) return false
        if (filterCourse && courseCodeVal !== filterCourse) return false

        return true
    })

    if (filteredKeys.length === 0) return <div className="text-center text-muted">No schedules found.</div>

    return filteredKeys.map((key) => {
        const [gCode, cCode, sem] = key.split('|')

        const groupObj = groups.find(g => g.group_name === gCode || g.name === gCode || g.code === gCode)
        const courseObj = courses.find(c => c.course_code === cCode || c.code === cCode || c.courseCode === cCode)

        const groupName = groupObj?.name || groupObj?.group_name || gCode
        const courseName = courseObj?.name || courseObj?.courseName || courseObj?.course_name || cCode

        const groupSchedules = grouped[key]

        return (
            <div key={key} className="print-chunk mb-4 p-2 border rounded">
                <div className="mb-2 border border-dark border-bottom-0 p-2 text-center font-weight-bold" style={{ border: '1px solid #000', fontWeight: 'bold' }}>
                    {`${getYearLabelFromSemesterNumber(sem)}. ${groupName}.${courseName ? ` ${courseName}.` : ''} ${sem !== 'N/A' ? `SEM ${sem}` : ''}`.replace(/\s+/g, ' ').toUpperCase()}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '12px' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '50px', border: '1px solid #000', padding: '8px', textAlign: 'center' }}>S.No</th>
                            <th style={{ width: '100px', border: '1px solid #000', padding: '8px', textAlign: 'left' }}>DATE</th>
                            <th style={{ width: '130px', border: '1px solid #000', padding: '8px', textAlign: 'center' }}>TIME</th>
                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>SUB CATEGORY</th>
                            <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>SUBJECT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupSchedules.map((sch, index) => {
                            const { subjectName, specificSubject } = getScheduleSubjectInfo(sch, subjects, cCode)
                            const dateStr = formatScheduleDate(sch)
                            const timeRange = getScheduleTimeRange(sch)
                            const subCategoryDisplayName =
                                resolveCategoryFromSubject(specificSubject, subCategoryLookup) ||
                                resolveSubCategoryName(sch.category, subCategoryLookup)
                            return (
                                <tr key={sch.schedule_id}>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{index + 1}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{dateStr}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{timeRange}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>{subCategoryDisplayName}</td>
                                    <td style={{ border: '1px solid #000', padding: '8px' }}>
                                        {sch.subject_code}-{subjectName}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        )
    })
}

function formatScheduleDate(schedule) {
    if (!schedule?.exam_date) return '-'
    const parsed = new Date(schedule.exam_date)
    if (Number.isNaN(parsed.getTime())) return '-'
    return parsed.toLocaleDateString('en-GB')
}

function getScheduleTimeRange(schedule) {
    const startRaw = schedule?.exam_start_time || ''
    const endRaw = schedule?.exam_end_time || ''

    const startLabel = startRaw
        ? TIME_SLOTS.find(t => t.value === startRaw.slice(0, 5))?.displayTime || startRaw
        : null
    const endLabel = endRaw
        ? TIME_SLOTS.find(t => t.value === endRaw.slice(0, 5))?.displayTime || endRaw
        : null

    if (!startLabel && !endLabel) return '-'
    if (!startLabel) return endLabel
    if (!endLabel) return startLabel
    return `${startLabel} - ${endLabel}`
}

function getScheduleSubjectInfo(schedule, subjects = [], courseFilter) {
    const scheduleCode = normalizeCode(schedule?.subject_code)
    if (!scheduleCode) {
        return { subjectName: '-', specificSubject: null }
    }

    const scheduleSemester = schedule?.semester_number ? String(schedule.semester_number) : null

    let specificSubject = subjects.find(subject =>
        matchesSubjectCodes(subject, scheduleCode) &&
        matchesSubjectSemester(subject, scheduleSemester) &&
        matchesSubjectCourse(subject, courseFilter)
    )

    if (!specificSubject) {
        specificSubject = subjects.find(subject => matchesSubjectCodes(subject, scheduleCode)) || null
    }

    const subjectName = specificSubject ? extractSubjectName(specificSubject, scheduleCode) : '-'

    return { subjectName, specificSubject }
}

function matchesSubjectCodes(subject, scheduleCode) {
    if (!subject || !scheduleCode) return false
    const candidateCodes = new Set()
    if (subject.subject_code) candidateCodes.add(normalizeCode(subject.subject_code))
    if (subject.subjectCode) candidateCodes.add(normalizeCode(subject.subjectCode))
    if (Array.isArray(subject.subjectCodes)) {
        subject.subjectCodes.forEach(code => {
            if (code) candidateCodes.add(normalizeCode(code))
        })
    }
    return candidateCodes.has(scheduleCode)
}

function matchesSubjectSemester(subject, scheduleSemester) {
    if (!scheduleSemester) return true
    const subjectSemester = subject?.semester_number ?? subject?.semester
    if (!subjectSemester) return true
    return String(subjectSemester) === scheduleSemester
}

function matchesSubjectCourse(subject, courseCode) {
    if (!courseCode || courseCode === 'Other' || courseCode === 'N/A') return true
    const courseCandidates = [subject?.course_name, subject?.courseCode, subject?.course_code].filter(Boolean)
    return courseCandidates.some(course => course === courseCode)
}

function extractSubjectName(subject, scheduleCode) {
    if (!subject) return '-'
    if (Array.isArray(subject.subjectCodes) && Array.isArray(subject.subjectNames)) {
        const idx = subject.subjectCodes.findIndex(code => normalizeCode(code) === scheduleCode)
        if (idx !== -1 && subject.subjectNames[idx]) {
            return subject.subjectNames[idx]
        }
    }
    return subject.subjectName || subject.subject_name || '-'
}

function normalizeCode(value) {
    if (value === undefined || value === null) return ''
    return String(value).trim().toUpperCase()
}
