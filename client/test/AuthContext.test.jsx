import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../src/context/AuthContext'

jest.mock('../src/api', () => ({
  __esModule: true,
  default: { post: jest.fn() }
}))
import api from '../src/api'

function Probe() {
  const { user, login, register, logout } = useAuth()
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'none'}</div>
      <button onClick={() => login('a@x.com', 'pw')}>login</button>
      <button onClick={() => register('Biz', 'Name', 'a@x.com', 'pw')}>register</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    api.post.mockReset()
  })

  it('starts with no user when localStorage is empty', () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('restores the user from localStorage on mount', () => {
    localStorage.setItem('pos_user', JSON.stringify({ email: 'saved@x.com' }))
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByTestId('user')).toHaveTextContent('saved@x.com')
  })

  it('login stores the token and user, and updates state', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: { token: 'tok123', user: { email: 'a@x.com' } } })
    render(<AuthProvider><Probe /></AuthProvider>)

    await user.click(screen.getByText('login'))

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('a@x.com'))
    expect(localStorage.getItem('pos_token')).toBe('tok123')
    expect(JSON.parse(localStorage.getItem('pos_user'))).toEqual({ email: 'a@x.com' })
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'a@x.com', password: 'pw' })
  })

  it('register stores the token and user', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: { token: 'tok456', user: { email: 'a@x.com' } } })
    render(<AuthProvider><Probe /></AuthProvider>)

    await user.click(screen.getByText('register'))

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('a@x.com'))
    expect(api.post).toHaveBeenCalledWith('/auth/register', { businessName: 'Biz', name: 'Name', email: 'a@x.com', password: 'pw' })
  })

  it('logout clears storage and state', async () => {
    const user = userEvent.setup()
    localStorage.setItem('pos_token', 'tok')
    localStorage.setItem('pos_user', JSON.stringify({ email: 'a@x.com' }))
    render(<AuthProvider><Probe /></AuthProvider>)
    expect(screen.getByTestId('user')).toHaveTextContent('a@x.com')

    await user.click(screen.getByText('logout'))

    expect(screen.getByTestId('user')).toHaveTextContent('none')
    expect(localStorage.getItem('pos_token')).toBeNull()
    expect(localStorage.getItem('pos_user')).toBeNull()
  })
})
