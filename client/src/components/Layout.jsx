import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{user?.businessName || 'POS'}</div>
        <nav>
          <NavLink to="/pos">POS</NavLink>
          <NavLink to="/sales">Sales</NavLink>
          {user?.role === 'OWNER' && <NavLink to="/inventory">Inventory</NavLink>}
          {user?.role === 'OWNER' && <NavLink to="/staff">Staff</NavLink>}
        </nav>
        <div className="user-box">
          <span>{user?.name} ({user?.role})</span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
