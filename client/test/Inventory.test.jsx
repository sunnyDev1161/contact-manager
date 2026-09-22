import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Inventory from '../src/pages/Inventory'

jest.mock('../src/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }))
import api from '../src/api'

jest.mock('../src/format', () => ({
  money: (n) => `Rs. ${Number(n).toFixed(2)}`,
  downloadCsv: jest.fn()
}))
import { downloadCsv } from '../src/format'

const activeProduct = {
  id: 'p1', name: 'Basmati Rice', category: 'Grains', unit: 'KG',
  pricePerUnit: 220, tradePricePerUnit: 200, costPerUnit: 180,
  stockQty: 5, lowStockThreshold: 10, isActive: true
}

beforeEach(() => {
  jest.clearAllMocks()
  window.confirm = jest.fn(() => true)
  api.get.mockResolvedValue({ data: { products: [activeProduct] } })
})

describe('Inventory page', () => {
  it('lists products and shows a low-stock row when stock is at/below threshold', async () => {
    render(<Inventory />)
    expect(await screen.findByText('Basmati Rice')).toBeInTheDocument()
    const row = screen.getByText('Basmati Rice').closest('tr')
    expect(row).toHaveClass('low-stock-row')
  })

  it('shows a live retail/trade profit preview as the form is filled', async () => {
    render(<Inventory />)
    await screen.findByText('Basmati Rice')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/Retail price/), '220')
    await user.type(screen.getByLabelText(/Trade price/), '200')
    await user.type(screen.getByLabelText(/Cost/), '180')
    const preview = document.querySelector('.profit-preview')
    expect(within(preview).getByText('Rs. 40.00')).toBeInTheDocument() // retail profit
    expect(within(preview).getByText('Rs. 20.00')).toBeInTheDocument() // trade profit
  })

  it('submits a new product with numeric fields', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: { product: { ...activeProduct, id: 'p2' } } })
    render(<Inventory />)
    await screen.findByText('Basmati Rice')

    await user.type(screen.getByLabelText('Name'), 'Chaat Masala')
    await user.type(screen.getByLabelText(/Retail price/), '80')
    await user.type(screen.getByLabelText(/Trade price/), '65')
    await user.type(screen.getByLabelText(/Cost/), '50')
    await user.type(screen.getByLabelText('Stock quantity'), '500')
    await user.click(screen.getByRole('button', { name: 'Add product' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/products', expect.objectContaining({
      name: 'Chaat Masala', pricePerUnit: 80, tradePricePerUnit: 65, costPerUnit: 50, stockQty: 500
    })))
  })

  it('populates the form on Edit and PUTs on save', async () => {
    const user = userEvent.setup()
    api.put.mockResolvedValue({ data: { product: activeProduct } })
    render(<Inventory />)
    await screen.findByText('Basmati Rice')

    await user.click(screen.getByText('Edit'))
    expect(screen.getByRole('heading', { name: 'Edit product' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Basmati Rice')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/products/p1', expect.objectContaining({ name: 'Basmati Rice' })))
  })

  it('deletes a product after confirmation', async () => {
    const user = userEvent.setup()
    api.delete.mockResolvedValue({ data: { softDeleted: false } })
    render(<Inventory />)
    await screen.findByText('Basmati Rice')
    await user.click(screen.getByText('Delete'))
    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/products/p1'))
  })

  it('does not delete when the confirmation is declined', async () => {
    const user = userEvent.setup()
    window.confirm = jest.fn(() => false)
    render(<Inventory />)
    await screen.findByText('Basmati Rice')
    await user.click(screen.getByText('Delete'))
    expect(api.delete).not.toHaveBeenCalled()
  })

  it('shows Restore instead of Edit/Delete for an inactive product', async () => {
    api.get.mockResolvedValue({ data: { products: [{ ...activeProduct, isActive: false }] } })
    render(<Inventory />)
    await screen.findByText(/Basmati Rice \(removed\)/)
    expect(screen.getByText('Restore')).toBeInTheDocument()
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  })

  it('reloads with includeInactive when the checkbox is toggled', async () => {
    const user = userEvent.setup()
    render(<Inventory />)
    await screen.findByText('Basmati Rice')
    await user.click(screen.getByLabelText('Show removed'))
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/products', { params: { includeInactive: true } }))
  })

  it('shows an error if loading products fails', async () => {
    api.get.mockRejectedValue({ response: { data: { error: 'Failed to load products' } } })
    render(<Inventory />)
    expect(await screen.findByText('Failed to load products')).toBeInTheDocument()
  })

  it('shows an error if saving a product fails', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValue({ response: { data: { error: 'Save failed' } } })
    render(<Inventory />)
    await screen.findByText('Basmati Rice')
    await user.type(screen.getByLabelText('Name'), 'X')
    await user.type(screen.getByLabelText(/Retail price/), '1')
    await user.type(screen.getByLabelText(/Trade price/), '1')
    await user.type(screen.getByLabelText(/Cost/), '1')
    await user.type(screen.getByLabelText('Stock quantity'), '1')
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    expect(await screen.findByText('Save failed')).toBeInTheDocument()
  })

  it('shows an error if deleting a product fails', async () => {
    const user = userEvent.setup()
    api.delete.mockRejectedValue({ response: { data: { error: 'Delete failed' } } })
    render(<Inventory />)
    await screen.findByText('Basmati Rice')
    await user.click(screen.getByText('Delete'))
    expect(await screen.findByText('Delete failed')).toBeInTheDocument()
  })

  it('cancels an in-progress edit, resetting the form', async () => {
    const user = userEvent.setup()
    render(<Inventory />)
    await screen.findByText('Basmati Rice')
    await user.click(screen.getByText('Edit'))
    expect(screen.getByRole('heading', { name: 'Edit product' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'Add product' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })

  it('reactivates an inactive product', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValue({ data: { products: [{ ...activeProduct, isActive: false }] } })
    api.put.mockResolvedValue({ data: { product: activeProduct } })
    render(<Inventory />)
    await screen.findByText(/Basmati Rice \(removed\)/)
    await user.click(screen.getByText('Restore'))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/products/p1', { isActive: true }))
  })

  it('exports the current product list as CSV', async () => {
    const user = userEvent.setup()
    render(<Inventory />)
    await screen.findByText('Basmati Rice')
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(downloadCsv).toHaveBeenCalledWith('inventory.csv', expect.any(Array), [activeProduct])
  })
})
