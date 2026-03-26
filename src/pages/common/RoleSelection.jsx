import React from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../store/ui.js';
import './RoleSelection.css';
import bgImage from '../../assets/media/EMS.jpg';

const allowedPortals = ['admin', 'staff'];
const portalRoutes = {
  admin: '/admin-portal/login',
  staff: '/staff/login'
};
const lockedMessage =
  'This page is locked. Please contact Twite AI Technologies to unlock it.';
const portals = [
  {
    id: 'admission',
    label: 'ADMISSION PORTAL',
    icon: 'bi-journal-richtext',
    desc: 'Admissions, Applications & Enquiries',
    className: 'admission'
  },
  {
    id: 'admin',
    label: 'ADMIN',
    icon: 'bi-person-gear',
    desc: 'User management & configuration',
    className: 'admin'
  },
  {
    id: 'staff',
    label: 'STAFF',
    icon: 'bi-person-workspace',
    desc: 'Access staff portal, manage students',
    className: 'staff'
  },
  {
    id: 'exam',
    label: 'EXAM PORTAL',
    icon: 'bi-laptop',
    desc: 'Controller of Examinations login',
    className: 'exam'
  },
  {
    id: 'student',
    label: 'STUDENT',
    icon: 'bi-mortarboard',
    desc: 'Access student portal, results & timetables',
    className: 'student'
  },
  {
    id: 'library',
    label: 'LIBRARY',
    icon: 'bi-book',
    desc: 'Library catalog & issue desk',
    className: 'library'
  },
  {
    id: 'parent',
    label: 'PARENT',
    icon: 'bi-people',
    desc: 'Access parent portal, monitor student progress',
    className: 'parent'
  },
  {
    id: 'hostel',
    label: 'HOSTEL',
    icon: 'bi-house',
    desc: 'Hostel management & allocation',
    className: 'hostel'
  },
  {
    id: 'transport',
    label: 'TRANSPORT',
    icon: 'bi-bus-front',
    desc: 'Transport routes & passes',
    className: 'transport'
  }
];

const showLockedMessage = () => {
  showToast(lockedMessage, { type: 'warning', duration: 7000 });
};

export default function RoleSelection() {
  const navigate = useNavigate();

  const handlePortalClick = (portalId) => {
    console.log(`Portal clicked: ${portalId}`);

    if (allowedPortals.includes(portalId)) {
      console.log(`Portal access: allowed for ${portalId}`);
      const route = portalRoutes[portalId];
      if (route) {
        navigate(route);
      }
      return;
    }

    console.log(`Portal access: blocked for ${portalId}`);
    showLockedMessage();
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
          {portals.map((portal) => (
            <div
              key={portal.id}
              className={`role-card ${portal.className}`}
              onClick={() => handlePortalClick(portal.id)}
            >
              <div className="role-icon-wrapper">
                <i className={`bi ${portal.icon}`}></i>
              </div>
              <div className="role-name">{portal.label}</div>
              <div className="role-description">{portal.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
