import { useEffect, useState } from 'react'
import api from '../api'
import { money } from '../format'

function toDateInput(d) {
  return d.toISOString().slice(0, 10)
}

function lastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0)
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

  async function load(range) {
    const f = range?.from ?? from
    const t = range?.to ?? to
    setLoading(true)
    setError('')
    try {
      const params = { from: `${f}T00:00:00.000Z`, to: `${t}T23:59:59.999Z` }
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

  function applyPreset(preset) {
    const now = new Date()
    let start, end
    if (preset === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = now
    } else if (preset === 'lastMonth') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end = lastDayOfMonth(now.getFullYear(), now.getMonth() - 1)
    } else {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      end = now
    }
    const fromStr = toDateInput(start)
    const toStr = toDateInput(end)
    setFrom(fromStr)
    setTo(toStr)
    load({ from: fromStr, to: toStr })
  }

  return (
    <div>
      <h1>Sales & Profit</h1>
      {error && <div className="error-banner">{error}</div>}

      <div className="preset-row">
        <button className="preset-btn" onClick={() => applyPreset('thisMonth')}>This Month</button>
        <button className="preset-btn" onClick={() => applyPreset('lastMonth')}>Last Month</button>
        <button className="preset-btn" onClick={() => applyPreset('last30')}>Last 30 Days</button>
      </div>

      <div className="filter-bar">
        <label>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        <button onClick={() => load()}>Apply</button>
      </div>

      {summary && (
        <div className="stat-row">
          <div className="stat-card"><div className="stat-label">Sales</div><div className="stat-value">{summary.salesCount}</div></div>
          <div className="stat-card"><div className="stat-label">Revenue</div><div className="stat-value">{money(summary.totalRevenue)}</div></div>
          <div className="stat-card"><div className="stat-label">Cost</div><div className="stat-value">{money(summary.totalCost)}</div></div>
          <div className="stat-card highlight"><div className="stat-label">Profit</div><div className="stat-value">{money(summary.totalProfit)}</div></div>
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
                <td>{money(s.totalAmount)}</td>
                <td>{money(s.totalProfit)}</td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={5}>No sales in this range.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  )
}
