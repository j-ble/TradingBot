// Phase 0 System Verification Script
// Runs all pre-trading checks from DAILY_OPERATING_CHECKLIST.md
// Returns JSON with pass/fail status for each check

const { Pool } = require('pg');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

async function runPhase0Checks() {
  const results = {
    timestamp: new Date().toISOString(),
    checks: []
  };

  // Check 1: PostgreSQL Connection & Schema
  try {
    const pool = new Pool({
      connectionString: process.env.POSTGRES_CONNECTION_STRING
    });

    // Test connection
    const connectionTest = await pool.query('SELECT NOW()');

    // Verify core tables exist
    const schemaCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('liquidity_sweeps', 'trades', 'system_state', 'reclaim_confirmations')
    `);

    if (schemaCheck.rows.length >= 4) {
      results.checks.push({
        name: 'PostgreSQL',
        status: 'PASS',
        detail: `Connected, ${schemaCheck.rows.length} core tables found`
      });
    } else {
      results.checks.push({
        name: 'PostgreSQL',
        status: 'FAIL',
        detail: `Schema incomplete: only ${schemaCheck.rows.length}/4 tables found`
      });
    }

    await pool.end();
  } catch (err) {
    results.checks.push({
      name: 'PostgreSQL',
      status: 'FAIL',
      detail: err.message
    });
  }

  // Check 2: Coinbase API Authentication (ECDSA)
  try {
    const apiKey = process.env.COINBASE_API_KEY;
    const apiSecret = process.env.COINBASE_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('API credentials missing from .env');
    }

    // Validate ECDSA key format
    if (!apiSecret.includes('BEGIN EC PRIVATE KEY')) {
      throw new Error('API secret must be ECDSA format (BEGIN EC PRIVATE KEY)');
    }

    // Create test JWT
    const timestamp = Math.floor(Date.now() / 1000);
    const method = 'GET';
    const path = '/api/v3/brokerage/accounts';

    const payload = {
      iss: 'coinbase-cloud',
      nbf: timestamp,
      exp: timestamp + 120,
      sub: apiKey,
      uri: `${method} ${path}`
    };

    const header = {
      alg: 'ES256',
      kid: apiKey,
      nonce: crypto.randomBytes(16).toString('hex')
    };

    const token = jwt.sign(payload, apiSecret, {
      algorithm: 'ES256',
      header: header
    });

    // Make test API call
    const response = await fetch(`https://api.coinbase.com${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      results.checks.push({
        name: 'Coinbase API',
        status: 'PASS',
        detail: `Authenticated (${data.accounts?.length || 0} accounts)`
      });
    } else {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }
  } catch (err) {
    results.checks.push({
      name: 'Coinbase API',
      status: 'FAIL',
      detail: err.message
    });
  }

  // Check 3: Circuit Breaker Status
  try {
    const pool = new Pool({
      connectionString: process.env.POSTGRES_CONNECTION_STRING
    });

    const res = await pool.query(`
      SELECT paused_until, pause_reason, consecutive_losses
      FROM system_state
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    if (res.rows.length === 0) {
      results.checks.push({
        name: 'Circuit Breaker',
        status: 'PASS',
        detail: 'No circuit breaker record (clean state)'
      });
    } else {
      const state = res.rows[0];
      const pausedUntil = state.paused_until ? new Date(state.paused_until) : null;

      if (pausedUntil && pausedUntil > new Date()) {
        results.checks.push({
          name: 'Circuit Breaker',
          status: 'FAIL',
          detail: `PAUSED until ${pausedUntil.toISOString()}: ${state.pause_reason || 'Unknown reason'}`
        });
      } else if (state.consecutive_losses >= 3) {
        results.checks.push({
          name: 'Circuit Breaker',
          status: 'WARN',
          detail: `${state.consecutive_losses} consecutive losses (approaching Level 1 trigger)`
        });
      } else {
        results.checks.push({
          name: 'Circuit Breaker',
          status: 'PASS',
          detail: 'No active pause'
        });
      }
    }

    await pool.end();
  } catch (err) {
    results.checks.push({
      name: 'Circuit Breaker',
      status: 'FAIL',
      detail: err.message
    });
  }

  // Check 4: Account Balance
  try {
    const apiKey = process.env.COINBASE_API_KEY;
    const apiSecret = process.env.COINBASE_API_SECRET;

    const timestamp = Math.floor(Date.now() / 1000);
    const method = 'GET';
    const path = '/api/v3/brokerage/accounts';

    const payload = {
      iss: 'coinbase-cloud',
      nbf: timestamp,
      exp: timestamp + 120,
      sub: apiKey,
      uri: `${method} ${path}`
    };

    const header = {
      alg: 'ES256',
      kid: apiKey,
      nonce: crypto.randomBytes(16).toString('hex')
    };

    const token = jwt.sign(payload, apiSecret, {
      algorithm: 'ES256',
      header: header
    });

    const response = await fetch(`https://api.coinbase.com${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    // Find USD balance
    const usdAccount = data.accounts?.find(acc => acc.currency === 'USD');
    const balance = usdAccount ? parseFloat(usdAccount.available_balance?.value || 0) : 0;

    const minRequired = 500;

    if (balance >= minRequired) {
      results.checks.push({
        name: 'Account Balance',
        status: 'PASS',
        detail: `$${balance.toFixed(2)} (min: $${minRequired})`
      });
    } else {
      results.checks.push({
        name: 'Account Balance',
        status: 'FAIL',
        detail: `$${balance.toFixed(2)} below minimum $${minRequired}`
      });
    }
  } catch (err) {
    results.checks.push({
      name: 'Account Balance',
      status: 'FAIL',
      detail: err.message
    });
  }

  // Check 5: Open Positions
  try {
    const pool = new Pool({
      connectionString: process.env.POSTGRES_CONNECTION_STRING
    });

    const res = await pool.query(`
      SELECT COUNT(*) as open_count
      FROM trades
      WHERE status = 'ACTIVE'
    `);

    const openCount = parseInt(res.rows[0].open_count);

    if (openCount === 0) {
      results.checks.push({
        name: 'Open Positions',
        status: 'PASS',
        detail: 'None (clean slate)'
      });
    } else {
      results.checks.push({
        name: 'Open Positions',
        status: 'WARN',
        detail: `${openCount} position(s) still open from previous session`
      });
    }

    await pool.end();
  } catch (err) {
    results.checks.push({
      name: 'Open Positions',
      status: 'FAIL',
      detail: err.message
    });
  }

  // Check 6: Environment Variables
  const requiredVars = [
    'COINBASE_API_KEY',
    'COINBASE_API_SECRET',
    'POSTGRES_CONNECTION_STRING'
  ];

  const missingVars = requiredVars.filter(v => !process.env[v]);

  if (missingVars.length === 0) {
    results.checks.push({
      name: 'Environment',
      status: 'PASS',
      detail: 'All required variables present'
    });
  } else {
    results.checks.push({
      name: 'Environment',
      status: 'FAIL',
      detail: `Missing: ${missingVars.join(', ')}`
    });
  }

  // Check 7: System Logs (last 24h)
  try {
    const pool = new Pool({
      connectionString: process.env.POSTGRES_CONNECTION_STRING
    });

    // Check if system_logs table exists (optional table)
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'system_logs'
      )
    `);

    if (tableCheck.rows[0].exists) {
      const res = await pool.query(`
        SELECT COUNT(*) as error_count
        FROM system_logs
        WHERE type = 'ERROR'
        AND timestamp > NOW() - INTERVAL '24 hours'
      `);

      const errorCount = parseInt(res.rows[0].error_count);

      if (errorCount === 0) {
        results.checks.push({
          name: 'System Logs',
          status: 'PASS',
          detail: 'No critical errors in last 24h'
        });
      } else if (errorCount < 5) {
        results.checks.push({
          name: 'System Logs',
          status: 'WARN',
          detail: `${errorCount} error(s) in last 24h`
        });
      } else {
        results.checks.push({
          name: 'System Logs',
          status: 'FAIL',
          detail: `${errorCount} errors in last 24h (threshold: 5)`
        });
      }
    } else {
      results.checks.push({
        name: 'System Logs',
        status: 'PASS',
        detail: 'Logs table not configured (optional)'
      });
    }

    await pool.end();
  } catch (err) {
    results.checks.push({
      name: 'System Logs',
      status: 'WARN',
      detail: `Could not check: ${err.message}`
    });
  }

  // Final Result
  const allPassed = results.checks.every(c => c.status === 'PASS');
  const anyFailed = results.checks.some(c => c.status === 'FAIL');

  results.overall = anyFailed ? 'FAIL' : (allPassed ? 'PASS' : 'PASS_WITH_WARNINGS');

  return results;
}

// Execute and output JSON
runPhase0Checks()
  .then(results => {
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.overall === 'FAIL' ? 1 : 0);
  })
  .catch(err => {
    console.error(JSON.stringify({
      error: err.message,
      overall: 'FAIL',
      timestamp: new Date().toISOString()
    }, null, 2));
    process.exit(1);
  });
