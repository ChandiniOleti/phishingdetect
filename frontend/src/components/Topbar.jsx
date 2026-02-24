import React from 'react'

export default function Topbar() {
  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">Threat Intelligence Dashboard</div>
        <div className="topbar-sub">Live monitoring, AI scoring, and instant alerts.</div>
      </div>
      <div className="topbar-actions">
        <button className="ghost">Run System Check</button>
        <button className="primary">Deploy Shield</button>
      </div>
    </header>
  )
}
