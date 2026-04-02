import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()
  const token = localStorage.getItem('phishguard_token')

  return (
    <div className="landing">
      <header className="landing-hero">
        <div className="landing-hero-text">
          <div className="landing-kicker">Real-time phishing defense for web, email, images, and files</div>
          <h1 className="landing-title">
            PhishGuard AI
            <span className="landing-title-accent"> Detect. Explain. Block.</span>
          </h1>
          <p className="landing-lede">
            A full-stack phishing detection platform with an ML pipeline, a live dashboard, and a Chrome extension that
            warns on suspicious pages.
          </p>

          <div className="landing-cta">
            {!token ? (
              <>
                <button className="primary" onClick={() => navigate('/login')}>Get Started</button>
                <Link className="ghost-link" to="/login">Login or Sign up</Link>
              </>
            ) : (
              <>
                <button className="primary" onClick={() => navigate('/about')}>Open About</button>
                <Link className="ghost-link" to="/dashboard">Go to Dashboard</Link>
              </>
            )}
          </div>
        </div>

        <div className="landing-hero-panel">
          <div className="landing-panel-card">
            <div className="landing-panel-title">What you can scan</div>
            <div className="landing-panel-grid">
              <div className="landing-chip">URLs</div>
              <div className="landing-chip">Emails</div>
              <div className="landing-chip">Images (OCR)</div>
              <div className="landing-chip">Files</div>
              <div className="landing-chip">Reports</div>
              <div className="landing-chip">Model Analysis</div>
            </div>
            <div className="landing-panel-sub">
              Built with Flask + React + Recharts + Chrome MV3 extension.
            </div>
          </div>
        </div>
      </header>

      <section className="landing-section">
        <div className="landing-section-head">
          <div className="section-title">How It Works</div>
          <div className="section-sub">ML features + models, served as an API, visualized in a dashboard.</div>
        </div>

        <div className="landing-steps">
          <div className="landing-step">
            <div className="landing-step-num">01</div>
            <div className="landing-step-title">Extract</div>
            <div className="landing-step-sub">URL patterns, text signals, OCR text from images, and file metadata.</div>
          </div>
          <div className="landing-step">
            <div className="landing-step-num">02</div>
            <div className="landing-step-title">Score</div>
            <div className="landing-step-sub">Hybrid decisioning: ML probability plus strong heuristics for lookalikes.</div>
          </div>
          <div className="landing-step">
            <div className="landing-step-num">03</div>
            <div className="landing-step-title">Explain</div>
            <div className="landing-step-sub">Reasons are returned so users understand what triggered the verdict.</div>
          </div>
          <div className="landing-step">
            <div className="landing-step-num">04</div>
            <div className="landing-step-title">Protect</div>
            <div className="landing-step-sub">The extension can warn (and optionally block) phishing pages.</div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-head">
          <div className="section-title">Get Started</div>
          <div className="section-sub">Sign in, then explore the About page to jump into each feature.</div>
        </div>
        <div className="landing-cta wide">
          <button className="primary" onClick={() => navigate('/login')}>Login / Sign up</button>
          <a className="ghost-link" href="/extension.zip" download="extension.zip">Load Extension</a>
        </div>
      </section>
    </div>
  )
}

