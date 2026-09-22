import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import POS from '../src/pages/POS'

const mockUseAuth = jest.fn()
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))

jest.mock('../src/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }))
import api from '../src/api'

const rice = { id: 'p1', name: 'Basmati Rice', category: 'Grains', unit: 'KG', sku: 'RICE1', pricePerUnit: 220, tradePricePerUnit: 200, stockQty: 100 }
const masala = { id: 'p2', name: 'Chaat Masala', category: 'Spices', unit: 'G', sku: 'CM1', pricePerUnit: 0.8, tradePricePerUnit: 0.65, stockQty: 5000 }
const malik = { id: 'c1', shopName: 'Malik General Store', shopkeeperName: 'Malik Zafar', phone: '0300', balance: 100 }

function mockApi({ products = [rice, masala], customers = [malik], business = { name: 'Takbeer Traders' } } = {}) {
  api.get.mockImplementation((url) => {
    if (url === '/products') return Promise.resolve({ data: { products } })
    if (url === '/customers') return Promise.resolve({ data: { customers } })
    if (url === '/business') return Promise.resolve({ data: { business } })
    return Promise.resolve({ data: {} })
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  window.confirm = jest.fn(() => true)
  mockUseAuth.mockReturnValue({ user: { businessId: 'biz1', name: 'Cashier Ali' } })
  mockApi()
})

async function renderPOS() {
  const utils = render(<POS />)
  await screen.findByText('Basmati Rice')
  return utils
}

describe('POS — product grid and cart', () => {
  it('adds a product to the cart on tap and shows retail price by default', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.click(screen.getByText('Basmati Rice'))
    expect(screen.getByText('Rs. 220.00/KG')).toBeInTheDocument()
    expect(screen.getByText('TOTAL').closest('.total-display')).toHaveTextContent('Rs. 220.00')
  })

  it('switches the whole cart to trade pricing when Trade Sale is selected', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.click(screen.getByText('Basmati Rice'))
    await user.click(screen.getByText('Trade Sale'))
    expect(screen.getByText('Rs. 200.00/KG')).toBeInTheDocument()
  })

  it('filters the product grid by category', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.click(screen.getByText('Spices'))
    expect(screen.queryByText('Basmati Rice')).not.toBeInTheDocument()
    expect(screen.getByText('Chaat Masala')).toBeInTheDocument()
  })

  it('adds an item via exact SKU match on Enter', async () => {
    const user = userEvent.setup()
    await renderPOS()
    const input = screen.getByPlaceholderText(/Scan barcode/)
    await user.type(input, 'RICE1{Enter}')
    expect(screen.getByText('Rs. 220.00/KG')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('shows a scan error when nothing matches', async () => {
    const user = userEvent.setup()
    await renderPOS()
    const input = screen.getByPlaceholderText(/Scan barcode/)
    await user.type(input, 'NOPE{Enter}')
    expect(screen.getByText('No item found for "NOPE"')).toBeInTheDocument()
  })

  it('changes a line quantity via the keypad', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.click(screen.getByText('Basmati Rice'))
    await user.click(document.querySelector('.receipt-row'))
    await user.click(screen.getByText('⌫')) // clear the seeded "1"
    await user.click(screen.getByText('5'))
    await user.click(screen.getByText('Set Qty'))
    expect(document.querySelector('.total-display')).toHaveTextContent('Rs. 1100.00') // 220 * 5
  })

  it('setting quantity to 0 removes the line', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.click(screen.getByText('Basmati Rice'))
    await user.click(document.querySelector('.receipt-row'))
    await user.click(screen.getByText('⌫'))
    await user.click(screen.getByText('Set Qty'))
    expect(screen.getByText('No items yet — scan or tap a product.')).toBeInTheDocument()
  })

  it('removes a line via its × button', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.click(screen.getByText('Basmati Rice'))
    await user.click(screen.getByText('×'))
    expect(screen.getByText('No items yet — scan or tap a product.')).toBeInTheDocument()
  })

  it('clears the whole sale after confirmation', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.click(screen.getByText('Basmati Rice'))
    await user.click(screen.getByText('Clear Sale'))
    expect(window.confirm).toHaveBeenCalled()
    expect(screen.getByText('No items yet — scan or tap a product.')).toBeInTheDocument()
  })
})

describe('POS — customer selection', () => {
  it('auto-switches to Trade Sale when a customer is picked', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.type(screen.getByPlaceholderText(/Customer \(shop name\)/), 'Malik')
    await user.click(screen.getByText('Malik General Store'))
    expect(screen.getByText('Trade Sale')).toHaveClass('active')
  })

  it('reverts to walk-in via Change', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.type(screen.getByPlaceholderText(/Customer \(shop name\)/), 'Malik')
    await user.click(screen.getByText('Malik General Store'))
    await user.click(screen.getByText('Change'))
    expect(screen.getByPlaceholderText(/Customer \(shop name\)/)).toBeInTheDocument()
  })
})

describe('POS — hold / recall', () => {
  it('holds the current sale, clearing the cart, and recalls it later', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.click(screen.getByText('Basmati Rice'))
    await user.click(screen.getByText('Hold Sale'))
    expect(screen.getByText('No items yet — scan or tap a product.')).toBeInTheDocument()
    expect(screen.getByText('Held (1)')).toBeInTheDocument()

    await user.click(screen.getByText('Held (1)'))
    await user.click(screen.getByText('Recall'))
    expect(screen.getByText('Rs. 220.00/KG')).toBeInTheDocument()
  })

  it('discards a held bill without recalling it', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.click(screen.getByText('Basmati Rice'))
    await user.click(screen.getByText('Hold Sale'))
    await user.click(screen.getByText('Held (1)'))
    await user.click(screen.getByText('Discard'))
    expect(screen.queryByText('Rs. 220.00/KG')).not.toBeInTheDocument()
  })
})

describe('POS — payment and checkout', () => {
  it('requires full payment for a walk-in sale before Confirm Sale is enabled', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.click(screen.getByText('Basmati Rice'))
    await user.click(screen.getByText('Pay Rs. 220.00'))
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Sale' })
    expect(confirmBtn).toBeDisabled()

    for (const d of ['2', '2', '0']) await user.click(screen.getByText(d, { selector: '.overlay-panel .keypad-key' }))
    expect(confirmBtn).not.toBeDisabled()
  })

  it('allows a customer sale to be confirmed with 0 tendered (fully on credit)', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.type(screen.getByPlaceholderText(/Customer \(shop name\)/), 'Malik')
    await user.click(screen.getByText('Malik General Store'))
    await user.click(screen.getByText('Basmati Rice'))
    await user.click(screen.getByText(/Pay Rs\./))
    expect(screen.getByRole('button', { name: 'Confirm Sale' })).not.toBeDisabled()
    expect(screen.getByText(/Credit \(added to Malik General Store's account\)/)).toBeInTheDocument()
  })

  it('completes a sale and shows the credit note when partially paid', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({
      data: { sale: { id: 's1', invoiceNo: 1, totalAmount: 200, totalProfit: 20, amountPaid: 50, items: [] } }
    })
    await renderPOS()
    await user.type(screen.getByPlaceholderText(/Customer \(shop name\)/), 'Malik')
    await user.click(screen.getByText('Malik General Store'))
    await user.click(screen.getByText('Basmati Rice'))
    await user.click(screen.getByText(/Pay Rs\./))
    for (const d of ['5', '0']) await user.click(screen.getByText(d, { selector: '.overlay-panel .keypad-key' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Sale' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/sales', {
      saleType: 'TRADE', items: [{ productId: 'p1', quantity: 1 }], customerId: 'c1', amountTendered: 50
    }))
    expect(await screen.findByText(/added to Malik General Store's account/)).toBeInTheDocument()
  })

  it('shows a checkout error from the server without clearing the cart', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValue({ response: { data: { error: 'Not enough stock for "Basmati Rice".' } } })
    await renderPOS()
    await user.click(screen.getByText('Basmati Rice'))
    await user.click(screen.getByText('Pay Rs. 220.00'))
    for (const d of ['2', '2', '0']) await user.click(screen.getByText(d, { selector: '.overlay-panel .keypad-key' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Sale' }))
    expect(await screen.findByText('Not enough stock for "Basmati Rice".')).toBeInTheDocument()
    expect(screen.getByText('Rs. 220.00/KG')).toBeInTheDocument()
  })
})

describe('POS — draft cart autosave', () => {
  it('persists the in-progress cart to localStorage and restores it on remount', async () => {
    const user = userEvent.setup()
    const { unmount } = await renderPOS()
    await user.click(screen.getByText('Basmati Rice'))
    await waitFor(() => expect(localStorage.getItem('pos_draft_biz1')).toBeTruthy())
    unmount()

    mockApi()
    await renderPOS()
    expect(screen.getByText('Rs. 220.00/KG')).toBeInTheDocument()
  })

  it('clears the draft once the cart is emptied', async () => {
    const user = userEvent.setup()
    await renderPOS()
    await user.click(screen.getByText('Basmati Rice'))
    await waitFor(() => expect(localStorage.getItem('pos_draft_biz1')).toBeTruthy())
    await user.click(screen.getByText('Clear Sale'))
    await waitFor(() => expect(localStorage.getItem('pos_draft_biz1')).toBeNull())
  })
})
