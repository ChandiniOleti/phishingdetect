import React, { useState } from 'react'
import UploadCard from '../components/UploadCard.jsx'
import ResultPanel from '../components/ResultPanel.jsx'
import { scanImage } from '../api.js'

export default function ScanImage() {
  const [result, setResult] = useState(null)
  const [mode, setMode] = useState('auto')

  const handleUpload = async (file) => {
    const data = await scanImage(file, mode)
    setResult(data)
  }

  return (
    <div className="stack">
      <div className="card scan">
        <div className="card-title">Image Scan Mode</div>
        <div className="card-sub">
          Use <span className="mono">Fast (Vision)</span> for quickest results. OCR can be slower on large images.
        </div>
        <select className="scan-input" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="auto">Auto (Vision + OCR if needed)</option>
          <option value="vision">Fast (Vision-only)</option>
          <option value="ocr">OCR-only</option>
        </select>
      </div>
      <UploadCard label="Upload image for OCR / vision phishing scan" onUpload={handleUpload} />
      <ResultPanel result={result} />
    </div>
  )
}
