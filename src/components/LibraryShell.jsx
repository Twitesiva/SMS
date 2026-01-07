import { Outlet, useNavigate } from 'react-router-dom'
import AdminShell from './AdminShell'
import { libraryNavGroups } from '../pages/library/nav'

export default function LibraryShell() {
  const nav = useNavigate()
  
  return (
    <AdminShell
      onSignOut={() => {
        nav('/roles')
        return true
      }}
      navGroups={libraryNavGroups}
      brandTitle="Library Management Console"
      brandSubtitle="Vijayam"
      footerTitle="Library Management Studio"
      footerSubtitle="Crafted for Vijayam College"
    >
      <Outlet />
    </AdminShell>
  )
}
