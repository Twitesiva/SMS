import { useEffect, useState } from 'react'
import StaffShell from '../../components/StaffShell'
import { useStaffAuth } from '../../store/staffAuth'
import { supabase } from '../../../supabaseClient'

const buildProfileRows = (staff) => [
    { label: 'Staff Name', value: staff?.full_name },
    { label: 'Staff ID', value: staff?.staff_id },
    { label: 'Designation', value: staff?.designation },
    { label: 'Qualification', value: staff?.qualification },
    { label: 'Mobile Number', value: staff?.phone_number },
    { label: 'Email', value: staff?.email },
    { label: 'Experience (Years)', value: staff?.experience_years },
    { label: 'Joining Date', value: staff?.joining_date },
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

    const photoSrc = ''

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

    const fetchAssignments = async (teacherId) => {
        setLoading(true)
        const { data, error } = await supabase
            .from('teacher_subject_mapping')
            .select(`
                semester,
                subjects (
                    subject_code,
                    subject_name
                ),
                courses (
                    course_name
                ),
                groups (
                    group_name
                )
            `)
            .eq('teacher_id', teacherId)
            .eq('is_active', true)

        if (!error) {
            setAssignments(data || [])
        }
        setLoading(false)
    }

    return (
        <StaffShell>
            <div className="student-dashboard staff-dashboard">
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
                           PROFILE SECTION (UNCHANGED)
                        ================================ */}
                        <div className="student-dashboard__grid">
                            <div className="student-card student-card--profile">
                                <div className="student-card__header">Staff Profile</div>
                                <div className="student-card__body">
                                    <div className="student-profile">
                                        {rows.map((row) => (
                                            <div key={row.label} className="student-profile__row">
                                                <div className="student-profile__label">{row.label}</div>
                                                <div className="student-profile__colon">:</div>
                                                <div className="student-profile__value">{row.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="student-card student-card--status">
                                <div className="student-card__body student-card__body--center">
                                    <div className="student-avatar">
                                        {photoSrc ? (
                                            <img src={photoSrc} alt="staff" />
                                        ) : (
                                            <div className="student-avatar__fallback">
                                                {(staff?.full_name || 'ST')
                                                    .slice(0, 2)
                                                    .toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="student-status">
                                        Current Status: {statusLabel}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ===============================
                           CONSOLIDATED TEACHING DETAILS
                        ================================ */}
                        <div className="student-card mt-4 mb-4">
                            <div className="student-card__header">
                                Course and Group Details
                            </div>

                            <div className="student-card__body">
                                <table className="table table-bordered table-sm">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '60px' }}>S.No</th>
                                            <th>Course</th>
                                            <th>Group</th>
                                            <th>Subject</th>
                                            <th>Semester</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assignments.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan="5"
                                                    className="text-center text-muted"
                                                >
                                                    No course and group details found
                                                </td>
                                            </tr>
                                        ) : (
                                            assignments.map((row, index) => (
                                                <tr key={index}>
                                                    <td>{index + 1}</td>
                                                    <td>{row.courses?.course_name}</td>
                                                    <td>{row.groups?.group_name}</td>
                                                    <td>
                                                        {row.subjects?.subject_code} –{' '}
                                                        {row.subjects?.subject_name}
                                                    </td>
                                                    <td>Semester {row.semester}</td>
                                                </tr>
                                            ))
                                        )}
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
