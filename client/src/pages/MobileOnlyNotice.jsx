import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../roles'

// Order Booker and Delivery Rider accounts exist so the owner can manage
// them from this same Staff page, but they have no work to do on this
// desktop terminal — that's what the mobile app is for.
export default function MobileOnlyNotice() {
  const { user, logout } = useAuth()

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>This is a mobile app account</h1>
        <p>
          {user?.name}'s account is set up as <strong>{roleLabel(user?.role)}</strong>. That role works from
          the Takbeer Traders mobile app on your phone, not this desktop terminal — there's nothing to do here.
        </p>
        <button onClick={logout}>Log out</button>
      </div>
    </div>
  )
}
