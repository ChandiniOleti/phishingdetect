const API = 'http://localhost:5000/api/scan/url'

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

// Brand lookalikes: if the hostname contains a brand but isn't an official domain, increase risk.
const brandRules = [
  { token: 'paypal', allow: /(^|\\.)paypal\\.com$/i },
  { token: 'facebook', allow: /(^|\\.)facebook\\.com$/i }
]

function clamp(n) {
  return Math.max(0, Math.min(1, n))
}

function localHeuristic(url) {
  const lower = String(url || '').toLowerCase()
  let score = 0

  let hostname = ''
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    hostname = ''
  }

  for (const k of suspiciousKeywords) {
    if (lower.includes(k)) score += 0.18
  }

  // Stronger signal: keywords in hostname are riskier than in path/query.
  for (const k of suspiciousKeywords) {
    if (hostname && hostname.includes(k)) score += 0.12
  }

  // Lookalike brand (e.g. "secure-login-paypal.com" is not "paypal.com")
  for (const rule of brandRules) {
    if (!hostname) continue
    if (!hostname.includes(rule.token)) continue
    if (!rule.allow.test(hostname)) score += 0.55
  }

  // Hyphenated or digit-heavy hostnames are common in phishing kits.
  if (hostname && hostname.includes('-')) score += 0.10
  if (hostname && /\\d/.test(hostname)) score += 0.05

  if (url.length > 75) score += 0.1
  if (lower.startsWith('http://')) score += 0.1

  return clamp(score)
}

async function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['phishguard_token'], (res) =>
      resolve(res.phishguard_token || '')
    )
  })
}

async function scanWithApi(url) {
  try {
    const token = await getToken()
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ url })
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error || 'Scan failed' }

    return data
  } catch {
    return { error: 'API unreachable' }
  }
}

function decideVerdict(apiResult, heuristicScore) {
  const apiScore = apiResult?.result?.score
  const rawApiLabel = apiResult?.result?.label

  const mlScore = typeof apiScore === 'number' ? apiScore : 0
  const score = Math.max(mlScore, heuristicScore)

  const apiLabel = String(rawApiLabel || '').toLowerCase()
  let label = ''
  if (apiLabel === 'phishing' || apiLabel === 'malicious') label = 'phishing'
  else if (apiLabel === 'suspicious') label = 'suspicious'
  else if (apiLabel === 'legitimate' || apiLabel === 'clean' || apiLabel === 'safe') label = 'legitimate'

  // If API label is missing/unknown, decide from risk score.
  if (!label) {
    if (score >= 0.60) label = 'phishing'
    else if (score >= 0.35) label = 'suspicious'
    else label = 'legitimate'
  }

  // Heuristic override: treat obvious phishing patterns as unsafe even if ML says legitimate.
  if (heuristicScore >= 0.60) label = 'phishing'
  else if (heuristicScore >= 0.35 && label === 'legitimate') label = 'suspicious'

  return { score, label }
}

const notifiedTabs = new Map()

function showOverlay(label, score) {
  const existing = document.getElementById('phishguard-banner')
  if (existing) existing.remove()

  const normalized = String(label || 'unknown').toLowerCase()
  const pct = Math.round((typeof score === 'number' ? score : 0) * 100)
  const verdict = normalized === 'legitimate' ? 'SAFE' : 'UNSAFE'
  const accent =
    normalized === 'legitimate'
      ? '#38f5d1'
      : normalized === 'suspicious'
        ? '#ffb800'
        : '#ff3b8d'

  const banner = document.createElement('div')
  banner.id = 'phishguard-banner'
  banner.style.position = 'fixed'
  banner.style.top = '20px'
  banner.style.right = '20px'
  banner.style.zIndex = '999999'
  banner.style.padding = '12px 16px'
  banner.style.background = accent
  banner.style.color = '#0b0c12'
  banner.style.fontFamily = 'Arial, sans-serif'
  banner.style.borderRadius = '12px'
  banner.style.boxShadow = '0 12px 30px rgba(0,0,0,0.35)'
  banner.style.fontWeight = 'bold'
  banner.style.letterSpacing = '0.2px'
  banner.textContent = `PhishGuard: ${verdict} (${normalized.toUpperCase()} ${pct}%)`

  document.documentElement.appendChild(banner)
  setTimeout(() => banner.remove(), 10000)
}

async function sendPhishStatus(tabId, payload) {
  // Try content-script messaging first.
  const sent = await new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, payload, () => {
      const err = chrome.runtime.lastError
      resolve(!err)
    })
  })

  if (sent) return

  // Fallback: inject overlay directly (covers pages where the content script didn't attach yet).
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: showOverlay,
      args: [payload.label, payload.score]
    })
  } catch {
    // Can't inject into chrome://, chrome-error://, Chrome Web Store, PDF viewer, etc.
  }
}

function setBadge(tabId, label) {
  const text = label === 'legitimate' ? '' : '!'
  const color =
    label === 'phishing' ? '#ff3b8d' : label === 'suspicious' ? '#ffb800' : '#38f5d1'
  chrome.action.setBadgeText({ tabId, text })
  chrome.action.setBadgeBackgroundColor({ tabId, color })
}

function normalizeUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `http://${raw}`
}

function getProtectionEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['phishguard_protection_enabled'], (res) => {
      resolve(res.phishguard_protection_enabled !== false)
    })
  })
}

function getStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pg_stats'], (res) => {
      resolve(res.pg_stats || { urls_checked: 0, threats_blocked: 0, warnings_shown: 0 })
    })
  })
}

function setStats(stats) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pg_stats: stats }, resolve)
  })
}

function getAllowHosts() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pg_allow_hosts'], (res) => {
      resolve(res.pg_allow_hosts || {})
    })
  })
}

function setAllowHosts(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pg_allow_hosts: value || {} }, resolve)
  })
}

async function isHostAllowed(host) {
  const allow = await getAllowHosts()
  const exp = allow && host ? Number(allow[host]) : 0
  if (!exp || Number.isNaN(exp)) return false
  if (Date.now() > exp) return false
  return true
}

async function incrementStats(label) {
  const stats = await getStats()
  stats.urls_checked = (stats.urls_checked || 0) + 1
  if (label !== 'legitimate') stats.warnings_shown = (stats.warnings_shown || 0) + 1
  if (label === 'phishing') stats.threats_blocked = (stats.threats_blocked || 0) + 1
  await setStats(stats)
  return stats
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) return
  if (tab.url.startsWith(chrome.runtime.getURL(''))) return

  const protectionEnabled = await getProtectionEnabled()
  if (!protectionEnabled) {
    setBadge(tabId, 'legitimate')
    return
  }

  // Prevent spam for rapid reload loops; still allow rescans after a short window.
  const prev = notifiedTabs.get(tabId)
  const now = Date.now()
  if (prev && prev.url === tab.url && now - prev.ts < 8000) return
  notifiedTabs.set(tabId, { url: tab.url, ts: now })

  const heuristicScore = localHeuristic(tab.url)
  const apiResult = await scanWithApi(tab.url)

  const { score, label } = decideVerdict(apiResult, heuristicScore)
  setBadge(tabId, label)
  incrementStats(label).catch(() => {})

  // If we are on an unsafe URL, we might be unable to inject a banner (e.g. chrome-error pages).
  // In that case show a dedicated warning page.
  if (label === 'phishing') {
    let host = ''
    try {
      host = new URL(tab.url).hostname.toLowerCase()
    } catch {
      host = ''
    }
    const allowed = host ? await isHostAllowed(host) : false
    if (!allowed) {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: 'PhishGuard Alert',
          message: `UNSAFE (PHISHING ${Math.round(score * 100)}%) — ${host || 'site'}`
        })
      } catch {
        // ignore
      }
      const blockedUrl =
        chrome.runtime.getURL('blocked.html') +
        `?u=${encodeURIComponent(tab.url)}&l=${encodeURIComponent(label)}&s=${encodeURIComponent(Math.round(score * 100))}`
      try {
        await chrome.tabs.update(tabId, { url: blockedUrl })
      } catch {
        // Ignore if tab can't be updated.
      }
      return
    }
  }

  // Send verdict to page banner (best-effort; inject overlay fallback if needed)
  sendPhishStatus(tabId, { type: 'PHISH_STATUS', url: tab.url, score, label })

  // Notifications ONLY for risk
  if (label !== 'legitimate') {
    const verdict = 'UNSAFE'
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'PhishGuard Alert',
      message: `${verdict} (${label.toUpperCase()} ${Math.round(score * 100)}%) — ${new URL(tab.url).hostname}`
    })
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  notifiedTabs.delete(tabId)
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ;(async () => {
    const type = msg?.type

    if (type === 'GET_PROTECTION') {
      const enabled = await getProtectionEnabled()
      sendResponse({ enabled })
      return
    }

    if (type === 'SET_PROTECTION') {
      const enabled = msg?.enabled !== false
      await new Promise((resolve) => {
        chrome.storage.local.set({ phishguard_protection_enabled: enabled }, resolve)
      })
      sendResponse({ enabled })
      return
    }

    if (type === 'GET_STATS') {
      sendResponse(await getStats())
      return
    }

    if (type === 'CLEAR_STATS') {
      const stats = { urls_checked: 0, threats_blocked: 0, warnings_shown: 0 }
      await setStats(stats)
      sendResponse(stats)
      return
    }

    if (type === 'ALLOW_HOST') {
      const host = String(msg?.host || '').toLowerCase().trim()
      const ttl = Number(msg?.ttl_ms || 0)
      if (!host || !ttl || Number.isNaN(ttl)) {
        sendResponse({ ok: false })
        return
      }
      const allow = await getAllowHosts()
      allow[host] = Date.now() + ttl
      await setAllowHosts(allow)
      sendResponse({ ok: true })
      return
    }

    if (type === 'SCAN_URL') {
      const url = normalizeUrl(msg?.url)
      if (!url) {
        sendResponse({ error: 'Missing URL', label: 'unknown', score: 0 })
        return
      }

      // Allow popup to pass API/token explicitly, but keep defaults for safety.
      const apiEndpoint = msg?.api || API
      const token = String(msg?.token || '')

      const heuristicScore = localHeuristic(url)
      let apiResult = { error: 'API unreachable' }
      try {
        const res = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ url })
        })
        const data = await res.json().catch(() => ({}))
        apiResult = res.ok ? data : { error: data.error || 'Scan failed' }
      } catch {
        apiResult = { error: 'API unreachable' }
      }

      const { score, label } = decideVerdict(apiResult, heuristicScore)
      await incrementStats(label).catch(() => {})

      // If this scan is for a real tab (popup scanning current tab), update badge + banner too.
      if (sender?.tab?.id != null) {
        setBadge(sender.tab.id, label)
        sendPhishStatus(sender.tab.id, { type: 'PHISH_STATUS', url, score, label })
      }

      sendResponse({
        label,
        score,
        detail: apiResult?.error ? `${apiResult.error} (using local heuristic)` : 'API scan',
        result: apiResult?.result
      })
      return
    }

    sendResponse({ error: 'Unknown message type' })
  })()

  return true
})
