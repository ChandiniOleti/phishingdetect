import React from 'react'
import { useNavigate } from 'react-router-dom'

const features = [
  {
    title: 'URL Sentinel',
    desc: 'Scan suspicious links and get an explainable SAFE/UNSAFE verdict.',
    to: '/scan/url'
  },
  {
    title: 'Email Scanner',
    desc: 'Paste email/SMS text and detect social engineering patterns.',
    to: '/scan/email'
  },
  {
    title: 'Image OCR',
    desc: 'Upload screenshots; OCR text is analyzed for phishing intent.',
    to: '/scan/image'
  },
  {
    title: 'File Sandbox',
    desc: 'Analyze attachments using metadata + a learned risk model.',
    to: '/scan/file'
  },
  {
    title: 'Threat Reports',
    desc: 'Export and review recent scans with labels and confidence.',
    to: '/reports'
  },
  {
    title: 'Model Analysis',
    desc: 'Notebook-style validation graphs for accuracy and log loss.',
    to: '/analysis'
  }
]

export default function About() {
  const navigate = useNavigate()

  return (
    <div className="stack about-page">
      <div className="section-head">
        <div>
          <div className="section-title">About PhishGuard AI</div>
          <div className="section-sub">
            This project combines an ML pipeline, a Flask scoring API, a React dashboard, and a Chrome extension for
            real-time warnings.
          </div>
        </div>
        <div className="section-actions">
          <button className="ghost" onClick={() => navigate('/dashboard')}>Open Dashboard</button>
          <button className="primary" onClick={() => navigate('/scan/url')}>Start Scanning</button>
        </div>
      </div>

      <div className="card about-card">
        <div className="card-title">Key Features</div>
        <div className="card-sub">Click a feature to open it.</div>

        <div className="feature-grid">
          {features.map((f) => (
            <button key={f.to} className="feature-card" onClick={() => navigate(f.to)}>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
              <div className="feature-link">Open</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card about-card">
        <div className="card-title">Architecture</div>
        <div className="card-sub">How the parts connect.</div>
        <div className="about-bullets">
          <div className="about-bullet">
            <div className="about-bullet-k">Backend</div>
            <div className="about-bullet-v">Flask API on <span className="mono">http://localhost:5000</span></div>
          </div>
          <div className="about-bullet">
            <div className="about-bullet-k">Frontend</div>
            <div className="about-bullet-v">React + Vite on <span className="mono">http://localhost:5174</span></div>
          </div>
          <div className="about-bullet">
            <div className="about-bullet-k">Extension</div>
            <div className="about-bullet-v">MV3 worker monitors tab URLs and displays warnings.</div>
          </div>
          <div className="about-bullet">
            <div className="about-bullet-k">Models</div>
            <div className="about-bullet-v"><span className="mono">backend/models</span> contains joblib artifacts + benchmark CSVs.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
