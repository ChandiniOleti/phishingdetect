import React, { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../components/StatCard.jsx'
import { getStats, getHistory } from '../api.js'

export default function Dashboard() {
  const [stats, setStats] = useState({ total_scans: 0, phishing_detected: 0, safe: 0, model_status: 'rules' })
  const [history, setHistory] = useState([])

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
    getHistory().then(setHistory).catch(() => {})
  }, [])

  const chartData = history.slice(0, 12).reverse().map((item, idx) => ({
    name: `#${idx + 1}`,
    risk: Math.round((item.result?.score || 0) * 100)
  }))

  return (
    <div className="stack">
      <div className="section-head">
        <div>
          <div className="section-title">Command Center</div>
          <div className="section-sub">Real-time visibility into phishing activity and model confidence.</div>
        </div>
        <div className="section-actions">
          <button className="ghost">Refresh</button>
          <button className="primary">Run Sweep</button>
        </div>
      </div>
      <section className="grid stats">
        <StatCard title="Total Scans" value={stats.total_scans} trend="+12% this week" />
        <StatCard title="Threats Blocked" value={stats.phishing_detected} trend="Active response" />
        <StatCard title="Clean Items" value={stats.safe} trend="Safe traffic" />
        <StatCard title="Model" value={stats.model_status.toUpperCase()} trend="Adaptive" />
      </section>

      <section className="grid wide">
        <div className="card chart">
          <div className="card-title">Risk Pulse</div>
          <div className="card-sub">Latest scans confidence distribution</div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="risk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff3b8d" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#ffb800" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#8a8fa3" />
                <YAxis stroke="#8a8fa3" />
                <Tooltip />
                <Area type="monotone" dataKey="risk" stroke="#ff3b8d" fill="url(#risk)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card alerts">
          <div className="card-title">Live Alerts</div>
          <div className="alert-list">
            {history.slice(0, 6).map((item) => (
              <div key={item._id || item.input} className="alert-item">
                <div>
                  <div className="alert-title">{item.type.toUpperCase()} Scan</div>
                  <div className="alert-sub">{item.input}</div>
                </div>
                <span className={`pill ${item.result?.label}`}>{item.result?.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
