import React, { useState } from 'react';

/**
 * ConsoleTab Component
 * Provides direct Cypher query editor with loadable presets and tabular results.
 */
export default function ConsoleTab({ onExecuteQuery, presets, consoleResults, loading }) {
  const [cypher, setCypher] = useState('MATCH (a:Account) RETURN a LIMIT 5');

  const handlePresetChange = (e) => {
    const val = e.target.value;
    if (val) {
      setCypher(val);
    }
  };

  const handleRun = () => {
    onExecuteQuery(cypher);
  };

  return (
    <div id="tab-console" className="tab-content active">
      <div className="console-box">
        <div className="section-header">
          <h3>Live openCypher Editor</h3>
          <span className="sub-header-label">Read-only demo query executor</span>
        </div>
        <div className="editor-container">
          <textarea 
            id="cypher-editor" 
            spellCheck="false"
            value={cypher}
            onChange={(e) => setCypher(e.target.value)}
          />
        </div>
        <div className="console-controls">
          <div className="query-presets">
            <select className="form-select-sm" onChange={handlePresetChange}>
              <option value="">-- Load Preset Query --</option>
              {presets.map((p, idx) => (
                <option key={idx} value={p.query}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleRun}
            disabled={loading}
          >
            Execute Query
          </button>
        </div>
        
        {/* Tabular Console Results */}
        {consoleResults && (
          <div id="console-output-section" className="console-output-section">
            <div className="section-header">
              <h4>Query Execution Results</h4>
            </div>
            <div className="table-container console-table-container">
              <table>
                <thead>
                  <tr>
                    {consoleResults.columns.map((col, idx) => (
                      <th key={idx}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consoleResults.rows.length === 0 ? (
                    <tr>
                      <td colSpan={consoleResults.columns.length} className="text-center">
                        Query returned 0 rows.
                      </td>
                    </tr>
                  ) : (
                    consoleResults.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {consoleResults.columns.map((col, cIdx) => {
                          const val = row[col];
                          if (val === null || val === undefined) {
                            return (
                              <td key={cIdx}>
                                <span style={{ color: 'var(--text-muted)' }}>null</span>
                              </td>
                            );
                          }
                          if (typeof val === 'object') {
                            if (val.labels) {
                              return (
                                <td key={cIdx}>
                                  <strong>({val.labels[0]})</strong> {val.properties.accountId || val.properties.deviceId || val.properties.ipAddress || val.id}
                                </td>
                              );
                            }
                            if (val.type) {
                              return (
                                <td key={cIdx}>
                                  <strong>[{val.type}]</strong>
                                </td>
                              );
                            }
                            return <td key={cIdx}>{JSON.stringify(val)}</td>;
                          }
                          return <td key={cIdx}>{val.toString()}</td>;
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
