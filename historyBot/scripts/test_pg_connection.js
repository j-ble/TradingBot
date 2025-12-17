#!/usr/bin/env node

/**
 * Test PostgreSQL Connection from Node.js
 * This mimics how n8n connects to PostgreSQL
 */

const { Client } = require('pg');

async function testConnection() {
    console.log('Testing PostgreSQL connection from Node.js...\n');

    const config = {
        host: 'localhost',
        port: 5432,
        database: 'trading_bot',
        user: 'trader',
        password: 'iLovePostgres1920',
    };

    console.log('Configuration:');
    console.log('  Host:', config.host);
    console.log('  Port:', config.port);
    console.log('  Database:', config.database);
    console.log('  User:', config.user);
    console.log('  Password: ***************\n');

    const client = new Client(config);

    try {
        console.log('Attempting to connect...');
        await client.connect();
        console.log('✓ Connected successfully!\n');

        console.log('Testing query...');
        const result = await client.query('SELECT version()');
        console.log('✓ Query successful!');
        console.log('PostgreSQL version:', result.rows[0].version);

        console.log('\nTesting tables...');
        const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
        console.log(`✓ Found ${tables.rows.length} tables:`);
        tables.rows.forEach(row => console.log(`  - ${row.table_name}`));

        console.log('\n✅ All tests passed! n8n should be able to connect with these settings.');

    } catch (err) {
        console.error('\n❌ Connection failed!');
        console.error('Error:', err.message);
        console.error('\nTroubleshooting:');

        if (err.code === 'ECONNREFUSED') {
            console.error('  • PostgreSQL may not be listening on TCP/IP');
            console.error('  • Check pg_hba.conf authentication settings');
        } else if (err.code === '28P01') {
            console.error('  • Authentication failed - check username/password');
        }

        process.exit(1);
    } finally {
        await client.end();
    }
}

testConnection();
