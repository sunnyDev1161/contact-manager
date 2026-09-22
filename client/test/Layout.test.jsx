import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Layout from '../src/components/Layout'

const mockUseAuth = jest.fn()
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}))

jest.mock('../src/api', () => ({
  __esModule: true,
  default: { get: jest.fn() }
}))
import api from '../src/api'

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/pos']}>
      <Layout />
    </MemoryRouter>
  )
}

describe('Layout', () => {
  beforeEach(() => {
    api.get.mockReset()
    api.get.mockResolvedValue({ data: { products: [] } })
  })

  it('shows owner-only nav links for an OWNER', async () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Boss', role: 'OWNER', businessName: 'Takbeer Traders' }, logout: jest.fn() })
    renderLayout()
    expect(screen.getByText('Inventory')).toBeInTheDocument()
    expect(screen.getByText('Staff')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/products'))
  })

  it('hides owner-only nav links for STAFF', () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Cashier', role: 'STAFF', businessName: 'Takbeer Traders' }, logout: jest.fn() })
    renderLayout()
    expect(screen.queryByText('Inventory')).not.toBeInTheDocument()
    expect(screen.queryByText('Staff')).not.toBeInTheDocument()
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('shows a low-stock badge when products are at or below threshold', async () => {
    api.get.mockResolvedValue({
      data: { products: [{ stockQty: 2, lowStockThreshold: 10 }, { stockQty: 50, lowStockThreshold: 10 }] }
    })
    mockUseAuth.mockReturnValue({ user: { name: 'Boss', role: 'OWNER' }, logout: jest.fn() })
    renderLayout()
    await waitFor(() => expect(screen.getByTitle('1 item(s) low on stock')).toBeInTheDocument())
  })

  it('shows no badge when nothing is low on stock', async () => {
    api.get.mockResolvedValue({ data: { products: [{ stockQty: 50, lowStockThreshold: 10 }] } })
    mockUseAuth.mockReturnValue({ user: { name: 'Boss', role: 'OWNER' }, logout: jest.fn() })
    renderLayout()
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(screen.queryByTitle(/low on stock/)).not.toBeInTheDocument()
  })
})
