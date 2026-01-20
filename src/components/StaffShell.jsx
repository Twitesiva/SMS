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
            title: 'Staff Portal',
            static: true,
            items: [
                { to: '/staff/dashboard', label: 'My Profile', icon: 'bi-speedometer2' },
                { to: '/staff/attendance', label: 'Student Attendance', icon: 'bi-clipboard-check' },
                { to: '/staff/students', label: 'Student Records', icon: 'bi-people' },
                { to: '/staff/timetable', label: 'Academic Timetable', icon: 'bi-calendar-week' },
                { to: '/staff/circulars', label: 'Circulars', icon: 'bi-megaphone-fill' },
                { to: '/staff/materials', label: 'Learning Materials', icon: 'bi-folder2-open' },
            ]
        },
        {
            title: 'Academic Management',
            static: true,
            items: [
                { to: '/staff/performance', label: 'Academic Performance Feedback', icon: 'bi-graph-up-arrow' },
                { to: '/staff/my-attendance', label: 'My Attendance Overview', icon: 'bi-person-check' },
            ]
        },
        ...(isHOD ? [{
            title: 'Leave Management',
            static: true,
            items: [
                { to: '/staff/leave?view=students', label: 'Student Requests', icon: 'bi-person-lines-fill' },
                { to: '/staff/leave?view=staff', label: 'Staff Requests', icon: 'bi-person-lines-fill' },
            ]
        }] : [])
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
