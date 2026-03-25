import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AppContext'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading-screen">Loading…</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
