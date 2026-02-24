const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function authHeaders() {
  const token = localStorage.getItem('phishguard_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getStats() {
  const res = await fetch(`${API_BASE}/api/stats`, {
    headers: authHeaders()
  })
  return res.json()
}

export async function getHistory() {
  const res = await fetch(`${API_BASE}/api/history`, {
    headers: authHeaders()
  })
  return res.json()
}

export async function getAnalysisMetrics() {
  const res = await fetch(`${API_BASE}/api/analysis/metrics`, {
    headers: authHeaders()
  })
  return res.json()
}

export async function scanUrl(url) {
  const res = await fetch(`${API_BASE}/api/scan/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ url })
  })
  return res.json()
}

export async function scanEmail(text) {
  const res = await fetch(`${API_BASE}/api/scan/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text })
  })
  return res.json()
}

export async function scanImage(file, mode = 'auto') {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/api/scan/image?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: form
  })
  return res.json()
}

export async function scanFile(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/api/scan/file`, {
    method: 'POST',
    headers: authHeaders(),
    body: form
  })
  return res.json()
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  return res.json()
}

export async function register(email, password, role) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role })
  })
  return res.json()
}
