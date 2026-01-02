import StaffShell from '../../components/StaffShell'
import { useStaffAuth } from '../../store/staffAuth'

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
    const normalizedStatus = statusRaw.trim().toLowerCase() === 'continue' ? 'active' : statusRaw
    const statusLabel = normalizedStatus
        ? normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1).toLowerCase()
        : 'Active'

    // Assuming teachers table doesn't have photo_url yet, or maybe it wasn't in the schema provided. 
    // The schema didn't show 'photo_url'. I will check if I can use a default or if the user forgot it. 
    // User schema: id, staff_id, full_name, gender, date_of_birth, aadhar_number, phone_number, email, address, designation, qualification, experience_years, joining_date, status, created_at.
    // No photo_url. I'll just use initials.
    const photoSrc = ''

    return (
        <StaffShell>
            <div className="student-dashboard">
                <div className="student-dashboard__grid">
                    <div className="student-card student-card--profile">
                        <div className="student-card__header">Staff Profile</div>
                        <div className="student-card__body">
                            {rows.length === 0 ? (
                                <div className="student-card__empty">No staff details found.</div>
                            ) : (
                                <div className="student-profile">
                                    {rows.map((row) => (
                                        <div key={row.label} className="student-profile__row">
                                            <div className="student-profile__label">{row.label}</div>
                                            <div className="student-profile__value">{row.value}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="student-card student-card--status">
                        <div className="student-card__body student-card__body--center">
                            <div className="student-avatar">
                                {photoSrc ? (
                                    <img src={photoSrc} alt={staff?.full_name || 'Staff'} />
                                ) : (
                                    <div className="student-avatar__fallback">
                                        {(staff?.full_name || 'ST').slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="student-status">Current Status: {statusLabel}</div>
                        </div>
                    </div>
                </div>
            </div>
        </StaffShell>
    )
}
