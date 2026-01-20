import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useStaffAuth } from '../store/staffAuth'
import crest from '../assets/media/images.png'
import AdminShell from './AdminShell'
import './AdminShell.css'

export default function StaffShell({ children }) {
    const location = useLocation()
    const { pathname, search } = location
    const navTo = useNavigate()
    const { staff, signOut } = useStaffAuth()
    const [collapsed, setCollapsed] = useState(false)
    const [openSection, setOpenSection] = useState(null)
    const isHOD = staff?.designation === 'HOD'

    const navGroups = useMemo(() => [
        {
            title: 'My Profile',
            static: true,
            items: [{ to: '/staff/dashboard', label: 'My Profile', icon: 'bi-speedometer2' }]
        },
        {
            title: 'Student Attendance',
            static: true,
            items: [{ to: '/staff/attendance', label: 'Student Attendance', icon: 'bi-clipboard-check' }]
        },
        {
            title: 'Student Records',
            static: true,
            items: [{ to: '/staff/students', label: 'Student Records', icon: 'bi-people' }]
        },
        {
            title: 'Academic Timetable',
            static: true,
            items: [{ to: '/staff/timetable', label: 'Academic Timetable', icon: 'bi-calendar-week' }]
        },
        {
            title: 'Circulars',
            static: true,
            items: [{ to: '/staff/circulars', label: 'Circulars', icon: 'bi-megaphone-fill' }]
        },
        {
            title: 'Learning Materials',
            static: true,
            items: [{ to: '/staff/materials', label: 'Learning Materials', icon: 'bi-folder2-open' }]
        },
        {
            title: 'Academic Performance',
            static: true,
            items: [{ to: '/staff/performance', label: 'Academic Performance', icon: 'bi-graph-up-arrow' }]
        },
        {
            title: 'My Attendance',
            static: true,
            items: [{ to: '/staff/my-attendance', label: 'My Attendance', icon: 'bi-person-check' }]
        },
        ...(isHOD ? [
            {
                title: 'Leave: Student Requests',
                static: true,
                items: [{ to: '/staff/leave?view=students', label: 'Student Requests', icon: 'bi-person-lines-fill' }]
            },
            {
                title: 'Leave: Staff Requests',
                static: true,
                items: [{ to: '/staff/leave?view=staff', label: 'Staff Requests', icon: 'bi-person-lines-fill' }]
            }
        ] : [])
    ], [isHOD])

    const handleLogout = () => {
        signOut()
        navTo('/staff/login')
    }

    return (
        <AdminShell
            navGroups={navGroups}
            brandTitle="Staff Portal"
            brandSubtitle="Vijayam College"
            customSidebarClass="staff-sidebar-modern"
            customShellClass="staff-shell"
            onSignOut={handleLogout}
        >
            {children}
        </AdminShell>
    )
}
