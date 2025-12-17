# n8n Implementation Plan - Automated Trading Execution

**Status**: IMPLEMENTATION GUIDE
**Based On**: All 7 Locked Contracts + 4 Logical Steps
**Infrastructure**: Mac Mini + n8n + PostgreSQL + Coinbase API

---

## Executive Summary

This plan implements the complete locked trading system using n8n workflows. The system executes **mechanically** according to the Daily Operating Checklist, with NO discretionary decisions except where explicitly required by contracts.

**Core Principle**: n8n is the execution engine. Contracts are the law. No deviations.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     n8n ORCHESTRATION LAYER                      │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ 4H Scanner  │  │ 5M Scanner  │  │  Position   │
    │  (Every 4H) │  │  (Every 5M) │  │  Monitor    │
    │             │  │             │  │  (Every 1M) │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
           ▼                ▼                ▼
    ┌─────────────────────────────────────────────┐
    │              CONTRACT VALIDATION             │
    │  Phase 0: Mental State (manual)              │
    │  Phase 1: 4H Bias Detection (automated)      │
    │  Phase 2: 1H Session Filter (automated)      │
    │  Phase 3: 5M Reclaim Check (automated)       │
    │  Phase 4: 1M Entry Optimization (automated)  │
    │  Phase 5: Position Sizing (automated)        │
    └────────────────────┬────────────────────────┘
                         │
                         ▼
              ┌────────────────────┐
              │  Trade Execution   │
              │  Phase 6: Manage   │
              │  Phase 7: EOD      │
              │  Phase 8: Log      │
              └────────────────────┘
                         │
                         ▼
              ┌────────────────────┐
              │   PostgreSQL DB    │
              │   Coinbase API     │
              └────────────────────┘
```

---

## Contract Implementation Matrix

| Contract | n8n Workflow | Trigger | Purpose |
|----------|--------------|---------|---------|
| DAILY_OPERATING_CHECKLIST (Phase 0) | Phase 0 System Check | Manual webhook / Daily 08:00 UTC | Automated system verification via Claude Code SSH |
| 4H_BIAS_CONTRACT | 4H Bias Scanner | Every 4H | Detect liquidity sweep + RSI + confirmation |
| 1H_SESSION_CONTRACT | Session Filter | On 4H signal | Block NY_OPEN (50% WR), prefer NY_MID (90% WR) |
| 5M_EXECUTION_CONTRACT | 5M Reclaim Monitor | Every 5M when bias active | Detect reclaim level within 1-2 hours |
| 1M_ENTRY_CONTRACT | 1M Entry Optimizer | On 5M reclaim | Optional 30-min limit order window |
| TRADE_MANAGEMENT_CONTRACT | Position Manager | Every 1M when open | Breakeven at +0.8R, structure-based exits |
| LIVE_TRADING_CONTRACT | Circuit Breakers | After each trade + Daily 00:00 UTC | Track phases, enforce pauses (Level 1/2/3) |

---

## Infrastructure Prerequisites

### 1. Mac Mini Setup

**Required Software**:
```bash
# Node.js 20 LTS
node --version  # Should show v20.x.x

# PostgreSQL 16
brew services start postgresql@16
psql -U postgres -c "SELECT version();"

# n8n
npm install -g n8n
n8n --version

# Environment Variables
cat /Users/ble/TradingBot/historyBot/.env
# Should contain:
# COINBASE_API_KEY=...
# COINBASE_API_SECRET=...
# POSTGRES_CONNECTION_STRING=...
# TELEGRAM_BOT_TOKEN=... (optional)
```

**24/7 Operation Requirements**:
- Mac Mini set to "Never Sleep" (System Settings → Energy Saver)
- Auto-login enabled (for restart scenarios)
- n8n configured to auto-start on boot
- PostgreSQL set to start on boot (`brew services` handles this)

### 2. Database Schema

The database must exist before n8n workflows run. Schema location: `database/schema.sql`

**Key Tables**:
```sql
-- Stores active 4H bias signals
liquidity_sweeps (id, timestamp, sweep_type, price, bias, active)

-- Tracks 5M reclaim confirmations
reclaim_confirmations (id, sweep_id, reclaim_timestamp, reclaim_price)

-- Stores all trades with full lifecycle
trades (id, entry_time, direction, entry_price, stop_loss, take_profit,
        status, outcome, r_result, session)

-- Position sizing calculations
position_sizes (id, trade_id, account_balance, risk_percent,
                stop_distance_percent, position_size_usd)

-- Circuit breaker state
system_state (id, active_trades, consecutive_losses, daily_loss_percent,
              paused_until, phase)
```

### 3. Coinbase API Access (ECDSA Authentication)

**Requirements**:
- API key with trading permissions
- Spot trading enabled for BTC-USD
- Rate limits: 10 requests/second (public), 15 requests/second (private)
- **Encryption**: ECDSA (Elliptic Curve Digital Signature Algorithm) using ES256

**ECDSA Key Format**:
```bash
# Your API credentials should look like:
COINBASE_API_KEY=organizations/abc-123/apiKeys/xyz-789
COINBASE_API_SECRET=-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIAbcdef...
-----END EC PRIVATE KEY-----
```

**JWT Signing Implementation** (ES256 algorithm for ECDSA):
```javascript
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Create JWT token for Coinbase API authentication
function createCoinbaseJWT(method, path) {
  const apiKey = process.env.COINBASE_API_KEY;
  const apiSecret = process.env.COINBASE_API_SECRET;

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

  // Sign with ECDSA private key
  const token = jwt.sign(payload, apiSecret, {
    algorithm: 'ES256',
    header: header
  });

  return token;
}

// Example usage in n8n Function node:
const method = 'GET';
const path = '/api/v3/brokerage/products/BTC-USD/candles?granularity=FOUR_HOUR&limit=50';
const token = createCoinbaseJWT(method, path);

return {
  url: `https://api.coinbase.com${path}`,
  token: token
};
```

**n8n HTTP Request Node Configuration**:
```json
{
  "url": "={{ $json.url }}",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "=Bearer {{ $json.token }}"
      }
    ]
  }
}
```

**Test API Connection**:
```bash
# Run this from scripts/ directory
node test_coinbase_connection.js
# Should return: { status: 'connected', btc_price: 43250.00 }
```

**Common ECDSA Issues & Solutions**:

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid signature" | Wrong algorithm (RSA vs ECDSA) | Use ES256, not RS256 |
| "Key format error" | PEM format incorrect | Ensure `-----BEGIN EC PRIVATE KEY-----` header |
| "Expired token" | Clock skew | Sync system time: `sudo ntpdate -u time.apple.com` |
| "Invalid kid" | Wrong API key in header | Use full path: `organizations/.../apiKeys/...` |

**Security Notes**:
- ECDSA provides same security as RSA with smaller key sizes (256-bit ECDSA ≈ 3072-bit RSA)
- Private key NEVER leaves your Mac Mini
- JWT tokens expire after 2 minutes (automatic security)
- Never commit `.env` file to git (add to `.gitignore`)

---

## n8n Workflow Implementations

### Workflow 1: 4H Bias Scanner

**File**: `n8n/workflows/4h_bias_scanner.json` (already exists, needs validation)

**Trigger**: Schedule (Every 4 hours at :00)

**Contract**: `4H_BIAS_CONTRACT.md`

**Logic Flow**:
```
1. Fetch 4H Candles (Coinbase API)
   └─> GET /api/v3/brokerage/products/BTC-USD/candles?granularity=FOUR_HOUR&limit=50

2. Calculate RSI (14 period)
   └─> Function Node: calculateRSI(candles)

3. Detect Swing Highs/Lows (3-candle pattern)
   └─> Function Node: detectSwings(candles)

4. Check BULLISH Bias Conditions
   ├─> Condition 1: prevCandle.low < swingLow.price && prevCandle.close > swingLow.price
   ├─> Condition 2: RSI < 40
   └─> Condition 3: latestCandle.close > prevCandle.close

5. Check BEARISH Bias Conditions
   ├─> Condition 1: prevCandle.high > swingHigh.price && prevCandle.close < swingHigh.price
   ├─> Condition 2: RSI > 80
   └─> Condition 3: latestCandle.close < prevCandle.close

6. If BIAS Detected:
   ├─> Store in DB: INSERT INTO liquidity_sweeps
   ├─> Send Telegram Alert (optional)
   └─> Trigger 5M Scanner (activate monitoring)

7. If NO Bias:
   └─> Log: "No 4H bias detected (RSI: X)"
```

**Database Update**:
```sql
-- Mark previous biases as inactive
UPDATE liquidity_sweeps SET active = false WHERE active = true;

-- Insert new bias
INSERT INTO liquidity_sweeps (timestamp, sweep_type, price, bias, swing_level, active)
VALUES (NOW(), 'LOW', 42150.00, 'BULLISH', 42100.00, true);
```

**Expected Output** (5-6 signals per month):
```json
{
  "bias": "BULLISH",
  "sweepType": "LOW",
  "sweepPrice": 42100.00,
  "rsi": 38.5,
  "timestamp": "2025-12-17T12:00:00Z"
}
```

---

### Workflow 2: 5M Reclaim Monitor

**File**: `n8n/workflows/5m_reclaim_monitor.json` (needs creation)

**Trigger**: Schedule (Every 5 minutes) + Conditional (only when 4H bias is active)

**Contracts**: `1H_SESSION_CONTRACT.md` + `5M_EXECUTION_CONTRACT.md`

**Logic Flow**:
```
1. Check if 4H Bias Active
   └─> Query DB: SELECT * FROM liquidity_sweeps WHERE active = true

2. If NO Active Bias:
   └─> Skip execution (log "No active bias")

3. If Active Bias Found:
   └─> Retrieve: bias, sweepPrice, biasTimestamp

4. Calculate Elapsed Time Since Bias
   └─> elapsed = NOW() - biasTimestamp
   └─> If elapsed > 4 hours:
       └─> Mark bias as EXPIRED in DB
       └─> Exit workflow

5. Check Current Session (1H SESSION CONTRACT)
   └─> Get current UTC hour
   └─> If 14:00-17:00 UTC (NY_OPEN):
       └─> Skip trade (50% win rate session)
       └─> Log: "NY_OPEN blocked"
   └─> Else: Continue

6. Fetch Latest 5M Candle
   └─> GET /api/v3/brokerage/products/BTC-USD/candles?granularity=FIVE_MINUTE&limit=1

7. Check Reclaim Level (5M EXECUTION CONTRACT)
   ├─> If BULLISH bias:
   │   └─> Reclaim = latestCandle.close > (sweepPrice * 1.002)  // +0.2%
   └─> If BEARISH bias:
       └─> Reclaim = latestCandle.close < (sweepPrice * 0.998)  // -0.2%

8. If RECLAIM Detected:
   ├─> Store in DB: INSERT INTO reclaim_confirmations
   ├─> Send Alert: "5M Reclaim confirmed"
   └─> Trigger: 1M Entry Workflow

9. If NO Reclaim:
   └─> Log: "Waiting for reclaim (Elapsed: X min)"
```

**Session Filtering Logic** (Critical):
```javascript
const currentHour = new Date().getUTCHours();

// Session definitions from 1H_SESSION_CONTRACT
const sessions = {
  NY_OPEN: currentHour >= 14 && currentHour < 17,    // FORBIDDEN
  NY_MID: currentHour >= 17 && currentHour < 22,     // PREFERRED (90% WR)
  LONDON: currentHour >= 8 && currentHour < 14,      // ALLOWED
  ASIA: currentHour >= 0 && currentHour < 8,         // ALLOWED
  NY_CLOSE: currentHour >= 22 || currentHour < 0     // ALLOWED
};

if (sessions.NY_OPEN) {
  console.log("Trade blocked: NY_OPEN session (50% win rate)");
  return { skip: true, reason: "NY_OPEN" };
}

const preferredSession = sessions.NY_MID;
return { continue: true, session: getSessionName(), preferred: preferredSession };
```

**Expected Timing**:
- 1-2 hours after 4H bias: Optimal (MFE/MAE 1.73x)
- 2-4 hours: Acceptable (MFE/MAE 1.53x)
- 4+ hours: EXPIRED (MFE/MAE 0.84x)

---

### Workflow 3: 1M Entry Optimizer

**File**: `n8n/workflows/1m_entry_optimizer.json` (needs creation)

**Trigger**: Called by 5M Reclaim Monitor when reclaim confirmed

**Contract**: `1M_ENTRY_CONTRACT.md` (OPTIONAL optimization)

**Logic Flow**:
```
1. Receive 5M Reclaim Signal
   └─> Inputs: bias, sweepPrice, reclaimPrice, session

2. Calculate Position Size (POSITION_SIZING_MODEL.md)
   ├─> Query account balance from Coinbase
   ├─> Risk = 1% (Phase 1-2) or 1.5% (Phase 3+)
   ├─> Stop distance = 5M swing level distance
   └─> Position Size = (Balance × Risk%) / Stop Distance%

3. Identify 1M Swing Level
   ├─> Fetch last 30 × 1M candles
   ├─> Detect recent swing low (LONG) or swing high (SHORT)
   └─> Limit price = swing level ± 0.1%

4. Decision: Market Entry or 1M Optimization
   ├─> If elapsed > 1.5 hours since bias:
   │   └─> MARKET ENTRY (no time for optimization)
   └─> Else:
       └─> Place LIMIT ORDER at 1M swing level
       └─> Set 30-minute timer

5. Wait for Fill (max 30 minutes)
   ├─> Poll every 30 seconds: Check order status
   ├─> If filled → Proceed to Trade Management
   └─> If not filled after 30 min:
       └─> Cancel limit order
       └─> Place MARKET ORDER

6. Calculate Stops & Targets
   ├─> Stop Loss = 5M swing level (from 4H bias data)
   ├─> Take Profit = 4H opposing structure (min 2R)
   └─> Validate R:R ≥ 2.0:
       └─> If R:R < 2.0 → REJECT trade, log reason

7. Execute Trade
   ├─> POST /api/v3/brokerage/orders (market or limit)
   ├─> POST /api/v3/brokerage/orders (stop-loss order)
   ├─> POST /api/v3/brokerage/orders (take-profit order)
   └─> Store trade in DB with status = 'ACTIVE'

8. Trigger Position Management Workflow
```

**Position Sizing Calculation** (Critical Math):
```javascript
// From POSITION_SIZING_MODEL.md
const accountBalance = 10000;  // Query from Coinbase
const riskPercent = 0.01;       // 1% per LIVE_TRADING_CONTRACT Phase 1-2

// Example values
const entryPrice = 42500.00;
const stopLossPrice = 42100.00;  // 5M swing level
const stopDistance = Math.abs((stopLossPrice - entryPrice) / entryPrice);  // 0.0094 = 0.94%

const riskAmount = accountBalance * riskPercent;  // $100
const positionSizeUSD = riskAmount / stopDistance;  // $100 / 0.0094 = $10,638

const positionSizeBTC = positionSizeUSD / entryPrice;  // $10,638 / $42,500 = 0.2503 BTC

// Validate
if (positionSizeUSD > accountBalance * 0.5) {
  throw new Error("Position size exceeds 50% of account (hard limit)");
}

// Store calculation in DB for audit trail
INSERT INTO position_sizes (trade_id, account_balance, risk_percent,
                             stop_distance_percent, position_size_usd)
VALUES (trade_id, 10000, 0.01, 0.0094, 10638);
```

**R:R Validation** (Must be ≥ 2.0):
```javascript
// From TRADE_MANAGEMENT_CONTRACT
const entryPrice = 42500.00;
const stopLoss = 42100.00;
const target = 43300.00;  // Must be derived from 4H structure

const risk = Math.abs(entryPrice - stopLoss);  // $400
const reward = Math.abs(target - entryPrice);  // $800

const RR = reward / risk;  // 2.0

if (RR < 2.0) {
  console.error(`Trade rejected: R:R ${RR.toFixed(2)} < 2.0 minimum`);
  return { skip: true, reason: "Insufficient R:R" };
}
```

---

### Workflow 4: Position Manager

**File**: `n8n/workflows/position_manager.json` (needs creation)

**Trigger**: Schedule (Every 1 minute) + Conditional (only when open positions exist)

**Contract**: `TRADE_MANAGEMENT_CONTRACT.md`

**Logic Flow**:
```
1. Query Open Positions
   └─> SELECT * FROM trades WHERE status = 'ACTIVE'

2. If NO Open Positions:
   └─> Skip execution

3. For Each Open Position:
   ├─> Fetch current BTC price
   ├─> Calculate unrealized P&L
   └─> Calculate R progress

4. Check Exit Conditions (in order):

   A. Target Hit?
      ├─> If currentPrice >= takeProfit (LONG):
      │   ├─> POST /api/v3/brokerage/orders/close_position
      │   ├─> UPDATE trades SET status='CLOSED', outcome='WIN'
      │   └─> Log trade result
      └─> If currentPrice <= takeProfit (SHORT):
          └─> Same as above

   B. Stop Hit?
      ├─> Query exchange for stop order status
      ├─> If stop filled:
      │   ├─> UPDATE trades SET status='CLOSED', outcome='LOSS'
      │   └─> Log trade result
      └─> Else: Continue

   C. 4H Structure Invalidated?
      ├─> Check if opposite 4H bias fired
      ├─> If yes:
      │   ├─> Close position manually
      │   ├─> UPDATE trades SET status='CLOSED', outcome='STRUCTURE'
      │   └─> Log: "Exited due to structure invalidation"
      └─> Else: Continue

   D. Friday Close Rule?
      ├─> If current_day == Friday AND current_hour >= 22:
      │   ├─> If unrealized_pnl <= 0:
      │   │   ├─> Close position
      │   │   └─> UPDATE trades SET outcome='WEEKEND'
      │   └─> If unrealized_pnl > 0:
      │       └─> Hold (stop must be at breakeven or better)
      └─> Else: Continue

5. Breakeven Protection (+0.8R Rule)
   ├─> If trade NOT yet protected:
   │   ├─> Calculate R progress = (currentPrice - entry) / (target - entry)
   │   ├─> If R progress >= 0.8:
   │   │   ├─> Move stop to breakeven (entry price)
   │   │   ├─> POST /api/v3/brokerage/orders (update stop order)
   │   │   ├─> UPDATE trades SET protected=true
   │   │   └─> Send notification: "Stop moved to breakeven"
   │   └─> Else: No action
   └─> If already protected:
       └─> No stop adjustment (PROHIBITED by contract)

6. Log Position Status
   └─> Console log: "Position X: R+0.5, unrealized +$200, time 3.2hrs"
```

**Breakeven Protection Logic** (Critical):
```javascript
// From TRADE_MANAGEMENT_CONTRACT
// Rule: At +0.8R, move stop to breakeven

const entry = trade.entry_price;
const stop = trade.stop_loss;
const target = trade.take_profit;
const current = latestPrice;

const fullRDistance = Math.abs(target - entry);
const currentProgress = Math.abs(current - entry);
const rProgress = currentProgress / fullRDistance;  // e.g., 0.85 = 85% to target

if (rProgress >= 0.8 && !trade.protected) {
  // Move stop to breakeven
  const newStop = entry;  // Exact entry price

  // Cancel old stop order
  await cancelOrder(trade.stop_order_id);

  // Place new stop at breakeven
  const stopOrder = await placeStopOrder({
    side: trade.direction === 'LONG' ? 'SELL' : 'BUY',
    stopPrice: newStop,
    size: trade.position_size_btc
  });

  // Update database
  UPDATE trades
  SET protected = true,
      stop_loss = newStop,
      stop_order_id = stopOrder.id
  WHERE id = trade.id;

  console.log(`Trade ${trade.id}: Stop moved to breakeven at $${newStop}`);
}
```

**Prohibited Actions** (Must NOT do):
```javascript
// From TRADE_MANAGEMENT_CONTRACT - Banned List

// ❌ NO partial exits
if (rProgress >= 0.5) {
  // WRONG: Close 50% of position
  // RIGHT: Do nothing
}

// ❌ NO trailing stops
if (rProgress >= 1.0) {
  // WRONG: Implement trailing stop
  // RIGHT: Hold for target or stop
}

// ❌ NO target adjustments
if (currentPrice > target * 0.9) {
  // WRONG: Move target higher
  // RIGHT: Keep original target
}

// ❌ NO stop tightening
if (rProgress >= 0.5) {
  // WRONG: Move stop to +0.5R
  // RIGHT: Only move to BE at +0.8R, then never touch
}
```

---

### Workflow 5: Circuit Breaker Monitor

**File**: `n8n/workflows/circuit_breaker.json` (needs creation)

**Trigger**: After each trade closes + Daily at 00:00 UTC

**Contract**: `LIVE_TRADING_CONTRACT.md`

**Logic Flow**:
```
1. Query Recent Trades
   └─> SELECT * FROM trades WHERE closed_at > NOW() - INTERVAL '24 hours'

2. Calculate Circuit Breaker Metrics
   ├─> Consecutive losses: Count unbroken LOSS streak
   ├─> Daily loss: SUM(r_result) for today if negative
   └─> Current phase: From system_state table

3. Check Level 1 Triggers (24-hour pause)
   ├─> Consecutive losses >= 3?
   ├─> Daily loss >= 3%?
   └─> If YES to any:
       ├─> UPDATE system_state SET paused_until = NOW() + INTERVAL '24 hours'
       ├─> Close all open positions
       ├─> Cancel all pending orders
       ├─> Send urgent notification
       └─> Log: "Level 1 Circuit Breaker activated"

4. Check Level 2 Triggers (72-hour pause + manual reset)
   ├─> Monthly win rate < 50%?
   ├─> Consecutive losses >= 5?
   ├─> Any single trade loss > 1.5%?
   ├─> Phase drawdown limit hit?
   └─> If YES to any:
       ├─> UPDATE system_state SET paused_until = 'MANUAL_RESET_REQUIRED'
       ├─> Close all open positions
       ├─> Send emergency notification
       └─> Log: "Level 2 Circuit Breaker - MANUAL REVIEW REQUIRED"

5. Check Level 3 Triggers (Indefinite halt)
   ├─> Account drawdown >= 10%?
   ├─> 3 consecutive months negative?
   └─> If YES:
       ├─> UPDATE system_state SET paused_until = 'INDEFINITE_HALT'
       ├─> Disable all trading workflows
       ├─> Send emergency notification
       └─> Log: "Level 3 HALT - Full audit required"

6. If NO Circuit Breaker Triggered:
   └─> Verify system ready for trading
   └─> Log: "Circuit breaker check passed"
```

**Circuit Breaker State Table**:
```sql
CREATE TABLE system_state (
  id SERIAL PRIMARY KEY,
  active_trades INT DEFAULT 0,
  consecutive_losses INT DEFAULT 0,
  last_loss_timestamp TIMESTAMPTZ,
  daily_loss_percent DECIMAL(5,2) DEFAULT 0.00,
  monthly_win_rate DECIMAL(5,2) DEFAULT 0.00,
  account_drawdown DECIMAL(5,2) DEFAULT 0.00,
  paused_until TIMESTAMPTZ,
  pause_reason TEXT,
  current_phase INT DEFAULT 1,  -- From LIVE_TRADING_CONTRACT phases
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Daily Operating Checklist Integration

### Phase 0: Pre-Market System Verification (Automated via Claude Code)

**Automated using n8n SSH Node → Claude Code**

This workflow uses Claude Code to verify all system components are operational before enabling trading for the day.

**File**: `n8n/workflows/phase0_system_check.json` (needs creation)

**Trigger**: Manual webhook OR Daily at 08:00 UTC

**Logic Flow**:
```
1. n8n SSH Node → Connect to localhost
   └─> Execute: claude code --headless

2. Send Claude Code Prompt:
   "Execute the Phase 0 system verification checklist for the trading bot.
   Check all items in contract/DAILY_OPERATING_CHECKLIST.md Phase 0.

   Verify:
   1. PostgreSQL database connectivity and schema integrity
   2. Coinbase API connection and authentication
   3. No active circuit breakers in system_state table
   4. No pending manual review flags
   5. Sufficient account balance for minimum trade ($500+)
   6. Last 24h system logs have no critical errors
   7. All required environment variables present
   8. No positions left open from previous session

   Run: node scripts/verify_environment.js

   Return JSON result with status for each check."

3. Receive Claude Code Response:
   └─> Parse JSON output

4. Evaluate Results:
   ├─> If ALL checks PASS:
   │   ├─> UPDATE system_state SET ready_for_trading = true
   │   ├─> Enable all trading workflows (4H, 5M, Position Manager)
   │   ├─> Send notification: "✅ Phase 0 Complete - System Ready"
   │   └─> Log: "Phase 0 passed at [timestamp]"
   └─> If ANY check FAILS:
       ├─> UPDATE system_state SET ready_for_trading = false
       ├─> Keep all trading workflows disabled
       ├─> Send alert: "🚨 Phase 0 FAILED - [failure details]"
       └─> Log failure reason for manual review

5. Store Verification Log:
   └─> INSERT INTO system_logs (type, status, details, timestamp)
```

**Claude Code Verification Script** (`scripts/verify_environment.js`):
```javascript
// This script is executed by Claude Code via SSH
const { Pool } = require('pg');
const crypto = require('crypto');

async function runPhase0Checks() {
  const results = {
    timestamp: new Date().toISOString(),
    checks: []
  };

  // Check 1: PostgreSQL Connection
  try {
    const pool = new Pool({ connectionString: process.env.POSTGRES_CONNECTION_STRING });
    const res = await pool.query('SELECT NOW()');
    await pool.query('SELECT COUNT(*) FROM liquidity_sweeps');
    await pool.end();
    results.checks.push({ name: 'PostgreSQL', status: 'PASS', detail: 'Connected' });
  } catch (err) {
    results.checks.push({ name: 'PostgreSQL', status: 'FAIL', detail: err.message });
  }

  // Check 2: Coinbase API Authentication
  try {
    const apiKey = process.env.COINBASE_API_KEY;
    const apiSecret = process.env.COINBASE_API_SECRET;

    if (!apiKey || !apiSecret) throw new Error('API credentials missing');

    // Test ECDSA signing
    const timestamp = Math.floor(Date.now() / 1000);
    const method = 'GET';
    const path = '/api/v3/brokerage/accounts';

    const sign = crypto.createSign('SHA256');
    sign.update(timestamp + method + path);
    const signature = sign.sign(apiSecret, 'base64');

    // Make test API call
    const response = await fetch(`https://api.coinbase.com${path}`, {
      headers: {
        'CB-ACCESS-KEY': apiKey,
        'CB-ACCESS-SIGN': signature,
        'CB-ACCESS-TIMESTAMP': timestamp.toString()
      }
    });

    if (response.ok) {
      results.checks.push({ name: 'Coinbase API', status: 'PASS', detail: 'Authenticated' });
    } else {
      throw new Error(`API returned ${response.status}`);
    }
  } catch (err) {
    results.checks.push({ name: 'Coinbase API', status: 'FAIL', detail: err.message });
  }

  // Check 3: Circuit Breaker Status
  try {
    const pool = new Pool({ connectionString: process.env.POSTGRES_CONNECTION_STRING });
    const res = await pool.query(`
      SELECT paused_until, pause_reason
      FROM system_state
      WHERE id = 1
    `);

    if (!res.rows[0]) {
      results.checks.push({ name: 'Circuit Breaker', status: 'PASS', detail: 'No active pause' });
    } else {
      const pausedUntil = new Date(res.rows[0].paused_until);
      if (pausedUntil > new Date()) {
        results.checks.push({
          name: 'Circuit Breaker',
          status: 'FAIL',
          detail: `Paused until ${pausedUntil.toISOString()}: ${res.rows[0].pause_reason}`
        });
      } else {
        results.checks.push({ name: 'Circuit Breaker', status: 'PASS', detail: 'No active pause' });
      }
    }
    await pool.end();
  } catch (err) {
    results.checks.push({ name: 'Circuit Breaker', status: 'FAIL', detail: err.message });
  }

  // Check 4: Account Balance
  try {
    // Fetch from Coinbase (using authenticated API call)
    const balance = await getCoinbaseBalance();
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
    results.checks.push({ name: 'Account Balance', status: 'FAIL', detail: err.message });
  }

  // Check 5: Open Positions
  try {
    const pool = new Pool({ connectionString: process.env.POSTGRES_CONNECTION_STRING });
    const res = await pool.query(`
      SELECT COUNT(*) as open_count
      FROM trades
      WHERE status = 'ACTIVE'
    `);

    const openCount = parseInt(res.rows[0].open_count);
    if (openCount === 0) {
      results.checks.push({ name: 'Open Positions', status: 'PASS', detail: 'None (clean slate)' });
    } else {
      results.checks.push({
        name: 'Open Positions',
        status: 'WARN',
        detail: `${openCount} position(s) still open from previous session`
      });
    }
    await pool.end();
  } catch (err) {
    results.checks.push({ name: 'Open Positions', status: 'FAIL', detail: err.message });
  }

  // Check 6: Environment Variables
  const requiredVars = [
    'COINBASE_API_KEY',
    'COINBASE_API_SECRET',
    'POSTGRES_CONNECTION_STRING',
    'CURRENT_PHASE',
    'RISK_PERCENT'
  ];

  const missingVars = requiredVars.filter(v => !process.env[v]);
  if (missingVars.length === 0) {
    results.checks.push({ name: 'Environment', status: 'PASS', detail: 'All variables present' });
  } else {
    results.checks.push({
      name: 'Environment',
      status: 'FAIL',
      detail: `Missing: ${missingVars.join(', ')}`
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
    console.error(JSON.stringify({ error: err.message }, null, 2));
    process.exit(1);
  });
```

**n8n Workflow Configuration**:
```json
{
  "nodes": [
    {
      "name": "Trigger Phase 0",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "phase0-check",
        "method": "POST"
      }
    },
    {
      "name": "SSH to Claude Code",
      "type": "n8n-nodes-base.ssh",
      "parameters": {
        "authentication": "password",
        "host": "localhost",
        "port": 22,
        "username": "your_username",
        "command": "cd /Users/ble/TradingBot/historyBot && node scripts/verify_environment.js"
      }
    },
    {
      "name": "Parse Results",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "const output = $input.first().json.stdout;\nconst results = JSON.parse(output);\nreturn { json: results };"
      }
    },
    {
      "name": "Check Overall Status",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.overall }}",
              "value2": "FAIL"
            }
          ]
        }
      }
    },
    {
      "name": "Enable Trading (PASS)",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "executeQuery",
        "query": "UPDATE system_state SET ready_for_trading = true, last_phase0_check = NOW()"
      }
    },
    {
      "name": "Disable Trading (FAIL)",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "operation": "executeQuery",
        "query": "UPDATE system_state SET ready_for_trading = false, last_phase0_check = NOW()"
      }
    }
  ]
}
```

**Human Mental State Check** (Still Required):
While Claude Code automates system verification, the human mental state check remains your responsibility:
```
Before triggering Phase 0 webhook each day, ask yourself:
□ Am I rested and focused?
□ No urge to "make money today"
□ Acceptable to not trade at all today

If NO to any → Do not trigger Phase 0 webhook
If YES to all → Trigger Phase 0 webhook via curl or n8n UI
```

**Trigger Command**:
```bash
# Manual trigger via curl
curl -X POST http://localhost:5678/webhook/phase0-check

# OR via n8n UI: Click "Execute Workflow" button
```

If Phase 0 passes → All trading workflows enabled for the day
If Phase 0 fails → Trading workflows remain disabled, review logs

---

## Testing & Verification

### Phase-by-Phase Testing

**Phase 1: 4H Scanner Only**
```bash
# Run 4H workflow manually in n8n
# Expected: Detect swing levels, calculate RSI
# Verify: No trades executed, only DB logging
```

**Phase 2: 5M Monitor Only**
```bash
# Manually insert a test 4H bias in DB
# Run 5M workflow
# Expected: Detect when reclaim happens
# Verify: Sends alert but no trade execution
```

**Phase 3: Full Stack Paper Mode**
```bash
# Enable all workflows
# Set environment variable: PAPER_TRADING=true
# Expected: Full execution flow, but orders sent to log file instead of Coinbase
# Verify: 20 paper trades logged correctly
```

**Phase 4: Live with Minimum Capital**
```bash
# After Phase 0 paper validation passes (20+ trades, >55% WR)
# Set PAPER_TRADING=false
# Minimum capital: $500
# Expected: First live trade with 1% risk ($5)
```

### Monitoring Dashboard Requirements

**Real-time Indicators**:
```
✅ 4H Scanner: Last run 12:00 UTC (Next: 16:00 UTC)
✅ 5M Monitor: Active bias BULLISH since 14:30 UTC (Elapsed: 1.5hrs)
⏸️ Position: None open
📊 Phase: 1 (Validation: 5/20 trades)
🔄 Win Rate: 60% (3W/2L)
💰 P&L: +$47.00 (+0.94%)
🚨 Circuit Breaker: None
```

**Log Files** (`logs/` directory):
```
logs/
├── 4h_scanner.log       # All 4H bias detections
├── 5m_monitor.log       # Reclaim confirmations
├── trades.log           # Trade execution and management
├── circuit_breaker.log  # Pause events
└── errors.log           # System errors
```

---

## Environment Configuration

### .env File Template
```bash
# Coinbase API
COINBASE_API_KEY=organizations/xxx/apiKeys/xxx
COINBASE_API_SECRET=-----BEGIN EC PRIVATE KEY-----\nMHcCAQ...

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=trading_bot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# Trading Configuration
PAPER_TRADING=false
CURRENT_PHASE=1
RISK_PERCENT=0.01
MAX_POSITIONS=1

# Notifications (optional)
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id

# System
LOG_LEVEL=info
TIMEZONE=UTC
```

---

## Deployment Checklist

### Pre-Deployment
```
□ PostgreSQL running and accessible
□ Database schema created (run database/schema.sql)
□ Environment variables configured in .env
□ Coinbase API keys tested (run test_coinbase_connection.js)
□ n8n installed and accessible at http://localhost:5678
□ All 5 workflows imported into n8n
□ Workflow credentials configured (Coinbase, PostgreSQL, Telegram)
□ Mac Mini power settings: Never sleep
□ Mac Mini auto-login enabled
□ n8n auto-start configured
```

### Phase 0 Paper Trading
```
□ PAPER_TRADING=true in .env
□ 20+ paper trades logged
□ Win rate > 55%
□ No execution failures
□ All data logged correctly
□ Weekly review completed
```

### Phase 1 Live Deployment
```
□ Phase 0 validation complete
□ PAPER_TRADING=false
□ Capital: $500 minimum
□ CURRENT_PHASE=1
□ RISK_PERCENT=0.01
□ Emergency stop procedure tested
□ Telegram notifications working
□ Dashboard accessible
□ First trade checklist ready
```

---

## Emergency Procedures

### Emergency Stop (Manual)

**Trigger**: Create n8n webhook for instant shutdown

```
Workflow: emergency_stop.json
Trigger: Webhook POST /emergency-stop
Action:
  1. Close all open positions (market orders)
  2. Cancel all pending orders
  3. Disable all trading workflows
  4. UPDATE system_state SET paused_until = 'MANUAL_RESET_REQUIRED'
  5. Send emergency notification
  6. Log: "EMERGENCY STOP ACTIVATED - [timestamp]"
```

**Access**: Bookmark webhook URL or create physical button (e.g., Stream Deck)

### System Recovery

**After Circuit Breaker or Emergency Stop**:
```
1. Review all trades since last normal operation
2. Identify cause of failure (pattern breakdown, API error, etc.)
3. Verify all contracts still valid
4. Run database integrity check
5. Test Coinbase API connection
6. Reset system_state table if appropriate
7. Re-enable workflows one at a time
8. Monitor first trade closely
```

---

## Success Metrics

**System Health Indicators**:
```
✅ 4H Scanner: 5-6 signals per month (correct behavior)
✅ 5M Reclaim: 60-70% confirmation rate
✅ Win Rate: >60% (Phase 1), >65% (Phase 3)
✅ Expectancy: +0.94R per trade maintained
✅ Circuit Breakers: Level 1 OK, Level 2/3 never
✅ Uptime: 99%+ (n8n + Mac Mini)
✅ Order Execution: <2 second slippage
```

**Red Flags** (Investigate immediately):
```
🚨 4H Scanner: >10 signals per month (filters loosened?)
🚨 Win Rate: <50% after 20 trades (system broken)
🚨 Expectancy: Negative (edge disappeared)
🚨 Circuit Breaker: Level 2 triggered (manual review required)
🚨 API Errors: >5% of requests fail
🚨 Missed Signals: Workflows not executing on schedule
```

---

## One-Sentence Summary

**n8n executes the locked contracts mechanically: 4H permission, 1H session filter, 5M timing, 1M optimization, with 1% risk and swing-based stops — NO discretion, NO deviations.**
