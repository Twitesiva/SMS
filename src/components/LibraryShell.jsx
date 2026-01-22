import { Outlet, useNavigate } from 'react-router-dom'
import LibraryPortalShell from './LibraryPortalShell'
import { libraryNavGroups } from '../pages/library/nav'
import './LibraryShell.css'

export default function LibraryShell() {
  const nav = useNavigate()
  
  return (
    <LibraryPortalShell
      onSignOut={() => {
        nav('/roles')
        return true
      }}
      navGroups={libraryNavGroups}
      brandTitle="Library Management Console"
      brandSubtitle="Vijayam"
      customSidebarClass="library-sidebar-modern"
      customShellClass="library-shell admin-shell--library"
    >
      <Outlet />
    </LibraryPortalShell>
  )
}
