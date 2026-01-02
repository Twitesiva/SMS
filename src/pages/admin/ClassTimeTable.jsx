import AdminShell from '../../components/AdminShell'
import crestPrimary from '../../assets/media/images.png'
import { useState } from 'react'

const adminNavGroups = [
  {
    title: 'Student Portal',
    items: [
      {
        to: '/admin-portal/academic-years',
        label: 'Academic Years',
        icon: 'bi-calendar3'
      },
      {
        to: '/admin-portal/groups-courses',
        label: 'Groups & Courses',
        icon: 'bi-diagram-3'
      },
      {
        to: '/admin-portal/subjects',
        label: 'Subjects',
        icon: 'bi-journal-text'
      }
    ]
  },
  {
    title: 'Fees Creation',
    static: true,
    items: [
      {
        to: '/admin-portal/fees-creation',
        label: 'Student Fees Creation',
        icon: 'bi-currency-rupee'
      }
    ]
  },
    {
        title: 'Profile Creation',
        static: true,
        items: [
            {
                to: '/admin-portal/profile-creation',
                label: 'Staff Profile Creation',
                icon: 'bi-person-plus-fill'
            }
        ]
    },
    {
        title: 'Department',
        static: true,
        items: [
            {
                to: '/admin-portal/department',
                label: 'Department',
                icon: 'bi-diagram-3'
            }
        ]
    },
    {
        title: 'Class Time Table',
        static: true,
        items: [
            {
                to: '/admin-portal/class-time-table',
                label: 'Class Time Table',
                icon: 'bi-calendar-date'
            }
        ]
    }
]

export default function ClassTimeTable() {
    return (
        <AdminShell
            navGroups={adminNavGroups}
            brandTitle="Admin Management Console"
            brandSubtitle="Chittoor"
            footerTitle="Admin Management Studio"
            footerSubtitle="Crafted for Vijayam College"
        >
            <div className="desktop-container" style={{ overflowX: 'hidden' }}>
                <section className="setup-hero mb-4 text-center">
                    <div className="setup-hero-copywrap mx-auto text-center" style={{ maxWidth: '640px' }}>
                        <div className="admin-applications__crest mx-auto" aria-hidden="true">
                            <img src={crestPrimary} alt="Vijayam crest" />
                        </div>
                        <h3 className="setup-hero-title mb-2">Vijayam Arts & Science College</h3>
                        <p className="setup-hero-copy mb-3">Collect, verify, and onboard applicants with confidence.</p>
                        <div className="setup-hero-chips d-flex flex-wrap gap-2 justify-content-center">
                            <span className="setup-hero-chip text-uppercase">SMART EXAMINATION PLATFORM</span>
                            <span className="setup-hero-chip text-uppercase">ADMISSIONS CONTROL</span>
                            <span className="setup-hero-chip text-uppercase">APPLICATIONS ADMIN CONSOLE</span>
                        </div>
                    </div>
                </section>

                <div className="row g-4 justify-content-center mx-0">
                    <div className="col-12">
                        <div className="card card-soft p-4">
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                                <div>
                                    <h4 className="mb-1">Class Time Table</h4>
                                    <p className="text-muted mb-0">Manage and create class time tables.</p>
                                </div>
                            </div>

                            <div className="p-5 text-center text-muted">
                                <i className="bi bi-calendar3 fs-1 mb-3 d-block"></i>
                                <p>Class time table creation form coming soon...</p>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </AdminShell>
    )
}

