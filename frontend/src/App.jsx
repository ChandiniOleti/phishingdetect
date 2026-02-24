import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Landing from './pages/Landing.jsx'
import ScanUrl from './pages/ScanUrl.jsx'
import ScanEmail from './pages/ScanEmail.jsx'
import ScanImage from './pages/ScanImage.jsx'
import ScanFile from './pages/ScanFile.jsx'
import Reports from './pages/Reports.jsx'
import Admin from './pages/Admin.jsx'
import Login from './pages/Login.jsx'
import Analysis from './pages/Analysis.jsx'
import About from './pages/About.jsx'

function RequireAuth({ children }) {
  const location = useLocation()
  const token = localStorage.getItem('phishguard_token')
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}

export default function App() {
  const location = useLocation()
  const token = localStorage.getItem('phishguard_token')
  const isPublic = location.pathname === '/' || location.pathname === '/login'
  const showSidebar = !isPublic && !!token

  return (
    <div className="app-shell">
      <div className="ambient" aria-hidden="true">
        <div className="blob blob-a" />
        <div className="blob blob-b" />
        <div className="grid-overlay" />
      </div>
      {showSidebar ? <Sidebar /> : null}
      <main className="main">
        <div className="page">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/about" element={<RequireAuth><About /></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/analysis" element={<RequireAuth><Analysis /></RequireAuth>} />
            <Route path="/scan/url" element={<RequireAuth><ScanUrl /></RequireAuth>} />
            <Route path="/scan/email" element={<RequireAuth><ScanEmail /></RequireAuth>} />
            <Route path="/scan/image" element={<RequireAuth><ScanImage /></RequireAuth>} />
            <Route path="/scan/file" element={<RequireAuth><ScanFile /></RequireAuth>} />
            <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
