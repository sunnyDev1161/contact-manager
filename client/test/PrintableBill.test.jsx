import { render, screen } from '@testing-library/react'
import PrintableBill from '../src/components/PrintableBill'

const business = {
  name: 'Takbeer Traders',
  tagline: 'Trading • Supply',
  proprietors: 'Full Name | Full Name',
  address: 'Hassan Abdal',
  phone: '0300-1234567'
}

function makeSale(overrides = {}) {
  return {
    id: 'sale-uuid-abc12345',
    invoiceNo: 7,
    createdAt: '2026-01-15T10:30:00.000Z',
    saleType: 'RETAIL',
    totalAmount: 440,
    amountPaid: 440,
    customer: null,
    items: [
      { id: 'i1', productName: 'Basmati Rice', quantity: 2, unit: 'KG', tradeUnitPrice: 200, retailUnitPrice: 220, lineTotal: 440 }
    ],
    ...overrides
  }
}

describe('PrintableBill', () => {
  it('renders nothing when there is no sale or business', () => {
    const { container: a } = render(<PrintableBill sale={null} business={business} cashierName="Ali" />)
    expect(a.firstChild).toBeNull()
    const { container: b } = render(<PrintableBill sale={makeSale()} business={null} cashierName="Ali" />)
    expect(b.firstChild).toBeNull()
  })

  it('prints a sequential invoice number, not the raw sale id', () => {
    render(<PrintableBill sale={makeSale()} business={business} cashierName="Ali" />)
    expect(screen.getByText(/INV-00007/)).toBeInTheDocument()
  })

  it('shows the business name, tagline, and proprietors', () => {
    render(<PrintableBill sale={makeSale()} business={business} cashierName="Ali" />)
    // the business name appears in both the header and the footer
    expect(screen.getAllByText('Takbeer Traders').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Takbeer Traders' })).toBeInTheDocument()
    expect(screen.getByText('Trading • Supply')).toBeInTheDocument()
    expect(screen.getByText(/Full Name \| Full Name/)).toBeInTheDocument()
  })

  it('hides tagline/proprietors/contact rows when not set', () => {
    const bareBusiness = { name: 'Bare Shop' }
    render(<PrintableBill sale={makeSale()} business={bareBusiness} cashierName="Ali" />)
    expect(screen.queryByText(/PROP:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Address:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Mobile:/)).not.toBeInTheDocument()
  })

  it('shows "Walk-in" when no customer is attached', () => {
    render(<PrintableBill sale={makeSale({ customer: null })} business={business} cashierName="Ali" />)
    expect(screen.getByText('Walk-in')).toBeInTheDocument()
  })

  it('shows the customer shop name when attached', () => {
    render(<PrintableBill sale={makeSale({ customer: { shopName: 'Malik General Store' } })} business={business} cashierName="Ali" />)
    expect(screen.getByText('Malik General Store')).toBeInTheDocument()
  })

  it('labels the total by which price basis was charged', () => {
    const { rerender } = render(<PrintableBill sale={makeSale({ saleType: 'RETAIL' })} business={business} cashierName="Ali" />)
    expect(screen.getByText(/Total \(Retail Price\)/)).toBeInTheDocument()
    rerender(<PrintableBill sale={makeSale({ saleType: 'TRADE' })} business={business} cashierName="Ali" />)
    expect(screen.getByText(/Total \(Trade Price\)/)).toBeInTheDocument()
  })

  it('shows a credit breakdown only when the sale was not paid in full', () => {
    const { rerender } = render(<PrintableBill sale={makeSale({ totalAmount: 440, amountPaid: 440 })} business={business} cashierName="Ali" />)
    expect(screen.queryByText(/Credit added to account/)).not.toBeInTheDocument()

    rerender(<PrintableBill sale={makeSale({ totalAmount: 440, amountPaid: 100 })} business={business} cashierName="Ali" />)
    expect(screen.getByText(/Credit added to account: Rs\. 340\.00/)).toBeInTheDocument()
    expect(screen.getByText(/Paid now: Rs\. 100\.00/)).toBeInTheDocument()
  })

  it('prefers the historical sale.user name over the passed-in cashierName prop', () => {
    render(<PrintableBill sale={makeSale({ user: { name: 'Historical Cashier' } })} business={business} cashierName="Current Session User" />)
    expect(screen.getByText('Historical Cashier')).toBeInTheDocument()
    expect(screen.queryByText('Current Session User')).not.toBeInTheDocument()
  })

  it('falls back to the cashierName prop when sale.user is absent (a fresh POS checkout)', () => {
    render(<PrintableBill sale={makeSale()} business={business} cashierName="Live Session Cashier" />)
    expect(screen.getByText('Live Session Cashier')).toBeInTheDocument()
  })
})
