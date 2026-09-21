import { money } from '../format'

// Rendered off-screen at all times; @media print CSS (index.css) hides
// everything else on the page and shows only this when the cashier prints,
// so the receipt-style bill is what actually comes out of the printer.
export default function PrintableBill({ sale, businessName, cashierName }) {
  if (!sale) return null

  return (
    <div className="receipt-print">
      <h2>{businessName}</h2>
      <div className="receipt-print-meta">
        <div>{new Date(sale.createdAt).toLocaleString()}</div>
        <div>Cashier: {cashierName}</div>
        <div>Sale type: {sale.saleType === 'TRADE' ? 'Trade' : 'Retail'}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Trade Price</th>
            <th>Retail Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map(item => (
            <tr key={item.id}>
              <td>{item.productName}</td>
              <td>{item.quantity} {item.unit}</td>
              <td>{money(item.tradeUnitPrice)}</td>
              <td>{money(item.retailUnitPrice)}</td>
              <td>{money(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-print-total">
        Total ({sale.saleType === 'TRADE' ? 'Trade Price' : 'Retail Price'}): {money(sale.totalAmount)}
      </div>
    </div>
  )
}
