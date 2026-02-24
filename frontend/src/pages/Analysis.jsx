import React, { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts'
import StatCard from '../components/StatCard.jsx'
import { getAnalysisMetrics } from '../api.js'

function pct(value) {
  if (typeof value !== 'number') return 'N/A'
  return `${(value * 100).toFixed(2)}%`
}

function num(value) {
  if (typeof value !== 'number') return 'N/A'
  return value.toFixed(4)
}

export default function Analysis() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getAnalysisMetrics()
      .then((json) => {
        if (cancelled) return
        if (json?.error) {
          setError(json.error)
          setData(null)
          return
        }
        setData(json)
        setError('')
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load analysis metrics.')
        setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const urlChart = useMemo(() => {
    const rows = data?.url_models || []
    return rows.map((r) => ({
      model: (r.model || '').replace(/^url_/, ''),
      accuracy: typeof r.accuracy === 'number' ? Math.round(r.accuracy * 10000) / 100 : null,
      loss: r.loss
    }))
  }, [data])

  const emailChart = useMemo(() => {
    const rows = data?.email_models || []
    return rows.map((r) => ({
      model: (r.model || '').replace(/^email_/, ''),
      accuracy: typeof r.accuracy === 'number' ? Math.round(r.accuracy * 10000) / 100 : null,
      loss: r.loss
    }))
  }, [data])

  const aux = useMemo(() => {
    const rows = data?.aux_models || []
    const find = (prefix) => rows.find((r) => (r.model || '').startsWith(prefix))
    return {
      ocr: find('ocr_') || null,
      file: find('file_') || null
    }
  }, [data])

  const vision = useMemo(() => {
    const rows = data?.image_models || []
    return rows[0] || null
  }, [data])

  const bestUrl = data?.best?.url_by_accuracy
  const bestEmail = data?.best?.email_by_accuracy

  return (
    <div className="stack">
      <div className="section-head">
        <div>
          <div className="section-title">Model Analysis</div>
          <div className="section-sub">Notebook-style validation charts for URL and Email models.</div>
        </div>
        <div className="section-actions">
          <button className="ghost" onClick={() => window.location.reload()}>Refresh</button>
        </div>
      </div>

      {error && (
        <div className="card">
          <div className="card-title">Metrics Unavailable</div>
          <div className="card-sub">{error}</div>
          <div className="card-sub">
            Ensure you have run <span className="mono">python backend/scripts/train_models.py</span> and the API is
            using <span className="mono">backend/models</span> as its model directory.
          </div>
        </div>
      )}

      {!error && !data && (
        <div className="card">
          <div className="card-title">Loading</div>
          <div className="card-sub">Fetching metrics from the backend...</div>
        </div>
      )}

      {!error && data && (
        <>
          <section className="grid stats">
            <StatCard
              title="Best URL Model"
              value={bestUrl?.model ? bestUrl.model.replace(/^url_/, '') : 'N/A'}
              trend={bestUrl?.accuracy != null ? `Accuracy ${pct(bestUrl.accuracy)}` : 'No data'}
            />
            <StatCard
              title="Best Email Model"
              value={bestEmail?.model ? bestEmail.model.replace(/^email_/, '') : 'N/A'}
              trend={bestEmail?.accuracy != null ? `Accuracy ${pct(bestEmail.accuracy)}` : 'No data'}
            />
            <StatCard
              title="Image Vision Model"
              value={vision?.model ? vision.model.replace(/^image_/, '') : 'N/A'}
              trend={vision?.accuracy != null ? `Accuracy ${pct(vision.accuracy)} | Loss ${num(vision.loss)}` : 'No data'}
            />
            <StatCard
              title="OCR Text Model"
              value={aux.ocr?.model ? aux.ocr.model.replace(/^ocr_/, '') : 'N/A'}
              trend={aux.ocr?.accuracy != null ? `Accuracy ${pct(aux.ocr.accuracy)} | Loss ${num(aux.ocr.loss)}` : 'No data'}
            />
            <StatCard
              title="File Model"
              value={aux.file?.model ? aux.file.model.replace(/^file_/, '') : 'N/A'}
              trend={aux.file?.accuracy != null ? `Accuracy ${pct(aux.file.accuracy)} | Loss ${num(aux.file.loss)}` : 'No data'}
            />
          </section>

          <section className="grid wide">
            <div className="card chart">
              <div className="card-title">URL Models - Accuracy</div>
              <div className="card-sub">Benchmark accuracy across URL classifiers.</div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={urlChart} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="model" stroke="#8a8fa3" angle={-18} textAnchor="end" height={60} />
                    <YAxis stroke="#8a8fa3" domain={[0, 100]} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ background: 'rgba(18, 20, 34, 0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}
                      labelStyle={{ color: '#eef1ff' }}
                    />
                    <Legend />
                    <Bar dataKey="accuracy" name="Accuracy (%)" fill="#ff3b8d" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card chart">
              <div className="card-title">URL Models - Log Loss</div>
              <div className="card-sub">Lower is better.</div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={urlChart} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="model" stroke="#8a8fa3" angle={-18} textAnchor="end" height={60} />
                    <YAxis stroke="#8a8fa3" />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ background: 'rgba(18, 20, 34, 0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}
                      labelStyle={{ color: '#eef1ff' }}
                    />
                    <Legend />
                    <Bar dataKey="loss" name="Log Loss" fill="#38f5d1" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="grid wide">
            <div className="card chart">
              <div className="card-title">Email Models - Accuracy</div>
              <div className="card-sub">Benchmark accuracy across text classifiers.</div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={emailChart} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="model" stroke="#8a8fa3" angle={-18} textAnchor="end" height={60} />
                    <YAxis stroke="#8a8fa3" domain={[0, 100]} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ background: 'rgba(18, 20, 34, 0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}
                      labelStyle={{ color: '#eef1ff' }}
                    />
                    <Legend />
                    <Bar dataKey="accuracy" name="Accuracy (%)" fill="#ffb800" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card chart">
              <div className="card-title">Email Models - Log Loss</div>
              <div className="card-sub">Lower is better.</div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={emailChart} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="model" stroke="#8a8fa3" angle={-18} textAnchor="end" height={60} />
                    <YAxis stroke="#8a8fa3" />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ background: 'rgba(18, 20, 34, 0.96)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}
                      labelStyle={{ color: '#eef1ff' }}
                    />
                    <Legend />
                    <Bar dataKey="loss" name="Log Loss" fill="#8cc8ff" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
