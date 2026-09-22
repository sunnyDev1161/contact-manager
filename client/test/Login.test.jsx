import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../src/pages/Login'

const mockLogin = jest.fn()
const mockNavigate = jest.fn()
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin })
}))
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))

function renderLogin() {
  return render(<MemoryRouter><Login /></MemoryRouter>)
}

describe('Login page', () => {
  beforeEach(() => {
    mockLogin.mockReset()
    mockNavigate.mockReset()
  })

  it('logs in and navigates to /pos on success', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValue({})
    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'owner@example.com')
    await user.type(screen.getByLabelText('Password'), 'changeme123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('owner@example.com', 'changeme123'))
    expect(mockNavigate).toHaveBeenCalledWith('/pos')
  })

  it('shows the server error message on failed login', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValue({ response: { data: { error: 'Invalid email or password' } } })
    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'owner@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('falls back to a generic error message when the server gives none', async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValue(new Error('network down'))
    renderLogin()
    await user.type(screen.getByLabelText('Email'), 'a@x.com')
    await user.type(screen.getByLabelText('Password'), 'x')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByText('Login failed')).toBeInTheDocument()
  })
})
