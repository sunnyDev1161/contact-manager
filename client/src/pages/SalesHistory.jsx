import { useEffect, useState } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import PrintableBill from '../components/PrintableBill'
import { money, downloadCsv } from '../format'

function toDateInput(d) {
  return d.toISOString().slice(0, 10)
}

function lastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0)
}

export default function SalesHistory() {
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'
  const today = new Date()
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [from, setFrom] = useState(toDateInput(monthAgo))
  const [to, setTo] = useState(toDateInput(today))
  const [sales, setSales] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [business, setBusiness] = useState(null)
  const [printSale, setPrintSale] = useState(null)
  const [voidingSale, setVoidingSale] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  async function load(range) {
    const f = range?.from ?? from
    const t = range?.to ?? to
    setLoading(true)
    setError('')
    try {
      const params = { from: `${f}T00:00:00.000Z`, to: `${t}T23:59:59.999Z`, limit: 200 }
      const [salesRes, summaryRes] = await Promise.all([
        api.get('/sales', { params }),
        api.get('/sales/summary', { params })
      ])
      setSales(salesRes.data.sales)
      setTotalCount(salesRes.data.totalCount)
      setSummary(summaryRes.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load sales')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api.get('/business').then(({ data }) => setBusiness(data.business)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!printSale) return
    // Let the hidden .receipt-print element render with the new sale before
    // the browser's print dialog captures the page.
    const t = setTimeout(() => window.print(), 50)
    return () => clearTimeout(t)
  }, [printSale])

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

  // A modal, not window.prompt(): Electron's Chromium build doesn't
  // implement prompt() at all (it throws "prompt() is and will not be
  // supported"), unlike alert()/confirm() which do work there — this is a
  // real desktop app, not a regular browser tab.
  function startVoid(sale) {
    setVoidingSale(sale)
    setVoidReason('')
  }

  async function confirmVoid() {
    if (!voidReason.trim()) return
    setVoiding(true)
    setError('')
    try {
      await api.post(`/sales/${voidingSale.id}/void`, { reason: voidReason.trim() })
      setVoidingSale(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to void sale')
    } finally {
      setVoiding(false)
    }
  }

  function exportCsv() {
    downloadCsv(`sales_${from}_to_${to}.csv`, [
      ['Invoice #', s => `INV-${String(s.invoiceNo).padStart(5, '0')}`],
      ['Date', s => new Date(s.createdAt).toLocaleString()],
      ['Customer', s => s.customer ? s.customer.shopName : 'Walk-in'],
      ['Cashier', s => s.user?.name || ''],
      ['Items', s => s.items.map(i => `${i.productName} x${i.quantity}`).join('; ')],
      ['Total', s => s.totalAmount],
      ['Paid', s => s.amountPaid],
      ['Credit', s => Math.max(0, s.totalAmount - s.amountPaid)],
      ['Profit', s => s.totalProfit],
      ['Voided', s => s.voidedAt ? 'Yes' : 'No']
    ], sales)
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
        <button className="secondary" onClick={exportCsv} disabled={sales.length === 0}>Export CSV</button>
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
        <>
          {totalCount > sales.length && (
            <p className="truncation-note">Showing the most recent {sales.length} of {totalCount} sales in this range. Narrow the date range to see the rest.</p>
          )}
          <table className="data-table">
            <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Cashier</th><th>Items</th><th>Total</th><th>Paid</th><th>Profit</th><th></th></tr></thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id} className={s.voidedAt ? 'voided-row' : ''}>
                  <td>INV-{String(s.invoiceNo).padStart(5, '0')}{s.voidedAt && <span className="void-badge"> VOIDED</span>}</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>{s.customer ? s.customer.shopName : 'Walk-in'}</td>
                  <td>{s.user?.name}</td>
                  <td>{s.items.map(i => `${i.productName} ×${i.quantity}`).join(', ')}</td>
                  <td>{money(s.totalAmount)}</td>
                  <td className={s.totalAmount - s.amountPaid > 0.001 ? 'balance-owed' : ''}>
                    {money(s.amountPaid)}{s.totalAmount - s.amountPaid > 0.001 && ` (${money(s.totalAmount - s.amountPaid)} credit)`}
                  </td>
                  <td>{money(s.totalProfit)}</td>
                  <td className="row-actions">
                    <button className="link" onClick={() => setPrintSale(s)}>Print</button>
                    {isOwner && !s.voidedAt && <button className="link danger" onClick={() => startVoid(s)}>Void</button>}
                  </td>
                </tr>
              ))}
              {sales.length === 0 && <tr><td colSpan={9}>No sales in this range.</td></tr>}
            </tbody>
          </table>
        </>
      )}

      {voidingSale && (
        <div className="overlay" onClick={() => !voiding && setVoidingSale(null)}>
          <div className="overlay-panel" onClick={e => e.stopPropagation()}>
            <h2>Void sale INV-{String(voidingSale.invoiceNo).padStart(5, '0')}?</h2>
            <p>This restocks the items and reverses any credit put on the customer's account. It can't be undone.</p>
            <label>
              Reason
              <input
                autoFocus
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="e.g. Cashier scanned the wrong item"
              />
            </label>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setVoidingSale(null)} disabled={voiding}>Cancel</button>
              <button type="button" onClick={confirmVoid} disabled={voiding || !voidReason.trim()}>
                {voiding ? 'Voiding…' : 'Void Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PrintableBill sale={printSale} business={business} cashierName={printSale?.user?.name} />
    </div>
  )
}
