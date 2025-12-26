import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import './StudentProfile.css';
import crestAccent from '../../assets/media/images.png';

export default function StudentProfile() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    if (!user || user.role !== 'STUDENT' || !user.studentData) {
        // Redirect if not logged in
        React.useEffect(() => {
            navigate('/student/login');
        }, [navigate]);
        return null;
    }

    const { studentData } = user;

    const handleLogout = () => {
        signOut();
        navigate('/home');
    };

    return (
        <div className="student-profile-container">
            <header className="student-profile-header">
                <div className="student-brand">
                    <img src={crestAccent} alt="Logo" className="student-logo" />
                    <div>
                        <h1>Student Portal</h1>
                        <p>Welcome, {studentData.full_name}</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="student-logout-btn">
                    <i className="bi bi-box-arrow-right"></i> Logout
                </button>
            </header>

            <div className="student-content">
                <div className="student-card profile-main">
                    <div className="student-avatar-section">
                        <div className="student-avatar-wrapper">
                            {studentData.photo_url ? (
                                <img src={studentData.photo_url} alt={studentData.full_name} />
                            ) : (
                                <div className="student-initials">{studentData.full_name?.charAt(0)}</div>
                            )}
                        </div>
                        <h2>{studentData.full_name}</h2>
                        <span className="student-badge">{studentData.status || 'Active'}</span>
                    </div>

                    <div className="student-info-grid">
                        <div className="info-item">
                            <label>Hall Ticket No</label>
                            <p>{studentData.hall_ticket_no}</p>
                        </div>
                        <div className="info-item">
                            <label>Student ID</label>
                            <p>{studentData.student_id}</p>
                        </div>
                        <div className="info-item">
                            <label>Course</label>
                            <p>{studentData.course_name}</p>
                        </div>
                        <div className="info-item">
                            <label>Group</label>
                            <p>{studentData.group_name || '-'}</p>
                        </div>
                        <div className="info-item">
                            <label>Academic Year</label>
                            <p>{studentData.academic_year}</p>
                        </div>
                        <div className="info-item">
                            <label>Current Semester</label>
                            <p>Semester {studentData.current_semester}</p>
                        </div>
                    </div>
                </div>

                <div className="student-card profile-details">
                    <h3>Personal Information</h3>
                    <div className="details-grid">
                        <div className="detail-row">
                            <span>Date of Birth</span>
                            <span>{studentData.date_of_birth || '-'}</span>
                        </div>
                        <div className="detail-row">
                            <span>Gender</span>
                            <span>{studentData.gender || '-'}</span>
                        </div>
                        <div className="detail-row">
                            <span>Phone Number</span>
                            <span>{studentData.phone_number || '-'}</span>
                        </div>
                        <div className="detail-row">
                            <span>Aadhar Number</span>
                            <span>{studentData.aadhar_number || '-'}</span>
                        </div>
                        <div className="detail-row">
                            <span>Father's Name</span>
                            <span>{studentData.father_name || '-'}</span>
                        </div>
                        <div className="detail-row">
                            <span>Mother's Name</span>
                            <span>{studentData.mother_name || '-'}</span>
                        </div>
                        <div className="detail-row full-width">
                            <span>Address</span>
                            <span>{studentData.address || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
