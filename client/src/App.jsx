import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import POS from './pages/POS'
import Inventory from './pages/Inventory'
import SalesHistory from './pages/SalesHistory'
import Staff from './pages/Staff'
import Settings from './pages/Settings'
import Customers from './pages/Customers'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/pos" element={<POS />} />
          <Route path="/sales" element={<SalesHistory />} />
          <Route path="/customers" element={<Customers />} />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute ownerOnly>
                <Inventory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute ownerOnly>
                <Staff />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute ownerOnly>
                <Settings />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/pos" replace />} />
      </Routes>
    </AuthProvider>
  )
}
