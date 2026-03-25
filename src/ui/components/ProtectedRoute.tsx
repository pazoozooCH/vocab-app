import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AppContext'

export function ProtectedRoute() {
  const { user, loading, authorized, signOut } = useAuth()

  if (loading) {
    return <div className="loading-screen">Loading…</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (authorized === null) {
    return <div className="loading-screen">Checking access…</div>
  }

  if (!authorized) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1 className="login-card__title">Not Authorized</h1>
          <p className="login-card__subtitle">
            Your account ({user.email}) is not on the access list.
          </p>
          <button id="sign-out-btn" className="btn btn--primary btn--large" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
