import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../src/components/ProtectedRoute'

const mockUseAuth = jest.fn()
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}))

function renderWithRoute(ownerOnly) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/pos" element={<div>POS Page</div>} />
        <Route path="/protected" element={<ProtectedRoute ownerOnly={ownerOnly}><div>Secret Content</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no user', () => {
    mockUseAuth.mockReturnValue({ user: null })
    renderWithRoute(false)
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('renders children when logged in and no role restriction', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'STAFF' } })
    renderWithRoute(false)
    expect(screen.getByText('Secret Content')).toBeInTheDocument()
  })

  it('redirects a STAFF user away from an ownerOnly route', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'STAFF' } })
    renderWithRoute(true)
    expect(screen.getByText('POS Page')).toBeInTheDocument()
  })

  it('allows an OWNER user into an ownerOnly route', () => {
    mockUseAuth.mockReturnValue({ user: { role: 'OWNER' } })
    renderWithRoute(true)
    expect(screen.getByText('Secret Content')).toBeInTheDocument()
  })

  it('shows the mobile-only notice for an ORDER_BOOKER instead of desktop content', () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Bilal', role: 'ORDER_BOOKER' }, logout: jest.fn() })
    renderWithRoute(false)
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument()
    expect(screen.getByText('This is a mobile app account')).toBeInTheDocument()
  })

  it('shows the mobile-only notice for a DELIVERY_RIDER on an ownerOnly route too', () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Usman', role: 'DELIVERY_RIDER' }, logout: jest.fn() })
    renderWithRoute(true)
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument()
    expect(screen.getByText('This is a mobile app account')).toBeInTheDocument()
  })
})
