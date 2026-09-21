import { useEffect, useState } from 'react'
import api from '../api'

export default function Staff() {
  const [staff, setStaff] = useState([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const { data } = await api.get('/auth/staff')
    setStaff(data.users)
  }

  useEffect(() => { load() }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      await api.post('/auth/staff', { name, email, password })
      setName(''); setEmail(''); setPassword('')
      setMessage('Staff account created.')
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create staff account')
    }
  }

  return (
    <div>
      <h1>Staff</h1>
      <p>Give cashiers their own login so every sale is tied to the person who made it.</p>
      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <form className="card form-grid" onSubmit={onSubmit}>
        <h2>Add staff account</h2>
        <label>Name<input value={name} onChange={e => setName(e.target.value)} required /></label>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Temporary password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /></label>
        <div className="form-actions"><button type="submit">Add staff</button></div>
      </form>

      <table className="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>
          {staff.map(u => (
            <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
