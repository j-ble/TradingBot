# Trading Bot Implementation - Pull Request Breakdown
## BTC Futures Trading Bot - Incremental Development Plan

**Total PRs**: 22
**Estimated Timeline**: 3-4 weeks
**Status**: Ready for Implementation

---

## Table of Contents

1. [Phase 1: Foundation](#phase-1-foundation-prs-1-4)
2. [Phase 2: Data Collection](#phase-2-data-collection-prs-5-7)
3. [Phase 3: Pattern Detection](#phase-3-pattern-detection-prs-8-11)
4. [Phase 4: Trading Logic](#phase-4-trading-logic-prs-12-14)
5. [Phase 5: AI Integration](#phase-5-ai-integration-prs-15-16)
6. [Phase 6: Dashboard](#phase-6-dashboard-prs-17-19)
7. [Phase 7: Enhancements](#phase-7-enhancements-prs-20-22)
8. [PR Dependency Graph](#pr-dependency-graph)

---

## Phase 1: Foundation (PRs 1-4)

### PR #1: Database Schema and PostgreSQL Setup
**Size**: Medium | **Priority**: P0 | **Dependencies**: None

**Description**:
Set up PostgreSQL database with complete schema for the trading bot including all tables and indexes.

**Files to Create**:
- `database/schema.sql` - Complete database schema
- `database/migrations/001_initial_schema.sql` - Migration file
- `database/queries.js` - Reusable query functions
- `database/connection.js` - Database connection pool
- `.env.example` - Environment variables template

**Tables to Create**:
- `candles_4h` - 4-hour candlestick data
- `candles_5m` - 5-minute candlestick data
- `swing_levels` - Swing high/low tracking
- `liquidity_sweeps` - 4H sweep detection results
- `confluence_state` - 5M confluence state machine
- `trades` - Trade execution and history
- `system_config` - Bot configuration and emergency controls

**Testing Requirements**:
- Database connection successful
- All tables created with correct schema
- Indexes created properly
- Sample data insertion and retrieval
- Connection pool performance

**Acceptance Criteria**:
- [ ] PostgreSQL 16 installed and configured
- [ ] All 7 tables created with proper constraints
- [ ] Foreign key relationships working
- [ ] Indexes created for performance
- [ ] Connection pooling configured
- [ ] Basic CRUD operations tested

---

### PR #2: Coinbase API Client Wrapper
**Size**: Medium | **Priority**: P0 | **Dependencies**: None

**Description**:
Create a robust Coinbase Advanced Trade API client with authentication, error handling, and retry logic.

**Files to Create**:
- `lib/coinbase/client.js` - Main API wrapper class
- `lib/coinbase/auth.js` - Authentication and signing
- `lib/coinbase/endpoints.js` - API endpoint definitions
- `lib/coinbase/errors.js` - Custom error classes
- `tests/unit/coinbase/client.test.js` - Unit tests

**API Methods to Implement**:
```javascript
// Market Data
getCandles(productId, start, end, granularity) // granularity: FIVE_MINUTE, FOUR_HOUR
getBestBidAsk(productIds)
getMarketTrades(productId, limit)

// Account
listAccounts()
getAccount(accountUuid)

// Orders
createOrder(productId, side, orderConfiguration)
getOrder(orderId)
listOrders(filters) // filters: product_ids, order_status, start_date, end_date
cancelOrders(orderIds)
closePosition(productId, size)
previewOrder(productId, side, orderConfiguration)
```

**Base URL**: `https://api.coinbase.com`

**Features**:
- JWT Bearer token authentication (CDP API Key Secret)
- Rate limiting (10 requests/second)
- Automatic retry with exponential backoff
- Request/response logging
- Error handling and custom exceptions
- TypeScript-style JSDoc annotations

**Testing Requirements**:
- Mock API responses for all methods
- Test JWT token generation and signing
- Test rate limiting behavior
- Test retry logic on failures
- Integration test with Coinbase sandbox

**Acceptance Criteria**:
- [ ] All API methods implemented
- [ ] JWT authentication working with CDP API keys
- [ ] Rate limiting prevents exceeding limits
- [ ] Retry logic handles transient failures
- [ ] Comprehensive error handling
- [ ] Unit tests passing (>90% coverage)

---

### PR #3: Environment Configuration and Error Handling
**Size**: Small | **Priority**: P0 | **Dependencies**: None

**Description**:
Set up environment configuration management and global error handling infrastructure.

**Files to Create**:
- `lib/config/index.js` - Configuration loader and validator
- `lib/config/schema.js` - Configuration schema with Zod
- `lib/utils/logger.js` - Structured logging with levels
- `lib/utils/errors.js` - Custom error classes
- `lib/utils/validation.js` - Input validation helpers

**Configuration Categories**:
```javascript
// Database
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

// Coinbase API
COINBASE_API_KEY, COINBASE_API_SECRET, COINBASE_PASSPHRASE

// Trading
PAPER_TRADING_MODE (true/false)
ACCOUNT_BALANCE
LEVERAGE (2-5)
RISK_PER_TRADE (0.01 = 1%)

// AI
OLLAMA_HOST, OLLAMA_MODEL

// System
LOG_LEVEL (debug/info/warn/error)
EMERGENCY_STOP (true/false)
```

**Features**:
- Environment variable validation on startup
- Schema-based configuration with defaults
- Structured JSON logging with timestamps
- Log rotation and file output
- Error stack traces in development
- Graceful error handling

**Testing Requirements**:
- Test config loading with valid/invalid env vars
- Test logger output formats
- Test error handling and stack traces

**Acceptance Criteria**:
- [ ] All environment variables validated
- [ ] Configuration loaded and accessible
- [ ] Logger working with multiple levels
- [ ] Errors logged with stack traces
- [ ] Application fails fast on invalid config

---

### PR #4: Basic Utilities and Helpers
**Size**: Small | **Priority**: P1 | **Dependencies**: None

**Description**:
Implement common utility functions and helpers used across the application.

**Files to Create**:
- `lib/utils/math.js` - Mathematical calculations
- `lib/utils/time.js` - Time/date utilities
- `lib/utils/format.js` - Formatting functions
- `lib/utils/async.js` - Async helpers (retry, sleep, timeout)
- `tests/unit/utils/*.test.js` - Unit tests

**Utility Functions**:
```javascript
// Math utilities
calculatePercentageChange(oldValue, newValue)
roundToDecimals(number, decimals)
calculateRiskReward(entry, stop, target)
calculatePositionSize(balance, risk, stopDistance)

// Time utilities
getUnixTimestamp()
formatTimestamp(timestamp, format)
isWithinTimeRange(timestamp, start, end)
getCandle4HTimestamp(timestamp)
getCandle5MTimestamp(timestamp)

// Format utilities
formatPrice(price, decimals = 2)
formatBTC(amount, decimals = 8)
formatPercentage(value, decimals = 2)

// Async utilities
sleep(ms)
retry(fn, maxRetries, delayMs)
timeout(promise, ms)
```

**Testing Requirements**:
- Test all mathematical calculations
- Test timestamp conversions
- Test formatting edge cases
- Test async utilities (retry, timeout)

**Acceptance Criteria**:
- [ ] All utility functions implemented
- [ ] Comprehensive unit tests (>95% coverage)
- [ ] Edge cases handled (null, undefined, NaN)
- [ ] JSDoc documentation for all functions

---

## Phase 2: Data Collection (PRs 5-7)

### PR #5: 4H Candle Collector
**Size**: Medium | **Priority**: P0 | **Dependencies**: PR#1, PR#2

**Description**:
Implement 4-hour candle data collection, historical backfill, and ongoing updates.

**Files to Create**:
- `jobs/collect_4h.js` - Main collection job
- `lib/collectors/candle_collector_4h.js` - Collection logic
- `lib/collectors/backfill.js` - Historical data backfill
- `tests/integration/collectors/4h.test.js` - Integration tests

**Features**:
- Fetch 4H candles from Coinbase API
- Historical backfill (last 200 candles = ~800 hours = 33 days)
- Scheduled collection every 4 hours
- Duplicate prevention (UNIQUE constraint on timestamp)
- Data validation before storage
- Automatic gap detection and filling

**Candle Data Structure**:
```javascript
{
  timestamp: '2024-01-01T00:00:00Z',
  open: 90000.00,
  high: 91000.00,
  low: 89500.00,
  close: 90500.00,
  volume: 1234.56789012
}
```

**Scheduling**:
- Run at candle close: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC
- Use cron expression: `0 0,4,8,12,16,20 * * *`
- Retry on failure (3 attempts with 5min delay)

**Testing Requirements**:
- Test API fetch and parsing
- Test historical backfill
- Test duplicate handling
- Test gap detection and filling
- Test data validation

**Acceptance Criteria**:
- [ ] Historical backfill working (200 candles)
- [ ] Scheduled collection every 4 hours
- [ ] No duplicate candles stored
- [ ] Data validation prevents bad data
- [ ] Gaps automatically detected and filled
- [ ] Integration tests passing

---

### PR #6: 5M Candle Collector
**Size**: Medium | **Priority**: P0 | **Dependencies**: PR#1, PR#2

**Description**:
Implement 5-minute candle data collection with higher frequency updates.

**Files to Create**:
- `jobs/collect_5m.js` - Main collection job
- `lib/collectors/candle_collector_5m.js` - Collection logic
- `tests/integration/collectors/5m.test.js` - Integration tests

**Features**:
- Fetch 5M candles from Coinbase API
- Historical backfill (last 500 candles = 2,500 minutes = ~42 hours)
- Scheduled collection every 5 minutes
- Efficient storage (keep only last 1000 candles, ~3.5 days)
- Data pruning (delete candles older than 7 days)
- Fast retrieval for pattern detection

**Scheduling**:
- Run every 5 minutes: `*/5 * * * *`
- Offset by 30 seconds after candle close
- Retry on failure (2 attempts with 1min delay)

**Data Retention**:
```javascript
// Keep recent data for pattern detection
MAX_5M_CANDLES = 1000
RETENTION_DAYS = 7

// Prune old data daily
DELETE FROM candles_5m
WHERE timestamp < NOW() - INTERVAL '7 days'
```

**Testing Requirements**:
- Test 5-minute collection frequency
- Test data pruning logic
- Test retention limits
- Test concurrent collection safety

**Acceptance Criteria**:
- [ ] Historical backfill working (500 candles)
- [ ] Collection every 5 minutes
- [ ] Data pruning removes old candles
- [ ] Maximum 1000 candles maintained
- [ ] Fast retrieval queries (<50ms)
- [ ] Integration tests passing

---

### PR #7: WebSocket Real-Time Price Feed
**Size**: Medium | **Priority**: P1 | **Dependencies**: PR#2

**Description**:
Implement WebSocket connection for real-time BTC-USD price updates.

**Files to Create**:
- `lib/coinbase/websocket.js` - WebSocket client
- `lib/coinbase/price_feed.js` - Price feed manager
- `lib/utils/event_emitter.js` - Event handling
- `tests/integration/websocket.test.js` - Integration tests

**Features**:
- Subscribe to BTC-USD ticker channel
- Real-time price updates
- Automatic reconnection on disconnect
- Heartbeat monitoring (detect stale connections)
- Event emission for price changes
- In-memory latest price cache

**WebSocket Events**:
```javascript
// Subscribe
{
  "type": "subscribe",
  "channels": [
    {
      "name": "ticker",
      "product_ids": ["BTC-USD"]
    }
  ]
}

// Price update
{
  "type": "ticker",
  "product_id": "BTC-USD",
  "price": "90123.45",
  "time": "2024-01-01T12:00:00Z"
}
```

**Price Feed API**:
```javascript
const priceFeed = new PriceFeed()

// Start listening
await priceFeed.connect()

// Get latest price
const currentPrice = priceFeed.getCurrentPrice()

// Listen for updates
priceFeed.on('price_update', (price) => {
  console.log('New price:', price)
})

// Stop listening
await priceFeed.disconnect()
```

**Reconnection Logic**:
- Detect disconnect within 30 seconds
- Reconnect with exponential backoff
- Max 10 retry attempts
- Alert after 5 failed reconnections

**Testing Requirements**:
- Test WebSocket connection
- Test message parsing
- Test reconnection logic
- Test heartbeat monitoring
- Mock WebSocket server for tests

**Acceptance Criteria**:
- [ ] WebSocket connects successfully
- [ ] Price updates received in real-time
- [ ] Automatic reconnection on disconnect
- [ ] Latest price always available
- [ ] Event emission working
- [ ] Heartbeat monitoring functional

---

## Phase 3: Pattern Detection (PRs 8-11)

### PR #8: Swing Level Tracking System
**Size**: Medium | **Priority**: P0 | **Dependencies**: PR#1, PR#5, PR#6

**Description**:
Implement swing high/low detection and tracking for both 4H and 5M timeframes.

**Files to Create**:
- `lib/scanners/swing_tracker.js` - Swing detection logic
- `lib/scanners/swing_detector_4h.js` - 4H swing detection
- `lib/scanners/swing_detector_5m.js` - 5M swing detection
- `jobs/track_swings.js` - Scheduled swing tracking
- `tests/unit/scanners/swing_tracker.test.js` - Unit tests

**Swing Detection Algorithm** (3-candle pattern):
```javascript
// Swing High Detection
function detectSwingHigh(candles, index) {
  const current = candles[index]
  const before = candles[index - 2]
  const after = candles[index + 2]

  return current.high > before.high &&
         current.high > after.high
}

// Swing Low Detection
function detectSwingLow(candles, index) {
  const current = candles[index]
  const before = candles[index - 2]
  const after = candles[index + 2]

  return current.low < before.low &&
         current.low < after.low
}
```

**Database Operations**:
```javascript
// Store new swing
INSERT INTO swing_levels (
  timestamp, timeframe, swing_type, price, active
) VALUES (?, ?, ?, ?, true)

// Deactivate previous swing
UPDATE swing_levels
SET active = false
WHERE timeframe = ? AND swing_type = ? AND active = true

// Get most recent swing
SELECT * FROM swing_levels
WHERE timeframe = ? AND swing_type = ? AND active = true
ORDER BY timestamp DESC LIMIT 1
```

**Features**:
- Detect swing highs and lows on both timeframes
- Store swing levels in database
- Mark most recent swing as "active"
- Deactivate older swings
- Provide API to retrieve latest swings
- Track swing timestamps for reference

**Testing Requirements**:
- Test 3-candle pattern detection
- Test swing storage and retrieval
- Test active/inactive state management
- Test edge cases (not enough candles)
- Test both timeframes independently

**Acceptance Criteria**:
- [ ] Swing high detection working
- [ ] Swing low detection working
- [ ] Swings stored in database
- [ ] Active swing tracking correct
- [ ] API returns latest swing levels
- [ ] Unit tests passing (>90% coverage)

---

### PR #9: 4H Liquidity Sweep Detector
**Size**: Medium | **Priority**: P0 | **Dependencies**: PR#7, PR#8

**Description**:
Detect 4-hour liquidity sweeps and set market bias for 5M confluence detection.

**Files to Create**:
- `lib/scanners/4h_scanner.js` - Main sweep detection logic
- `lib/scanners/sweep_detector.js` - Sweep validation
- `jobs/scan_4h.js` - Scheduled 4H scanning
- `tests/unit/scanners/4h_scanner.test.js` - Unit tests

**Sweep Detection Logic**:
```javascript
// High Sweep Detection
function detectHighSweep(currentPrice, lastSwingHigh) {
  const sweepThreshold = lastSwingHigh * 1.001 // +0.1%
  return currentPrice > sweepThreshold
}

// Low Sweep Detection
function detectLowSweep(currentPrice, lastSwingLow) {
  const sweepThreshold = lastSwingLow * 0.999 // -0.1%
  return currentPrice < sweepThreshold
}
```

**Bias Assignment**:
```javascript
// HIGH swept → BEARISH bias (short reversal expected)
if (highSwept) {
  bias = 'BEARISH'
  direction = 'SHORT'
}

// LOW swept → BULLISH bias (long reversal expected)
if (lowSwept) {
  bias = 'BULLISH'
  direction = 'LONG'
}
```

**Database Storage**:
```sql
INSERT INTO liquidity_sweeps (
  timestamp,
  sweep_type,      -- 'HIGH' or 'LOW'
  price,           -- Current price at sweep
  bias,            -- 'BULLISH' or 'BEARISH'
  swing_level,     -- The swing level that was swept
  swing_level_id,  -- Reference to swing_levels table
  active           -- true (will be deactivated when confluence completes)
) VALUES (?, ?, ?, ?, ?, ?, true)
```

**Features**:
- Real-time sweep detection using WebSocket price
- Link sweep to the swing level that was swept
- Set bias for 5M confluence scanner
- Store sweep events in database
- Deactivate sweep when confluence completes or expires
- Alert/log sweep detection

**Scheduling**:
- Check for sweeps every minute using latest price
- Run dedicated scan after each 4H candle close
- Deactivate expired sweeps (>24 hours old)

**Testing Requirements**:
- Test high sweep detection
- Test low sweep detection
- Test sweep threshold calculations
- Test bias assignment
- Test database storage and retrieval

**Acceptance Criteria**:
- [ ] High sweeps detected accurately
- [ ] Low sweeps detected accurately
- [ ] Bias set correctly
- [ ] Sweeps stored with swing references
- [ ] Active sweep tracking working
- [ ] Unit tests passing (>90% coverage)

---

### PR #10: 5M Confluence State Machine
**Size**: Large | **Priority**: P0 | **Dependencies**: PR#6, PR#8, PR#9

**Description**:
Implement the 5-minute confluence detection state machine (CHoCH → FVG → BOS).

**Files to Create**:
- `lib/scanners/5m_scanner.js` - State machine orchestrator
- `lib/scanners/choch.js` - Change of Character detection
- `lib/scanners/fvg.js` - Fair Value Gap detection and fill
- `lib/scanners/bos.js` - Break of Structure detection
- `jobs/scan_5m.js` - Scheduled 5M scanning
- `tests/unit/scanners/confluence/*.test.js` - Unit tests

**State Machine Flow**:
```
WAITING_CHOCH → (CHoCH detected) → WAITING_FVG
WAITING_FVG → (FVG filled) → WAITING_BOS
WAITING_BOS → (BOS detected) → COMPLETE
Any state → (timeout >12h or invalidation) → EXPIRED
```

**CHoCH Detection** (lib/scanners/choch.js):
```javascript
// For BULLISH bias (after low sweep)
function detectBullishCHoCH(candles) {
  const recentHighs = candles.slice(-5).map(c => c.high)
  const currentPrice = candles[candles.length - 1].close
  const maxRecentHigh = Math.max(...recentHighs)

  return currentPrice > maxRecentHigh
}

// For BEARISH bias (after high sweep)
function detectBearishCHoCH(candles) {
  const recentLows = candles.slice(-5).map(c => c.low)
  const currentPrice = candles[candles.length - 1].close
  const minRecentLow = Math.min(...recentLows)

  return currentPrice < minRecentLow
}
```

**FVG Detection** (lib/scanners/fvg.js):
```javascript
// Detect Fair Value Gap (3-candle pattern)
function detectFVG(candles, bias) {
  const c1 = candles[candles.length - 3]
  const c2 = candles[candles.length - 2]
  const c3 = candles[candles.length - 1]

  if (bias === 'BULLISH') {
    // Bullish FVG: gap between c1.high and c3.low
    if (c1.high < c3.low) {
      const gapSize = c3.low - c1.high
      const currentPrice = c3.close

      if (gapSize > currentPrice * 0.001) { // >0.1% gap
        return {
          top: c3.low,
          bottom: c1.high,
          type: 'BULLISH',
          size: gapSize
        }
      }
    }
  } else if (bias === 'BEARISH') {
    // Bearish FVG: gap between c1.low and c3.high
    if (c1.low > c3.high) {
      const gapSize = c1.low - c3.high
      const currentPrice = c3.close

      if (gapSize > currentPrice * 0.001) { // >0.1% gap
        return {
          top: c1.low,
          bottom: c3.high,
          type: 'BEARISH',
          size: gapSize
        }
      }
    }
  }

  return null
}

// Detect FVG Fill
function detectFVGFill(candle, fvgZone, bias) {
  if (bias === 'BULLISH') {
    return candle.low >= fvgZone.bottom &&
           candle.low <= fvgZone.top
  } else {
    return candle.high >= fvgZone.bottom &&
           candle.high <= fvgZone.top
  }
}
```

**BOS Detection** (lib/scanners/bos.js):
```javascript
// Break of Structure confirmation
function detectBOS(currentPrice, chochPrice, bias) {
  if (bias === 'BULLISH') {
    // Must break above CHoCH high
    return currentPrice > chochPrice * 1.001 // +0.1%
  } else if (bias === 'BEARISH') {
    // Must break below CHoCH low
    return currentPrice < chochPrice * 0.999 // -0.1%
  }
  return false
}
```

**State Persistence**:
```sql
-- Update confluence state
UPDATE confluence_state SET
  current_state = ?,
  choch_detected = ?,
  choch_time = ?,
  choch_price = ?,
  fvg_detected = ?,
  fvg_zone_low = ?,
  fvg_zone_high = ?,
  fvg_fill_price = ?,
  fvg_fill_time = ?,
  bos_detected = ?,
  bos_time = ?,
  bos_price = ?,
  sequence_valid = ?,
  updated_at = NOW()
WHERE sweep_id = ?
```

**Features**:
- State machine manages progression through stages
- Each stage validates independently
- State persisted to database for recovery
- Timeout handling (expire after 12 hours)
- Invalidation on price action reversal
- Complete signal triggers AI decision

**Testing Requirements**:
- Test each stage independently
- Test state transitions
- Test timeout expiration
- Test invalidation conditions
- Test database state persistence

**Acceptance Criteria**:
- [ ] CHoCH detection working for both biases
- [ ] FVG detection and fill working
- [ ] BOS detection confirming structure break
- [ ] State machine transitions correctly
- [ ] Timeout expiration after 12 hours
- [ ] State persisted to database
- [ ] COMPLETE state triggers next stage
- [ ] Unit tests passing (>85% coverage)

---

### PR #11: Pattern Validation and State Persistence
**Size**: Small | **Priority**: P1 | **Dependencies**: PR#10

**Description**:
Add validation, error handling, and state recovery for the confluence detection system.

**Files to Create**:
- `lib/scanners/validator.js` - Pattern validation logic
- `lib/scanners/state_recovery.js` - Recover state after restart
- `tests/unit/scanners/validator.test.js` - Unit tests

**Validation Rules**:
```javascript
// Validate complete confluence setup
function validateConfluence(confluenceState) {
  const checks = {
    chochValid: confluenceState.choch_detected === true,
    fvgValid: confluenceState.fvg_detected === true,
    bosValid: confluenceState.bos_detected === true,
    sequenceValid: isCorrectSequence(confluenceState),
    timeValid: !isExpired(confluenceState),
    priceValid: isPriceActionValid(confluenceState)
  }

  return Object.values(checks).every(v => v === true)
}

// Check correct sequence order
function isCorrectSequence(state) {
  if (!state.choch_time) return false
  if (!state.fvg_fill_time) return false
  if (!state.bos_time) return false

  return state.choch_time < state.fvg_fill_time &&
         state.fvg_fill_time < state.bos_time
}

// Check not expired
function isExpired(state) {
  const now = Date.now()
  const createdAt = new Date(state.created_at).getTime()
  const TWELVE_HOURS = 12 * 60 * 60 * 1000

  return (now - createdAt) > TWELVE_HOURS
}
```

**State Recovery**:
```javascript
// Recover active confluences on startup
async function recoverActiveStates() {
  const activeStates = await db.query(`
    SELECT * FROM confluence_state
    WHERE current_state NOT IN ('COMPLETE', 'EXPIRED')
    ORDER BY created_at DESC
  `)

  for (const state of activeStates) {
    if (isExpired(state)) {
      await expireState(state.id)
    } else {
      // Resume monitoring
      await resumeStateMonitoring(state)
    }
  }
}
```

**Features**:
- Validate confluence completeness
- Check sequence order (CHoCH → FVG → BOS)
- Detect expired states
- Invalidate on price reversal
- Recover state after system restart
- Clean up stale states

**Testing Requirements**:
- Test validation logic
- Test expiration detection
- Test state recovery
- Test cleanup of old states

**Acceptance Criteria**:
- [ ] Confluence validation working
- [ ] Sequence order verified
- [ ] Expired states detected
- [ ] State recovery on restart
- [ ] Stale states cleaned up
- [ ] Unit tests passing (>90% coverage)

---

## Phase 4: Trading Logic (PRs 12-14)

### PR #12: Swing-Based Stop Loss Calculator
**Size**: Medium | **Priority**: P0 | **Dependencies**: PR#8

**Description**:
Implement swing-based stop loss calculation with priority logic and constraints.

**Files to Create**:
- `lib/trading/stop_loss_calculator.js` - Stop loss logic
- `lib/trading/swing_selector.js` - Select appropriate swing
- `tests/unit/trading/stop_loss.test.js` - Unit tests

**Stop Loss Priority Logic**:
```javascript
async function calculateStopLoss(entry, direction, bias) {
  // 1. Try 5M swing first
  const swing5M = await getRecentSwing('5M', direction)
  const stop5M = calculateStopWithBuffer(swing5M, direction)

  if (isValidStop(stop5M, entry)) {
    return {
      price: stop5M,
      source: '5M_SWING',
      swingPrice: swing5M,
      distance: calculateDistance(entry, stop5M)
    }
  }

  // 2. Fallback to 4H swing
  const swing4H = await getRecentSwing('4H', direction)
  const stop4H = calculateStopWithBuffer(swing4H, direction)

  if (isValidStop(stop4H, entry)) {
    return {
      price: stop4H,
      source: '4H_SWING',
      swingPrice: swing4H,
      distance: calculateDistance(entry, stop4H)
    }
  }

  // 3. No valid swing found
  return null
}
```

**Buffer Calculation**:
```javascript
function calculateStopWithBuffer(swingPrice, direction) {
  if (direction === 'LONG') {
    // Stop below swing low - 0.2% buffer
    return swingPrice * 0.998
  } else {
    // Stop above swing high + 0.3% buffer
    return swingPrice * 1.003
  }
}
```

**Validation**:
```javascript
function isValidStop(stopPrice, entryPrice) {
  const distance = Math.abs(entryPrice - stopPrice) / entryPrice
  const distancePercent = distance * 100

  // Must be between 0.5% and 3%
  return distancePercent >= 0.5 && distancePercent <= 3.0
}
```

**Features**:
- Priority logic: 5M → 4H → Reject
- Buffer zones: 0.2-0.3% beyond swing
- Distance constraints: 0.5%-3% from entry
- Return swing source for tracking
- Calculate distance percentage

**Testing Requirements**:
- Test 5M swing selection
- Test 4H fallback
- Test buffer calculation
- Test distance validation
- Test edge cases (swing too close/far)

**Acceptance Criteria**:
- [ ] 5M swing prioritized correctly
- [ ] 4H swing used as fallback
- [ ] Buffer applied correctly
- [ ] Distance constraints enforced
- [ ] Invalid swings rejected
- [ ] Unit tests passing (>90% coverage)

---

### PR #13: Position Sizer and Risk Manager
**Size**: Medium | **Priority**: P0 | **Dependencies**: PR#12

**Description**:
Calculate position sizes based on 1% risk and enforce risk management rules.

**Files to Create**:
- `lib/trading/position_sizer.js` - Position size calculation
- `lib/trading/risk_manager.js` - Risk checks and limits
- `tests/unit/trading/risk_manager.test.js` - Unit tests

**Position Sizing**:
```javascript
function calculatePositionSize(accountBalance, entry, stopLoss) {
  const riskAmount = accountBalance * 0.01 // 1% risk
  const stopDistance = Math.abs(entry - stopLoss)
  const positionSizeBTC = riskAmount / stopDistance
  const positionSizeUSD = positionSizeBTC * entry

  return {
    btc: positionSizeBTC,
    usd: positionSizeUSD,
    riskAmount: riskAmount,
    stopDistance: stopDistance
  }
}

// Example:
// Balance: $10,000
// Entry: $90,000
// Stop: $87,300 (3% away)
// Risk: $100 (1%)
// Stop Distance: $2,700
// Position: $100 / $2,700 = 0.037 BTC = $3,333 USD
```

**Risk/Reward Validation**:
```javascript
function validateRiskReward(entry, stopLoss, takeProfit, direction) {
  const stopDistance = Math.abs(entry - stopLoss)
  const targetDistance = Math.abs(takeProfit - entry)
  const rrRatio = targetDistance / stopDistance

  return {
    valid: rrRatio >= 2.0,
    ratio: rrRatio,
    minTarget: direction === 'LONG'
      ? entry + (stopDistance * 2)
      : entry - (stopDistance * 2)
  }
}
```

**Risk Manager Checks**:
```javascript
async function validateTrade(tradeParams) {
  const checks = {
    // Position limit
    positionLimit: await checkPositionLimit(),

    // Daily loss limit
    dailyLoss: await checkDailyLossLimit(),

    // Consecutive losses
    consecutiveLosses: await checkConsecutiveLosses(),

    // Account balance
    accountBalance: await checkAccountBalance(),

    // Stop loss valid
    stopLossValid: validateStopLoss(tradeParams),

    // R/R ratio
    rrRatio: validateRiskReward(tradeParams).valid,

    // API connection
    apiConnected: await checkCoinbaseAPI()
  }

  return {
    approved: Object.values(checks).every(v => v === true),
    checks: checks,
    failedChecks: Object.keys(checks).filter(k => !checks[k])
  }
}
```

**Risk Limits**:
```javascript
const RISK_LIMITS = {
  MAX_POSITIONS: 1,
  RISK_PER_TRADE: 0.01, // 1%
  DAILY_LOSS_LIMIT: 0.03, // 3%
  CONSECUTIVE_LOSS_LIMIT: 3,
  MIN_ACCOUNT_BALANCE: 100,
  MIN_RR_RATIO: 2.0,
  MAX_RR_RATIO: 5.0
}
```

**Features**:
- 1% fixed risk per trade
- Position size calculated from stop distance
- R/R ratio validation (min 2:1)
- Pre-trade risk checks
- Daily loss tracking
- Consecutive loss protection
- Account balance monitoring

**Testing Requirements**:
- Test position size calculation
- Test R/R ratio validation
- Test each risk check independently
- Test daily loss calculation
- Test consecutive loss counting

**Acceptance Criteria**:
- [ ] Position size always 1% risk
- [ ] R/R ratio >= 2:1 enforced
- [ ] Max 1 position enforced
- [ ] Daily loss limit prevents trades
- [ ] 3 consecutive losses trigger pause
- [ ] All risk checks validated
- [ ] Unit tests passing (>90% coverage)

---

### PR #14: Trade Execution Engine
**Size**: Large | **Priority**: P0 | **Dependencies**: PR#2, PR#13

**Description**:
Execute trades on Coinbase with market orders, stop loss, and take profit.

**Files to Create**:
- `lib/trading/executor.js` - Main execution engine
- `lib/trading/order_manager.js` - Order placement and tracking
- `lib/trading/monitor.js` - Position monitoring
- `tests/integration/trading/execution.test.js` - Integration tests

**Execution Flow**:
```javascript
async function executeTrade(tradeDecision) {
  try {
    // 1. Pre-execution validation
    const validation = await validateExecution(tradeDecision)
    if (!validation.approved) {
      throw new Error(`Validation failed: ${validation.failedChecks}`)
    }

    // 2. Place market entry order
    const entryOrder = await placeMarketOrder({
      productId: 'BTC-USD',
      side: tradeDecision.direction === 'LONG' ? 'BUY' : 'SELL',
      size: tradeDecision.position_size_btc
    })

    // 3. Wait for fill
    const fill = await waitForOrderFill(entryOrder.id, 30000) // 30s timeout

    // 4. Place stop loss order
    const stopOrder = await placeStopLossOrder({
      productId: 'BTC-USD',
      side: tradeDecision.direction === 'LONG' ? 'SELL' : 'BUY',
      size: tradeDecision.position_size_btc,
      stopPrice: tradeDecision.stop_loss
    })

    // 5. Place take profit order
    const tpOrder = await placeTakeProfitOrder({
      productId: 'BTC-USD',
      side: tradeDecision.direction === 'LONG' ? 'SELL' : 'BUY',
      size: tradeDecision.position_size_btc,
      limitPrice: tradeDecision.take_profit
    })

    // 6. Save trade to database
    const trade = await saveTrade({
      ...tradeDecision,
      entry_price: fill.price,
      entry_time: fill.timestamp,
      coinbase_entry_order_id: entryOrder.id,
      coinbase_stop_order_id: stopOrder.id,
      coinbase_tp_order_id: tpOrder.id,
      status: 'OPEN'
    })

    // 7. Start position monitoring
    await startMonitoring(trade.id)

    return trade
  } catch (error) {
    logger.error('Trade execution failed:', error)
    throw error
  }
}
```

**Pre-Execution Validation**:
```javascript
async function validateExecution(decision) {
  const currentPrice = await getCurrentPrice('BTC-USD')

  const checks = {
    // Price within 0.2% of expected entry
    priceValid: Math.abs(currentPrice - decision.entry_price) / decision.entry_price < 0.002,

    // Stop on correct side
    stopSide: decision.direction === 'LONG'
      ? decision.stop_loss < decision.entry_price
      : decision.stop_loss > decision.entry_price,

    // TP achievable
    tpValid: decision.direction === 'LONG'
      ? decision.take_profit > decision.entry_price
      : decision.take_profit < decision.entry_price,

    // Position size correct
    sizeValid: validatePositionSize(decision)
  }

  return {
    approved: Object.values(checks).every(v => v === true),
    checks: checks
  }
}
```

**Position Monitoring**:
```javascript
// Monitor open position every 30 seconds
async function monitorPosition(tradeId) {
  const trade = await getTrade(tradeId)

  // Check if SL or TP filled
  const stopOrder = await getOrder(trade.coinbase_stop_order_id)
  const tpOrder = await getOrder(trade.coinbase_tp_order_id)

  if (stopOrder.status === 'FILLED') {
    await closeTrade(tradeId, 'LOSS', stopOrder.fill_price)
  } else if (tpOrder.status === 'FILLED') {
    await closeTrade(tradeId, 'WIN', tpOrder.fill_price)
  }

  // Check time-based exit (>72 hours)
  const hoursOpen = (Date.now() - new Date(trade.entry_time)) / (1000 * 60 * 60)
  if (hoursOpen > 72) {
    await closePositionAtMarket(tradeId)
  }

  // Update P&L
  const currentPrice = await getCurrentPrice('BTC-USD')
  await updateTradeMetrics(tradeId, currentPrice)
}
```

**Features**:
- Market order entry execution
- Stop loss order placement
- Take profit order placement
- Order fill confirmation
- Position monitoring (30s intervals)
- Time-based exit (72 hours)
- Trade status updates
- P&L tracking

**Testing Requirements**:
- Test order placement (mock API)
- Test order fill waiting
- Test SL/TP placement
- Test position monitoring
- Test trade closure
- Integration test with Coinbase sandbox

**Acceptance Criteria**:
- [ ] Market orders execute successfully
- [ ] Stop loss orders placed correctly
- [ ] Take profit orders placed correctly
- [ ] Fill confirmation working
- [ ] Position monitoring active
- [ ] Time-based exit after 72h
- [ ] Trade status updated correctly
- [ ] Integration tests passing

---

## Phase 5: AI Integration (PRs 15-16)

### PR #15: AI Prompt Templates and Ollama Integration
**Size**: Medium | **Priority**: P0 | **Dependencies**: PR#11, PR#12

**Description**:
Integrate Ollama local LLM for trade decision-making with structured prompts.

**Files to Create**:
- `lib/ai/decision.js` - AI decision engine
- `lib/ai/prompts.js` - Prompt template builder
- `lib/ai/ollama_client.js` - Ollama API client
- `tests/unit/ai/decision.test.js` - Unit tests

**Ollama Client**:
```javascript
class OllamaClient {
  constructor(host = 'http://localhost:11434', model = 'gpt-oss:20b') {
    this.host = host
    this.model = model
  }

  async generate(prompt, options = {}) {
    const response = await axios.post(`${this.host}/api/generate`, {
      model: this.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options.temperature || 0.3,
        top_p: options.top_p || 0.9,
        ...options
      }
    })

    return response.data.response
  }
}
```

**Prompt Builder**:
```javascript
function buildPrompt(setupData) {
  return `You are an expert BTC futures trader using liquidity-based technical analysis.

GOAL: Achieve 90% win rate through disciplined trade selection.

ENTRY RULES:
- Trade ONLY when all 4 confluences align:
  1. 4H liquidity sweep (high or low)
  2. 5M CHoCH (change of character)
  3. 5M FVG fill (fair value gap filled)
  4. 5M BOS (break of structure)

RISK RULES:
- Position size: ALWAYS 1% of account balance
- Stop loss: MUST use swing-based placement (5M or 4H swing level)
- Stop loss distance: MUST be 0.5%-3% from entry
- Take profit: Minimum 2:1 R/R ratio (based on swing stop)
- If swing-based stop doesn't allow 2:1 R/R, REJECT the trade
- Never override safety checks

CURRENT SETUP:
- 4H Sweep: ${setupData.sweepType} at $${setupData.sweepPrice} (${setupData.bias} bias)
- CHoCH: Detected at $${setupData.chochPrice} at ${setupData.chochTime}
- FVG: $${setupData.fvgLow} - $${setupData.fvgHigh}, filled at $${setupData.fvgFillPrice}
- BOS: Detected at $${setupData.bosPrice} at ${setupData.bosTime}
- Current Price: $${setupData.currentPrice}
- Account Balance: $${setupData.accountBalance}

SWING LEVELS (for stop loss calculation):
- Most Recent 5M Swing ${setupData.swing5MType}: $${setupData.swing5MPrice} at ${setupData.swing5MTime}
- 4H Sweep Swing ${setupData.swing4HType}: $${setupData.swing4HPrice} at ${setupData.swing4HTime}
- Recommended Stop (with 0.2-0.3% buffer): $${setupData.recommendedStop}
- Stop Distance from Entry: ${setupData.stopDistancePercent}%

ACCOUNT STATUS:
- Open Positions: ${setupData.openPositions}
- Recent Win Rate: ${setupData.winRate}%
- Consecutive Losses: ${setupData.consecutiveLosses}

STOP LOSS CALCULATION:
For LONG: Use most recent swing low - 0.2-0.3% buffer
For SHORT: Use most recent swing high + 0.2-0.3% buffer
Verify stop is 0.5%-3% from entry
If stop distance invalid, try alternate timeframe swing
If both invalid, return "NO"

RESPOND in JSON:
{
  "trade_decision": "YES" | "NO",
  "direction": "LONG" | "SHORT",
  "entry_price": number,
  "stop_loss": number,
  "stop_loss_source": "5M_SWING" | "4H_SWING",
  "take_profit": number,
  "position_size_btc": number,
  "risk_reward_ratio": number,
  "confidence": number (0-100),
  "reasoning": "detailed explanation including why the swing-based stop is valid"
}

CRITICAL:
- Stop loss MUST be based on swing levels, not arbitrary percentages
- If stop loss doesn't meet 0.5%-3% constraint, return "NO"
- If R/R ratio < 2:1 with swing-based stop, return "NO"
- If ANY doubt exists, return "NO". Be conservative.`
}
```

**AI Decision Engine**:
```javascript
async function getTradeDecision(confluenceState, sweepData) {
  // 1. Gather all required data
  const setupData = await buildSetupData(confluenceState, sweepData)

  // 2. Build prompt
  const prompt = buildPrompt(setupData)

  // 3. Call AI model
  const ollama = new OllamaClient()
  const response = await ollama.generate(prompt, {
    temperature: 0.3, // Low temperature for consistency
    timeout: 30000 // 30 second timeout
  })

  // 4. Parse JSON response
  const decision = parseAIResponse(response)

  // 5. Validate decision
  if (!validateAIDecision(decision)) {
    throw new Error('Invalid AI decision format')
  }

  // 6. Store AI reasoning
  await storeAIDecision(confluenceState.id, decision)

  return decision
}
```

**Response Parsing**:
```javascript
function parseAIResponse(response) {
  // Extract JSON from response (may have extra text)
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response')
  }

  const decision = JSON.parse(jsonMatch[0])

  // Validate required fields
  const required = [
    'trade_decision', 'direction', 'entry_price',
    'stop_loss', 'stop_loss_source', 'take_profit',
    'position_size_btc', 'risk_reward_ratio',
    'confidence', 'reasoning'
  ]

  for (const field of required) {
    if (!(field in decision)) {
      throw new Error(`Missing required field: ${field}`)
    }
  }

  return decision
}
```

**Features**:
- Ollama API integration
- Structured prompt templates
- Setup data gathering
- JSON response parsing
- Decision validation
- Confidence scoring
- AI reasoning storage

**Testing Requirements**:
- Test Ollama client connection
- Test prompt building
- Test response parsing
- Test decision validation
- Mock AI responses for tests

**Acceptance Criteria**:
- [ ] Ollama client connects successfully
- [ ] Prompts built correctly with all data
- [ ] AI responses parsed correctly
- [ ] JSON validation working
- [ ] Confidence >= 70 enforced
- [ ] AI reasoning stored
- [ ] Unit tests passing (>85% coverage)

---

### PR #16: AI Decision Validation and Safety Checks
**Size**: Small | **Priority**: P0 | **Dependencies**: PR#15

**Description**:
Add validation and safety checks for AI decisions before execution.

**Files to Create**:
- `lib/ai/validation.js` - AI decision validation
- `lib/ai/safety.js` - Safety checks and overrides
- `tests/unit/ai/validation.test.js` - Unit tests

**Decision Validation**:
```javascript
function validateAIDecision(decision, setupData) {
  const errors = []

  // 1. Trade decision must be YES or NO
  if (!['YES', 'NO'].includes(decision.trade_decision)) {
    errors.push('Invalid trade_decision value')
  }

  // 2. Direction must match bias
  const expectedDirection = setupData.bias === 'BULLISH' ? 'LONG' : 'SHORT'
  if (decision.direction !== expectedDirection) {
    errors.push(`Direction ${decision.direction} doesn't match bias ${setupData.bias}`)
  }

  // 3. Entry price within 0.5% of current
  const entryDiff = Math.abs(decision.entry_price - setupData.currentPrice) / setupData.currentPrice
  if (entryDiff > 0.005) {
    errors.push('Entry price too far from current price')
  }

  // 4. Stop loss on correct side
  if (decision.direction === 'LONG' && decision.stop_loss >= decision.entry_price) {
    errors.push('Stop loss must be below entry for LONG')
  }
  if (decision.direction === 'SHORT' && decision.stop_loss <= decision.entry_price) {
    errors.push('Stop loss must be above entry for SHORT')
  }

  // 5. Stop loss distance 0.5%-3%
  const stopDistance = Math.abs(decision.entry_price - decision.stop_loss) / decision.entry_price
  if (stopDistance < 0.005 || stopDistance > 0.03) {
    errors.push(`Stop distance ${stopDistance * 100}% outside 0.5%-3% range`)
  }

  // 6. R/R ratio >= 2:1
  if (decision.risk_reward_ratio < 2.0) {
    errors.push(`R/R ratio ${decision.risk_reward_ratio} below 2:1 minimum`)
  }

  // 7. Confidence >= 70
  if (decision.confidence < 70) {
    errors.push(`Confidence ${decision.confidence} below 70 threshold`)
  }

  // 8. Position size reasonable
  const expectedSize = calculatePositionSize(
    setupData.accountBalance,
    decision.entry_price,
    decision.stop_loss
  )
  const sizeDiff = Math.abs(decision.position_size_btc - expectedSize.btc) / expectedSize.btc
  if (sizeDiff > 0.05) { // 5% tolerance
    errors.push('Position size calculation incorrect')
  }

  return {
    valid: errors.length === 0,
    errors: errors
  }
}
```

**Safety Overrides**:
```javascript
// Override AI decision if conditions unsafe
function applySafetyOverrides(decision, marketConditions) {
  const overrides = []

  // 1. Extreme volatility
  if (marketConditions.volatility > 0.05) { // >5%
    overrides.push('Extreme volatility detected')
    decision.trade_decision = 'NO'
  }

  // 2. Low liquidity
  if (marketConditions.volume < marketConditions.avgVolume * 0.3) {
    overrides.push('Low liquidity detected')
    decision.trade_decision = 'NO'
  }

  // 3. Spread too wide
  if (marketConditions.spread > 0.001) { // >0.1%
    overrides.push('Spread too wide')
    decision.trade_decision = 'NO'
  }

  // 4. Near major economic event (if tracked)
  if (marketConditions.majorEventSoon) {
    overrides.push('Major economic event approaching')
    decision.trade_decision = 'NO'
  }

  return {
    decision: decision,
    overridden: overrides.length > 0,
    overrides: overrides
  }
}
```

**Features**:
- Comprehensive decision validation
- Direction vs bias verification
- Price sanity checks
- R/R ratio enforcement
- Confidence threshold
- Safety overrides for extreme conditions
- Validation error reporting

**Testing Requirements**:
- Test each validation rule
- Test safety overrides
- Test edge cases
- Test error reporting

**Acceptance Criteria**:
- [ ] All validation rules enforced
- [ ] Direction matches bias
- [ ] Stop loss on correct side
- [ ] R/R ratio >= 2:1 verified
- [ ] Confidence >= 70 enforced
- [ ] Safety overrides working
- [ ] Unit tests passing (>90% coverage)

---

## Phase 6: Dashboard (PRs 17-19)

### PR #17: Basic Next.js Dashboard with System Status
**Size**: Medium | **Priority**: P1 | **Dependencies**: PR#1

**Description**:
Create basic Next.js dashboard showing system status and open positions.

**Files to Create**:
- `dashboard/app/page.tsx` - Main dashboard page
- `dashboard/app/api/status/route.ts` - System status API
- `dashboard/app/api/positions/route.ts` - Open positions API
- `dashboard/components/SystemStatus.tsx` - Status display
- `dashboard/components/PositionCard.tsx` - Position display
- `dashboard/components/EmergencyStop.tsx` - Emergency stop button
- `dashboard/lib/api.ts` - API client
- `dashboard/tailwind.config.js` - Tailwind configuration

**Dashboard Layout**:
```tsx
// app/page.tsx
export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4">
        <h1 className="text-2xl font-bold">BTC Trading Bot</h1>
      </header>

      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* System Status */}
          <SystemStatus />

          {/* Emergency Controls */}
          <EmergencyStop />

          {/* Account Summary */}
          <AccountSummary />

          {/* Open Positions */}
          <div className="col-span-full">
            <OpenPositions />
          </div>
        </div>
      </main>
    </div>
  )
}
```

**System Status Component**:
```tsx
// components/SystemStatus.tsx
export function SystemStatus() {
  const { data: status } = useSWR('/api/status', fetcher, {
    refreshInterval: 5000 // Refresh every 5 seconds
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <StatusRow
            label="Trading Mode"
            value={status?.paperMode ? 'Paper' : 'Live'}
            status={status?.paperMode ? 'warning' : 'success'}
          />
          <StatusRow
            label="Database"
            value={status?.database ? 'Connected' : 'Disconnected'}
            status={status?.database ? 'success' : 'error'}
          />
          <StatusRow
            label="Coinbase API"
            value={status?.coinbase ? 'Connected' : 'Disconnected'}
            status={status?.coinbase ? 'success' : 'error'}
          />
          <StatusRow
            label="AI Model"
            value={status?.ai ? 'Ready' : 'Unavailable'}
            status={status?.ai ? 'success' : 'error'}
          />
          <StatusRow
            label="WebSocket"
            value={status?.websocket ? 'Connected' : 'Disconnected'}
            status={status?.websocket ? 'success' : 'error'}
          />
        </div>
      </CardContent>
    </Card>
  )
}
```

**Position Card Component**:
```tsx
// components/PositionCard.tsx
export function PositionCard({ position }) {
  const pnl = calculatePnL(position)
  const pnlColor = pnl >= 0 ? 'text-green-500' : 'text-red-500'

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>
            {position.direction} BTC-USD
          </CardTitle>
          <Badge variant={position.direction === 'LONG' ? 'success' : 'destructive'}>
            {position.direction}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <DataRow label="Entry" value={`$${position.entry_price}`} />
          <DataRow label="Size" value={`${position.position_size_btc} BTC`} />
          <DataRow label="Stop Loss" value={`$${position.stop_loss}`} />
          <DataRow label="Take Profit" value={`$${position.take_profit}`} />
          <DataRow label="R/R Ratio" value={`${position.risk_reward_ratio}:1`} />
          <DataRow label="P&L" value={`$${pnl}`} className={pnlColor} />
        </div>

        <div className="mt-4">
          <Progress
            value={calculateProgressToTarget(position)}
            className="h-2"
          />
          <p className="text-sm text-gray-400 mt-1">
            Progress to target: {calculateProgressToTarget(position)}%
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
```

**API Routes**:
```typescript
// app/api/status/route.ts
export async function GET() {
  const status = {
    paperMode: process.env.PAPER_TRADING_MODE === 'true',
    database: await checkDatabaseConnection(),
    coinbase: await checkCoinbaseAPI(),
    ai: await checkOllamaModel(),
    websocket: await checkWebSocketConnection(),
    emergencyStop: await getEmergencyStopStatus()
  }

  return Response.json(status)
}

// app/api/positions/route.ts
export async function GET() {
  const positions = await db.query(`
    SELECT * FROM trades
    WHERE status = 'OPEN'
    ORDER BY entry_time DESC
  `)

  return Response.json(positions)
}
```

**Features**:
- Real-time system status
- Open position display
- P&L tracking
- Emergency stop button
- Auto-refresh (5 seconds)
- Responsive design
- Dark theme

**Testing Requirements**:
- Test component rendering
- Test API routes
- Test real-time updates
- Test emergency stop

**Acceptance Criteria**:
- [ ] Dashboard loads successfully
- [ ] System status displays correctly
- [ ] Open positions shown
- [ ] P&L calculated accurately
- [ ] Auto-refresh working
- [ ] Emergency stop functional
- [ ] Responsive on mobile

---

### PR #18: Trading Charts and Position Visualization
**Size**: Large | **Priority**: P1 | **Dependencies**: PR#17

**Description**:
Add interactive trading charts with pattern visualization and position tracking.

**Files to Create**:
- `dashboard/components/TradingChart.tsx` - Main chart component
- `dashboard/components/CandleChart.tsx` - Candlestick chart
- `dashboard/components/PatternOverlay.tsx` - Pattern indicators
- `dashboard/components/PositionMarkers.tsx` - Entry/SL/TP markers
- `dashboard/app/api/candles/route.ts` - Candle data API

**Trading Chart Component**:
```tsx
// Using Recharts library
import { CandlestickChart, Line, Area } from 'recharts'

export function TradingChart({ timeframe = '5M' }) {
  const { data: candles } = useSWR(`/api/candles/${timeframe}`, fetcher)
  const { data: patterns } = useSWR('/api/patterns', fetcher)
  const { data: positions } = useSWR('/api/positions', fetcher)

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>BTC-USD Chart</CardTitle>
          <TimeframeSelector
            value={timeframe}
            options={['5M', '4H']}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={500}>
          <CandlestickChart data={candles}>
            {/* Candlesticks */}
            <Candles />

            {/* Swing levels */}
            {patterns?.swings.map(swing => (
              <ReferenceLine
                key={swing.id}
                y={swing.price}
                stroke={swing.type === 'HIGH' ? '#ef4444' : '#22c55e'}
                strokeDasharray="5 5"
                label={`Swing ${swing.type}`}
              />
            ))}

            {/* FVG zones */}
            {patterns?.fvgs.map(fvg => (
              <ReferenceArea
                key={fvg.id}
                y1={fvg.top}
                y2={fvg.bottom}
                fill={fvg.type === 'BULLISH' ? '#22c55e' : '#ef4444'}
                fillOpacity={0.2}
              />
            ))}

            {/* Position markers */}
            {positions?.map(pos => (
              <PositionMarkers
                key={pos.id}
                entry={pos.entry_price}
                stopLoss={pos.stop_loss}
                takeProfit={pos.take_profit}
                direction={pos.direction}
              />
            ))}
          </CandlestickChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

**Pattern Overlay**:
```tsx
export function PatternOverlay({ patterns, chartBounds }) {
  return (
    <>
      {/* CHoCH markers */}
      {patterns.choch && (
        <circle
          cx={getX(patterns.choch.time)}
          cy={getY(patterns.choch.price)}
          r={5}
          fill="#3b82f6"
        />
      )}

      {/* BOS markers */}
      {patterns.bos && (
        <polygon
          points={getTrianglePoints(patterns.bos)}
          fill="#f59e0b"
        />
      )}
    </>
  )
}
```

**Features**:
- Candlestick charts (5M and 4H)
- Swing level indicators
- FVG zone highlighting
- CHoCH/BOS markers
- Entry/SL/TP position markers
- Interactive zoom and pan
- Real-time price updates
- Pattern tooltips

**Testing Requirements**:
- Test chart rendering
- Test pattern overlays
- Test position markers
- Test timeframe switching

**Acceptance Criteria**:
- [ ] Candlestick chart displays
- [ ] Swing levels shown
- [ ] FVG zones highlighted
- [ ] Patterns marked correctly
- [ ] Position markers visible
- [ ] Timeframe switching works
- [ ] Chart updates in real-time

---

### PR #19: Trade History and Analytics
**Size**: Medium | **Priority**: P1 | **Dependencies**: PR#17

**Description**:
Display trade history, performance metrics, and analytics dashboard.

**Files to Create**:
- `dashboard/app/trades/page.tsx` - Trade history page
- `dashboard/app/analytics/page.tsx` - Analytics page
- `dashboard/components/TradesTable.tsx` - Trade list table
- `dashboard/components/PerformanceMetrics.tsx` - Metrics display
- `dashboard/components/WinRateChart.tsx` - Win rate visualization
- `dashboard/app/api/trades/route.ts` - Trades API
- `dashboard/app/api/metrics/route.ts` - Metrics API

**Trades Table**:
```tsx
export function TradesTable() {
  const { data: trades } = useSWR('/api/trades', fetcher)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Direction</TableHead>
          <TableHead>Entry</TableHead>
          <TableHead>Exit</TableHead>
          <TableHead>R/R</TableHead>
          <TableHead>P&L</TableHead>
          <TableHead>Outcome</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trades?.map(trade => (
          <TableRow key={trade.id}>
            <TableCell>{formatDate(trade.entry_time)}</TableCell>
            <TableCell>
              <Badge variant={trade.direction === 'LONG' ? 'success' : 'destructive'}>
                {trade.direction}
              </Badge>
            </TableCell>
            <TableCell>${trade.entry_price}</TableCell>
            <TableCell>${trade.exit_price || '-'}</TableCell>
            <TableCell>{trade.risk_reward_ratio}:1</TableCell>
            <TableCell className={trade.pnl_usd >= 0 ? 'text-green-500' : 'text-red-500'}>
              ${trade.pnl_usd}
            </TableCell>
            <TableCell>
              <OutcomeBadge outcome={trade.outcome} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

**Performance Metrics**:
```tsx
export function PerformanceMetrics() {
  const { data: metrics } = useSWR('/api/metrics', fetcher)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Win Rate"
        value={`${metrics?.winRate}%`}
        target="90%"
        progress={metrics?.winRate}
        status={metrics?.winRate >= 90 ? 'success' : 'warning'}
      />

      <MetricCard
        title="Total P&L"
        value={`$${metrics?.totalPnL}`}
        subtitle={`${metrics?.totalPnLPercent}%`}
        status={metrics?.totalPnL >= 0 ? 'success' : 'error'}
      />

      <MetricCard
        title="Avg R/R Ratio"
        value={`${metrics?.avgRRRatio}:1`}
        target="≥2:1"
        status={metrics?.avgRRRatio >= 2 ? 'success' : 'warning'}
      />

      <MetricCard
        title="Total Trades"
        value={metrics?.totalTrades}
        subtitle={`${metrics?.winCount}W / ${metrics?.lossCount}L`}
      />
    </div>
  )
}
```

**Win Rate Chart**:
```tsx
export function WinRateChart() {
  const { data } = useSWR('/api/metrics/history', fetcher)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Win Rate Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="3 3" label="Target 90%" />
            <Line
              type="monotone"
              dataKey="winRate"
              stroke="#3b82f6"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

**Metrics Calculation**:
```typescript
// app/api/metrics/route.ts
export async function GET() {
  const trades = await db.query(`
    SELECT * FROM trades WHERE status = 'CLOSED'
  `)

  const wins = trades.filter(t => t.outcome === 'WIN')
  const losses = trades.filter(t => t.outcome === 'LOSS')

  const metrics = {
    totalTrades: trades.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: (wins.length / trades.length * 100).toFixed(2),
    totalPnL: trades.reduce((sum, t) => sum + t.pnl_usd, 0),
    totalPnLPercent: calculateTotalPnLPercent(trades),
    avgRRRatio: (wins.reduce((sum, t) => sum + t.risk_reward_ratio, 0) / wins.length).toFixed(2),
    largestWin: Math.max(...trades.map(t => t.pnl_usd)),
    largestLoss: Math.min(...trades.map(t => t.pnl_usd)),
    consecutiveWins: calculateConsecutiveWins(trades),
    consecutiveLosses: calculateConsecutiveLosses(trades)
  }

  return Response.json(metrics)
}
```

**Features**:
- Trade history table
- Performance metrics dashboard
- Win rate tracking
- P&L visualization
- R/R ratio analysis
- Trade filtering and sorting
- Export to CSV
- Historical charts

**Testing Requirements**:
- Test metrics calculation
- Test table rendering
- Test chart visualization
- Test filtering/sorting

**Acceptance Criteria**:
- [ ] Trade history displays all trades
- [ ] Metrics calculated correctly
- [ ] Win rate shown accurately
- [ ] P&L tracking working
- [ ] Charts render correctly
- [ ] Filtering/sorting functional
- [ ] Export to CSV works

---

## Phase 7: Enhancements (PRs 20-22)

### PR #20: Telegram Notifications
**Size**: Small | **Priority**: P2 | **Dependencies**: PR#14

**Description**:
Integrate Telegram bot for trade notifications and alerts.

**Files to Create**:
- `lib/utils/notifier.js` - Telegram notification manager
- `lib/utils/telegram.js` - Telegram Bot API client
- `tests/unit/notifier.test.js` - Unit tests

**Telegram Client**:
```javascript
class TelegramClient {
  constructor(botToken, chatId) {
    this.botToken = botToken
    this.chatId = chatId
    this.apiUrl = `https://api.telegram.org/bot${botToken}`
  }

  async sendMessage(text, options = {}) {
    await axios.post(`${this.apiUrl}/sendMessage`, {
      chat_id: this.chatId,
      text: text,
      parse_mode: options.parseMode || 'Markdown',
      disable_notification: options.silent || false
    })
  }
}
```

**Notification Types**:
```javascript
// Trade opened
async function notifyTradeOpened(trade) {
  const message = `
🚀 *Trade Opened*

Direction: ${trade.direction}
Entry: $${trade.entry_price}
Stop Loss: $${trade.stop_loss}
Take Profit: $${trade.take_profit}
R/R Ratio: ${trade.risk_reward_ratio}:1
Size: ${trade.position_size_btc} BTC
Confidence: ${trade.ai_confidence}%

_Reasoning:_ ${trade.ai_reasoning}
`

  await telegram.sendMessage(message)
}

// Trade closed
async function notifyTradeClosed(trade) {
  const emoji = trade.outcome === 'WIN' ? '✅' : '❌'
  const message = `
${emoji} *Trade Closed - ${trade.outcome}*

Direction: ${trade.direction}
Entry: $${trade.entry_price}
Exit: $${trade.exit_price}
P&L: $${trade.pnl_usd} (${trade.pnl_percent}%)
Duration: ${calculateDuration(trade)}

_Total Win Rate: ${await getWinRate()}%_
`

  await telegram.sendMessage(message)
}

// Confluence detected
async function notifyConfluenceComplete(confluence) {
  const message = `
🎯 *Confluence Complete*

Timeframe: 5M
Bias: ${confluence.bias}
CHoCH: ✅
FVG Fill: ✅
BOS: ✅

Waiting for AI decision...
`

  await telegram.sendMessage(message, { silent: true })
}

// Emergency alerts
async function notifyEmergency(alert) {
  const message = `
🚨 *EMERGENCY ALERT*

${alert.type}: ${alert.message}

Action: ${alert.action}
Time: ${new Date().toISOString()}
`

  await telegram.sendMessage(message)
}
```

**Features**:
- Trade opened/closed notifications
- Confluence detection alerts
- Emergency stop notifications
- Daily summary reports
- Win rate updates
- Silent mode for minor updates

**Testing Requirements**:
- Test message formatting
- Test Telegram API calls
- Mock API for tests

**Acceptance Criteria**:
- [ ] Trade notifications sent
- [ ] Alerts working
- [ ] Messages formatted correctly
- [ ] Silent mode functional
- [ ] Emergency alerts prioritized

---

### PR #21: Trailing Stops and Position Management
**Size**: Medium | **Priority**: P2 | **Dependencies**: PR#14

**Description**:
Implement trailing stop loss to lock in profits as trade moves in favor.

**Files to Create**:
- `lib/trading/trailing_stop.js` - Trailing stop logic
- `lib/trading/position_manager.js` - Position update manager
- `tests/unit/trading/trailing_stop.test.js` - Unit tests

**Trailing Stop Logic**:
```javascript
async function checkTrailingStop(trade) {
  const currentPrice = await getCurrentPrice('BTC-USD')

  // Activate when 80% to target
  const targetDistance = Math.abs(trade.take_profit - trade.entry_price)
  const currentDistance = Math.abs(currentPrice - trade.entry_price)
  const progressPercent = (currentDistance / targetDistance) * 100

  if (progressPercent >= 80 && !trade.trailing_stop_activated) {
    // Move stop to breakeven
    await updateStopLoss(trade.id, trade.entry_price)
    await markTrailingActivated(trade.id)

    logger.info(`Trailing stop activated for trade ${trade.id}`)
    await notifyTrailingActivated(trade)
  }
}
```

**Features**:
- Breakeven stop at 80% to target
- Automatic stop loss update
- Trailing activation tracking
- Notifications

**Testing Requirements**:
- Test activation threshold
- Test stop update
- Test edge cases

**Acceptance Criteria**:
- [ ] Trailing activates at 80%
- [ ] Stop moved to breakeven
- [ ] Activation tracked
- [ ] Notifications sent

---

### PR #22: System Hardening and Emergency Controls
**Size**: Medium | **Priority**: P1 | **Dependencies**: PR#14, PR#17

**Description**:
Add comprehensive error handling, emergency stop, and system hardening.

**Files to Create**:
- `lib/utils/emergency.js` - Emergency stop logic
- `lib/utils/health_check.js` - System health monitoring
- `lib/utils/recovery.js` - Crash recovery
- `dashboard/components/EmergencyControls.tsx` - UI controls

**Emergency Stop**:
```javascript
async function executeEmergencyStop(reason) {
  logger.error(`EMERGENCY STOP TRIGGERED: ${reason}`)

  // 1. Close all open positions at market
  const openTrades = await getOpenTrades()
  for (const trade of openTrades) {
    await closePositionAtMarket(trade.id)
  }

  // 2. Cancel all pending orders
  await cancelAllOrders()

  // 3. Stop all jobs/workflows
  await stopAllJobs()

  // 4. Set emergency stop flag
  await setEmergencyStop(true)

  // 5. Send urgent notifications
  await notifyEmergency({
    type: 'EMERGENCY_STOP',
    message: reason,
    action: 'All positions closed, trading stopped'
  })

  logger.info('Emergency stop completed')
}
```

**Health Checks**:
```javascript
async function performHealthCheck() {
  const checks = {
    database: await checkDatabase(),
    coinbase: await checkCoinbaseAPI(),
    ai: await checkAIModel(),
    websocket: await checkWebSocket(),
    diskSpace: await checkDiskSpace(),
    memory: await checkMemory()
  }

  const failures = Object.entries(checks)
    .filter(([_, status]) => !status)
    .map(([name]) => name)

  if (failures.length > 0) {
    logger.warn('Health check failures:', failures)

    if (failures.includes('coinbase')) {
      await pauseTrading('Coinbase API unavailable')
    }
  }

  return checks
}
```

**Features**:
- Emergency stop button
- Automatic crash recovery
- Health monitoring
- Graceful shutdown
- Connection retry logic
- Error alerting

**Testing Requirements**:
- Test emergency stop
- Test health checks
- Test recovery

**Acceptance Criteria**:
- [ ] Emergency stop closes positions
- [ ] Health checks detect failures
- [ ] Recovery restores state
- [ ] Alerts sent on errors

---

## PR Dependency Graph

```
Foundation Layer:
PR#1 (Database) ──┬─→ PR#5 (4H Candles) ──┬─→ PR#8 (Swing Tracker) ──┬─→ PR#9 (Sweep Detector)
                  │                        │                          │
PR#2 (Coinbase) ──┼─→ PR#6 (5M Candles) ──┘                          │
                  │                                                    │
PR#3 (Config) ────┘                                                   │
PR#4 (Utils)                                                          │
                                                                       │
Data & Patterns:                                                      │
PR#7 (WebSocket) ─────────────────────────────────────────────────────┤
                                                                       ↓
PR#8 (Swing Tracker) ─→ PR#9 (Sweep) ─→ PR#10 (Confluence) ─→ PR#11 (Validation)
                                                ↓                      ↓
Trading Logic:                                  │                      │
PR#12 (Stop Loss) ←─────────────────────────────┴──────────────────────┘
       ↓
PR#13 (Risk Manager) ─→ PR#14 (Execution) ──┬─→ PR#20 (Telegram)
                                             ├─→ PR#21 (Trailing Stops)
                                             └─→ PR#22 (Emergency)

AI Integration:
PR#11 ─→ PR#15 (AI Prompts) ─→ PR#16 (AI Validation) ─→ PR#14

Dashboard:
PR#1 ─→ PR#17 (Basic Dashboard) ─→ PR#18 (Charts) ─→ PR#19 (Analytics)
                                         ↓
                                    PR#22 (Emergency Controls)
```

---

## Implementation Order

### Week 1 (MVP Focus):
1. PR#1 - Database Setup
2. PR#2 - Coinbase API
3. PR#3 - Configuration
4. PR#4 - Utilities
5. PR#5 - 4H Candles
6. PR#6 - 5M Candles
7. PR#7 - WebSocket

### Week 2 (Pattern Detection):
8. PR#8 - Swing Tracking
9. PR#9 - Sweep Detection
10. PR#10 - Confluence State Machine
11. PR#11 - Validation
12. PR#12 - Stop Loss Calculator
13. PR#13 - Risk Manager
14. PR#14 - Trade Execution

### Week 3 (AI & Dashboard):
15. PR#15 - AI Integration
16. PR#16 - AI Validation
17. PR#17 - Basic Dashboard
18. PR#18 - Trading Charts
19. PR#19 - Analytics

### Week 4 (Polish & Production):
20. PR#20 - Telegram
21. PR#21 - Trailing Stops
22. PR#22 - System Hardening

---

## Review Guidelines

### PR Size Targets:
- **Small**: <200 lines, 1-2 files
- **Medium**: 200-500 lines, 3-5 files
- **Large**: 500-1000 lines, 6-10 files

### Review Checklist:
- [ ] Code follows project conventions
- [ ] Tests included and passing
- [ ] Documentation updated
- [ ] No console.logs (use logger)
- [ ] Error handling implemented
- [ ] Database queries optimized
- [ ] Security considerations addressed
- [ ] Performance acceptable

### Merge Requirements:
- All tests passing
- Code review approved
- No merge conflicts
- Documentation complete

---

**Ready to Start**: Begin with PR#1 (Database Schema)
**Estimated Completion**: 3-4 weeks
**Total PRs**: 22
