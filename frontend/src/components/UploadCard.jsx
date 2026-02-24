import React, { useState } from 'react'

export default function UploadCard({ label, onUpload }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!file) return
    setLoading(true)
    await onUpload(file)
    setLoading(false)
  }

  return (
    <form className="card scan scan-large" onSubmit={handleSubmit}>
      <label className="scan-label">{label}</label>
      <input className="scan-input scan-input-large" type="file" onChange={(event) => setFile(event.target.files[0])} />
      <button className="primary" type="submit">{loading ? 'Analyzing...' : 'Upload & Scan'}</button>
    </form>
  )
}
