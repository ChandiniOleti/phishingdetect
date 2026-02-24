import React from 'react'

export default function Admin() {
  return (
    <div className="stack">
      <div className="section-head">
        <div>
          <div className="section-title">Admin Console</div>
          <div className="section-sub">Manage users, policies, response playbooks, and model lifecycle.</div>
        </div>
        <div className="section-actions">
          <button className="ghost">Audit Log</button>
          <button className="primary">New Policy</button>
        </div>
      </div>
      <div className="card">
        <div className="grid admin">
          <div className="admin-card">
            <h4>User Control</h4>
            <p>Invite users, assign roles, and enforce access boundaries.</p>
            <div className="admin-actions">
              <button className="ghost">Manage Users</button>
              <button className="primary">Invite</button>
            </div>
          </div>
          <div className="admin-card">
            <h4>Policy Engine</h4>
            <p>Define block rules, thresholds, and escalation workflows.</p>
            <div className="admin-actions">
              <button className="ghost">Edit Policies</button>
              <button className="primary">Publish</button>
            </div>
          </div>
          <div className="admin-card">
            <h4>Model Ops</h4>
            <p>Deploy models, monitor drift, and trigger retraining.</p>
            <div className="admin-actions">
              <button className="ghost">Model Center</button>
              <button className="primary">Deploy</button>
            </div>
          </div>
        </div>
      </div>
      <div className="card split">
        <div>
          <div className="card-title">Active Policies</div>
          <ul className="list">
            <li>Block non-HTTPS login forms</li>
            <li>Quarantine attachments over 8 MB</li>
            <li>Require MFA for high-risk domains</li>
          </ul>
        </div>
        <div>
          <div className="card-title">Response Playbooks</div>
          <ul className="list">
            <li>Auto-notify SOC for phishing score &gt; 0.8</li>
            <li>Block URL after 3 detections</li>
            <li>Escalate to admin on repeat offender</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
