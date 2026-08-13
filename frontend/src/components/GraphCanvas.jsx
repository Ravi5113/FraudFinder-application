import React, { useEffect, useRef } from 'react';
import { DataSet, Network } from 'vis-network/standalone/umd/vis-network.min.js';

// Base Colors for Chart Highlight states
const COLORS = {
  AccountSafe: { border: '#10b981', fill: '#e6f7f0' },
  AccountRisk: { border: '#ef4444', fill: '#fdf2f2' },
  Device: { border: '#3b82f6', fill: '#eff6ff' },
  IPAddress: { border: '#8b5cf6', fill: '#f5f3ff' },
  Default: { border: '#64748b', fill: '#f8fafc' },
  
  FadedBg: '#f1f5f9',
  FadedBorder: 'rgba(0, 0, 0, 0.06)',
  FadedFont: 'rgba(0, 0, 0, 0.15)',
  FadedEdge: 'rgba(0, 0, 0, 0.04)',
  
  EdgeDefault: 'rgba(0, 0, 0, 0.12)',
  EdgeCircular: '#ef4444',
  EdgeShared: '#3b82f6',
  EdgePath: '#f59e0b'
};

/**
 * Helper: Generates beautiful, responsive vector SVG data URIs for nodes.
 * Replaces Vis.js default geometric shapes with modern dashboard badges.
 */
const createSvgIcon = (label, isHighlighted, isHighRisk) => {
  let iconContent = '';
  let borderCol = '#64748b';
  let fillCol = '#ffffff';

  if (!isHighlighted) {
    borderCol = '#cbd5e1';
    fillCol = '#f8fafc';
  } else {
    if (label === 'Account') {
      borderCol = isHighRisk ? '#ef4444' : '#10b981';
      fillCol = isHighRisk ? '#fdf2f2' : '#e6f7f0';
    } else if (label === 'Device') {
      borderCol = '#3b82f6';
      fillCol = '#eff6ff';
    } else if (label === 'IPAddress') {
      borderCol = '#8b5cf6';
      fillCol = '#f5f3ff';
    }
  }

  // Inject crisp vector paths representing the entities
  if (label === 'Account') {
    // User / Owner Silhouette
    iconContent = `
      <circle cx="12" cy="8.5" r="3.5" fill="${borderCol}" />
      <path d="M6 17c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1.5H6V17z" fill="${borderCol}" />
    `;
  } else if (label === 'Device') {
    // Device Monitor / Screen
    iconContent = `
      <rect x="5" y="5" width="14" height="9" rx="1" fill="none" stroke="${borderCol}" stroke-width="1.8" />
      <line x1="7" y1="17" x2="17" y2="17" stroke="${borderCol}" stroke-width="1.8" stroke-linecap="round" />
      <line x1="12" y1="14" x2="12" y2="17" stroke="${borderCol}" stroke-width="1.8" />
    `;
  } else if (label === 'IPAddress') {
    // Globe / Network node
    iconContent = `
      <circle cx="12" cy="12" r="7" fill="none" stroke="${borderCol}" stroke-width="1.5" />
      <ellipse cx="12" cy="12" rx="3" ry="7" fill="none" stroke="${borderCol}" stroke-width="1.2" />
      <line x1="5" y1="12" x2="19" y2="12" stroke="${borderCol}" stroke-width="1.2" />
    `;
  } else {
    iconContent = `
      <circle cx="12" cy="12" r="7" fill="none" stroke="${borderCol}" stroke-width="1.5" />
    `;
  }

  // Premium badge outer boundary with subtle drop shadow
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="${fillCol}" stroke="${borderCol}" stroke-width="${isHighRisk && isHighlighted ? 3.2 : 1.8}" />
    <g>
      ${iconContent}
    </g>
  </svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};

export default function GraphCanvas({
  nodes,
  edges,
  highlightedNodeIds,
  highlightedEdgeIds,
  loading,
  loadingText,
  onNodeSelect,
  onEdgeSelect,
  onClearSelection,
  onNetworkInit
}) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const nodesDataSetRef = useRef(null);
  const edgesDataSetRef = useRef(null);

  // Formulates Vis.js node config
  const getNodeVisuals = (node, isNodeHighlighted = true) => {
    const label = node.labels[0] || 'Unknown';
    const isHighRisk = label === 'Account' && node.properties.riskScore >= 0.8;
    
    const svgIcon = createSvgIcon(label, isNodeHighlighted, isHighRisk);
    
    let labelText = '';
    if (label === 'Account') {
      labelText = `${node.properties.ownerName}\n(${node.properties.accountId})`;
    } else if (label === 'Device') {
      labelText = `${node.properties.os} ${node.properties.deviceType}\n(${node.properties.deviceId})`;
    } else if (label === 'IPAddress') {
      const loc = node.properties.location ? node.properties.location.split(',')[0] : 'Unknown';
      labelText = `${node.properties.ipAddress}\n(${loc})`;
    }

    let titleColor = '#10b981';
    if (label === 'Device') titleColor = '#3b82f6';
    else if (label === 'IPAddress') titleColor = '#8b5cf6';

    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'network-tooltip-container';
    tooltipEl.innerHTML = `
      <div style="font-weight: 700; color: ${titleColor}; margin-bottom: 6px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
        ${label} Details
      </div>
      <div style="display: grid; grid-template-columns: auto auto; gap: 4px 12px;">
        ${Object.entries(node.properties)
          .map(([k, v]) => `
            <span style="color: #94a3b8; font-weight: 500;">${k}:</span>
            <span style="color: #f8fafc; font-family: var(--font-mono, monospace);">${v}</span>
          `).join('')}
      </div>
    `;

    return {
      label: labelText,
      title: tooltipEl,
      shape: 'circularImage',
      image: svgIcon,
      size: label === 'Account' ? 28 : 22,
      font: {
        color: isNodeHighlighted ? '#1e293b' : COLORS.FadedFont,
        size: 10,
        face: 'Inter',
        vadjust: 0
      },
      color: {
        background: '#ffffff',
        border: isNodeHighlighted 
          ? (label === 'Account' ? (isHighRisk ? '#ef4444' : '#10b981') : (label === 'Device' ? '#3b82f6' : '#8b5cf6')) 
          : '#cbd5e1'
      },
      borderWidth: isHighRisk && isNodeHighlighted ? 3.5 : 2,
      shadow: {
        enabled: isNodeHighlighted,
        color: 'rgba(0, 0, 0, 0.05)',
        size: 5,
        x: 0,
        y: 2
      }
    };
  };

  // Initialize Network Canvas
  useEffect(() => {
    if (!containerRef.current) return;

    nodesDataSetRef.current = new DataSet([]);
    edgesDataSetRef.current = new DataSet([]);

    const data = {
      nodes: nodesDataSetRef.current,
      edges: edgesDataSetRef.current
    };

    const options = {
      interaction: {
        hover: true,
        tooltipDelay: 300,
        selectConnectedEdges: false
      },
      physics: {
        solver: 'forceAtlas2Based',
        stabilization: {
          enabled: true,
          iterations: 180,
          updateInterval: 25
        },
        forceAtlas2Based: {
          gravitationalConstant: -130, // Stronger repulsion to space out clusters
          centralGravity: 0.005,       // Soft central pull to expand network structure
          springLength: 130,           // Long springs to give text labels breathing room
          springConstant: 0.06,
          avoidOverlap: 1.0            // STRICTLY avoid node overlap to eliminate clutter
        }
      }
    };

    const network = new Network(containerRef.current, data, options);
    networkRef.current = network;
    if (onNetworkInit) {
      onNetworkInit(network);
    }

    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        onNodeSelect(params.nodes[0]);
      } else if (params.edges.length > 0) {
        onEdgeSelect(params.edges[0]);
      } else {
        onClearSelection();
      }
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, []);

  // Sync data & highlights
  useEffect(() => {
    if (!nodesDataSetRef.current || !edgesDataSetRef.current) return;

    const isHighlightMode = highlightedNodeIds !== null;

    const formattedNodes = nodes.map(n => {
      const isNodeHighlighted = !isHighlightMode || highlightedNodeIds.has(n.id);
      return {
        id: n.id,
        ...getNodeVisuals(n, isNodeHighlighted)
      };
    });

    const formattedEdges = edges.map(e => {
      const isEdgeHighlighted = !isHighlightMode || highlightedEdgeIds.has(e.id);
      
      let edgeColor = COLORS.EdgeDefault;
      let edgeWidth = 1.5;
      let dashed = false;
      
      if (isHighlightMode && isEdgeHighlighted) {
        if (highlightedEdgeIds.type === 'circular') {
          edgeColor = COLORS.EdgeCircular;
          edgeWidth = 3;
        } else if (highlightedEdgeIds.type === 'shared') {
          edgeColor = COLORS.EdgeShared;
          edgeWidth = 2.5;
          dashed = true;
        } else if (highlightedEdgeIds.type === 'path') {
          edgeColor = COLORS.EdgePath;
          edgeWidth = 3.5;
        }
      } else if (isHighlightMode && !isEdgeHighlighted) {
        edgeColor = COLORS.FadedEdge;
      }
      
      const hasArrow = e.type === 'TRANSFERRED';
      
      return {
        id: e.id,
        from: e.from,
        to: e.to,
        label: isEdgeHighlighted ? e.type : '',
        font: {
          color: isEdgeHighlighted ? '#475569' : COLORS.FadedFont,
          size: 9,
          face: 'Inter',
          strokeWidth: 2.5,          // Draws outline halo behind relationship labels
          strokeColor: '#f8fafc'      // Outline matches background grid for clean overlaying
        },
        width: edgeWidth,
        color: {
          color: edgeColor,
          highlight: edgeColor,
          hover: edgeColor
        },
        arrows: hasArrow ? { to: { enabled: true, scaleFactor: 0.5 } } : '',
        dashes: dashed,
        smooth: {
          type: 'continuous',        // Keeps multi-directional lines separated
          roundness: 0.2
        }
      };
    });

    nodesDataSetRef.current.clear();
    nodesDataSetRef.current.add(formattedNodes);

    edgesDataSetRef.current.clear();
    edgesDataSetRef.current.add(formattedEdges);

    if (isHighlightMode && networkRef.current) {
      setTimeout(() => {
        networkRef.current.fit({ animation: { duration: 500 } });
      }, 50);
    }
  }, [nodes, edges, highlightedNodeIds, highlightedEdgeIds]);

  const zoomIn = () => {
    if (networkRef.current) {
      const currentScale = networkRef.current.getScale();
      networkRef.current.moveTo({
        scale: currentScale * 1.3,
        animation: { duration: 200 }
      });
    }
  };
  
  const zoomOut = () => {
    if (networkRef.current) {
      const currentScale = networkRef.current.getScale();
      networkRef.current.moveTo({
        scale: currentScale * 0.7,
        animation: { duration: 200 }
      });
    }
  };

  const fitView = () => {
    if (networkRef.current) networkRef.current.fit({ animation: { duration: 500 } });
  };

  const resetView = () => {
    onClearSelection();
    if (networkRef.current) networkRef.current.fit({ animation: { duration: 500 } });
  };

  return (
    <div className="graph-viewport-wrapper">
      <div id="graph-network-container" ref={containerRef}></div>
      
      {/* Legend */}
      <div className="viewport-overlay-info">
        <span className="legend-item"><span className="legend-dot label-account"></span> Account</span>
        <span className="legend-item"><span className="legend-dot label-device"></span> Device</span>
        <span className="legend-item"><span className="legend-dot label-ip"></span> IP Address</span>
        <span className="legend-item"><span className="legend-dot risk-high"></span> Flagged Suspicious</span>
      </div>
      
      {/* Loading Overlay */}
      {loading && (
        <div id="graph-loading-overlay" className="viewport-overlay-loading">
          <div className="spinner"></div>
          <span className="loading-text">{loadingText || 'Executing Graph Query...'}</span>
        </div>
      )}
      
      {/* Toolbar */}
      <div className="graph-toolbar">
        <button onClick={zoomIn} title="Zoom In">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button onClick={zoomOut} title="Zoom Out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button onClick={fitView} title="Fit Network Viewport">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 9v12h-6M3 15V3h6"/></svg>
        </button>
        <button onClick={resetView} title="Show Full Network">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
        </button>
      </div>
    </div>
  );
}
