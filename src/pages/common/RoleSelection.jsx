import React from 'react';
import { useNavigate } from 'react-router-dom';
import './RoleSelection.css';
import bgImage from '../../assets/media/EMS.jpg';

export default function RoleSelection() {
  const navigate = useNavigate();

  const roles = [
    {
      id: 'admin',
      label: 'ADMIN',
      icon: 'bi-person-gear',
      desc: 'Manage admin portal operations',
      className: 'admin'
    },
    {
      id: 'staff',
      label: 'STAFF',
      icon: 'bi-person-workspace',
      desc: 'Access staff portal and tools',
      className: 'staff'
    }
  ];

  const handleNavigation = (role) => {
    if (role === 'admin') {
      navigate('/admin-portal/login');
      return;
    }
    navigate('/staff/login');
  };

  return (
    <div className="role-selection-container">
      <img src={bgImage} alt="Background" className="role-bg-image" />

      <button onClick={() => navigate('/home')} className="role-back-btn">
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
