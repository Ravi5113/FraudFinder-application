import React from 'react';

/**
 * Header Component
 * Renders brand title, connection status LED, and reseed trigger.
 */
export default function Header({ dbStatus, onReseed }) {
  const getStatusText = () => {
    if (dbStatus === 'connected') return 'Connected to CognoDB';
    if (dbStatus === 'disconnected') return 'CognoDB Unreachable';
    return 'Checking Database...';
  };

  return (
    <header className="app-header">
      <div className="brand">
        <svg className="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <div className="brand-text">
          <h1>FraudFinder</h1>
          <span className="sub-brand">CognoDB Graph Analytics</span>
        </div>
      </div>
      
      <div className="status-bar">
        <div id="db-status-badge" className={`status-badge ${dbStatus}`}>
          <span className="status-dot"></span>
          <span id="db-status-text">{getStatusText()}</span>
        </div>
        <button 
          id="reseed-btn" 
          className="btn btn-secondary" 
          disabled={dbStatus !== 'connected'}
          onClick={onReseed}
        >
          <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          Reseed Database
        </button>
      </div>
    </header>
  );
}
