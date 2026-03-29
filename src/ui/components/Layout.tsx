import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AppContext'
import { BuildInfo } from './BuildInfo'
import { checkNavigationGuard } from '../hooks/useNavigationGuard'

const isLocalDev = import.meta.env.DEV

export function Layout() {
  const { signOut } = useAuth()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const handleNav = (to: string) => (e: React.MouseEvent) => {
    if (location.pathname === to) return
    if (!checkNavigationGuard()) {
      e.preventDefault()
    }
  }

  const handleMoreNav = (to: string) => (e: React.MouseEvent) => {
    if (location.pathname === to) return
    if (!checkNavigationGuard()) {
      e.preventDefault()
      return
    }
    setMoreOpen(false)
  }

  // Close menu on outside click
  useEffect(() => {
    if (!moreOpen) return
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [moreOpen])

  const isMoreActive = ['/export', '/import', '/stats'].includes(location.pathname)

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
        <NavLink to="/" end id="nav-add" className="bottom-nav__tab" onClick={handleNav('/')}>
          <span className="bottom-nav__icon">+</span>
          <span className="bottom-nav__label">Add</span>
        </NavLink>
        <NavLink to="/words" id="nav-words" className="bottom-nav__tab" onClick={handleNav('/words')}>
          <span className="bottom-nav__icon">&#9776;</span>
          <span className="bottom-nav__label">Words</span>
        </NavLink>
        <div className="bottom-nav__more" ref={moreRef}>
          <button
            id="nav-more"
            className={`bottom-nav__tab bottom-nav__tab--btn${isMoreActive ? ' active' : ''}`}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <span className="bottom-nav__icon">&middot;&middot;&middot;</span>
            <span className="bottom-nav__label">More</span>
          </button>
          {moreOpen && (
            <div className="more-menu" id="more-menu">
              <NavLink to="/export" id="nav-export" className="more-menu__item" onClick={handleMoreNav('/export')}>
                Export
              </NavLink>
              <NavLink to="/import" id="nav-import" className="more-menu__item" onClick={handleMoreNav('/import')}>
                Import
              </NavLink>
              <NavLink to="/stats" id="nav-stats" className="more-menu__item" onClick={handleMoreNav('/stats')}>
                Stats
              </NavLink>
            </div>
          )}
        </div>
      </nav>
    </div>
  )
}
