import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useParentAuth } from '../store/parentAuth'
import crest from '../assets/media/images.png'
import AdminShell from './AdminShell'
import './AdminShell.css'

const navGroups = [
    {
        title: 'Student Details',
        static: true,
        items: [
            { to: '/parent/student-details', label: 'Student Details', icon: 'bi-person-badge' }
        ]
    },
    {
        title: 'Attendance',
        static: true,
        items: [
            { to: '/parent/attendance', label: 'Attendance', icon: 'bi-calendar-check' }
        ]
    },
    {
        title: 'Marks',
        static: true,
        items: [
            { to: '/parent/marks', label: 'Marks', icon: 'bi-file-earmark-bar-graph' }
        ]
    },
    {
        title: 'Notifications',
        static: true,
        items: [
            { to: '/parent/notifications', label: 'Notifications', icon: 'bi-bell' }
        ]
    }
]

export default function ParentShell({ children }) {
    const { pathname } = useLocation()
    const navTo = useNavigate()
    const { parent, signOut } = useParentAuth()

    const handleLogout = () => {
        signOut()
        navTo('/parent/login')
    }

    return (
        <AdminShell
            navGroups={navGroups}
            brandTitle="Parent Portal"
            brandSubtitle="Vijayam College"
            customSidebarClass="parent-sidebar-modern slate"
            customShellClass="parent-shell slate"
            onSignOut={handleLogout}
        >
            {children}
        </AdminShell>
    )
}
