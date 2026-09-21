import { useEffect, useState } from 'react'
import api from '../api'

const emptyForm = { name: '', tagline: '', proprietors: '', address: '', phone: '' }

export default function Settings() {
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/business')
      setForm({
        name: data.business.name || '',
        tagline: data.business.tagline || '',
        proprietors: data.business.proprietors || '',
        address: data.business.address || '',
        phone: data.business.phone || ''
      })
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load business profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      await api.put('/business', form)
      setMessage('Saved. This also updates the header/footer on printed bills.')
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    }
  }

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <h1>Business Settings</h1>
      <p>This information appears on your printed bills.</p>
      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <form className="card form-grid" onSubmit={onSubmit}>
        <h2>Business profile</h2>
        <label>
          Business name
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          Tagline
          <input
            value={form.tagline}
            onChange={e => setForm({ ...form, tagline: e.target.value })}
            placeholder="e.g. Trading • Supply • General Merchandise"
          />
        </label>
        <label>
          Proprietor(s)
          <input
            value={form.proprietors}
            onChange={e => setForm({ ...form, proprietors: e.target.value })}
            placeholder="e.g. Full Name | Full Name"
          />
        </label>
        <label>
          Address
          <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
        </label>
        <label>
          Phone
          <input
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="e.g. 03XX-XXXXXXX | 03XX-XXXXXXX"
          />
        </label>
        <div className="form-actions">
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  )
}
