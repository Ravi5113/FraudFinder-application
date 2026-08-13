import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import DashboardTab from './components/DashboardTab';
import FraudTab from './components/FraudTab';
import ConsoleTab from './components/ConsoleTab';
import GraphCanvas from './components/GraphCanvas';
import Inspector from './components/Inspector';

// Console Preset Queries
const CYPHER_PRESETS = [
  { label: 'Get Top 5 Riskiest Accounts', query: 'MATCH (n:Account) RETURN n ORDER BY n.riskScore DESC LIMIT 5' },
  { label: 'Show Recent Transfers', query: 'MATCH (a:Account)-[r:TRANSFERRED]->(b:Account) RETURN a, r, b LIMIT 10' },
  { label: 'Show Devices Logins', query: 'MATCH (d:Device)<-[:USED_DEVICE]-(a:Account) RETURN d, a' },
  { label: 'Show IP Logins', query: 'MATCH (i:IPAddress)<-[:USED_IP]-(a:Account) RETURN i, a' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dbStatus, setDbStatus] = useState('connecting');
  
  // Data state
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  // Inputs/Outputs state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTraceSource, setSelectedTraceSource] = useState('');
  const [fraudAlerts, setFraudAlerts] = useState(null);
  const [consoleResults, setConsoleResults] = useState(null);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [selectedElement, setSelectedElement] = useState(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState(null);
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState(null);

  // Vis.js Network instance reference
  const visNetworkRef = useRef(null);

  // 1. Connection Status Healthcheck
  const checkDatabaseStatus = async () => {
    setDbStatus('connecting');
    try {
      const res = await fetch('/api/db-status');
      const data = await res.json();
      if (data.status === 'connected') {
        setDbStatus('connected');
        loadFullNetwork();
      } else {
        setDbStatus('disconnected');
        alert(`CognoDB Connection Alert: ${data.error}`);
      }
    } catch (error) {
      setDbStatus('disconnected');
      alert('Could not connect to backend server. Make sure node server.js is running.');
    }
  };

  // 2. Fetch Full Network Graph
  const loadFullNetwork = async () => {
    setLoading(true);
    setLoadingText('Fetching Network Graph...');
    try {
      const res = await fetch('/api/network');
      const data = await res.json();
      if (data.success !== false) {
        setNodes(data.nodes);
        setEdges(data.edges);
      } else {
        alert(`Failed to load network: ${data.error}`);
      }
    } catch (error) {
      alert(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. Database Seeding Trigger
  const handleReseed = async () => {
    if (!confirm('Are you sure you want to reseed the database? This will clear all existing graph nodes and load mock transaction data.')) {
      return;
    }
    setLoading(true);
    setLoadingText('Clearing and Reseeding Database...');
    setSelectedElement(null);
    clearHighlights();
    
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Database successfully seeded!');
        loadFullNetwork();
      } else {
        alert(`Seeding failed: ${data.error}`);
      }
    } catch (error) {
      alert(`Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 4. Detect Circular Loops (Money Laundering)
  const handleDetectCircular = async () => {
    setLoading(true);
    setLoadingText('Searching for Money Laundering Loops...');
    setSelectedElement(null);
    
    try {
      const res = await fetch('/api/fraud/circular');
      const data = await res.json();
      
      if (!data.success) {
        alert(`Circular loop detection failed: ${data.error}`);
        return;
      }
      
      const cycles = data.cycles;
      if (cycles.length === 0) {
        setFraudAlerts({
          type: 'empty',
          title: 'Detected Loops',
          message: 'No circular loops of length 3 found in active network.'
        });
        setHighlightedNodeIds(null);
        setHighlightedEdgeIds(null);
        return;
      }
      
      const nodeIds = new Set();
      const edgeIds = new Set();
      
      cycles.forEach(c => {
        c.accounts.forEach(a => nodeIds.add(a.id));
        c.transfers.forEach(t => edgeIds.add(t.id));
      });
      
      edgeIds.type = 'circular';
      setHighlightedNodeIds(nodeIds);
      setHighlightedEdgeIds(edgeIds);
      
      setFraudAlerts({
        type: 'circular',
        title: 'Detected Money Loops',
        cycles: cycles
      });
      
    } catch (error) {
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 5. Detect Shared Entities (Fraud Rings)
  const handleDetectShared = async () => {
    setLoading(true);
    setLoadingText('Tracing Shared Identity Fraud Rings...');
    setSelectedElement(null);
    
    try {
      const res = await fetch('/api/fraud/shared-entities');
      const data = await res.json();
      
      if (!data.success) {
        alert(`Shared entities trace failed: ${data.error}`);
        return;
      }
      
      if (data.nodes.length === 0) {
        setFraudAlerts({
          type: 'empty',
          title: 'Flagged Fraud Rings',
          message: 'No shared entities with high-risk nodes found.'
        });
        setHighlightedNodeIds(null);
        setHighlightedEdgeIds(null);
        return;
      }
      
      const nodeIds = new Set(data.nodes.map(n => n.id));
      const edgeIds = new Set(data.edges.map(e => e.id));
      edgeIds.type = 'shared';
      
      setHighlightedNodeIds(nodeIds);
      setHighlightedEdgeIds(edgeIds);
      
      // Group suspect accounts by the shared entity
      const sharedEntities = data.nodes.filter(n => !n.labels.includes('Account'));
      const suspectAccounts = data.nodes.filter(n => n.labels.includes('Account'));
      
      const rings = sharedEntities.map(ent => {
        const type = ent.labels[0] === 'Device' ? 'Device' : 'IP Address';
        const value = ent.properties.deviceId || ent.properties.ipAddress;
        
        const linkedAccounts = data.edges
          .filter(e => e.to === ent.id || e.from === ent.id)
          .map(e => {
            const accId = e.from === ent.id ? e.to : e.from;
            return suspectAccounts.find(n => n.id === accId);
          })
          .filter(Boolean);
          
        return {
          id: ent.id,
          type,
          value,
          accounts: linkedAccounts
        };
      });
      
      setFraudAlerts({
        type: 'shared',
        title: 'Flagged Shared Entities',
        rings: rings
      });
      
    } catch (error) {
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 6. Trace Shortest Connection Path
  const handleTracePath = async (overrideAccountId = null) => {
    const accountId = overrideAccountId || selectedTraceSource;
    if (!accountId) {
      alert('Please select a starting account to trace connection path.');
      return;
    }
    
    setLoading(true);
    setLoadingText(`Tracing Path from ${accountId}...`);
    setSelectedElement(null);
    
    try {
      const res = await fetch(`/api/fraud/trace-path?accountId=${accountId}`);
      const data = await res.json();
      
      if (!data.success) {
        alert(`Tracer failed: ${data.error}`);
        return;
      }
      
      if (!data.found) {
        setFraudAlerts({
          type: 'path',
          title: 'Path Tracer Results',
          found: false,
          message: `No connection path to high-risk accounts found within 5 hops.`
        });
        setHighlightedNodeIds(null);
        setHighlightedEdgeIds(null);
        return;
      }
      
      const nodeIds = new Set(data.nodes.map(n => n.id));
      const edgeIds = new Set(data.edges.map(e => e.id));
      edgeIds.type = 'path';
      
      setHighlightedNodeIds(nodeIds);
      setHighlightedEdgeIds(edgeIds);
      
      // Trace steps sequentially starting from the source account node
      let currentId = data.nodes.find(n => n.properties.accountId === accountId).id;
      const steps = [];
      const visitedNodes = new Set([currentId]);
      
      while (visitedNodes.size < data.nodes.length) {
        const nextEdge = data.edges.find(e => 
          (e.from === currentId && !visitedNodes.has(e.to)) || 
          (e.to === currentId && !visitedNodes.has(e.from))
        );
        if (!nextEdge) break;
        
        const nextNodeId = nextEdge.from === currentId ? nextEdge.to : nextEdge.from;
        const nextNode = data.nodes.find(n => n.id === nextNodeId);
        const currentNode = data.nodes.find(n => n.id === currentId);
        
        const curName = currentNode.properties.accountId || currentNode.properties.deviceId || currentNode.properties.ipAddress;
        const nextName = nextNode.properties.accountId || nextNode.properties.deviceId || nextNode.properties.ipAddress;
        
        let description = '';
        if (nextEdge.type === 'TRANSFERRED') {
          description = `transferred $${nextEdge.properties.amount.toLocaleString()} to`;
        } else if (nextEdge.type === 'USED_DEVICE') {
          description = `shared device with`;
        } else if (nextEdge.type === 'USED_IP') {
          description = `shared IP link with`;
        }
        
        steps.push({ from: curName, to: nextName, description });
        currentId = nextNodeId;
        visitedNodes.add(nextNodeId);
      }
      
      const targetNode = data.nodes.find(n => n.id === currentId);
      
      setFraudAlerts({
        type: 'path',
        title: 'Path to High Risk',
        found: true,
        steps: steps,
        targetAccount: {
          id: targetNode.properties.accountId,
          name: targetNode.properties.ownerName,
          risk: targetNode.properties.riskScore
        }
      });
      
    } catch (error) {
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 7. Custom Cypher Query Execution
  const handleExecuteQuery = async (cypherText) => {
    setLoading(true);
    setLoadingText('Running Custom Cypher Query...');
    setSelectedElement(null);
    setConsoleResults(null);
    
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cypher: cypherText })
      });
      const data = await res.json();
      
      if (!data.success) {
        alert(`Cypher Error: ${data.error}`);
        return;
      }
      
      setConsoleResults({ columns: data.columns, rows: data.rows });
      
      // OPTIONAL ADVANCED: If query returns node elements, highlight only those on the graph
      const returnedNodeIds = new Set();
      const returnedEdgeIds = new Set();
      
      data.rows.forEach(row => {
        data.columns.forEach(col => {
          const val = row[col];
          if (val && typeof val === 'object') {
            if (val.labels && nodes.some(n => n.id === val.id)) {
              returnedNodeIds.add(val.id);
            } else if (val.type && edges.some(e => e.id === val.id)) {
              returnedEdgeIds.add(val.id);
            }
          }
        });
      });
      
      if (returnedNodeIds.size > 0) {
        edges.forEach(e => {
          if (returnedNodeIds.has(e.from) && returnedNodeIds.has(e.to)) {
            returnedEdgeIds.add(e.id);
          }
        });
        setHighlightedNodeIds(returnedNodeIds);
        setHighlightedEdgeIds(returnedEdgeIds);
      } else {
        setHighlightedNodeIds(null);
        setHighlightedEdgeIds(null);
      }
      
    } catch (error) {
      alert(`Query failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 8. Visual inspection helpers
  const handleNodeSelect = (nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedElement({ type: 'node', data: node });
    }
  };

  const handleEdgeSelect = (edgeId) => {
    const edge = edges.find(e => e.id === edgeId);
    if (edge) {
      setSelectedElement({ type: 'edge', data: edge });
    }
  };

  const handleClearSelection = () => {
    setSelectedElement(null);
  };

  const clearHighlights = () => {
    setHighlightedNodeIds(null);
    setHighlightedEdgeIds(null);
    setFraudAlerts(null);
  };

  // Triggers path search directly from details drawer action
  const handleTracePathFromInspector = (accountId) => {
    setSelectedTraceSource(accountId);
    setActiveTab('fraud-queries');
    handleTracePath(accountId);
  };

  // focus viewport camera on a specific node in graph
  const handleFocusNode = (nodeId) => {
    if (visNetworkRef.current) {
      visNetworkRef.current.selectNodes([nodeId]);
      visNetworkRef.current.focus(nodeId, {
        scale: 1.2,
        animation: { duration: 600, easingFunction: 'easeInOutQuad' }
      });
      // also inspect it
      handleNodeSelect(nodeId);
    }
  };

  // Focus node by Account ID (e.g. from table)
  const handleSelectAccountFromTable = (accNode) => {
    handleFocusNode(accNode.id);
  };

  // Connection check on load
  useEffect(() => {
    checkDatabaseStatus();
  }, []);

  return (
    <div className="app-container">
      <Header dbStatus={dbStatus} onReseed={handleReseed} />
      
      <div className="app-workspace">
        <aside className="control-panel">
          
          {/* Navigation Tabs */}
          <nav className="nav-tabs">
            <button 
              className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dashboard'); clearHighlights(); }}
            >
              <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              Dashboard
            </button>
            <button 
              className={`tab-btn ${activeTab === 'fraud-queries' ? 'active' : ''}`}
              onClick={() => { setActiveTab('fraud-queries'); clearHighlights(); }}
            >
              <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>
              </svg>
              Fraud Investigator
            </button>
            <button 
              className={`tab-btn ${activeTab === 'console' ? 'active' : ''}`}
              onClick={() => { setActiveTab('console'); clearHighlights(); }}
            >
              <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
              Cypher Console
            </button>
          </nav>

          <div className="tab-content-container">
            {activeTab === 'dashboard' && (
              <DashboardTab 
                nodes={nodes} 
                onSelectAccount={handleSelectAccountFromTable}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
            {activeTab === 'fraud-queries' && (
              <FraudTab 
                nodes={nodes}
                onDetectCircular={handleDetectCircular}
                onDetectShared={handleDetectShared}
                onTracePath={() => handleTracePath()}
                selectedTraceSource={selectedTraceSource}
                setSelectedTraceSource={setSelectedTraceSource}
                fraudAlerts={fraudAlerts}
                onClearAlerts={clearHighlights}
                onFocusNode={handleFocusNode}
              />
            )}
            {activeTab === 'console' && (
              <ConsoleTab 
                onExecuteQuery={handleExecuteQuery}
                presets={CYPHER_PRESETS}
                consoleResults={consoleResults}
                loading={loading}
              />
            )}
          </div>
        </aside>

        <section className="visualization-panel">
          <GraphCanvas 
            nodes={nodes}
            edges={edges}
            highlightedNodeIds={highlightedNodeIds}
            highlightedEdgeIds={highlightedEdgeIds}
            loading={loading}
            loadingText={loadingText}
            onNodeSelect={handleNodeSelect}
            onEdgeSelect={handleEdgeSelect}
            onClearSelection={handleClearSelection}
            onNetworkInit={(network) => visNetworkRef.current = network}
          />

          <Inspector 
            selectedElement={selectedElement}
            onClose={handleClearSelection}
            onTracePathFromInspector={handleTracePathFromInspector}
            rawNodes={nodes}
          />
        </section>
      </div>
    </div>
  );
}
