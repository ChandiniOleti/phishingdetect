import React, { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

const links = [
  { to: '/about', label: 'About & Features' },
  { to: '/dashboard', label: 'Command Center' },
  { to: '/analysis', label: 'Model Analysis' },
  { to: '/scan/url', label: 'URL Sentinel' },
  { to: '/scan/email', label: 'Email Scanner' },
  { to: '/scan/image', label: 'Image OCR' },
  { to: '/scan/file', label: 'File Sandbox' },
  { to: '/reports', label: 'Threat Reports' },
  { to: '/admin', label: 'Admin Console' }
]

export default function Sidebar() {
  const [authed, setAuthed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    setAuthed(!!localStorage.getItem('phishguard_token'))
  }, [location.pathname])

  const handleLogout = () => {
    localStorage.removeItem('phishguard_token')
    setAuthed(false)
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">PG</div>
        <div>
          <div className="brand-title">PhishGuard AI</div>
          <div className="brand-sub">Real-Time Defense</div>
        </div>
      </div>
      <nav className="nav">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <span>{link.label}</span>
          </NavLink>
        ))}
        {!authed && (
          <NavLink to="/login" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <span>Login</span>
          </NavLink>
        )}
        {authed && (
          <button className="nav-link logout" onClick={handleLogout}>
            Logout
          </button>
        )}
      </nav>
      <div className="sidebar-footer">
        <div className="badge">AI + ML Shield</div>
        <div className="pulse" />
      </div>
    </aside>
  )
}
