import React, { useState } from 'react'
import UploadCard from '../components/UploadCard.jsx'
import ResultPanel from '../components/ResultPanel.jsx'
import { scanFile } from '../api.js'

export default function ScanFile() {
  const [result, setResult] = useState(null)

  const handleUpload = async (file) => {
    const data = await scanFile(file)
    setResult(data)
  }

  return (
    <div className="stack">
      <UploadCard label="Upload attachment to sandbox" onUpload={handleUpload} />
      <ResultPanel result={result} />
    </div>
  )
}
