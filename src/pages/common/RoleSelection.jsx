import React from 'react';
import { useNavigate } from 'react-router-dom';
import './RoleSelection.css';
import bgImage from '../../assets/media/EMS.jpg';

export default function RoleSelection() {
    const navigate = useNavigate();

    const handleNavigation = (role) => {
        switch (role) {
            case 'admission-portal':
                alert("Admission Portal coming soon!");
                break;
            case 'exam-portal':
                navigate('/admin/login');
                break;
            case 'student':
                alert("Student Portal coming soon!");
                break;
            case 'staff':
                alert("Staff Portal coming soon!");
                break;
            case 'admin':
                // Maybe different admin login or just placeholder since Exam Portal covers the requested flow
                alert("Admin Dashboard access via Exam Portal for now.");
                break;
            default:
                break;
        }
    };

    const roles = [
        {
            id: 'student',
            label: 'Student',
            icon: 'bi-mortarboard-fill',
            desc: 'Access Student Portal, Results & Timetables',
            className: 'student'
        },
        {
            id: 'staff',
            label: 'Staff',
            icon: 'bi-person-workspace',
            desc: 'Access Staff Portal, Manage Students',
            className: 'staff'
        },
        {
            id: 'admission-portal',
            label: 'Admission Portal',
            icon: 'bi-journal-text',
            desc: 'Admissions, Applications & Enquiries',
            className: 'admission-portal'
        },
        {
            id: 'admin',
            label: 'Admin',
            icon: 'bi-person-gear',
            desc: 'User Management',
            className: 'admin'
        },
        {
            id: 'exam-portal',
            label: 'Exam Portal',
            icon: 'bi-laptop',
            desc: 'Controller of Examinations Login',
            className: 'exam-portal'
        }
    ];

    return (
        <div className="role-selection-container">
            <img src={bgImage} alt="Background" className="role-bg-image" />

            <button
                onClick={() => navigate('/home')}
                className="role-back-btn"
            >
                <i className="bi bi-arrow-left"></i> Back to Home
            </button>

            <div className="role-content">
                <h1 className="role-title">Select Your Portal</h1>

                <div className="role-grid">
                    {roles.map((role) => (
                        <div
                            key={role.id}
                            className={`role-card ${role.className}`}
                            onClick={() => handleNavigation(role.id)}
                        >
                            <div className="role-icon-wrapper">
                                <i className={`bi ${role.icon}`}></i>
                            </div>
                            <div className="role-name">{role.label}</div>
                            <div className="role-description">{role.desc}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
