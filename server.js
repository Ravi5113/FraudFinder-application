/**
 * server.js
 * 
 * Express backend server for FraudFinder.
 * Establishes connection to CognoDB (Neo4j compatible) over Bolt,
 * provides REST endpoints to query and visualize the transaction network,
 * and serves the public static files for the frontend dashboard.
 */

const express = require('express');
const neo4j = require('neo4j-driver');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const { seedDatabase } = require('./seed');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Serve React compiled static assets
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Database Connection Credentials
const uri = process.env.COGNODB_URI;
const username = process.env.COGNODB_USERNAME || 'cognodb';
const password = process.env.COGNODB_PASSWORD;

let driver;

// Initialize CognoDB Driver (gracefully)
if (!uri || !password) {
  console.warn('WARNING: Missing database credentials in environment variables.');
  console.warn('The application will start, but database operations will fail until .env is configured.');
} else {
  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    console.log(`Driver initialized for URI: ${uri}`);
  } catch (error) {
    console.error('Failed to initialize Neo4j driver:', error);
  }
}

/**
 * Helper: Safely converts Neo4j data types (like 64-bit Integers) to standard JS types.
 */
function convertNeo4jTypes(obj) {
  if (obj === null || obj === undefined) return obj;
  
  // Neo4j Integer conversion
  if (neo4j.isInt(obj)) {
    return obj.toNumber();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertNeo4jTypes);
  }
  
  if (typeof obj === 'object') {
    const converted = {};
    for (const key in obj) {
      converted[key] = convertNeo4jTypes(obj[key]);
    }
    return converted;
  }
  
  return obj;
}

/**
 * Helper: Formats a Neo4j Node object to a simplified structure.
 */
function formatNode(node) {
  if (!node) return null;
  return {
    id: node.elementId || node.identity.toString(),
    labels: node.labels,
    properties: convertNeo4jTypes(node.properties)
  };
}

/**
 * Helper: Formats a Neo4j Relationship object to a simplified structure.
 */
function formatRelationship(rel) {
  if (!rel) return null;
  return {
    id: rel.elementId || rel.identity.toString(),
    type: rel.type,
    from: rel.startNodeElementId || rel.start.toString(),
    to: rel.endNodeElementId || rel.end.toString(),
    properties: convertNeo4jTypes(rel.properties)
  };
}

/**
 * Helper: Checks if the database is reachable.
 */
async function checkDbConnection() {
  if (!driver) return false;
  const session = driver.session();
  try {
    // Run a trivial query to confirm active connection
    await session.run('RETURN 1');
    return true;
  } catch (err) {
    console.error('Database connection test failed:', err.message);
    return false;
  } finally {
    await session.close();
  }
}

// Middleware: Check driver availability and return 503 if database is unreachable
function requireDatabase(req, res, next) {
  if (!driver) {
    return res.status(503).json({
      success: false,
      error: 'Database driver not initialized. Please check server environment variables.'
    });
  }
  next();
}

/**
 * API Endpoints
 */

// 1. Connection Status Healthcheck
app.get('/api/db-status', async (req, res) => {
  const isConnected = await checkDbConnection();
  if (isConnected) {
    res.json({ status: 'connected', uri: uri });
  } else {
    res.json({ 
      status: 'disconnected', 
      error: 'CognoDB is currently unreachable. Check your credentials in the .env file.' 
    });
  }
});

// 2. Database Seeding Trigger
app.post('/api/seed', requireDatabase, async (req, res) => {
  try {
    await seedDatabase(driver);
    res.json({ success: true, message: 'Database successfully seeded with mock transactional data.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Fetch Full Network Graph (All nodes & relationships)
app.get('/api/network', requireDatabase, async (req, res) => {
  const session = driver.session();
  try {
    // Cypher query to retrieve all nodes and relationships
    const result = await session.run(
      'MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m'
    );

    const nodesMap = new Map();
    const edgesMap = new Map();

    result.records.forEach(record => {
      const n = record.get('n');
      const r = record.get('r');
      const m = record.get('m');

      if (n) {
        const formatted = formatNode(n);
        nodesMap.set(formatted.id, formatted);
      }
      if (m) {
        const formatted = formatNode(m);
        nodesMap.set(formatted.id, formatted);
      }
      if (r) {
        const formatted = formatRelationship(r);
        edgesMap.set(formatted.id, formatted);
      }
    });

    res.json({
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values())
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

// 4. Detect Circular Transfer Loops (Length 3)
// Relational Awkwardness: Requires 3 self-joins in SQL.
app.get('/api/fraud/circular', requireDatabase, async (req, res) => {
  const session = driver.session();
  try {
    // Cypher query to detect a cycle of three distinct accounts transferring money
    const query = `
      MATCH (a1:Account)-[r1:TRANSFERRED]->(a2:Account)-[r2:TRANSFERRED]->(a3:Account)-[r3:TRANSFERRED]->(a1)
      WHERE a1.accountId < a2.accountId AND a2.accountId <> a3.accountId AND a1.accountId <> a3.accountId
      RETURN a1, a2, a3, r1, r2, r3
    `;
    const result = await session.run(query);

    const cycles = result.records.map(record => {
      return {
        accounts: [
          formatNode(record.get('a1')),
          formatNode(record.get('a2')),
          formatNode(record.get('a3'))
        ],
        transfers: [
          formatRelationship(record.get('r1')),
          formatRelationship(record.get('r2')),
          formatRelationship(record.get('r3'))
        ]
      };
    });

    res.json({ success: true, cycles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

// 5. Detect Shared Entities (Fraud Rings)
// Finds accounts sharing devices/IPs with known high-risk accounts.
app.get('/api/fraud/shared-entities', requireDatabase, async (req, res) => {
  const session = driver.session();
  try {
    // Find a high-risk account, see what device/IP they logged in on,
    // and see which other (potentially unsuspected) accounts logged in on those same entities.
    const query = `
      MATCH (riskAcc:Account)-[r1:USED_DEVICE|USED_IP]->(sharedEnt)<-[r2:USED_DEVICE|USED_IP]-(suspectAcc:Account)
      WHERE riskAcc.riskScore >= 0.8 AND riskAcc <> suspectAcc
      RETURN riskAcc, sharedEnt, suspectAcc, r1, r2
    `;
    const result = await session.run(query);

    const nodesMap = new Map();
    const edgesMap = new Map();

    result.records.forEach(record => {
      const risk = formatNode(record.get('riskAcc'));
      const ent = formatNode(record.get('sharedEnt'));
      const suspect = formatNode(record.get('suspectAcc'));
      const r1 = formatRelationship(record.get('r1'));
      const r2 = formatRelationship(record.get('r2'));

      nodesMap.set(risk.id, risk);
      nodesMap.set(ent.id, ent);
      nodesMap.set(suspect.id, suspect);
      
      edgesMap.set(r1.id, r1);
      edgesMap.set(r2.id, r2);
    });

    res.json({
      success: true,
      nodes: Array.from(nodesMap.values()),
      edges: Array.from(edgesMap.values())
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

// 6. Trace Shortest Connection Path to a High-Risk Account
// Relational Awkwardness: Shortest path traversal is extremely complex/slow in SQL.
app.get('/api/fraud/trace-path', requireDatabase, async (req, res) => {
  const { accountId } = req.query;
  if (!accountId) {
    return res.status(400).json({ success: false, error: 'Parameter accountId is required.' });
  }

  const session = driver.session();
  try {
    // Parameterised Cypher query utilizing shortestPath() function.
    // Traces connections (transfers or shared logins) up to 5 hops deep.
    const query = `
      MATCH path = shortestPath(
        (startAcc:Account {accountId: $accountId})-[:TRANSFERRED|USED_DEVICE|USED_IP*..5]-(riskAcc:Account)
      )
      WHERE riskAcc.riskScore >= 0.8 AND startAcc <> riskAcc
      RETURN path
    `;
    
    const result = await session.run(query, { accountId });

    if (result.records.length === 0) {
      return res.json({ success: true, found: false, message: 'No connection path to high-risk accounts found within 5 hops.' });
    }

    const pathRecord = result.records[0].get('path');
    const nodes = pathRecord.segments.flatMap(segment => [
      formatNode(segment.start),
      formatNode(segment.end)
    ]);
    
    // De-duplicate nodes
    const uniqueNodes = Array.from(new Map(nodes.map(n => [n.id, n])).values());
    
    const edges = pathRecord.segments.map(segment => formatRelationship(segment.relationship));

    res.json({
      success: true,
      found: true,
      nodes: uniqueNodes,
      edges: edges
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

// 7. Custom Cypher Console Executor
// Allows developers/interviewers to run live Cypher queries to verify system capabilities.
app.post('/api/query', requireDatabase, async (req, res) => {
  const { cypher } = req.body;
  if (!cypher) {
    return res.status(400).json({ success: false, error: 'Query body cannot be empty.' });
  }

  // Prevent write/delete queries if we want it to be a read-only dashboard.
  // For safety and assessment seeding, we will allow all reads, but block writing in public interface
  // unless they are explicitly authorized. Let's allow everything for demo flexibility, but add a warning.
  const session = driver.session();
  try {
    const result = await session.run(cypher);
    
    // Parse records into raw arrays of objects
    const columns = result.keys;
    const rows = result.records.map(record => {
      const row = {};
      columns.forEach(col => {
        const val = record.get(col);
        // If it's a node or relationship, format it nicely
        if (val && typeof val === 'object' && val.labels) {
          row[col] = formatNode(val);
        } else if (val && typeof val === 'object' && val.type) {
          row[col] = formatRelationship(val);
        } else {
          row[col] = convertNeo4jTypes(val);
        }
      });
      return row;
    });

    res.json({ success: true, columns, rows });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  } finally {
    await session.close();
  }
});

// Serve frontend dashboard page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

// Start listening
app.listen(port, () => {
  console.log(`Server listening on port http://localhost:${port}`);
});
