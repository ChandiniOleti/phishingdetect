import React, { useEffect, useState } from 'react'
import { getHistory } from '../api.js'

export default function Reports() {
  const [history, setHistory] = useState([])

  useEffect(() => {
    getHistory().then(setHistory).catch(() => {})
  }, [])

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'phishguard-report.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">Threat Reports</div>
        <div className="card-sub">Export detailed scan data and detection summaries.</div>
        <button className="primary" onClick={handleExport}>Download Report</button>
      </div>
      <div className="card">
        <div className="card-title">Recent Scans</div>
        <div className="table">
          <div className="row header">
            <span>Type</span>
            <span>Input</span>
            <span>Label</span>
            <span>Score</span>
          </div>
          {history.map((item) => (
            <div className="row" key={item._id || item.input}>
              <span>{item.type}</span>
              <span className="truncate">{item.input}</span>
              <span className={`pill ${item.result?.label}`}>{item.result?.label}</span>
              <span>{Math.round((item.result?.score || 0) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
