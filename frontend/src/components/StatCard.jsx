import React from 'react'

export default function StatCard({ title, value, trend }) {
  return (
    <div className="card stat">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-trend">{trend}</div>
    </div>
  )
}
