import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AppContext'

export function LoginPage() {
  const { user, loading, signIn } = useAuth()

  if (loading) {
    return <div className="loading-screen">Loading…</div>
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-card__title">Vocab</h1>
        <p className="login-card__subtitle">
          Collect vocabulary, get AI translations, export to Anki.
        </p>
        <button className="btn btn--primary btn--large" onClick={signIn}>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
