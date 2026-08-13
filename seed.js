/**
 * seed.js
 * 
 * This script seeds the CognoDB graph database with a realistic financial transaction network.
 * It populates bank accounts, user login devices, and IP addresses, embedding:
 * 1. A circular payment loop (Alice -> Bob -> Charlie -> Alice) representing money laundering.
 * 2. A shared device/IP fraud ring (Dave, Eve, Frank) sharing details with high-risk nodes.
 * 3. A multi-hop connection chain linking a clean account (Judy) to a high-risk account (Eve).
 * 
 * Can be run independently: `npm run seed` or imported and run via the Express web API.
 */

const neo4j = require('neo4j-driver');
require('dotenv').config();

/**
 * Seeding logic. Runs within a database driver context.
 * @param {neo4j.Driver} driver - The active database driver instance
 */
async function seedDatabase(driver) {
  const session = driver.session();
  try {
    console.log('Starting CognoDB database seeding...');

    // Step 1: Clear the existing database
    // "MATCH (n) DETACH DELETE n" removes all nodes and all their connecting relationships.
    console.log('Clearing existing graph data...');
    await session.executeWrite(tx => 
      tx.run('MATCH (n) DETACH DELETE n')
    );

    // Step 2: Create Accounts
    // Accounts have properties: accountId, ownerName, email, balance, riskScore, and createdAt.
    // Labeled as :Account.
    console.log('Creating Account nodes...');
    const accounts = [
      { id: 'ACC001', name: 'Alice Smith', email: 'alice@example.com', balance: 5000.0, risk: 0.10, created: '2026-01-15' },
      { id: 'ACC002', name: 'Bob Jones', email: 'bob@example.com', balance: 1500.0, risk: 0.20, created: '2026-02-10' },
      { id: 'ACC003', name: 'Charlie Brown', email: 'charlie@example.com', balance: 3200.0, risk: 0.15, created: '2026-03-01' },
      { id: 'ACC004', name: 'Dave Miller', email: 'dave@example.com', balance: 12000.0, risk: 0.90, created: '2025-11-20' }, // High Risk
      { id: 'ACC005', name: 'Eve Johnson', email: 'eve@example.com', balance: 450.0, risk: 0.85, created: '2026-04-05' },    // High Risk
      { id: 'ACC006', name: 'Frank Davis', email: 'frank@example.com', balance: 8500.0, risk: 0.30, created: '2026-05-12' },
      { id: 'ACC007', name: 'Grace Wilson', email: 'grace@example.com', balance: 6200.0, risk: 0.05, created: '2026-05-20' },
      { id: 'ACC008', name: 'Heidi Thomas', email: 'heidi@example.com', balance: 900.0, risk: 0.10, created: '2026-06-01' },
      { id: 'ACC009', name: 'Ivan Wright', email: 'ivan@example.com', balance: 150.0, risk: 0.40, created: '2026-06-15' },
      { id: 'ACC010', name: 'Judy Green', email: 'judy@example.com', balance: 7100.0, risk: 0.02, created: '2026-07-01' }
    ];

    await session.executeWrite(tx => {
      const queries = accounts.map(acc => 
        tx.run(
          `CREATE (a:Account {
            accountId: $id,
            ownerName: $name,
            email: $email,
            balance: toFloat($balance),
            riskScore: toFloat($risk),
            createdAt: $created
          })`,
          acc
        )
      );
      return Promise.all(queries);
    });

    // Step 3: Create Devices
    // Devices have properties: deviceId, deviceType, and os.
    // Labeled as :Device.
    console.log('Creating Device nodes...');
    const devices = [
      { id: 'DEV001', type: 'Mobile', os: 'iOS' },
      { id: 'DEV002', type: 'Desktop', os: 'Windows' },
      { id: 'DEV003', type: 'Tablet', os: 'Android' },
      { id: 'DEV004', type: 'Mobile', os: 'Android' }
    ];

    await session.executeWrite(tx => {
      const queries = devices.map(dev => 
        tx.run(
          `CREATE (d:Device {
            deviceId: $id,
            deviceType: $type,
            os: $os
          })`,
          dev
        )
      );
      return Promise.all(queries);
    });

    // Step 4: Create IP Addresses
    // IPAddresses have properties: ipAddress and location.
    // Labeled as :IPAddress.
    console.log('Creating IPAddress nodes...');
    const ips = [
      { ip: '192.168.1.10', location: 'New York, USA' },
      { ip: '10.0.0.5', location: 'London, UK' },
      { ip: '172.16.254.1', location: 'Lagos, Nigeria' },
      { ip: '198.51.100.42', location: 'Toronto, Canada' }
    ];

    await session.executeWrite(tx => {
      const queries = ips.map(ip => 
        tx.run(
          `CREATE (i:IPAddress {
            ipAddress: $ip,
            location: $location
          })`,
          ip
        )
      );
      return Promise.all(queries);
    });

    // Step 5: Establish Relationships
    console.log('Creating relationships...');

    // 5a. Circular Payment Loop (Alice -> Bob -> Charlie -> Alice)
    // Structured transactions close the cycle to camouflage illicit funds.
    console.log('Establishing circular transfer loop relationships...');
    const circularTransfers = [
      { from: 'ACC001', to: 'ACC002', amount: 1000.0, time: '2026-08-10T10:00:00Z', txId: 'TX101' },
      { from: 'ACC002', to: 'ACC003', amount: 950.0, time: '2026-08-10T10:15:00Z', txId: 'TX102' },
      { from: 'ACC003', to: 'ACC001', amount: 900.0, time: '2026-08-10T10:30:00Z', txId: 'TX103' }
    ];

    await session.executeWrite(tx => {
      const queries = circularTransfers.map(t => 
        tx.run(
          `MATCH (from:Account {accountId: $from}), (to:Account {accountId: $to})
           CREATE (from)-[:TRANSFERRED {
             amount: toFloat($amount),
             timestamp: $time,
             transactionId: $txId
           }]->(to)`,
          t
        )
      );
      return Promise.all(queries);
    });

    // 5b. Shared Device/IP Fraud Ring
    // Dave (risk 0.90), Eve (risk 0.85), and Frank (risk 0.30) log in on the same machine (DEV002) and IP (IP003)
    console.log('Establishing shared device & IP address relationships...');
    const logins = [
      { acc: 'ACC004', dev: 'DEV002', ip: 'IP003', time: '2026-08-11T12:00:00Z' },
      { acc: 'ACC005', dev: 'DEV002', ip: 'IP003', time: '2026-08-11T12:10:00Z' },
      { acc: 'ACC006', dev: 'DEV002', ip: null,    time: '2026-08-11T12:30:00Z' } // Frank shares device, but not IP
    ];

    await session.executeWrite(tx => {
      const queries = [];
      logins.forEach(l => {
        queries.push(
          tx.run(
            `MATCH (a:Account {accountId: $acc}), (d:Device {deviceId: $dev})
             CREATE (a)-[:USED_DEVICE {lastUsed: $time}]->(d)`,
            l
          )
        );
        if (l.ip) {
          queries.push(
            tx.run(
              `MATCH (a:Account {accountId: $acc}), (i:IPAddress {ipAddress: $ip})
               CREATE (a)-[:USED_IP {lastUsed: $time}]->(i)`,
              l
            )
          );
        }
      });
      return Promise.all(queries);
    });

    // 5c. Multi-hop path linking clean account (Judy) to high-risk (Eve)
    // Judy -> Ivan -> Frank -> Eve
    console.log('Establishing multi-hop transfer chain...');
    const chainTransfers = [
      { from: 'ACC010', to: 'ACC009', amount: 500.0, time: '2026-08-09T08:00:00Z', txId: 'TX201' },
      { from: 'ACC009', to: 'ACC006', amount: 450.0, time: '2026-08-09T09:00:00Z', txId: 'TX202' },
      { from: 'ACC006', to: 'ACC005', amount: 400.0, time: '2026-08-09T10:00:00Z', txId: 'TX203' }
    ];

    await session.executeWrite(tx => {
      const queries = chainTransfers.map(t => 
        tx.run(
          `MATCH (from:Account {accountId: $from}), (to:Account {accountId: $to})
           CREATE (from)-[:TRANSFERRED {
             amount: toFloat($amount),
             timestamp: $time,
             transactionId: $txId
           }]->(to)`,
          t
        )
      );
      return Promise.all(queries);
    });

    // 5d. General normal activity to add realistic noise
    console.log('Establishing general/normal network connections...');
    const normalLoginsAndTx = [
      { type: 'device', acc: 'ACC001', target: 'DEV001', time: '2026-08-10T09:00:00Z' },
      { type: 'device', acc: 'ACC002', target: 'DEV001', time: '2026-08-10T09:15:00Z' },
      { type: 'ip',     acc: 'ACC001', target: '192.168.1.10', time: '2026-08-10T09:00:00Z' },
      
      { type: 'device', acc: 'ACC007', target: 'DEV003', time: '2026-08-12T07:00:00Z' },
      { type: 'ip',     acc: 'ACC007', target: '198.51.100.42', time: '2026-08-12T07:00:00Z' },
      
      { type: 'device', acc: 'ACC008', target: 'DEV004', time: '2026-08-12T08:00:00Z' },
      { type: 'device', acc: 'ACC010', target: 'DEV004', time: '2026-08-12T08:30:00Z' },
      { type: 'ip',     acc: 'ACC008', target: '10.0.0.5', time: '2026-08-12T08:00:00Z' },
      { type: 'ip',     acc: 'ACC010', target: '10.0.0.5', time: '2026-08-12T08:30:00Z' },
      
      { type: 'transfer', from: 'ACC007', to: 'ACC008', amount: 200.0, time: '2026-08-11T16:00:00Z', txId: 'TX301' }
    ];

    await session.executeWrite(tx => {
      const queries = normalLoginsAndTx.map(item => {
        if (item.type === 'device') {
          return tx.run(
            `MATCH (a:Account {accountId: $acc}), (d:Device {deviceId: $target})
             CREATE (a)-[:USED_DEVICE {lastUsed: $time}]->(d)`,
            { acc: item.acc, target: item.target, time: item.time }
          );
        } else if (item.type === 'ip') {
          return tx.run(
            `MATCH (a:Account {accountId: $acc}), (i:IPAddress {ipAddress: $target})
             CREATE (a)-[:USED_IP {lastUsed: $time}]->(i)`,
            { acc: item.acc, target: item.target, time: item.time }
          );
        } else if (item.type === 'transfer') {
          return tx.run(
            `MATCH (from:Account {accountId: $from}), (to:Account {accountId: $to})
             CREATE (from)-[:TRANSFERRED {
               amount: toFloat($amount),
               timestamp: $time,
               transactionId: $txId
             }]->(to)`,
            { from: item.from, to: item.to, amount: item.amount, time: item.time, txId: item.txId }
          );
        }
      });
      return Promise.all(queries);
    });

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding database:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// Export the seed function for use by the Express server
module.exports = { seedDatabase };

// If executed directly from command line (e.g. `node seed.js`)
if (require.main === module) {
  const uri = process.env.COGNODB_URI;
  const username = process.env.COGNODB_USERNAME || 'cognodb';
  const password = process.env.COGNODB_PASSWORD;

  if (!uri || !password) {
    console.error('ERROR: Missing database configuration in environment variables.');
    console.error('Please configure COGNODB_URI and COGNODB_PASSWORD in a .env file.');
    process.exit(1);
  }

  // Create neo4j driver
  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));

  seedDatabase(driver)
    .then(() => {
      console.log('Database successfully initialized.');
      return driver.close();
    })
    .catch(err => {
      console.error('Database seeding failed:', err);
      driver.close().then(() => process.exit(1));
    });
}
