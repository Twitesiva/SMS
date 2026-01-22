import React from 'react';
import { useNavigate } from 'react-router-dom';
import './RoleSelection.css';
import bgImage from '../../assets/media/EMS.jpg';

export default function RoleSelection() {
    const navigate = useNavigate();

    const handleNavigation = (role) => {
        switch (role) {
            case 'admission-portal':
                navigate('/admissions/login', { state: { admissionPortal: true } });
                break;
            case 'exam-portal':
                navigate('/admin/login');
                break;
            case 'student':
                navigate('/student/login');
                break;
            case 'staff':
                navigate('/staff/login');
                break;
            case 'admin':
                navigate('/admin-portal/login');
                break;
            case 'library':
                navigate('/library/login');
                break;
            case 'parent':
                navigate('/parent/login'); // Placeholder for parent login
                break;
            case 'transport':
                navigate('/transport/login');
                break;
            default:
                break;
        }
    };

    const roles = [
        {
            id: 'admission-portal',
            label: 'ADMISSION PORTAL',
            icon: 'bi-journal-text',
            desc: 'Admissions, Applications & Enquiries',
            className: 'admission-card'
        },
        {
            id: 'admin',
            label: 'ADMIN',
            icon: 'bi-person-gear',
            desc: 'User Management',
            className: 'admin'
        },
        {
            id: 'staff',
            label: 'STAFF',
            icon: 'bi-person-workspace',
            desc: 'Access Staff Portal, Manage Students',
            className: 'staff'
        },
        {
            id: 'exam-portal',
            label: 'EXAM PORTAL',
            icon: 'bi-laptop',
            desc: 'Controller of Examinations Login',
            className: 'exam-portal'
        },
        {
            id: 'student',
            label: 'STUDENT',
            icon: 'bi-mortarboard-fill',
            desc: 'Access Student Portal, Results & Timetables',
            className: 'student'
        },
        {
            id: 'library',
            label: 'LIBRARY',
            icon: 'bi-journal-bookmark',
            desc: 'Library Catalog & Issue Desk',
            className: 'library'
        },
        {
            id: 'parent',
            label: 'PARENT',
            icon: 'bi-people-fill',
            desc: 'Access Parent Portal, Monitor Student Progress',
            className: 'parent'
        },
        {
            id: 'hostel',
            label: 'HOSTEL',
            icon: 'bi-house-door',
            desc: 'Hostel Management & Allocation',
            className: 'hostel'
        },
        {
            id: 'transport',
            label: 'TRANSPORT',
            icon: 'bi-bus-front',
            desc: 'Transport Routes & Passes',
            className: 'transport'
        },
        
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
                <h1 className="role-title">SELECT YOUR PORTAL</h1>

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
