import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SalesHistory from '../src/pages/SalesHistory'

const mockUseAuth = jest.fn()
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

jest.mock('../src/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }))
import api from '../src/api'

jest.mock('../src/format', () => ({
  money: (n) => `Rs. ${Number(n).toFixed(2)}`,
  downloadCsv: jest.fn()
}))
import { downloadCsv } from '../src/format'

const sale = {
  id: 's1', invoiceNo: 3, createdAt: '2026-01-10T10:00:00Z', saleType: 'RETAIL', totalAmount: 440, amountPaid: 440,
  totalProfit: 80, customer: null, user: { name: 'Owner' },
  items: [{ id: 'i1', productName: 'Basmati Rice', quantity: 2, unit: 'KG', tradeUnitPrice: 200, retailUnitPrice: 220, lineTotal: 440 }], voidedAt: null
}

const summary = { salesCount: 1, totalRevenue: 440, totalCost: 360, totalProfit: 80 }

function mockApiResponses({ salesList = [sale], totalCount = salesList.length } = {}) {
  api.get.mockImplementation((url) => {
    if (url === '/sales') return Promise.resolve({ data: { sales: salesList, totalCount } })
    if (url === '/sales/summary') return Promise.resolve({ data: summary })
    if (url === '/business') return Promise.resolve({ data: { business: { name: 'Takbeer Traders' } } })
    return Promise.resolve({ data: {} })
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  window.print = jest.fn()
  mockApiResponses()
})

describe('SalesHistory page — owner view', () => {
  beforeEach(() => mockUseAuth.mockReturnValue({ user: { role: 'OWNER' } }))

  it('shows the summary stat cards and the sale row with its invoice number', async () => {
    render(<SalesHistory />)
    expect(await screen.findByText('INV-00003')).toBeInTheDocument()
    // Total, Paid, and the Revenue stat card all legitimately show Rs. 440.00
    expect(screen.getAllByText('Rs. 440.00').length).toBeGreaterThanOrEqual(2)
  })

  it('shows a truncation note when totalCount exceeds the loaded rows', async () => {
    mockApiResponses({ salesList: [sale], totalCount: 250 })
    render(<SalesHistory />)
    expect(await screen.findByText(/Showing the most recent 1 of 250 sales/)).toBeInTheDocument()
  })

  it('does not show a truncation note when everything fit', async () => {
    render(<SalesHistory />)
    await screen.findByText('INV-00003')
    expect(screen.queryByText(/Showing the most recent/)).not.toBeInTheDocument()
  })

  it('voids a sale after entering a reason in the confirmation modal', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: { sale: { ...sale, voidedAt: '2026-01-11T00:00:00Z' } } })
    render(<SalesHistory />)
    await screen.findByText('INV-00003')

    await user.click(screen.getByText('Void'))
    expect(screen.getByRole('heading', { name: 'Void sale INV-00003?' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Reason'), 'Wrong item scanned')
    await user.click(screen.getByRole('button', { name: 'Void Sale' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/sales/s1/void', { reason: 'Wrong item scanned' }))
  })

  it('cannot confirm the void modal with an empty reason', async () => {
    const user = userEvent.setup()
    render(<SalesHistory />)
    await screen.findByText('INV-00003')
    await user.click(screen.getByText('Void'))
    expect(screen.getByRole('button', { name: 'Void Sale' })).toBeDisabled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('closes the void modal on Cancel without voiding', async () => {
    const user = userEvent.setup()
    render(<SalesHistory />)
    await screen.findByText('INV-00003')
    await user.click(screen.getByText('Void'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('heading', { name: /Void sale/ })).not.toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('shows a VOIDED badge and hides the Void button for an already-voided sale', async () => {
    mockApiResponses({ salesList: [{ ...sale, voidedAt: '2026-01-11T00:00:00Z' }] })
    render(<SalesHistory />)
    await screen.findByText('INV-00003')
    expect(screen.getByText('VOIDED')).toBeInTheDocument()
    expect(screen.queryByText('Void')).not.toBeInTheDocument()
  })

  it('exports the loaded sales as CSV', async () => {
    const user = userEvent.setup()
    render(<SalesHistory />)
    await screen.findByText('INV-00003')
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(downloadCsv).toHaveBeenCalledWith(expect.stringContaining('sales_'), expect.any(Array), [sale])
  })

  it('shows an error if loading sales fails', async () => {
    api.get.mockRejectedValue({ response: { data: { error: 'Failed to load sales' } } })
    render(<SalesHistory />)
    expect(await screen.findByText('Failed to load sales')).toBeInTheDocument()
  })

  it('shows an error if voiding a sale fails', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValue({ response: { data: { error: 'This sale has already been voided.' } } })
    render(<SalesHistory />)
    await screen.findByText('INV-00003')
    await user.click(screen.getByText('Void'))
    await user.type(screen.getByLabelText('Reason'), 'test reason')
    await user.click(screen.getByRole('button', { name: 'Void Sale' }))
    expect(await screen.findByText('This sale has already been voided.')).toBeInTheDocument()
  })

  it('prints a sale by selecting it, which triggers window.print', async () => {
    const user = userEvent.setup()
    render(<SalesHistory />)
    await screen.findByText('INV-00003')
    await user.click(screen.getByText('Print'))
    await waitFor(() => expect(window.print).toHaveBeenCalled())
  })

  it('applies the "last month" and "last 30 days" presets', async () => {
    const user = userEvent.setup()
    render(<SalesHistory />)
    await screen.findByText('INV-00003')
    api.get.mockClear()
    mockApiResponses()
    await user.click(screen.getByText('Last Month'))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/sales', expect.any(Object)))

    api.get.mockClear()
    mockApiResponses()
    await user.click(screen.getByText('Last 30 Days'))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/sales', expect.any(Object)))
  })

  it('applies a date preset and reloads', async () => {
    const user = userEvent.setup()
    render(<SalesHistory />)
    await screen.findByText('INV-00003')
    api.get.mockClear()
    mockApiResponses()
    await user.click(screen.getByText('This Month'))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/sales', expect.any(Object)))
  })
})

describe('SalesHistory page — staff view', () => {
  beforeEach(() => mockUseAuth.mockReturnValue({ user: { role: 'STAFF' } }))

  it('hides the Void button for staff', async () => {
    render(<SalesHistory />)
    await screen.findByText('INV-00003')
    expect(screen.queryByText('Void')).not.toBeInTheDocument()
    expect(screen.getByText('Print')).toBeInTheDocument()
  })
})
