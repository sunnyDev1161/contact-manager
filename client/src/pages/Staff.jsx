import { useEffect, useState } from 'react'
import api from '../api'
import { ASSIGNABLE_ROLES, roleLabel } from '../roles'

export default function Staff() {
  const [staff, setStaff] = useState([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('STAFF')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('STAFF')
  const [resetPassword, setResetPassword] = useState('')

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
      await api.post('/auth/staff', { name, email, password, role })
      setName(''); setEmail(''); setPassword(''); setRole('STAFF')
      setMessage('Staff account created.')
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create staff account')
    }
  }

  function startEdit(u) {
    setEditingId(u.id)
    setEditName(u.name)
    setEditRole(u.role)
    setResetPassword('')
    setError('')
    setMessage('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditRole('STAFF')
    setResetPassword('')
  }

  async function saveEdit(id) {
    setError('')
    try {
      const payload = { name: editName, role: editRole }
      if (resetPassword) payload.password = resetPassword
      await api.put(`/auth/staff/${id}`, payload)
      setMessage('Staff account updated.')
      cancelEdit()
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update staff account')
    }
  }

  async function toggleActive(u) {
    setError('')
    const verb = u.isActive ? 'deactivate' : 'reactivate'
    if (!confirm(`${verb === 'deactivate' ? 'Deactivate' : 'Reactivate'} ${u.name}'s login?`)) return
    try {
      await api.put(`/auth/staff/${u.id}`, { isActive: !u.isActive })
      setMessage(`${u.name} ${verb}d.`)
      load()
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${verb} account`)
    }
  }

  return (
    <div>
      <h1>Staff</h1>
      <p>Give cashiers, order bookers, and delivery riders their own login so every sale, order, or delivery is tied to the person who made it.</p>
      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <form className="card form-grid" onSubmit={onSubmit}>
        <h2>Add staff account</h2>
        <label>Name<input value={name} onChange={e => setName(e.target.value)} required /></label>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Temporary password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /></label>
        <label>
          Role
          <select value={role} onChange={e => setRole(e.target.value)}>
            {ASSIGNABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <div className="form-actions"><button type="submit">Add staff</button></div>
      </form>

      <table className="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {staff.map(u => (
            <tr key={u.id} className={!u.isActive ? 'inactive-row' : ''}>
              {editingId === u.id ? (
                <>
                  <td><input value={editName} onChange={e => setEditName(e.target.value)} /></td>
                  <td>{u.email}</td>
                  <td>
                    <select value={editRole} onChange={e => setEditRole(e.target.value)}>
                      {ASSIGNABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td>
                    {u.role !== 'OWNER' && (
                      <input
                        type="password"
                        placeholder="New password (optional)"
                        value={resetPassword}
                        onChange={e => setResetPassword(e.target.value)}
                        minLength={8}
                      />
                    )}
                  </td>
                  <td className="row-actions">
                    <button className="link" onClick={() => saveEdit(u.id)}>Save</button>
                    <button className="link" onClick={cancelEdit}>Cancel</button>
                  </td>
                </>
              ) : (
                <>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{roleLabel(u.role)}</td>
                  <td>{u.isActive ? 'Active' : 'Deactivated'}</td>
                  <td className="row-actions">
                    {u.role !== 'OWNER' && (
                      <>
                        <button className="link" onClick={() => startEdit(u)}>Edit</button>
                        <button className="link danger" onClick={() => toggleActive(u)}>
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
