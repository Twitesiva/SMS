import { Navigate } from 'react-router-dom'
export default function GuardedRoute({ isAuthed, children, redirectTo = "/admin/login" }) {
  if (!isAuthed) return <Navigate to={redirectTo} replace />
  return children
}
