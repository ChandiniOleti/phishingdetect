function showBanner(label, score) {
  const existing = document.getElementById('phishguard-banner')
  if (existing) existing.remove()

  const banner = document.createElement('div')
  banner.id = 'phishguard-banner'

  const normalized = String(label || 'unknown').toLowerCase()
  const pct = Math.round((typeof score === 'number' ? score : 0) * 100)

  const verdict = normalized === 'legitimate' ? 'SAFE' : 'UNSAFE'
  const accent =
    normalized === 'legitimate'
      ? '#38f5d1'
      : normalized === 'suspicious'
        ? '#ffb800'
        : '#ff3b8d'

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

  document.body.appendChild(banner)

  setTimeout(() => banner.remove(), 8000)
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'PHISH_STATUS') {
    showBanner(msg.label, msg.score)
  }
})
