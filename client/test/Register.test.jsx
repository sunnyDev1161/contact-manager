import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Register from '../src/pages/Register'

const mockRegister = jest.fn()
const mockNavigate = jest.fn()
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister })
}))
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))

describe('Register page', () => {
  beforeEach(() => {
    mockRegister.mockReset()
    mockNavigate.mockReset()
  })

  it('registers a new business and navigates to /pos', async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValue({})
    render(<MemoryRouter><Register /></MemoryRouter>)

    await user.type(screen.getByLabelText('Business name'), 'Takbeer Traders')
    await user.type(screen.getByLabelText('Your name'), 'Owner')
    await user.type(screen.getByLabelText('Email'), 'owner@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith('Takbeer Traders', 'Owner', 'owner@example.com', 'password123'))
    expect(mockNavigate).toHaveBeenCalledWith('/pos')
  })

  it('shows a server error on failure', async () => {
    const user = userEvent.setup()
    mockRegister.mockRejectedValue({ response: { data: { error: 'Email already registered' } } })
    render(<MemoryRouter><Register /></MemoryRouter>)

    await user.type(screen.getByLabelText('Business name'), 'Biz')
    await user.type(screen.getByLabelText('Your name'), 'Owner')
    await user.type(screen.getByLabelText('Email'), 'taken@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  })
})
