import { useEffect, useMemo, useState } from 'react'
import api from '../api'

export default function POS() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([]) // { productId, name, unit, price, qty }
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)

  async function loadProducts() {
    const { data } = await api.get('/products')
    setProducts(data.products)
  }

  useEffect(() => { loadProducts() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
  }, [products, search])

  function addToCart(p) {
    setMessage('')
    setCart(prev => {
      const existing = prev.find(l => l.productId === p.id)
      if (existing) {
        return prev.map(l => l.productId === p.id ? { ...l, qty: l.qty + 1 } : l)
      }
      return [...prev, { productId: p.id, name: p.name, unit: p.unit, price: Number(p.pricePerUnit), qty: 1 }]
    })
  }

  function updateQty(productId, qty) {
    setCart(prev => prev.map(l => l.productId === productId ? { ...l, qty } : l))
  }

  function removeLine(productId) {
    setCart(prev => prev.filter(l => l.productId !== productId))
  }

  const total = cart.reduce((sum, l) => sum + l.price * (Number(l.qty) || 0), 0)

  async function checkout() {
    setError('')
    setMessage('')
    if (cart.length === 0) return
    setCheckingOut(true)
    try {
      const items = cart.map(l => ({ productId: l.productId, quantity: Number(l.qty) }))
      const { data } = await api.post('/sales', { items })
      setMessage(`Sale recorded: total ₹${Number(data.sale.totalAmount).toFixed(2)}, profit ₹${Number(data.sale.totalProfit).toFixed(2)}`)
      setCart([])
      loadProducts()
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed')
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <div className="pos-layout">
      <div className="pos-catalog">
        <input
          className="search-box"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="product-grid">
          {filtered.map(p => (
            <button key={p.id} className="product-tile" onClick={() => addToCart(p)}>
              <div className="product-name">{p.name}</div>
              <div className="product-meta">₹{p.pricePerUnit} / {p.unit}</div>
              <div className="product-stock">Stock: {p.stockQty}</div>
            </button>
          ))}
          {filtered.length === 0 && <p>No products found.</p>}
        </div>
      </div>

      <div className="pos-cart">
        <h2>Cart</h2>
        {error && <div className="error-banner">{error}</div>}
        {message && <div className="success-banner">{message}</div>}
        {cart.length === 0 ? <p>Cart is empty.</p> : (
          <table className="data-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Line total</th><th></th></tr></thead>
            <tbody>
              {cart.map(l => (
                <tr key={l.productId}>
                  <td>{l.name}<br /><small>₹{l.price}/{l.unit}</small></td>
                  <td>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={l.qty}
                      onChange={e => updateQty(l.productId, e.target.value)}
                      className="qty-input"
                    />
                  </td>
                  <td>₹{(l.price * (Number(l.qty) || 0)).toFixed(2)}</td>
                  <td><button className="link danger" onClick={() => removeLine(l.productId)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="cart-total">Total: ₹{total.toFixed(2)}</div>
        <button className="checkout-btn" disabled={cart.length === 0 || checkingOut} onClick={checkout}>
          {checkingOut ? 'Processing…' : 'Complete sale'}
        </button>
      </div>
    </div>
  )
}
