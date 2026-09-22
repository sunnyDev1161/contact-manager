import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Staff from '../src/pages/Staff'

jest.mock('../src/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn() } }))
import api from '../src/api'

const owner = { id: 'u0', name: 'Owner', email: 'owner@example.com', role: 'OWNER', isActive: true }
const cashier = { id: 'u1', name: 'Ali', email: 'ali@example.com', role: 'STAFF', isActive: true }

beforeEach(() => {
  jest.clearAllMocks()
  window.confirm = jest.fn(() => true)
  api.get.mockResolvedValue({ data: { users: [owner, cashier] } })
})

describe('Staff page', () => {
  it('lists staff with their status', async () => {
    render(<Staff />)
    expect(await screen.findByText('Ali')).toBeInTheDocument()
    expect(screen.getAllByText('Active')).toHaveLength(2)
  })

  it('creates a new staff account', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: { user: cashier } })
    render(<Staff />)
    await screen.findByText('Ali')

    await user.type(screen.getByLabelText('Name'), 'Bilal')
    await user.type(screen.getByLabelText('Email'), 'bilal@example.com')
    await user.type(screen.getByLabelText('Temporary password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Add staff' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/staff', {
      name: 'Bilal', email: 'bilal@example.com', password: 'password123'
    }))
    expect(await screen.findByText('Staff account created.')).toBeInTheDocument()
  })

  it('does not offer Edit/Deactivate for the OWNER row', async () => {
    render(<Staff />)
    await screen.findByText('Ali')
    const ownerRow = screen.getByText('Owner').closest('tr')
    expect(within(ownerRow).queryByText('Edit')).not.toBeInTheDocument()
  })

  it('edits a staff member\'s name and optionally resets their password', async () => {
    const user = userEvent.setup()
    api.put.mockResolvedValue({ data: { user: { ...cashier, name: 'Ali Updated' } } })
    render(<Staff />)
    await screen.findByText('Ali')

    const row = screen.getByText('Ali').closest('tr')
    await user.click(within(row).getByText('Edit'))

    const nameInput = screen.getByDisplayValue('Ali')
    await user.clear(nameInput)
    await user.type(nameInput, 'Ali Updated')
    await user.type(screen.getByPlaceholderText('New password (optional)'), 'newpassword123')
    await user.click(screen.getByText('Save'))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/auth/staff/u1', {
      name: 'Ali Updated', password: 'newpassword123'
    }))
  })

  it('deactivates a staff account after confirmation', async () => {
    const user = userEvent.setup()
    api.put.mockResolvedValue({ data: { user: { ...cashier, isActive: false } } })
    render(<Staff />)
    await screen.findByText('Ali')
    const row = screen.getByText('Ali').closest('tr')
    await user.click(within(row).getByText('Deactivate'))
    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/auth/staff/u1', { isActive: false }))
  })

  it('offers Reactivate for a deactivated account', async () => {
    api.get.mockResolvedValue({ data: { users: [owner, { ...cashier, isActive: false }] } })
    render(<Staff />)
    await screen.findByText('Ali')
    expect(screen.getByText('Deactivated')).toBeInTheDocument()
    expect(screen.getByText('Reactivate')).toBeInTheDocument()
  })

  it('shows an error message when creating a staff account fails', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValue({ response: { data: { error: 'Email already registered' } } })
    render(<Staff />)
    await screen.findByText('Ali')
    await user.type(screen.getByLabelText('Name'), 'X')
    await user.type(screen.getByLabelText('Email'), 'ali@example.com')
    await user.type(screen.getByLabelText('Temporary password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Add staff' }))
    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  })
})
