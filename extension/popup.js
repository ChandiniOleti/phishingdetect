const API = 'http://localhost:5000/api/scan/url'

function $(id) {
  return document.getElementById(id)
}

function clamp(n) {
  return Math.max(0, Math.min(1, n))
}

const suspiciousKeywords = [
  'login',
  'verify',
  'secure',
  'security',
  'update',
  'password',
  'account',
  'bank'
]

const brandRules = [
  { token: 'paypal', allow: /(^|\\.)paypal\\.com$/i },
  { token: 'facebook', allow: /(^|\\.)facebook\\.com$/i }
]

function localHeuristic(url) {
  const lower = String(url || '').toLowerCase()
  let hostname = ''
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    hostname = ''
  }

  let score = 0
  for (const k of suspiciousKeywords) {
    if (lower.includes(k)) score += 0.18
  }
  for (const k of suspiciousKeywords) {
    if (hostname && hostname.includes(k)) score += 0.12
  }
  for (const rule of brandRules) {
    if (!hostname) continue
    if (!hostname.includes(rule.token)) continue
    if (!rule.allow.test(hostname)) score += 0.55
  }
  if (hostname && hostname.includes('-')) score += 0.1
  if (hostname && /\\d/.test(hostname)) score += 0.05
  if (String(url || '').length > 75) score += 0.1
  if (lower.startsWith('http://')) score += 0.1

  return clamp(score)
}

function decideVerdict(apiResult, heuristicScore) {
  const apiScore = apiResult?.result?.score
  const apiLabel = apiResult?.result?.label

  const score = typeof apiScore === 'number' ? apiScore : heuristicScore

  if (apiLabel) return { score, label: String(apiLabel).toLowerCase() }
  if (score >= 0.6) return { score, label: 'phishing' }
  if (score >= 0.35) return { score, label: 'suspicious' }
  return { score, label: 'legitimate' }
}

function normalizeUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `http://${raw}`
}

function scoreToPct(score) {
  return Math.round((typeof score === 'number' ? score : 0) * 100)
}

function safeLabel(label) {
  const l = String(label || '').toLowerCase()
  if (l === 'legitimate' || l === 'safe' || l === 'clean') return 'legitimate'
  if (l === 'phishing' || l === 'malicious') return 'phishing'
  if (l === 'suspicious') return 'suspicious'
  return l || 'unknown'
}

function labelToStatus(label) {
  const l = safeLabel(label)
  return l === 'legitimate' ? 'safe' : 'unsafe'
}

function renderCurrent({ url, label, score, detail }) {
  const status = labelToStatus(label)
  const card = $('currentCard')
  const icon = $('currentIcon')
  const title = $('currentTitle')
  const sub = $('currentSub')
  const urlEl = $('currentUrl')

  card.classList.remove('safe', 'unsafe', 'pending')
  card.classList.add(status)

  icon.textContent = status === 'safe' ? '✓' : '!'
  title.textContent = status === 'safe' ? 'Current site is safe' : 'Current site is unsafe'
  sub.textContent = `${safeLabel(label).toUpperCase()} (${scoreToPct(score)}%)${detail ? ` | ${detail}` : ''}`

  try {
    const host = new URL(url).hostname
    urlEl.textContent = host
  } catch {
    urlEl.textContent = url || 'N/A'
  }
}

function setPending() {
  const card = $('currentCard')
  const icon = $('currentIcon')
  const title = $('currentTitle')
  const sub = $('currentSub')
  const urlEl = $('currentUrl')

  card.classList.remove('safe', 'unsafe')
  card.classList.add('pending')

  icon.textContent = '…'
  title.textContent = 'Checking current site'
  sub.textContent = 'Scanning...'
  urlEl.textContent = '—'
}

function setManualResult({ label, score, detail }) {
  const el = $('manualResult')
  const status = labelToStatus(label)
  el.classList.remove('ok', 'bad', 'warn')
  el.classList.add(status === 'safe' ? 'ok' : 'bad')
  el.textContent = `${status === 'safe' ? 'SAFE' : 'UNSAFE'}: ${safeLabel(label).toUpperCase()} (${scoreToPct(score)}%)${detail ? ` | ${detail}` : ''}`
}

function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['phishguard_token'], (res) => resolve(res.phishguard_token || ''))
  })
}

function setToken(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ phishguard_token: String(value || '') }, resolve)
  })
}

function sendMessage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (resp) => {
      const err = chrome.runtime.lastError
      if (err) {
        resolve({ error: err.message || 'Extension error', _noListener: true })
        return
      }
      resolve(resp || {})
    })
  })
}

async function scanUrl(url) {
  const token = await getToken()
  const res = await sendMessage({
    type: 'SCAN_URL',
    url,
    api: API,
    token
  })
  // If background listener isn't reachable, still provide a deterministic verdict.
  if (res?._noListener) {
    const heuristicScore = localHeuristic(url)
    const { score, label } = decideVerdict(null, heuristicScore)
    return { label, score, detail: res.error || 'Background unavailable (using local heuristic)' }
  }
  return res
}

async function loadStats() {
  const stats = await sendMessage({ type: 'GET_STATS' })
  $('statChecked').textContent = String(stats.urls_checked ?? 0)
  $('statThreats').textContent = String(stats.threats_blocked ?? 0)
  $('statWarnings').textContent = String(stats.warnings_shown ?? 0)
}

async function loadProtection() {
  const resp = await sendMessage({ type: 'GET_PROTECTION' })
  const enabled = resp.enabled !== false
  $('toggleProtection').checked = enabled
  $('toggleLabel').textContent = enabled ? 'Protection ON' : 'Protection OFF'
}

async function scanCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url ? String(tab.url) : ''
  if (!url || url.startsWith('chrome://') || url.startsWith('about:')) {
    renderCurrent({ url: url || 'N/A', label: 'unknown', score: 0, detail: 'Unsupported page' })
    return
  }

  setPending()
  const resp = await scanUrl(url)
  const label = resp?.label || resp?.result?.label || 'unknown'
  const score = resp?.score ?? resp?.result?.score ?? 0
  const detail = resp?.detail || resp?.error || ''
  renderCurrent({ url, label, score, detail })
  await loadStats()
}

function setAboutOpen(open) {
  const panel = $('aboutPanel')
  panel.hidden = !open
}

document.addEventListener('DOMContentLoaded', async () => {
  // Token preload
  const token = await getToken()
  $('token').value = token

  await loadProtection()
  await loadStats()
  await scanCurrentTab()

  $('toggleProtection').addEventListener('change', async (e) => {
    const enabled = !!e.target.checked
    $('toggleLabel').textContent = enabled ? 'Protection ON' : 'Protection OFF'
    await sendMessage({ type: 'SET_PROTECTION', enabled })
  })

  $('btnManualCheck').addEventListener('click', async () => {
    const input = $('manualUrl').value
    const url = normalizeUrl(input)
    if (!url) return
    $('btnManualCheck').disabled = true
    $('btnManualCheck').textContent = 'Checking...'
    const resp = await scanUrl(url)
    const label = resp?.label || resp?.result?.label || 'unknown'
    const score = resp?.score ?? resp?.result?.score ?? 0
    const detail = resp?.detail || resp?.error || ''
    setManualResult({ label, score, detail })
    await loadStats()
    $('btnManualCheck').disabled = false
    $('btnManualCheck').textContent = 'Check'
  })

  $('manualUrl').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btnManualCheck').click()
  })

  $('btnClearStats').addEventListener('click', async () => {
    await sendMessage({ type: 'CLEAR_STATS' })
    await loadStats()
  })

  $('btnAbout').addEventListener('click', () => {
    setAboutOpen(!$('aboutPanel').hidden)
  })

  $('btnSaveToken').addEventListener('click', async () => {
    await setToken($('token').value)
    $('tokenSaved').textContent = 'Saved.'
    setTimeout(() => {
      $('tokenSaved').textContent = ''
    }, 1500)
  })
})
