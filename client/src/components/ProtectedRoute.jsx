import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, ownerOnly = false }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (ownerOnly && user.role !== 'OWNER') return <Navigate to="/pos" replace />

  return children
}
