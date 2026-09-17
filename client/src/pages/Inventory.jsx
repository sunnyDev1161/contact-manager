import { useEffect, useState } from 'react'
import api from '../api'

const UNITS = ['PCS', 'KG', 'G', 'LITRE', 'ML']

const emptyForm = {
  name: '',
  category: '',
  sku: '',
  unit: 'PCS',
  pricePerUnit: '',
  costPerUnit: '',
  stockQty: '',
  lowStockThreshold: '0'
}

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showInactive, setShowInactive] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/products', { params: { includeInactive: showInactive } })
      setProducts(data.products)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [showInactive])

  function startEdit(p) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      category: p.category || '',
      sku: p.sku || '',
      unit: p.unit,
      pricePerUnit: p.pricePerUnit,
      costPerUnit: p.costPerUnit,
      stockQty: p.stockQty,
      lowStockThreshold: p.lowStockThreshold
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const payload = {
      name: form.name,
      category: form.category || null,
      sku: form.sku || null,
      unit: form.unit,
      pricePerUnit: Number(form.pricePerUnit),
      costPerUnit: Number(form.costPerUnit),
      stockQty: Number(form.stockQty),
      lowStockThreshold: Number(form.lowStockThreshold || 0)
    }
    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, payload)
      } else {
        await api.post('/products', payload)
      }
      cancelEdit()
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    }
  }

  async function onDelete(p) {
    if (!confirm(`Remove "${p.name}"?`)) return
    try {
      await api.delete(`/products/${p.id}`)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed')
    }
  }

  async function reactivate(p) {
    await api.put(`/products/${p.id}`, { isActive: true })
    load()
  }

  return (
    <div>
      <h1>Inventory</h1>
      {error && <div className="error-banner">{error}</div>}

      <form className="card form-grid" onSubmit={onSubmit}>
        <h2>{editingId ? 'Edit product' : 'Add product'}</h2>
        <label>
          Name
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          Category
          <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
        </label>
        <label>
          SKU
          <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
        </label>
        <label>
          Unit
          <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label>
          Selling price / unit
          <input type="number" step="0.01" min="0" value={form.pricePerUnit} onChange={e => setForm({ ...form, pricePerUnit: e.target.value })} required />
        </label>
        <label>
          Cost / unit
          <input type="number" step="0.01" min="0" value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: e.target.value })} required />
        </label>
        <label>
          Stock quantity
          <input type="number" step="0.001" min="0" value={form.stockQty} onChange={e => setForm({ ...form, stockQty: e.target.value })} required />
        </label>
        <label>
          Low stock alert below
          <input type="number" step="0.001" min="0" value={form.lowStockThreshold} onChange={e => setForm({ ...form, lowStockThreshold: e.target.value })} />
        </label>
        <div className="form-actions">
          <button type="submit">{editingId ? 'Save changes' : 'Add product'}</button>
          {editingId && <button type="button" className="secondary" onClick={cancelEdit}>Cancel</button>}
        </div>
      </form>

      <div className="list-header">
        <h2>Products</h2>
        <label className="inline-check">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Show removed
        </label>
      </div>

      {loading ? <p>Loading…</p> : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Category</th><th>Unit</th><th>Price</th><th>Cost</th><th>Stock</th><th></th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className={!p.isActive ? 'inactive-row' : Number(p.stockQty) <= Number(p.lowStockThreshold) ? 'low-stock-row' : ''}>
                <td>{p.name}{!p.isActive && ' (removed)'}</td>
                <td>{p.category || '—'}</td>
                <td>{p.unit}</td>
                <td>{p.pricePerUnit}</td>
                <td>{p.costPerUnit}</td>
                <td>{p.stockQty}</td>
                <td className="row-actions">
                  {p.isActive ? (
                    <>
                      <button className="link" onClick={() => startEdit(p)}>Edit</button>
                      <button className="link danger" onClick={() => onDelete(p)}>Delete</button>
                    </>
                  ) : (
                    <button className="link" onClick={() => reactivate(p)}>Restore</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
