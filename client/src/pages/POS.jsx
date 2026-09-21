import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import NumericKeypad from '../components/NumericKeypad'

function heldKey(businessId) {
  return `pos_held_bills_${businessId}`
}

function loadHeld(businessId) {
  try {
    const raw = localStorage.getItem(heldKey(businessId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHeld(businessId, held) {
  try {
    localStorage.setItem(heldKey(businessId), JSON.stringify(held))
  } catch {
    // ignore — held bills are a convenience, not critical data
  }
}

export default function POS() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [category, setCategory] = useState('All')
  const [codeInput, setCodeInput] = useState('')
  const [scanError, setScanError] = useState('')
  const [cart, setCart] = useState([]) // { productId, name, unit, price, qty }
  const [selectedId, setSelectedId] = useState(null)
  const [keypadValue, setKeypadValue] = useState('')
  const [heldBills, setHeldBills] = useState([])
  const [showHeld, setShowHeld] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [cashTendered, setCashTendered] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const codeInputRef = useRef(null)

  async function loadProducts() {
    const { data } = await api.get('/products')
    setProducts(data.products)
  }

  useEffect(() => { loadProducts() }, [])
  useEffect(() => {
    if (user?.businessId) setHeldBills(loadHeld(user.businessId))
  }, [user?.businessId])
  useEffect(() => { codeInputRef.current?.focus() }, [])

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [products])

  const filtered = useMemo(() => {
    const q = codeInput.trim().toLowerCase()
    return products.filter(p => {
      const inCategory = category === 'All' || p.category === category
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase() === q
      return inCategory && matchesQuery
    })
  }, [products, category, codeInput])

  function addToCart(p, qty = 1) {
    setScanError('')
    setMessage('')
    setCart(prev => {
      const existing = prev.find(l => l.productId === p.id)
      if (existing) {
        return prev.map(l => l.productId === p.id ? { ...l, qty: l.qty + qty } : l)
      }
      return [...prev, { productId: p.id, name: p.name, unit: p.unit, price: Number(p.pricePerUnit), qty }]
    })
  }

  function handleCodeKeyDown(e) {
    if (e.key !== 'Enter') return
    const q = codeInput.trim()
    if (!q) return

    const exactSku = products.find(p => p.sku && p.sku.toLowerCase() === q.toLowerCase())
    const exactName = products.find(p => p.name.toLowerCase() === q.toLowerCase())
    const target = exactSku || exactName || (filtered.length === 1 ? filtered[0] : null)

    if (target) {
      addToCart(target)
      setCodeInput('')
    } else {
      setScanError(`No item found for "${q}"`)
    }
  }

  function selectLine(productId) {
    const line = cart.find(l => l.productId === productId)
    if (!line) return
    setSelectedId(productId)
    setKeypadValue(String(line.qty))
  }

  function removeLine(productId) {
    setCart(prev => prev.filter(l => l.productId !== productId))
    if (selectedId === productId) { setSelectedId(null); setKeypadValue('') }
  }

  function commitQty() {
    const qty = parseFloat(keypadValue)
    if (!selectedId) return
    if (!qty || qty <= 0) {
      removeLine(selectedId)
      return
    }
    setCart(prev => prev.map(l => l.productId === selectedId ? { ...l, qty } : l))
    setSelectedId(null)
    setKeypadValue('')
  }

  function clearSale() {
    if (cart.length === 0) return
    if (!confirm('Clear this entire sale?')) return
    setCart([])
    setSelectedId(null)
    setKeypadValue('')
  }

  function holdSale() {
    if (cart.length === 0 || !user?.businessId) return
    const next = [{ id: crypto.randomUUID(), savedAt: Date.now(), cart }, ...heldBills]
    setHeldBills(next)
    saveHeld(user.businessId, next)
    setCart([])
    setSelectedId(null)
    setKeypadValue('')
    setMessage('Sale held.')
  }

  function recallHeld(id) {
    const bill = heldBills.find(h => h.id === id)
    if (!bill) return
    setCart(bill.cart)
    const next = heldBills.filter(h => h.id !== id)
    setHeldBills(next)
    saveHeld(user.businessId, next)
    setShowHeld(false)
  }

  function discardHeld(id) {
    const next = heldBills.filter(h => h.id !== id)
    setHeldBills(next)
    saveHeld(user.businessId, next)
  }

  const total = cart.reduce((sum, l) => sum + l.price * (Number(l.qty) || 0), 0)
  const tendered = parseFloat(cashTendered) || 0
  const change = tendered - total

  async function completeSale() {
    setError('')
    setCheckingOut(true)
    try {
      const items = cart.map(l => ({ productId: l.productId, quantity: Number(l.qty) }))
      const { data } = await api.post('/sales', { items })
      setMessage(`Sale complete: total ₹${Number(data.sale.totalAmount).toFixed(2)}, profit ₹${Number(data.sale.totalProfit).toFixed(2)}`)
      setCart([])
      setSelectedId(null)
      setShowPayment(false)
      setCashTendered('')
      loadProducts()
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed')
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <div className="terminal">
      <div className="terminal-main">
        <input
          ref={codeInputRef}
          className="scanner-input"
          placeholder="Scan barcode or type item name / code, then Enter"
          value={codeInput}
          onChange={e => { setCodeInput(e.target.value); setScanError('') }}
          onKeyDown={handleCodeKeyDown}
          autoFocus
        />
        {scanError && <div className="scan-error">{scanError}</div>}

        <div className="category-tabs">
          {categories.map(c => (
            <button
              key={c}
              className={c === category ? 'category-tab active' : 'category-tab'}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

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

      <div className="terminal-register">
        {message && <div className="success-banner">{message}</div>}

        <div className="receipt">
          <div className="receipt-header">
            <span>Item</span>
            <span>Qty</span>
            <span>Amount</span>
          </div>
          <div className="receipt-body">
            {cart.length === 0 && <div className="receipt-empty">No items yet — scan or tap a product.</div>}
            {cart.map(l => (
              <div
                key={l.productId}
                className={l.productId === selectedId ? 'receipt-row selected' : 'receipt-row'}
                onClick={() => selectLine(l.productId)}
              >
                <span className="receipt-name">{l.name}<small>₹{l.price}/{l.unit}</small></span>
                <span className="receipt-qty">{l.qty}</span>
                <span className="receipt-amount">₹{(l.price * l.qty).toFixed(2)}</span>
                <button className="receipt-remove" onClick={e => { e.stopPropagation(); removeLine(l.productId) }}>×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="qty-editor">
          <div className="qty-editor-label">
            {selectedId ? `Set quantity — ${cart.find(l => l.productId === selectedId)?.name || ''}` : 'Tap an item above to change its quantity'}
          </div>
          <div className="qty-editor-value">{keypadValue || '0'}</div>
          <NumericKeypad
            value={keypadValue}
            onChange={setKeypadValue}
            onConfirm={commitQty}
            confirmLabel="Set Qty"
            disabled={!selectedId}
          />
        </div>

        <div className="total-display">
          <span>TOTAL</span>
          <span>₹{total.toFixed(2)}</span>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="function-row">
          <button className="fn-btn fn-hold" onClick={holdSale} disabled={cart.length === 0}>Hold Sale</button>
          <button className="fn-btn fn-held" onClick={() => setShowHeld(true)} disabled={heldBills.length === 0}>
            Held ({heldBills.length})
          </button>
          <button className="fn-btn fn-clear" onClick={clearSale} disabled={cart.length === 0}>Clear Sale</button>
        </div>
        <button className="pay-btn" onClick={() => setShowPayment(true)} disabled={cart.length === 0}>
          Pay ₹{total.toFixed(2)}
        </button>
      </div>

      {showHeld && (
        <div className="overlay" onClick={() => setShowHeld(false)}>
          <div className="overlay-panel" onClick={e => e.stopPropagation()}>
            <h2>Held Sales</h2>
            {heldBills.length === 0 && <p>Nothing held.</p>}
            {heldBills.map(h => {
              const billTotal = h.cart.reduce((s, l) => s + l.price * l.qty, 0)
              return (
                <div key={h.id} className="held-row">
                  <div>
                    <div>{h.cart.length} item(s) — ₹{billTotal.toFixed(2)}</div>
                    <small>{new Date(h.savedAt).toLocaleTimeString()}</small>
                  </div>
                  <div className="held-actions">
                    <button onClick={() => recallHeld(h.id)}>Recall</button>
                    <button className="link danger" onClick={() => discardHeld(h.id)}>Discard</button>
                  </div>
                </div>
              )
            })}
            <button className="overlay-close" onClick={() => setShowHeld(false)}>Close</button>
          </div>
        </div>
      )}

      {showPayment && (
        <div className="overlay" onClick={() => !checkingOut && setShowPayment(false)}>
          <div className="overlay-panel payment-panel" onClick={e => e.stopPropagation()}>
            <h2>Payment</h2>
            <div className="payment-total">Due: ₹{total.toFixed(2)}</div>
            <div className="payment-row">
              <span>Cash tendered</span>
              <span className="payment-tendered">₹{cashTendered || '0'}</span>
            </div>
            <div className={`payment-row ${change < 0 ? 'negative' : ''}`}>
              <span>{change < 0 ? 'Still due' : 'Change'}</span>
              <span>₹{Math.abs(change).toFixed(2)}</span>
            </div>
            <NumericKeypad value={cashTendered} onChange={setCashTendered} />
            <div className="payment-actions">
              <button className="secondary" onClick={() => setShowPayment(false)} disabled={checkingOut}>Cancel</button>
              <button className="pay-btn" onClick={completeSale} disabled={checkingOut || tendered < total}>
                {checkingOut ? 'Processing…' : 'Confirm Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
