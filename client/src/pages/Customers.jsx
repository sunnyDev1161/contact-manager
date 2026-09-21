import { useEffect, useState } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { money } from '../format'

const emptyForm = { shopName: '', shopkeeperName: '', phone: '', address: '' }

export default function Customers() {
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showInactive, setShowInactive] = useState(false)

  const [ledgerCustomer, setLedgerCustomer] = useState(null)
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [ledgerError, setLedgerError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/customers', { params: { includeInactive: showInactive } })
      setCustomers(data.customers)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [showInactive])

  function startEdit(c) {
    setEditingId(c.id)
    setForm({
      shopName: c.shopName,
      shopkeeperName: c.shopkeeperName || '',
      phone: c.phone || '',
      address: c.address || ''
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form)
      } else {
        await api.post('/customers', form)
      }
      cancelEdit()
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    }
  }

  async function onDelete(c) {
    if (!confirm(`Remove "${c.shopName}"?`)) return
    try {
      await api.delete(`/customers/${c.id}`)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed')
    }
  }

  async function reactivate(c) {
    await api.put(`/customers/${c.id}`, { isActive: true })
    load()
  }

  async function openLedger(c) {
    setLedgerError('')
    setPaymentAmount('')
    setPaymentNote('')
    const { data } = await api.get(`/customers/${c.id}`)
    setLedgerCustomer(data.customer)
    setLedgerEntries(data.ledgerEntries)
  }

  async function recordPayment() {
    setLedgerError('')
    const amount = Number(paymentAmount)
    if (!amount || amount <= 0) {
      setLedgerError('Enter a valid payment amount.')
      return
    }
    try {
      await api.post(`/customers/${ledgerCustomer.id}/payments`, { amount, note: paymentNote || null })
      await openLedger(ledgerCustomer)
      load()
    } catch (err) {
      setLedgerError(err.response?.data?.error || 'Failed to record payment')
    }
  }

  return (
    <div>
      <h1>Customers</h1>
      <p>Shopkeepers and other buyers you sell to on credit. Track who owes what.</p>
      {error && <div className="error-banner">{error}</div>}

      {isOwner && (
        <form className="card form-grid" onSubmit={onSubmit}>
          <h2>{editingId ? 'Edit customer' : 'Add customer'}</h2>
          <label>
            Shop name
            <input value={form.shopName} onChange={e => setForm({ ...form, shopName: e.target.value })} required />
          </label>
          <label>
            Shopkeeper name
            <input value={form.shopkeeperName} onChange={e => setForm({ ...form, shopkeeperName: e.target.value })} />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            Address / location
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </label>
          <div className="form-actions">
            <button type="submit">{editingId ? 'Save changes' : 'Add customer'}</button>
            {editingId && <button type="button" className="secondary" onClick={cancelEdit}>Cancel</button>}
          </div>
        </form>
      )}

      <div className="list-header">
        <h2>All customers</h2>
        <label className="inline-check">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show removed
        </label>
      </div>

      {loading ? <p>Loading…</p> : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Shop</th><th>Shopkeeper</th><th>Phone</th><th>Address</th><th>Balance</th><th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} className={!c.isActive ? 'inactive-row' : ''}>
                <td>{c.shopName}{!c.isActive && ' (removed)'}</td>
                <td>{c.shopkeeperName || '—'}</td>
                <td>{c.phone || '—'}</td>
                <td>{c.address || '—'}</td>
                <td className={c.balance > 0 ? 'balance-owed' : 'balance-clear'}>{money(c.balance)}</td>
                <td className="row-actions">
                  {c.isActive ? (
                    <>
                      <button className="link" onClick={() => openLedger(c)}>Ledger</button>
                      {isOwner && <button className="link" onClick={() => startEdit(c)}>Edit</button>}
                      {isOwner && <button className="link danger" onClick={() => onDelete(c)}>Delete</button>}
                    </>
                  ) : (
                    isOwner && <button className="link" onClick={() => reactivate(c)}>Restore</button>
                  )}
                </td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={6}>No customers yet.</td></tr>}
          </tbody>
        </table>
      )}

      {ledgerCustomer && (
        <div className="overlay" onClick={() => setLedgerCustomer(null)}>
          <div className="overlay-panel ledger-panel" onClick={e => e.stopPropagation()}>
            <h2>{ledgerCustomer.shopName}</h2>
            <div className="ledger-balance">
              Balance owed: <strong>{money(ledgerCustomer.balance)}</strong>
            </div>
            {ledgerError && <div className="error-banner">{ledgerError}</div>}

            <div className="ledger-payment-form">
              <input
                type="number" step="0.01" min="0" placeholder="Payment amount"
                value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
              />
              <input
                type="text" placeholder="Note (optional)"
                value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
              />
              <button onClick={recordPayment}>Record Payment</button>
            </div>

            <div className="ledger-list">
              {ledgerEntries.length === 0 && <p>No transactions yet.</p>}
              {ledgerEntries.map(e => (
                <div key={e.id} className="ledger-row">
                  <div>
                    <span className={e.type === 'SALE' ? 'ledger-tag credit' : 'ledger-tag payment'}>
                      {e.type === 'SALE' ? 'Credit (sale)' : 'Payment'}
                    </span>
                    {e.note && <span className="ledger-note"> — {e.note}</span>}
                    <div className="ledger-meta">{new Date(e.createdAt).toLocaleString()} • {e.recordedBy?.name}</div>
                  </div>
                  <div className={e.type === 'SALE' ? 'ledger-amount credit' : 'ledger-amount payment'}>
                    {e.type === 'SALE' ? '+' : '−'}{money(e.amount)}
                  </div>
                </div>
              ))}
            </div>

            <button className="overlay-close" onClick={() => setLedgerCustomer(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
