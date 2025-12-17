#!/usr/bin/env node

/**
 * Test Coinbase API Connection with ECDSA Authentication
 * 
 * This script validates:
 * 1. API credentials are properly configured
 * 2. ECDSA ES256 JWT signing works correctly
 * 3. Can successfully connect to Coinbase Advanced Trade API
 * 4. Can retrieve current BTC-USD price
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

/**
 * Create JWT token for Coinbase API authentication using ECDSA ES256
 */
function createCoinbaseJWT(method, path) {
    const apiKey = process.env.COINBASE_API_KEY;
    const apiSecret = process.env.COINBASE_API_SECRET;

    if (!apiKey || !apiSecret) {
        throw new Error('Missing COINBASE_API_KEY or COINBASE_API_SECRET in .env file');
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // JWT payload
    const payload = {
        iss: 'coinbase-cloud',
        nbf: timestamp,
        exp: timestamp + 120,  // 2 minute expiration
        sub: apiKey,
        uri: `${method} ${path}`
    };

    // JWT header (ECDSA ES256)
    const header = {
        alg: 'ES256',
        kid: apiKey,
        nonce: crypto.randomBytes(16).toString('hex')
    };

    try {
        // Sign with ECDSA private key
        const token = jwt.sign(payload, apiSecret, {
            algorithm: 'ES256',
            header: header
        });

        return token;
    } catch (err) {
        if (err.message.includes('PEM')) {
            throw new Error('Invalid EC private key format. Ensure your COINBASE_API_SECRET starts with "-----BEGIN EC PRIVATE KEY-----"');
        }
        throw err;
    }
}

/**
 * Test connection to Coinbase API
 */
async function testConnection() {
    console.log(`\n${colors.bold}${colors.cyan}=== Coinbase API Connection Test ===${colors.reset}\n`);

    // Step 1: Check environment variables
    console.log(`${colors.yellow}[1/4]${colors.reset} Checking environment variables...`);

    const apiKey = process.env.COINBASE_API_KEY;
    const apiSecret = process.env.COINBASE_API_SECRET;

    if (!apiKey) {
        console.error(`${colors.red}✗ COINBASE_API_KEY not found in .env${colors.reset}`);
        process.exit(1);
    }

    if (!apiSecret) {
        console.error(`${colors.red}✗ COINBASE_API_SECRET not found in .env${colors.reset}`);
        process.exit(1);
    }

    console.log(`${colors.green}✓ API Key found${colors.reset}: ${apiKey.substring(0, 30)}...`);
    console.log(`${colors.green}✓ API Secret found${colors.reset}: ${apiSecret.substring(0, 35)}...`);

    // Step 2: Generate JWT token
    console.log(`\n${colors.yellow}[2/4]${colors.reset} Generating JWT token with ES256 (ECDSA)...`);

    let token;
    try {
        const method = 'GET';
        const path = '/api/v3/brokerage/accounts';
        token = createCoinbaseJWT(method, path);
        console.log(`${colors.green}✓ JWT token generated successfully${colors.reset}`);
        console.log(`   Token preview: ${token.substring(0, 50)}...`);
    } catch (err) {
        console.error(`${colors.red}✗ Failed to generate JWT:${colors.reset}`, err.message);
        process.exit(1);
    }

    // Step 3: Test API authentication
    console.log(`\n${colors.yellow}[3/4]${colors.reset} Testing API authentication...`);

    try {
        const method = 'GET';
        const path = '/api/v3/brokerage/accounts';
        const token = createCoinbaseJWT(method, path);

        const response = await fetch(`https://api.coinbase.com${path}`, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log(`${colors.green}✓ Successfully authenticated${colors.reset}`);
        console.log(`   Found ${data.accounts?.length || 0} account(s)`);

    } catch (err) {
        console.error(`${colors.red}✗ Authentication failed:${colors.reset}`, err.message);
        console.log(`\n${colors.yellow}Common Issues:${colors.reset}`);
        console.log(`  • Wrong algorithm: Ensure using ES256 (not RS256)`);
        console.log(`  • Invalid key format: Check for "-----BEGIN EC PRIVATE KEY-----" header`);
        console.log(`  • Expired token: Sync system time with: sudo ntpdate -u time.apple.com`);
        console.log(`  • Invalid kid: Use full API key path: organizations/.../apiKeys/...`);
        process.exit(1);
    }

    // Step 4: Fetch BTC-USD price
    console.log(`\n${colors.yellow}[4/4]${colors.reset} Fetching BTC-USD price...`);

    try {
        const method = 'GET';
        const path = '/api/v3/brokerage/products/BTC-USD';
        const token = createCoinbaseJWT(method, path);

        const response = await fetch(`https://api.coinbase.com${path}`, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const price = parseFloat(data.price);

        console.log(`${colors.green}✓ Successfully retrieved BTC-USD price${colors.reset}`);
        console.log(`   Current Price: $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

        // Success summary
        console.log(`\n${colors.bold}${colors.green}=== Connection Test PASSED ===${colors.reset}`);
        console.log(`${colors.green}✓ All checks passed successfully${colors.reset}\n`);

        // Return structured result (for n8n integration)
        const result = {
            status: 'connected',
            btc_price: price,
            timestamp: new Date().toISOString()
        };

        console.log(`${colors.cyan}Result JSON:${colors.reset}`, JSON.stringify(result, null, 2));

        return result;

    } catch (err) {
        console.error(`${colors.red}✗ Failed to fetch BTC price:${colors.reset}`, err.message);
        process.exit(1);
    }
}

// Run the test
testConnection()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        console.error(`\n${colors.red}${colors.bold}FATAL ERROR:${colors.reset}`, err.message);
        process.exit(1);
    });
