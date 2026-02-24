import React, { useState } from 'react'

export default function ScanForm({ label, placeholder, onSubmit }) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!value.trim()) return
    setLoading(true)
    await onSubmit(value)
    setLoading(false)
  }

  return (
    <form className="card scan scan-large" onSubmit={handleSubmit}>
      <label className="scan-label">{label}</label>
      <input
        className="scan-input scan-input-large"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
      />
      <button className="primary" type="submit">{loading ? 'Analyzing...' : 'Scan Now'}</button>
    </form>
  )
}
