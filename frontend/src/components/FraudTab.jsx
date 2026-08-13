import React from 'react';

/**
 * FraudTab Component
 * Houses the fraud ring, circular loop, and path tracing action controllers.
 */
export default function FraudTab({
  nodes,
  onDetectCircular,
  onDetectShared,
  onTracePath,
  selectedTraceSource,
  setSelectedTraceSource,
  fraudAlerts,
  onClearAlerts,
  onFocusNode
}) {
  const accounts = nodes.filter(n => n.labels.includes('Account'));

  return (
    <div id="tab-fraud-queries" className="tab-content active">
      {/* Interactive Compliance Investigator Guide */}
      <div className="panel-section alert-info-section">
        <div className="alert-info-header">
          <svg className="alert-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <h4>Compliance Investigator Guide</h4>
        </div>
        <p className="alert-info-body">
          Use the detection tools below to analyze transaction relationships. Clicking any node on the graph network map opens its profile inspector.
        </p>
      </div>

      <div className="query-actions-list">
        {/* Action 1: Circular Transfer Loops */}
        <div className="query-action-card">
          <div className="query-action-info">
            <h4>Money Laundering loops (3 Hops)</h4>
            <p>Detect structured circular transfer chains where money flows back to the original source (e.g., A &rarr; B &rarr; C &rarr; A).</p>
          </div>
          <button className="btn btn-primary" onClick={onDetectCircular}>Run Detection</button>
        </div>
        
        {/* Action 2: Shared Identity Fraud Rings */}
        <div className="query-action-card">
          <div className="query-action-info">
            <h4>Shared Entity Fraud Rings</h4>
            <p>Identify accounts that share a Device or IP Address with accounts already flagged for high risk.</p>
          </div>
          <button className="btn btn-primary" onClick={onDetectShared}>Analyze Networks</button>
        </div>
        
        {/* Action 3: Shortest Path to High-Risk */}
        <div className="query-action-card">
          <div className="query-action-info">
            <h4>Trace Connection to High-Risk</h4>
            <p>Find the shortest connection path of transfers, devices, or IPs linking an account to a known high-risk node.</p>
            <div className="input-group">
              <select 
                className="form-select"
                value={selectedTraceSource}
                onChange={(e) => setSelectedTraceSource(e.target.value)}
              >
                <option value="">Select an account to trace...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.properties.accountId}>
                    {acc.properties.accountId} - {acc.properties.ownerName} (Risk: {acc.properties.riskScore.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-accent" onClick={onTracePath}>Trace Connection</button>
        </div>
      </div>
      
      {/* Fraud Results Output Panel */}
      {fraudAlerts && (
        <div id="fraud-results-section" className="panel-section">
          <div className="section-header">
            <h3>{fraudAlerts.title}</h3>
            <button className="btn-text" onClick={onClearAlerts}>Clear</button>
          </div>
          <div className="fraud-results-container">
            {fraudAlerts.type === 'empty' && (
              <p className="placeholder-text">{fraudAlerts.message}</p>
            )}

            {fraudAlerts.type === 'circular' && fraudAlerts.cycles.map((c, i) => {
              const pathStr = c.accounts.map(a => a.properties.accountId).join(' → ') + ' → ' + c.accounts[0].properties.accountId;
              const totalAmount = c.transfers.reduce((sum, t) => sum + t.properties.amount, 0);
              
              return (
                <div key={i} className="fraud-alert-item">
                  <div className="fraud-alert-title">Loop #{i + 1}: {pathStr}</div>
                  <div className="fraud-alert-details">
                    Transfers: {c.transfers.map(t => `$${t.properties.amount.toLocaleString()}`).join(', ')}<br />
                    Total structured volume: ${totalAmount.toLocaleString()}
                  </div>
                  <button className="fraud-alert-btn" onClick={() => onFocusNode(c.accounts[0].id)}>
                    Focus on Loop
                  </button>
                </div>
              );
            })}

            {fraudAlerts.type === 'shared' && fraudAlerts.rings.map((ring, i) => (
              <div key={i} className="fraud-alert-item" style={{ borderLeftColor: '#3b82f6' }}>
                <div className="fraud-alert-title" style={{ color: '#60a5fa' }}>
                  Shared {ring.type}: {ring.value}
                </div>
                <div className="fraud-alert-details" style={{ marginTop: '4px' }}>
                  <strong>Linked Accounts:</strong><br />
                  {ring.accounts.map(a => (
                    <span key={a.id} style={{ display: 'block' }}>
                      {a.properties.accountId} ({a.properties.ownerName}, Risk: {a.properties.riskScore.toFixed(2)})
                    </span>
                  ))}
                </div>
                <button className="fraud-alert-btn" onClick={() => onFocusNode(ring.id)}>
                  Highlight Cluster
                </button>
              </div>
            ))}

            {fraudAlerts.type === 'path' && (
              <div className="fraud-alert-item" style={{ borderLeftColor: 'var(--color-accent)' }}>
                {fraudAlerts.found ? (
                  <>
                    <div className="fraud-alert-title" style={{ color: '#f59e0b' }}>Target High-Risk Account Found!</div>
                    <div className="fraud-alert-details" style={{ marginTop: '6px' }}>
                      {fraudAlerts.steps.map((step, idx) => (
                        <div key={idx} style={{ fontSize: '0.75rem', marginBottom: '6px', display: 'flex', gap: '8px' }}>
                          <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>[Step {idx + 1}]</span>
                          <span><strong>{step.from}</strong> {step.description} <strong>{step.to}</strong></span>
                        </div>
                      ))}
                      <div style={{ marginTop: '8px', fontWeight: 700, color: '#b91c1c' }}>
                        Target Account: {fraudAlerts.targetAccount.id} ({fraudAlerts.targetAccount.name}, Risk: {fraudAlerts.targetAccount.risk})
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="placeholder-text">{fraudAlerts.message}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
