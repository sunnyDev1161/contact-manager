import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Customers from '../src/pages/Customers'

const mockUseAuth = jest.fn()
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

jest.mock('../src/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }))
import api from '../src/api'

jest.mock('../src/format', () => ({
  money: (n) => `Rs. ${Number(n).toFixed(2)}`,
  downloadCsv: jest.fn()
}))
import { downloadCsv } from '../src/format'

const customer = {
  id: 'c1', shopName: 'Malik General Store', shopkeeperName: 'Malik Zafar',
  phone: '0300-1234567', address: 'Main Bazaar', balance: 450, isActive: true
}

beforeEach(() => {
  jest.clearAllMocks()
  window.confirm = jest.fn(() => true)
  api.get.mockResolvedValue({ data: { customers: [customer] } })
})

describe('Customers page — owner view', () => {
  beforeEach(() => mockUseAuth.mockReturnValue({ user: { role: 'OWNER' } }))

  it('shows the add-customer form and row actions for an owner', async () => {
    render(<Customers />)
    await screen.findByText('Malik General Store')
    expect(screen.getByRole('heading', { name: 'Add customer' })).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('color-codes a positive balance as owed', async () => {
    render(<Customers />)
    await screen.findByText('Malik General Store')
    const balanceCell = screen.getByText('Rs. 450.00')
    expect(balanceCell).toHaveClass('balance-owed')
  })

  it('color-codes a zero balance as clear', async () => {
    api.get.mockResolvedValue({ data: { customers: [{ ...customer, balance: 0 }] } })
    render(<Customers />)
    await screen.findByText('Malik General Store')
    expect(screen.getByText('Rs. 0.00')).toHaveClass('balance-clear')
  })

  it('creates a new customer', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: { customer } })
    render(<Customers />)
    await screen.findByText('Malik General Store')

    await user.type(screen.getByLabelText('Shop name'), 'New Shop')
    await user.click(screen.getByRole('button', { name: 'Add customer' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customers', expect.objectContaining({ shopName: 'New Shop' })))
  })

  it('deletes a customer after confirmation', async () => {
    const user = userEvent.setup()
    api.delete.mockResolvedValue({ data: { softDeleted: false } })
    render(<Customers />)
    await screen.findByText('Malik General Store')
    await user.click(screen.getByText('Delete'))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/customers/c1'))
  })

  it('opens the ledger and records a payment', async () => {
    const user = userEvent.setup()
    api.get.mockImplementation((url) => {
      if (url === '/customers/c1') {
        return Promise.resolve({ data: { customer: { ...customer, balance: 450 }, ledgerEntries: [
          { id: 'e1', type: 'SALE', amount: 450, note: null, createdAt: '2026-01-01T00:00:00Z', recordedBy: { name: 'Owner' } }
        ] } })
      }
      return Promise.resolve({ data: { customers: [customer] } })
    })
    api.post.mockResolvedValue({ data: {} })
    render(<Customers />)
    await screen.findByText('Malik General Store')

    await user.click(screen.getByText('Ledger'))
    expect(await screen.findByText('Credit (sale)')).toBeInTheDocument()
    expect(screen.getByText('+Rs. 450.00')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Payment amount'), '200')
    await user.click(screen.getByRole('button', { name: 'Record Payment' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/customers/c1/payments', { amount: 200, note: null }))
  })

  it('shows a validation error for a zero payment amount without calling the API', async () => {
    const user = userEvent.setup()
    api.get.mockImplementation((url) => {
      if (url === '/customers/c1') return Promise.resolve({ data: { customer, ledgerEntries: [] } })
      return Promise.resolve({ data: { customers: [customer] } })
    })
    render(<Customers />)
    await screen.findByText('Malik General Store')
    await user.click(screen.getByText('Ledger'))
    await screen.findByText('No transactions yet.')
    await user.click(screen.getByRole('button', { name: 'Record Payment' }))
    expect(screen.getByText('Enter a valid payment amount.')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('shows a distinct tag for a VOID (reversal) ledger entry', async () => {
    const user = userEvent.setup()
    api.get.mockImplementation((url) => {
      if (url === '/customers/c1') return Promise.resolve({ data: { customer, ledgerEntries: [
        { id: 'e1', type: 'VOID', amount: 100, note: null, createdAt: '2026-01-01T00:00:00Z', recordedBy: { name: 'Owner' } }
      ] } })
      return Promise.resolve({ data: { customers: [customer] } })
    })
    render(<Customers />)
    await screen.findByText('Malik General Store')
    await user.click(screen.getByText('Ledger'))
    expect(await screen.findByText('Reversal (voided sale)')).toBeInTheDocument()
  })

  it('shows an error if loading customers fails', async () => {
    api.get.mockRejectedValue({ response: { data: { error: 'Failed to load customers' } } })
    render(<Customers />)
    expect(await screen.findByText('Failed to load customers')).toBeInTheDocument()
  })

  it('shows an error if creating a customer fails', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValue({ response: { data: { error: 'Save failed' } } })
    render(<Customers />)
    await screen.findByText('Malik General Store')
    await user.type(screen.getByLabelText('Shop name'), 'X')
    await user.click(screen.getByRole('button', { name: 'Add customer' }))
    expect(await screen.findByText('Save failed')).toBeInTheDocument()
  })

  it('shows an error if deleting a customer fails', async () => {
    const user = userEvent.setup()
    api.delete.mockRejectedValue({ response: { data: { error: 'Delete failed' } } })
    render(<Customers />)
    await screen.findByText('Malik General Store')
    await user.click(screen.getByText('Delete'))
    expect(await screen.findByText('Delete failed')).toBeInTheDocument()
  })

  it('cancels an in-progress edit', async () => {
    const user = userEvent.setup()
    render(<Customers />)
    await screen.findByText('Malik General Store')
    await user.click(screen.getByText('Edit'))
    expect(screen.getByRole('heading', { name: 'Edit customer' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'Add customer' })).toBeInTheDocument()
  })

  it('reactivates an inactive customer', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValue({ data: { customers: [{ ...customer, isActive: false }] } })
    api.put.mockResolvedValue({ data: { customer } })
    render(<Customers />)
    await screen.findByText(/Malik General Store \(removed\)/)
    await user.click(screen.getByText('Restore'))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/customers/c1', { isActive: true }))
  })

  it('closes the ledger panel', async () => {
    const user = userEvent.setup()
    api.get.mockImplementation((url) => {
      if (url === '/customers/c1') return Promise.resolve({ data: { customer, ledgerEntries: [] } })
      return Promise.resolve({ data: { customers: [customer] } })
    })
    render(<Customers />)
    await screen.findByText('Malik General Store')
    await user.click(screen.getByText('Ledger'))
    await screen.findByText('No transactions yet.')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('No transactions yet.')).not.toBeInTheDocument()
  })

  it('exports the customer list as CSV', async () => {
    const user = userEvent.setup()
    render(<Customers />)
    await screen.findByText('Malik General Store')
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(downloadCsv).toHaveBeenCalledWith('customers.csv', expect.any(Array), [customer])
  })
})

describe('Customers page — staff view', () => {
  beforeEach(() => mockUseAuth.mockReturnValue({ user: { role: 'STAFF' } }))

  it('hides the add-customer form and Edit/Delete but still allows Ledger', async () => {
    render(<Customers />)
    await screen.findByText('Malik General Store')
    expect(screen.queryByRole('heading', { name: 'Add customer' })).not.toBeInTheDocument()
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    expect(screen.getByText('Ledger')).toBeInTheDocument()
  })
})
