import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AppContext'

export function Layout() {
  const { signOut } = useAuth()

  return (
    <div className="layout">
      <header className="top-bar">
        <h1 className="top-bar__title">Vocab</h1>
        <button className="top-bar__signout" onClick={signOut}>
          Sign out
        </button>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end className="bottom-nav__tab">
          <span className="bottom-nav__icon">+</span>
          <span className="bottom-nav__label">Add</span>
        </NavLink>
        <NavLink to="/words" className="bottom-nav__tab">
          <span className="bottom-nav__icon">☰</span>
          <span className="bottom-nav__label">Words</span>
        </NavLink>
        <NavLink to="/export" className="bottom-nav__tab">
          <span className="bottom-nav__icon">↓</span>
          <span className="bottom-nav__label">Export</span>
        </NavLink>
      </nav>
    </div>
  )
}
