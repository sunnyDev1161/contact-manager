import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App'

jest.mock('../src/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn((url) => {
      if (url === '/products') return Promise.resolve({ data: { products: [] } })
      if (url === '/customers') return Promise.resolve({ data: { customers: [] } })
      if (url === '/business') return Promise.resolve({ data: { business: {} } })
      return Promise.resolve({ data: {} })
    }),
    post: jest.fn()
  }
}))

function renderAt(path) {
  window.history.pushState({}, '', path)
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

describe('App routing', () => {
  beforeEach(() => localStorage.clear())

  it('redirects an unauthenticated visitor to /login for a protected route', () => {
    renderAt('/pos')
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it('serves /login directly', () => {
    renderAt('/login')
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it('serves /register directly', () => {
    renderAt('/register')
    expect(screen.getByRole('heading', { name: 'Create your business' })).toBeInTheDocument()
  })

  it('redirects an unknown path to /pos, which then redirects to /login when logged out', () => {
    renderAt('/some/unknown/path')
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it('lets a logged-in owner reach an owner-only route', async () => {
    localStorage.setItem('pos_token', 'tok')
    localStorage.setItem('pos_user', JSON.stringify({ role: 'OWNER', name: 'Boss', businessName: 'Biz' }))
    renderAt('/inventory')
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument()
  })

  it('redirects a logged-in STAFF user away from an owner-only route', async () => {
    localStorage.setItem('pos_token', 'tok')
    localStorage.setItem('pos_user', JSON.stringify({ role: 'STAFF', name: 'Cashier', businessName: 'Biz' }))
    renderAt('/staff')
    expect(await screen.findByPlaceholderText(/Scan barcode/)).toBeInTheDocument()
  })
})
