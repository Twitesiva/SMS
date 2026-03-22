import { useEffect, useState } from 'react'
import StaffShell from '../../components/StaffShell'
import { useStaffAuth } from '../../store/staffAuth'
import { supabase } from '../../../supabaseClient'
import './StaffPortal.css'

const buildProfileRows = (staff) => [
    { label: 'Staff Name', value: staff?.full_name },
    { label: 'Staff ID', value: staff?.staff_id },
    { label: 'Designation', value: staff?.designation ? staff.designation.replace(/_/g, ' ') : '' },
    { label: 'Qualification', value: staff?.qualification },
    { label: 'Mobile Number', value: staff?.phone },
    { label: 'Email', value: staff?.email },
    { label: 'Experience (Years)', value: staff?.experience },
    { label: 'Joining Date', value: staff?.joining_date ? staff.joining_date.split('-').reverse().join('-') : '-' },
    { label: 'Address', value: staff?.address },
]

export default function StaffDashboard() {
    const { staff } = useStaffAuth()

    const rows = buildProfileRows(staff).filter((row) => row.value)

    const statusRaw = staff?.status ? staff.status.toString() : 'Active'
    const normalizedStatus =
        statusRaw.trim().toLowerCase() === 'continue' ? 'active' : statusRaw
    const statusLabel = normalizedStatus
        ? normalizedStatus.charAt(0).toUpperCase() +
        normalizedStatus.slice(1).toLowerCase()
        : 'Active'

    const photoSrc = staff?.image_url

    /* ===============================
       STATE
    ================================ */
    const [assignments, setAssignments] = useState([])
    const [loading, setLoading] = useState(false)

    /* ===============================
       FETCH DATA
    ================================ */
    useEffect(() => {
        if (staff?.id) {
            fetchAssignments(staff.id)
        }
    }, [staff])

    const fetchAssignments = async (staffId) => {
        setLoading(true)
        
        try {
            // STEP 1: Get staff subjects to get subject_id list
            const { data: staffSubjects, error: ssError } = await supabase
                .from('staff_subjects')
                .select('subject_id')
                .eq('staff_id', staffId)

            if (ssError) throw ssError
            
            // Get subject IDs array
            const subjectIds = (staffSubjects || []).map(s => s.subject_id)
            
            if (subjectIds.length === 0) {
                setAssignments([])
                setLoading(false)
                return
            }

            // STEP 2: Get timetable_sessions data filtered by staff_id AND subject_id
            const { data: timetableData, error: ttError } = await supabase
                .from('timetable_sessions')
                .select('subject_id, class_section_id')
                .eq('staff_id', staffId)
                .in('subject_id', subjectIds)

            if (ttError) throw ttError

            if (!timetableData || timetableData.length === 0) {
                setAssignments([])
                setLoading(false)
                return
            }

            // Get unique class_section_ids and subject_ids for fetching names
            const sectionIds = [...new Set(timetableData.map(t => t.class_section_id).filter(Boolean))]
            const allSubjectIds = [...new Set(timetableData.map(t => t.subject_id).filter(Boolean))]

            // STEP 3: Fetch class_sections, classes, and subjects data
            // Use subjects.id (not subject_id) to match timetable_sessions.subject_id
            const [{ data: sectionsData }, { data: subjectsData }, { data: classesData }] = await Promise.all([
                supabase.from('class_sections').select('id, class_id').in('id', sectionIds),
                supabase.from('subjects').select('id, subject_title, school_level').in('id', allSubjectIds),
                supabase.from('classes').select('id, class_name')
            ])

            // Create lookup maps
            const sectionMap = new Map((sectionsData || []).map(s => [s.id, s]))
            const subjectMap = new Map((subjectsData || []).map(s => [s.id, s]))
            const classMap = new Map((classesData || []).map(c => [c.id, c]))

            // STEP 4: Build final data and remove duplicates
            const seen = new Set()
            const normalized = []
            
            timetableData.forEach(item => {
                const section = sectionMap.get(item.class_section_id)
                const subject = subjectMap.get(item.subject_id)
                const cls = classMap.get(section?.class_id)
                
                const className = cls?.class_name || ''
                const subjectName = subject?.subject_title || ''
                const schoolLevel = subject?.school_level || ''
                
                // Create unique key to remove duplicates (class + subject)
                const uniqueKey = `${className}-${subjectName}`
                
                if (!seen.has(uniqueKey)) {
                    seen.add(uniqueKey)
                    normalized.push({
                        schoolLevel: schoolLevel || '-',
                        className: className || '-',
                        subjectName: subjectName || '-'
                    })
                }
            })
            
            setAssignments(normalized)
        } catch (err) {
            console.error('Error fetching assignments:', err)
            setAssignments([])
        }
        setLoading(false)
    }

    return (
        <StaffShell>
            <div className="students-section-shell">
                {loading && (
                    <div className="student-details__loading" role="status" aria-live="polite">
                        <div className="student-details__loading-header">
                            <div className="student-loader__spinner" aria-hidden="true"></div>
                            <div>
                                <div className="student-loader__title">Loading staff dashboard</div>
                                <div className="student-loader__subtitle">Fetching your profile and assigned courses.</div>
                            </div>
                        </div>
                        <div className="student-details__loading-grid" aria-hidden="true">
                            {Array.from({ length: 2 }).map((_, index) => (
                                <div className="student-loader-card" key={`loader-card-${index}`}>
                                    <div className="student-loader-card__header student-loader__shimmer"></div>
                                    <div className="student-loader-card__line student-loader__shimmer"></div>
                                    <div className="student-loader-card__line student-loader__shimmer"></div>
                                    <div className="student-loader-card__line student-loader__shimmer"></div>
                                    <div className="student-loader-card__line student-loader__shimmer"></div>
                                </div>
                            ))}
                        </div>
                        <span className="sr-only">Loading details...</span>
                    </div>
                )}

                {!loading && (
                    <>
                        {/* ===============================
                           PROFILE SECTION
                        ================================ */}
                        <div className="student-dashboard__grid">
                            <div className="student-card student-card--profile h-100">
                                <div className="student-card__header">Staff Profile</div>
                                <div className="student-card__body p-4">
                                    <div className="d-flex flex-column gap-3">
                                        {rows.map((row) => (
                                            <div key={row.label} className="d-flex border-bottom pb-2">
                                                <div className="fw-bold text-secondary" style={{ width: '160px' }}>{row.label}</div>
                                                <div className="me-3">:</div>
                                                <div className="fw-semibold text-dark">{row.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="student-card h-100">
                                <div className="student-card__body d-flex flex-column align-items-center justify-content-center p-5 gap-4">
                                    <div
                                        className="rounded-circle shadow-sm"
                                        style={{
                                            width: '180px',
                                            height: '180px',
                                            borderRadius: '50%',
                                            border: '5px solid #fff',
                                            overflow: 'hidden',
                                            margin: '0 auto'
                                        }}
                                    >
                                        {photoSrc ? (
                                            <img
                                                src={photoSrc}
                                                alt="staff"
                                                className="w-100 h-100"
                                                style={{ objectFit: 'cover', objectPosition: 'top' }}
                                            />
                                        ) : (
                                            <div className="w-100 h-100 bg-light d-flex align-items-center justify-content-center display-4 fw-bold text-primary opacity-50">
                                                {(staff?.full_name || 'ST').slice(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-center">
                                        <div className="text-uppercase small text-muted letter-spacing-2 mb-1">Current Status</div>
                                        <div className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill">
                                            <i className="bi bi-circle-fill me-2 small"></i>
                                            {statusLabel}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ===============================
                            CONSOLIDATED TEACHING DETAILS
                        ================================ */}
                        <div className="student-card mt-4 mb-4">
                            <div className="student-card__header">
                                Assigned Classes
                            </div>

                            <div className="student-card__body records-page p-0">
                                <div className="table-responsive">
                                    <table className="table mb-0">
                                        <thead>
                                            <tr>
                                                <th className="text-center" style={{ width: '60px' }}>S.No</th>
                                                <th>School Level</th>
                                                <th>Class</th>
                                                <th>Subject</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {assignments.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan="4"
                                                        className="text-center text-muted py-4"
                                                    >
                                                        No assigned classes found
                                                    </td>
                                                </tr>
                                            ) : (
                                                assignments.map((row, index) => (
                                                    <tr key={index}>
                                                        <td className="text-center">{index + 1}</td>
                                                        <td>{row.schoolLevel}</td>
                                                        <td>{row.className}</td>
                                                        <td>{row.subjectName}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </StaffShell>
    )
}
