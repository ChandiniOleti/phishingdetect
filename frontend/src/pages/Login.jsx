import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../api.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [mode, setMode] = useState('login')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('Processing...')
    const data = mode === 'login'
      ? await login(email, password)
      : await register(email, password, role)

    if (data.token) {
      localStorage.setItem('phishguard_token', data.token)
      setMessage('Authenticated. Redirecting...')
      setTimeout(() => navigate('/about'), 300)
    } else {
      setMessage(data.error || 'Auth failed')
    }
  }

  return (
    <div className="stack">
      <form className="card scan" onSubmit={handleSubmit}>
        <div className="card-title">{mode === 'login' ? 'Login' : 'Register'}</div>
        <div className="card-sub" style={{ marginTop: -6 }}>
          After sign-in, you will be taken to the About page to explore features.
        </div>
        <input className="scan-input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="scan-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {mode === 'register' && (
          <select className="scan-input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">End User</option>
            <option value="student">Student</option>
            <option value="analyst">Analyst</option>
            <option value="admin">Admin</option>
          </select>
        )}
        <button className="primary" type="submit">{mode === 'login' ? 'Login' : 'Create Account'}</button>
        <button
          className="ghost"
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Need an account?' : 'Have an account?'}
        </button>
        <div className="card-sub">{message}</div>
      </form>
    </div>
  )
}
