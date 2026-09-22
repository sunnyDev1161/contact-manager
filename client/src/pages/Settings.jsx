import { useEffect, useState } from 'react'
import api from '../api'

const emptyForm = { name: '', tagline: '', proprietors: '', address: '', phone: '' }

export default function Settings() {
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [backingUp, setBackingUp] = useState(false)

  async function downloadBackup() {
    setError('')
    setBackingUp(true)
    try {
      const { data } = await api.get('/business/backup')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.error || 'Backup failed')
    } finally {
      setBackingUp(false)
    }
  }

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

      <div className="card">
        <h2>Data backup</h2>
        <p>Download a full copy of your products, customers, sales, and credit ledger as a JSON file. Keep it somewhere other than this laptop — a USB drive, email to yourself, or cloud storage — in case anything happens to this machine.</p>
        <button type="button" onClick={downloadBackup} disabled={backingUp}>
          {backingUp ? 'Preparing…' : 'Download backup'}
        </button>
      </div>
    </div>
  )
}
