import React from 'react'

function normalizeLabel(label) {
  const l = String(label || '').toLowerCase()
  if (l === 'legitimate' || l === 'clean' || l === 'safe') return 'legitimate'
  if (l === 'phishing' || l === 'malicious') return 'phishing'
  if (l === 'suspicious') return 'suspicious'
  return l || 'unknown'
}

export default function ResultPanel({ result }) {
  if (!result) return null
  const scanType = String(result.type || '').toLowerCase()
  const isEmailScan = scanType === 'email'
  const label = normalizeLabel(result.result?.label)
  const isSafe = label === 'legitimate'
  const emailVerdict = result.result?.verdict
  const verdict = isEmailScan
    ? (emailVerdict === 'fake' ? 'FAKE' : emailVerdict === 'not_fake' ? 'NOT FAKE' : 'UNKNOWN')
    : (isSafe ? 'SAFE' : 'UNSAFE')
  const rawScore = (result.result?.score ?? result.result?.risk ?? 0)
  const confidence = isSafe
    ? Math.round((1 - (rawScore || 0)) * 100)
    : Math.round((rawScore || 0) * 100)
  const modelName = String(result.result?.model || '').trim() || 'none'
  return (
    <div className={`card result ${isSafe ? 'safe' : 'unsafe'}`}>
      <div className="result-title">{isEmailScan ? 'Email Authenticity' : 'Verdict'}</div>
      <div className="result-score">{verdict}</div>
      <div className="result-meta">
        Label: {label} | Confidence: {confidence}% | Model: {modelName}
      </div>
      <div className="result-reasons">
        {(result.result?.reasons || []).map((reason, index) => (
          <span key={index} className="chip">{reason}</span>
        ))}
      </div>
    </div>
  )
}
