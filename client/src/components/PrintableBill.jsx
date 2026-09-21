import { money } from '../format'

// Rendered off-screen at all times; @media print CSS (index.css) hides
// everything else on the page and shows only this when the cashier prints.
// Laid out as a full A4 sheet (not a narrow thermal-receipt roll).
export default function PrintableBill({ sale, businessName, cashierName }) {
  if (!sale) return null

  const billNo = sale.id.slice(-8).toUpperCase()

  return (
    <div className="receipt-print">
      <div className="bill-letterhead">
        <h1>{businessName}</h1>
        <div className="bill-subtitle">Sales Bill</div>
      </div>

      <div className="bill-meta-row">
        <div>
          <div><strong>Date:</strong> {new Date(sale.createdAt).toLocaleString()}</div>
          <div><strong>Cashier:</strong> {cashierName}</div>
        </div>
        <div className="bill-meta-right">
          <div><strong>Bill No:</strong> {billNo}</div>
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

      <div className="bill-footer">Thank you for your business.</div>
    </div>
  )
}
