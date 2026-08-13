import React from 'react';

/**
 * Inspector Component
 * Renders the sliding drawer showing node/edge properties and account action triggers.
 */
export default function Inspector({ selectedElement, onClose, onTracePathFromInspector, rawNodes }) {
  if (!selectedElement) {
    return (
      <footer id="inspector-panel" className="inspector-panel collapsed">
        <div className="inspector-header">
          <div className="inspector-title-container">
            <svg className="inspector-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <h3 id="inspector-title">Select an entity to inspect</h3>
          </div>
        </div>
      </footer>
    );
  }

  const { type, data } = selectedElement;

  const renderNodeDetails = () => {
    const label = data.labels[0] || 'Entity';
    
    if (label === 'Account') {
      return (
        <>
          <div className="inspector-detail-item">
            <span className="detail-label">Owner Name</span>
            <span className="detail-val">{data.properties.ownerName}</span>
          </div>
          <div className="inspector-detail-item">
            <span className="detail-label">Email Address</span>
            <span className="detail-val">{data.properties.email}</span>
          </div>
          <div className="inspector-detail-item">
            <span className="detail-label">Balance</span>
            <span className="detail-val font-mono">${data.properties.balance.toLocaleString()}</span>
          </div>
          <div className="inspector-detail-item">
            <span className="detail-label">Fraud Risk Score</span>
            <span className="detail-val font-mono text-danger">{data.properties.riskScore.toFixed(4)}</span>
          </div>
          <div className="inspector-detail-item">
            <span className="detail-label">Created At</span>
            <span className="detail-val">{data.properties.createdAt}</span>
          </div>
          <div className="inspector-detail-item" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px dashed rgba(0,0,0,0.06)', paddingTop: '10px', marginTop: '4px' }}>
            <button 
              className="btn btn-accent" 
              style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
              onClick={() => onTracePathFromInspector(data.properties.accountId)}
            >
              🔍 Trace Path to High Risk
            </button>
          </div>
        </>
      );
    }

    if (label === 'Device') {
      return (
        <>
          <div className="inspector-detail-item">
            <span className="detail-label">Device Type</span>
            <span className="detail-val">{data.properties.deviceType}</span>
          </div>
          <div className="inspector-detail-item">
            <span className="detail-label">Operating System</span>
            <span className="detail-val">{data.properties.os}</span>
          </div>
          <div className="inspector-detail-item">
            <span className="detail-label">System Node ID</span>
            <span className="detail-val font-mono">{data.id}</span>
          </div>
        </>
      );
    }

    if (label === 'IPAddress') {
      return (
        <>
          <div className="inspector-detail-item">
            <span className="detail-label">IP Address</span>
            <span className="detail-val font-mono">{data.properties.ipAddress}</span>
          </div>
          <div className="inspector-detail-item">
            <span className="detail-label">Geolocation</span>
            <span className="detail-val">{data.properties.location}</span>
          </div>
          <div className="inspector-detail-item">
            <span className="detail-label">System Node ID</span>
            <span className="detail-val font-mono">{data.id}</span>
          </div>
        </>
      );
    }

    return null;
  };

  const renderEdgeDetails = () => {
    // Find node names for display
    const fromNode = rawNodes.find(n => n.id === data.from);
    const toNode = rawNodes.find(n => n.id === data.to);
    
    const fromName = fromNode ? (fromNode.properties.accountId || fromNode.properties.deviceId || fromNode.properties.ipAddress) : 'Unknown';
    const toName = toNode ? (toNode.properties.accountId || toNode.properties.deviceId || toNode.properties.ipAddress) : 'Unknown';

    return (
      <>
        <div className="inspector-detail-item">
          <span className="detail-label">Source Node</span>
          <span className="detail-val text-indigo">{fromName}</span>
        </div>
        <div className="inspector-detail-item">
          <span className="detail-label">Target Node</span>
          <span className="detail-val text-indigo">{toName}</span>
        </div>
        {data.type === 'TRANSFERRED' ? (
          <>
            <div className="inspector-detail-item">
              <span className="detail-label">Transaction ID</span>
              <span className="detail-val font-mono">{data.properties.transactionId}</span>
            </div>
            <div className="inspector-detail-item">
              <span className="detail-label">Transfer Amount</span>
              <span className="detail-val text-danger font-mono">${data.properties.amount.toLocaleString()}</span>
            </div>
            <div className="inspector-detail-item">
              <span className="detail-label">Timestamp</span>
              <span className="detail-val">{data.properties.timestamp}</span>
            </div>
          </>
        ) : (
          <div className="inspector-detail-item">
            <span className="detail-label">Last Logged Connection</span>
            <span className="detail-val">{data.properties.lastUsed}</span>
          </div>
        )}
      </>
    );
  };

  const getTitleText = () => {
    if (type === 'node') {
      const label = data.labels[0] || 'Entity';
      return `${label} Details: ${data.properties.accountId || data.properties.deviceId || data.properties.ipAddress}`;
    }
    return `Relationship: ${data.type}`;
  };

  return (
    <footer id="inspector-panel" className="inspector-panel">
      <div className="inspector-header">
        <div className="inspector-title-container">
          <svg className="inspector-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <h3 id="inspector-title">{getTitleText()}</h3>
        </div>
        <button id="close-inspector-btn" className="btn-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className="inspector-content">
        <div id="inspector-details-grid" className="inspector-details-grid">
          {type === 'node' ? renderNodeDetails() : renderEdgeDetails()}
        </div>
      </div>
    </footer>
  );
}
