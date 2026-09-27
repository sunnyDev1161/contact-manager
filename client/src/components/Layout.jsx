import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../roles'
import api from '../api'

export default function Layout() {
  const { user, logout } = useAuth()
  const [lowStockCount, setLowStockCount] = useState(0)
  const location = useLocation()

  // Layout stays mounted for the whole session (every page renders inside
  // it via <Outlet/>), so a fetch-once-on-mount badge would go stale the
  // moment stock changes — refetch on every navigation instead, which
  // covers the common case (add/adjust stock in Inventory, then move on).
  useEffect(() => {
    api.get('/products').then(({ data }) => {
      const count = data.products.filter(p => Number(p.stockQty) <= Number(p.lowStockThreshold)).length
      setLowStockCount(count)
    }).catch(() => {})
  }, [location.pathname])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{user?.businessName || 'POS'}</div>
        <nav>
          <NavLink to="/pos">POS</NavLink>
          <NavLink to="/sales">Sales</NavLink>
          <NavLink to="/customers">Customers</NavLink>
          {user?.role === 'OWNER' && (
            <NavLink to="/inventory">
              Inventory
              {lowStockCount > 0 && <span className="low-stock-badge" title={`${lowStockCount} item(s) low on stock`}>{lowStockCount}</span>}
            </NavLink>
          )}
          {user?.role === 'OWNER' && <NavLink to="/staff">Staff</NavLink>}
          {user?.role === 'OWNER' && <NavLink to="/settings">Settings</NavLink>}
        </nav>
        <div className="user-box">
          <span>{user?.name} ({roleLabel(user?.role)})</span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
