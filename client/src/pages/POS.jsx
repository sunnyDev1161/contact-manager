import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import NumericKeypad from '../components/NumericKeypad'
import PrintableBill from '../components/PrintableBill'
import { money } from '../format'

function heldKey(businessId) {
  return `pos_held_bills_${businessId}`
}

function draftKey(businessId) {
  return `pos_draft_${businessId}`
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
  const [cart, setCart] = useState([]) // { productId, name, unit, retailPrice, tradePrice, qty }
  const [saleType, setSaleType] = useState('RETAIL') // 'RETAIL' | 'TRADE' — which price basis this whole sale charges
  const [selectedId, setSelectedId] = useState(null)
  const [keypadValue, setKeypadValue] = useState('')
  const [heldBills, setHeldBills] = useState([])
  const [showHeld, setShowHeld] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [cashTendered, setCashTendered] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [lastSale, setLastSale] = useState(null)
  const [business, setBusiness] = useState(null)
  const [customers, setCustomers] = useState([])
  const [customer, setCustomer] = useState(null) // selected Customer object, or null for walk-in
  const [customerQuery, setCustomerQuery] = useState('')
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const codeInputRef = useRef(null)

  async function loadProducts() {
    const { data } = await api.get('/products')
    // Defensive default: a malformed/empty response must never crash the
    // live checkout screen with no error boundary — better to show an
    // empty product grid than take down the cashier's ability to sell.
    setProducts(data.products || [])
  }

  async function loadCustomers() {
    const { data } = await api.get('/customers')
    setCustomers(data.customers || [])
  }

  useEffect(() => { loadProducts() }, [])
  useEffect(() => { loadCustomers() }, [])
  useEffect(() => {
    api.get('/business').then(({ data }) => setBusiness(data.business)).catch(() => {})
  }, [])
  useEffect(() => {
    if (user?.businessId) setHeldBills(loadHeld(user.businessId))
  }, [user?.businessId])
  useEffect(() => { codeInputRef.current?.focus() }, [])

  // Restores an in-progress sale (not explicitly "held" — just whatever was
  // on screen) if the app was closed, refreshed, or the session was force-
  // logged-out mid-sale. Without this, a cart that isn't manually held is
  // gone for good the moment anything interrupts the page.
  useEffect(() => {
    if (!user?.businessId) return
    try {
      const raw = localStorage.getItem(draftKey(user.businessId))
      if (raw) {
        const draft = JSON.parse(raw)
        if (draft?.cart?.length) {
          setCart(draft.cart)
          setSaleType(draft.saleType || 'RETAIL')
          setCustomer(draft.customer || null)
        }
      }
    } catch {
      // ignore a corrupt draft — better to start with an empty sale than crash
    } finally {
      setDraftLoaded(true)
    }
  }, [user?.businessId])

  useEffect(() => {
    if (!draftLoaded || !user?.businessId) return
    try {
      if (cart.length === 0) {
        localStorage.removeItem(draftKey(user.businessId))
      } else {
        localStorage.setItem(draftKey(user.businessId), JSON.stringify({ cart, saleType, customer }))
      }
    } catch {
      // draft autosave is a convenience, not critical data
    }
  }, [cart, saleType, customer, draftLoaded, user?.businessId])

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

  // Prices are captured from the product record at add-time so a later
  // price edit in Inventory doesn't retroactively change an in-progress
  // sale. Which of the two is actually charged is decided by saleType at
  // total/checkout time, not baked into the line here.
  function addToCart(p, qty = 1) {
    setScanError('')
    setMessage('')
    setCart(prev => {
      const existing = prev.find(l => l.productId === p.id)
      if (existing) {
        return prev.map(l => l.productId === p.id ? { ...l, qty: l.qty + qty } : l)
      }
      return [...prev, {
        productId: p.id,
        name: p.name,
        unit: p.unit,
        retailPrice: Number(p.pricePerUnit),
        tradePrice: Number(p.tradePricePerUnit),
        qty
      }]
    })
  }

  function linePrice(l) {
    return saleType === 'TRADE' ? l.tradePrice : l.retailPrice
  }

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c =>
      c.shopName.toLowerCase().includes(q) ||
      (c.shopkeeperName || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    )
  }, [customers, customerQuery])

  function pickCustomer(c) {
    setCustomer(c)
    setCustomerQuery('')
    setShowCustomerPicker(false)
    // Shopkeeper accounts almost always buy at trade price — nudge the
    // toggle, but the cashier can still switch back to Retail manually.
    setSaleType('TRADE')
  }

  function clearCustomer() {
    setCustomer(null)
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
    const next = [{ id: crypto.randomUUID(), savedAt: Date.now(), cart, saleType, customer }, ...heldBills]
    setHeldBills(next)
    saveHeld(user.businessId, next)
    setCart([])
    setSelectedId(null)
    setKeypadValue('')
    setCustomer(null)
    setMessage('Sale held.')
  }

  function recallHeld(id) {
    const bill = heldBills.find(h => h.id === id)
    if (!bill) return
    setCart(bill.cart)
    setSaleType(bill.saleType || 'RETAIL')
    setCustomer(bill.customer || null)
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

  const total = cart.reduce((sum, l) => sum + linePrice(l) * (Number(l.qty) || 0), 0)
  const tendered = parseFloat(cashTendered) || 0
  const change = tendered - total
  // A walk-in (no customer) must tender the full total — there's no account
  // to put a shortfall on. A customer-attached sale can be paid any amount;
  // whatever's short becomes credit on their tab.
  const canConfirm = customer ? tendered >= 0 : tendered >= total

  async function completeSale() {
    setError('')
    setCheckingOut(true)
    try {
      const items = cart.map(l => ({ productId: l.productId, quantity: Number(l.qty) }))
      const { data } = await api.post('/sales', {
        saleType,
        items,
        customerId: customer?.id || null,
        amountTendered: tendered
      })
      const creditNote = data.sale.totalAmount - data.sale.amountPaid > 0
        ? `, ${money(data.sale.totalAmount - data.sale.amountPaid)} added to ${customer.shopName}'s account`
        : ''
      setMessage(`Sale complete: total ${money(data.sale.totalAmount)}, profit ${money(data.sale.totalProfit)}${creditNote}`)
      setLastSale(data.sale)
      setCart([])
      setSelectedId(null)
      setShowPayment(false)
      setCashTendered('')
      setCustomer(null)
      loadProducts()
      loadCustomers()
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
              <div className="product-meta">
                {money(saleType === 'TRADE' ? p.tradePricePerUnit : p.pricePerUnit)} / {p.unit}
              </div>
              <div className="product-stock">Stock: {p.stockQty}</div>
            </button>
          ))}
          {filtered.length === 0 && <p>No products found.</p>}
        </div>
      </div>

      <div className="terminal-register">
        {message && (
          <div className="success-banner">
            {message}
            {lastSale && <button className="print-bill-btn" onClick={() => window.print()}>Print Bill</button>}
          </div>
        )}

        <div className="customer-picker">
          {customer ? (
            <div className="customer-selected">
              <div>
                <strong>{customer.shopName}</strong>
                {customer.balance > 0 && <span className="customer-balance"> owes {money(customer.balance)}</span>}
              </div>
              <button className="link" onClick={clearCustomer}>Change</button>
            </div>
          ) : (
            <div className="customer-search">
              <input
                placeholder="Customer (shop name) — leave blank for walk-in"
                value={customerQuery}
                onChange={e => { setCustomerQuery(e.target.value); setShowCustomerPicker(true) }}
                onFocus={() => setShowCustomerPicker(true)}
              />
              {showCustomerPicker && (
                <div className="customer-dropdown">
                  {customerMatches.length === 0 && <div className="customer-dropdown-empty">No customers match — add one in Customers.</div>}
                  {customerMatches.map(c => (
                    <button key={c.id} className="customer-option" onClick={() => pickCustomer(c)}>
                      <span>{c.shopName}</span>
                      {c.balance > 0 && <span className="customer-balance">{money(c.balance)}</span>}
                    </button>
                  ))}
                  <button className="customer-dropdown-close" onClick={() => setShowCustomerPicker(false)}>Close</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sale-type-toggle">
          <button
            className={saleType === 'RETAIL' ? 'sale-type-btn active' : 'sale-type-btn'}
            onClick={() => setSaleType('RETAIL')}
          >
            Retail Sale
          </button>
          <button
            className={saleType === 'TRADE' ? 'sale-type-btn active trade' : 'sale-type-btn trade'}
            onClick={() => setSaleType('TRADE')}
          >
            Trade Sale
          </button>
        </div>

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
                <span className="receipt-name">{l.name}<small>{money(linePrice(l))}/{l.unit}</small></span>
                <span className="receipt-qty">{l.qty}</span>
                <span className="receipt-amount">{money(linePrice(l) * l.qty)}</span>
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
          <span>{money(total)}</span>
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
          Pay {money(total)}
        </button>
      </div>

      {showHeld && (
        <div className="overlay" onClick={() => setShowHeld(false)}>
          <div className="overlay-panel" onClick={e => e.stopPropagation()}>
            <h2>Held Sales</h2>
            {heldBills.length === 0 && <p>Nothing held.</p>}
            {heldBills.map(h => {
              const billTotal = h.cart.reduce((s, l) => s + (h.saleType === 'TRADE' ? l.tradePrice : l.retailPrice) * l.qty, 0)
              return (
                <div key={h.id} className="held-row">
                  <div>
                    <div>{h.cart.length} item(s) — {money(billTotal)} ({h.saleType === 'TRADE' ? 'Trade' : 'Retail'})</div>
                    <small>{h.customer ? h.customer.shopName : 'Walk-in'} • {new Date(h.savedAt).toLocaleTimeString()}</small>
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
            <div className="payment-total">Due: {money(total)}</div>
            {customer && <div className="payment-customer">For: {customer.shopName}</div>}
            <div className="payment-row">
              <span>Cash tendered</span>
              <span className="payment-tendered">Rs. {cashTendered || '0'}</span>
            </div>
            {change >= 0 ? (
              <div className="payment-row">
                <span>Change</span>
                <span>{money(change)}</span>
              </div>
            ) : customer ? (
              <div className="payment-row credit">
                <span>Credit (added to {customer.shopName}'s account)</span>
                <span>{money(Math.abs(change))}</span>
              </div>
            ) : (
              <div className="payment-row negative">
                <span>Still due — select a customer to allow credit</span>
                <span>{money(Math.abs(change))}</span>
              </div>
            )}
            <NumericKeypad value={cashTendered} onChange={setCashTendered} />
            <div className="payment-actions">
              <button className="secondary" onClick={() => setShowPayment(false)} disabled={checkingOut}>Cancel</button>
              <button className="pay-btn" onClick={completeSale} disabled={checkingOut || !canConfirm}>
                {checkingOut ? 'Processing…' : 'Confirm Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PrintableBill sale={lastSale} business={business} cashierName={user?.name} />
    </div>
  )
}
