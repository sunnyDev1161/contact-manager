import { money } from '../format'

function initials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(w => w[0].toUpperCase())
    .join('')
}

function formatDateTime(d) {
  const dt = new Date(d)
  const date = dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  const time = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${date}, ${time}`
}

// Rendered off-screen at all times; @media print CSS (index.css) hides
// everything else on the page and shows only this when the cashier prints.
// Laid out as a full A4 sheet, styled after the business's own letterhead.
export default function PrintableBill({ sale, business, cashierName }) {
  if (!sale || !business) return null

  const billNo = sale.id.slice(-8).toUpperCase()

  return (
    <div className="receipt-print">
      <div className="bill-letterhead">
        <div className="bill-badge">
          <svg viewBox="0 0 100 100" className="bill-badge-icon">
            <path d="M62 20a30 30 0 1 0 0 60 24 24 0 1 1 0-60z" fill="#b8935a" />
            <path d="M70 24 l3.5 8 8.5 1 -6.5 6 1.8 8.5 -7.3-4.4-7.3 4.4 1.8-8.5-6.5-6 8.5-1z" fill="#b8935a" />
          </svg>
          <div className="bill-badge-initials">{initials(business.name)}</div>
        </div>
        <div className="bill-letterhead-text">
          <h1>{business.name}</h1>
          {business.tagline && <div className="bill-subtitle">{business.tagline}</div>}
          {business.proprietors && (
            <div className="bill-prop"><strong>PROP:</strong> {business.proprietors}</div>
          )}
        </div>
      </div>

      <div className="bill-rule-thick" />
      <div className="bill-rule-thin" />

      <div className="bill-doctitle">Sales Bill</div>

      {(business.address || business.phone) && (
        <div className="bill-contact-row">
          {business.address && <span><strong>Address:</strong> {business.address}</span>}
          {business.phone && <span><strong>Mobile:</strong> {business.phone}</span>}
        </div>
      )}

      <div className="bill-meta-row">
        <div>
          <div><strong>REF:</strong> {billNo}</div>
          <div><strong>Cashier:</strong> {cashierName}</div>
          <div><strong>Sold To:</strong> {sale.customer ? sale.customer.shopName : 'Walk-in'}</div>
        </div>
        <div className="bill-meta-right">
          <div><strong>DATE:</strong> {formatDateTime(sale.createdAt)}</div>
          <div><strong>Sale Type:</strong> {sale.saleType === 'TRADE' ? 'Trade' : 'Retail'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Trade Price</th>
            <th>Retail Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, i) => (
            <tr key={item.id}>
              <td>{i + 1}</td>
              <td>{item.productName}</td>
              <td>{item.quantity} {item.unit}</td>
              <td>{money(item.tradeUnitPrice)}</td>
              <td>{money(item.retailUnitPrice)}</td>
              <td>{money(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bill-total-row">
        Total ({sale.saleType === 'TRADE' ? 'Trade Price' : 'Retail Price'}): {money(sale.totalAmount)}
      </div>
      {sale.totalAmount - sale.amountPaid > 0.001 && (
        <div className="bill-credit-row">
          <div>Paid now: {money(sale.amountPaid)}</div>
          <div>Credit added to account: {money(sale.totalAmount - sale.amountPaid)}</div>
        </div>
      )}

      <div className="bill-rule-thin bill-footer-rule" />
      <div className="bill-footer">
        <strong>{business.name}</strong>
        {business.address && <> &nbsp;•&nbsp; {business.address}</>}
        {business.phone && <> &nbsp;•&nbsp; {business.phone}</>}
      </div>
      <div className="bill-thanks">Thank you for your business.</div>
    </div>
  )
}
