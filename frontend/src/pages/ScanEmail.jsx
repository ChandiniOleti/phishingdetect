import React, { useState } from 'react'
import ScanForm from '../components/ScanForm.jsx'
import ResultPanel from '../components/ResultPanel.jsx'
import { scanEmail } from '../api.js'

export default function ScanEmail() {
  const [result, setResult] = useState(null)

  const handleSubmit = async (value) => {
    const data = await scanEmail(value)
    setResult(data)
  }

  return (
    <div className="stack">
      <ScanForm
        label="Paste email content or SMS message (DistilBERT detection)"
        placeholder="Urgent: verify your account now..."
        onSubmit={handleSubmit}
      />
      <ResultPanel result={result} />
    </div>
  )
}
