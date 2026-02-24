import React, { useState } from 'react'
import ScanForm from '../components/ScanForm.jsx'
import ResultPanel from '../components/ResultPanel.jsx'
import { scanUrl } from '../api.js'

export default function ScanUrl() {
  const [result, setResult] = useState(null)

  const handleSubmit = async (value) => {
    const data = await scanUrl(value)
    setResult(data)
  }

  return (
    <div className="stack">
      <ScanForm
        label="Paste a URL to scan"
        placeholder="https://secure-login.example.com"
        onSubmit={handleSubmit}
      />
      <ResultPanel result={result} />
    </div>
  )
}
