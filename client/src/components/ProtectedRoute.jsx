import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MOBILE_ONLY_ROLES } from '../roles'
import MobileOnlyNotice from '../pages/MobileOnlyNotice'

export default function ProtectedRoute({ children, ownerOnly = false }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (MOBILE_ONLY_ROLES.includes(user.role)) return <MobileOnlyNotice />
  if (ownerOnly && user.role !== 'OWNER') return <Navigate to="/pos" replace />

  return children
}
