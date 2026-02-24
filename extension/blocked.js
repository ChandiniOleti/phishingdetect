function getParam(name) {
  const url = new URL(window.location.href)
  return url.searchParams.get(name) || ''
}

function safeHost(u) {
  try {
    return new URL(u).hostname
  } catch {
    return ''
  }
}

const originalUrl = getParam('u')
const label = (getParam('l') || 'phishing').toUpperCase()
const score = getParam('s') || '0'
const host = safeHost(originalUrl)

document.getElementById('url').textContent = originalUrl || '—'
document.getElementById('host').textContent = host || '—'
document.getElementById('subtitle').textContent = `${label} (${score}%)`

document.getElementById('back').addEventListener('click', () => {
  history.back()
})

document.getElementById('continue').addEventListener('click', async () => {
  if (!host || !originalUrl) return
  await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'ALLOW_HOST', host, ttl_ms: 5 * 60 * 1000 }, resolve)
  })
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  chrome.tabs.update(tab.id, { url: originalUrl })
})

