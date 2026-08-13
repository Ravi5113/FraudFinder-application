import React from 'react';

/**
 * DashboardTab Component
 * Displays summary cards and accounts table inventory with local search.
 */
export default function DashboardTab({ nodes, onSelectAccount, searchQuery, setSearchQuery }) {
  const accounts = nodes.filter(n => n.labels.includes('Account'));
  const devicesCount = nodes.filter(n => n.labels.includes('Device')).length;
  const ipsCount = nodes.filter(n => n.labels.includes('IPAddress')).length;

  const filteredAccounts = accounts.filter(acc => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      acc.properties.accountId.toLowerCase().includes(query) ||
      acc.properties.ownerName.toLowerCase().includes(query)
    );
  });

  const getRiskBadgeClass = (score) => {
    if (score >= 0.8) return 'badge-danger';
    if (score >= 0.3) return 'badge-warning';
    return 'badge-success';
  };

  return (
    <div id="tab-dashboard" className="tab-content active">
      {/* Stats Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Accounts</span>
          <span className="stat-value">{accounts.length || '-'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Shared Devices</span>
          <span className="stat-value">{devicesCount || '-'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">IP Locations</span>
          <span className="stat-value">{ipsCount || '-'}</span>
        </div>
      </div>
      
      {/* Accounts List Container */}
      <div className="panel-section">
        <div className="section-header">
          <h3>Accounts Inventory</h3>
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Account ID</th>
                <th>Owner Name</th>
                <th>Balance</th>
                <th>Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center">
                    {accounts.length === 0 ? 'No accounts loaded. Reseed database.' : 'No matching accounts found.'}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acc => (
                  <tr 
                    key={acc.id} 
                    className="account-row" 
                    onClick={() => onSelectAccount(acc)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><strong className="text-indigo font-mono">{acc.properties.accountId}</strong></td>
                    <td>{acc.properties.ownerName}</td>
                    <td>${acc.properties.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`badge ${getRiskBadgeClass(acc.properties.riskScore)}`}>
                        {acc.properties.riskScore.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
