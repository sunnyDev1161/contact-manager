import { useEffect, useState } from 'react'
import api from '../api'

function toDateInput(d) {
  return d.toISOString().slice(0, 10)
}

export default function SalesHistory() {
  const today = new Date()
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [from, setFrom] = useState(toDateInput(monthAgo))
  const [to, setTo] = useState(toDateInput(today))
  const [sales, setSales] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const params = { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }
      const [salesRes, summaryRes] = await Promise.all([
        api.get('/sales', { params }),
        api.get('/sales/summary', { params })
      ])
      setSales(salesRes.data.sales)
      setSummary(summaryRes.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load sales')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h1>Sales & Profit</h1>
      {error && <div className="error-banner">{error}</div>}

      <div className="filter-bar">
        <label>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <button onClick={load}>Apply</button>
      </div>

      {summary && (
        <div className="stat-row">
          <div className="stat-card"><div className="stat-label">Sales</div><div className="stat-value">{summary.salesCount}</div></div>
          <div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value">₹{Number(summary.totalRevenue).toFixed(2)}</div></div>
          <div className="stat-card"><div className="stat-label">Cost</div><div className="stat-value">₹{Number(summary.totalCost).toFixed(2)}</div></div>
          <div className="stat-card highlight"><div className="stat-label">Profit</div><div className="stat-value">₹{Number(summary.totalProfit).toFixed(2)}</div></div>
        </div>
      )}

      {loading ? <p>Loading…</p> : (
        <table className="data-table">
          <thead><tr><th>Date</th><th>Cashier</th><th>Items</th><th>Total</th><th>Profit</th></tr></thead>
          <tbody>
            {sales.map(s => (
              <tr key={s.id}>
                <td>{new Date(s.createdAt).toLocaleString()}</td>
                <td>{s.user?.name}</td>
                <td>{s.items.map(i => `${i.productName} ×${i.quantity}`).join(', ')}</td>
                <td>₹{Number(s.totalAmount).toFixed(2)}</td>
                <td>₹{Number(s.totalProfit).toFixed(2)}</td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={5}>No sales in this range.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  )
}
