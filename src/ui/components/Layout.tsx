import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AppContext'
import { BuildInfo } from './BuildInfo'

const isLocalDev = import.meta.env.DEV

export function Layout() {
  const { signOut } = useAuth()

  return (
    <div className="layout">
      <header className={`top-bar ${isLocalDev ? 'top-bar--local' : ''}`}>
        <h1 id="app-title" className="top-bar__title">
          Vocab{isLocalDev && <span className="top-bar__local-badge">LOCAL</span>}
        </h1>
        <div className="top-bar__right">
          <BuildInfo />
          <button id="sign-out-btn" className="top-bar__signout" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end id="nav-add" className="bottom-nav__tab">
          <span className="bottom-nav__icon">+</span>
          <span className="bottom-nav__label">Add</span>
        </NavLink>
        <NavLink to="/words" id="nav-words" className="bottom-nav__tab">
          <span className="bottom-nav__icon">☰</span>
          <span className="bottom-nav__label">Words</span>
        </NavLink>
        <NavLink to="/export" id="nav-export" className="bottom-nav__tab">
          <span className="bottom-nav__icon">↓</span>
          <span className="bottom-nav__label">Export</span>
        </NavLink>
      </nav>
    </div>
  )
}
