# Trading Bot Implementation - Product Requirements Document
## BTC Futures Trading Bot - Phased System Build

**Project**: Autonomous AI-Powered BTC Futures Trading Bot
**Timeline**: 2-4 Week Phased Build (MVP in 1 week)
**Priority**: P0 - Production Trading System
**Status**: Pre-Development

---

## Executive Summary

Build a production-ready autonomous trading bot for BTC perpetual futures on Coinbase using AI-powered technical analysis based on liquidity sweeps and market structure.

**Core System**:
- Detect 4H liquidity sweeps (highs/lows)
- Confirm entries using 5M confluence (CHoCH → FVG Fill → BOS)
- AI decision-making via local LLM
- Automated execution with risk management
- Real-time monitoring dashboard

**Success Criteria**:
- Achieve 90% win rate over 100+ trades
- 1% risk per trade (fixed)
- Fully autonomous 24/7 operation

---

## Table of Contents

1. [Scope & Phases](#scope--phases)
2. [System Architecture](#system-architecture)
3. [Pattern Detection Logic](#pattern-detection-logic)
4. [Trading Rules](#trading-rules)
5. [Risk Management](#risk-management)
6. [Technical Stack](#technical-stack)
7. [Database Schema](#database-schema)
8. [Implementation Phases](#implementation-phases)
9. [Success Metrics](#success-metrics)
10. [Emergency Procedures](#emergency-procedures)

---

## Scope & Phases

### MVP (Week 1) - Core Trading System
- [x] PostgreSQL database with schema
- [x] Coinbase API integration
- [x] 4H/5M candle data collection
- [x] 4H liquidity sweep detection
- [x] 5M confluence detector (state machine)
- [x] Basic AI decision engine (local LLM)
- [x] Trade execution (market orders + SL/TP)
- [x] Simple dashboard (status + open positions)
- [x] Basic risk management (1% sizing, 1 position max)

### Phase 2 (Week 2) - Enhancement
- [ ] Position management with trailing stops
- [ ] Telegram notifications
- [ ] Full dashboard (charts, analytics, history)
- [ ] AI prompt optimization
- [ ] Paper trading validation
- [ ] Performance analytics

### Phase 3 (Weeks 3-4) - Production
- [ ] Comprehensive testing suite
- [ ] System hardening & error handling
- [ ] Advanced risk controls (daily limits, consecutive loss protection)
- [ ] Live trading with micro capital ($100)
- [ ] Performance monitoring & optimization
- [ ] Documentation

### Future Enhancements
- [ ] Multiple timeframe confirmation
- [ ] Volume profile analysis
- [ ] Additional confluence patterns
- [ ] Multi-position management
- [ ] Advanced partial profit taking

---

## System Architecture

```
┌────────────────────────────────────────────────────┐
│              DATA COLLECTION LAYER                  │
│  • 4H candles (every 4 hours)                      │
│  • 5M candles (every 5 minutes)                    │
│  • WebSocket: Real-time BTC-PERP price            │
└─────────────────┬──────────────────────────────────┘
                  ↓
┌────────────────────────────────────────────────────┐
│           4H LIQUIDITY SCANNER                      │
│  • Detect swing highs/lows (3-candle pattern)     │
│  • Check if price swept high/low (±0.1%)          │
│  • If swept → Set bias & activate 5M scanner      │
└─────────────────┬──────────────────────────────────┘
                  ↓
┌────────────────────────────────────────────────────┐
│       5M CONFLUENCE DETECTOR (State Machine)       │
│  State 1: WAITING_CHOCH → Detect change           │
│  State 2: WAITING_FVG → Detect gap & fill         │
│  State 3: WAITING_BOS → Detect break              │
│  State 4: COMPLETE → Trigger AI                   │
└─────────────────┬──────────────────────────────────┘
                  ↓
┌────────────────────────────────────────────────────┐
│            AI DECISION ENGINE                       │
│  • Analyze complete setup                          │
│  • Calculate entry/SL/TP                          │
│  • Validate risk parameters                        │
│  • Return YES/NO + trade plan                      │
└─────────────────┬──────────────────────────────────┘
                  ↓
┌────────────────────────────────────────────────────┐
│          TRADE EXECUTION ENGINE                     │
│  1. Validate pre-execution checks                  │
│  2. Calculate position size (1% risk)              │
│  3. Place market order (LONG/SHORT)                │
│  4. Place stop loss order                          │
│  5. Place take profit order                        │
│  6. Monitor position continuously                  │
└────────────────────────────────────────────────────┘
```

---

## Pattern Detection Logic

### 4H Liquidity Sweep Detection

**Swing High Detection**:
```javascript
// 3-candle pattern
swingHigh = candle[i].high > candle[i-2].high
         && candle[i].high > candle[i+2].high

// Store swing level for stop loss calculation
lastSwingHigh = candle[i].high
lastSwingHighTime = candle[i].timestamp

// Sweep detection
highSwept = currentPrice > lastSwingHigh * 1.001  // +0.1% threshold
```

**Swing Low Detection**:
```javascript
swingLow = candle[i].low < candle[i-2].low
        && candle[i].low < candle[i+2].low

// Store swing level for stop loss calculation
lastSwingLow = candle[i].low
lastSwingLowTime = candle[i].timestamp

lowSwept = currentPrice < lastSwingLow * 0.999  // -0.1% threshold
```

**Bias Assignment**:
- HIGH swept → BEARISH bias (look for SHORT reversal)
- LOW swept → BULLISH bias (look for LONG reversal)

**Swing Tracking**:
- Both 4H and 5M swing highs/lows are continuously tracked and stored
- 5M swings updated every 5 minutes for recent market structure
- 4H swings updated every 4 hours for major support/resistance
- Most recent valid swing of each timeframe is used for stop loss calculation

---

### 5M Confluence State Machine

**State 1: CHoCH Detection (Change of Character)**

*For BULLISH bias (after 4H low sweep):*
```javascript
// Price was making lower lows, then breaks structure
chochDetected = currentPrice > max(last5Candles.map(c => c.high))
```

*For BEARISH bias (after 4H high sweep):*
```javascript
// Price was making higher highs, then breaks structure
chochDetected = currentPrice < min(last5Candles.map(c => c.low))
```

**State 2: FVG Detection & Fill (Fair Value Gap)**

*FVG Identification (3-candle pattern):*
```javascript
// BULLISH FVG: gap between candle1.high and candle3.low
if (candle1.high < candle3.low) {
  fvgZone = {
    top: candle3.low,
    bottom: candle1.high,
    type: 'BULLISH'
  }
}

// BEARISH FVG: gap between candle1.low and candle3.high
if (candle1.low > candle3.high) {
  fvgZone = {
    top: candle1.low,
    bottom: candle3.high,
    type: 'BEARISH'
  }
}

// Gap must be significant
gapSize = Math.abs(fvgZone.top - fvgZone.bottom)
isSignificant = gapSize > (currentPrice * 0.001)  // >0.1%
```

*FVG Fill Detection:*
```javascript
// BULLISH: Price must dip back into gap
fillDetected = candle.low >= fvgZone.bottom
            && candle.low <= fvgZone.top

// BEARISH: Price must rise back into gap
fillDetected = candle.high >= fvgZone.bottom
            && candle.high <= fvgZone.top
```

**State 3: BOS Detection (Break of Structure)**

*For BULLISH (expecting LONG):*
```javascript
// Must break above CHoCH high after FVG fill
bosDetected = currentPrice > chochHigh * 1.001  // +0.1% confirmation
```

*For BEARISH (expecting SHORT):*
```javascript
// Must break below CHoCH low after FVG fill
bosDetected = currentPrice < chochLow * 0.999  // -0.1% confirmation
```

**State Transitions**:
```
WAITING_CHOCH → (CHoCH detected) → WAITING_FVG
WAITING_FVG → (FVG filled) → WAITING_BOS
WAITING_BOS → (BOS detected) → COMPLETE
COMPLETE → (Trigger AI)
Any state → (timeout >12h or invalidation) → EXPIRED
```

---

## Trading Rules

### Entry Requirements (ALL must be met)

1. **4H Liquidity Sweep**: High or low swept with clear bias
2. **5M Confluence Complete**: CHoCH → FVG Fill → BOS (in order)
3. **Swing-Based Stop Loss Valid**: Must be within 0.5%-3% of entry and allow minimum 2:1 R/R
4. **AI Approval**: Decision = YES, confidence ≥ 70
5. **Risk Checks**:
   - No open positions (max 1)
   - Daily loss limit not exceeded (3%)
   - Not 3 consecutive losses
   - Account balance ≥ $100

### Stop Loss Rules

**Swing-Based Stop Loss Strategy**:

The stop loss is placed at the most recent swing high/low (market structure) rather than fixed percentages, providing natural support/resistance protection.

**Priority Logic**:
1. **Primary**: Use most recent 5M swing low (for LONG) or swing high (for SHORT)
2. **Fallback**: If 5M swing invalid, use 4H swing level that was swept
3. **Validation**: Stop must be 0.5%-3% from entry price
4. **R/R Check**: Stop must allow minimum 2:1 risk/reward ratio
5. **Trade Rejection**: If no valid swing meets criteria, skip the trade

**Swing Detection** (3-candle pattern):
```javascript
// LONG trades - find most recent swing low
swingLow = candle[i].low < candle[i-2].low
        && candle[i].low < candle[i+2].low

// SHORT trades - find most recent swing high
swingHigh = candle[i].high > candle[i-2].high
         && candle[i].high > candle[i+2].high
```

**Stop Loss Calculation**:
```javascript
// For LONG trades
1. Find most recent 5M swing low
2. Add buffer: stopLoss = swingLow - (swingLow * 0.002)  // -0.2% buffer
3. Check distance: distance = ((entry - stopLoss) / entry) * 100
4. If distance not in [0.5%, 3%]: Use 4H swing low
5. If still invalid: Skip trade

// For SHORT trades
1. Find most recent 5M swing high
2. Add buffer: stopLoss = swingHigh + (swingHigh * 0.003)  // +0.3% buffer
3. Check distance: distance = ((stopLoss - entry) / entry) * 100
4. If distance not in [0.5%, 3%]: Use 4H swing high
5. If still invalid: Skip trade
```

**Buffer Zones**:
- LONG: Stop placed 0.2%-0.3% below swing low (protects against wicks)
- SHORT: Stop placed 0.2%-0.3% above swing high (protects against wicks)
- Buffer prevents premature stop-outs from normal volatility

**Constraints**:
- Min stop distance: 0.5% from entry (too tight risks noise)
- Max stop distance: 3% from entry (too wide exceeds risk tolerance)
- If swing level violates constraints → try alternate timeframe
- If both timeframes invalid → reject trade (no forced entries)

**R/R Validation**:
```javascript
stopDistance = Math.abs(entry - stopLoss)
minTakeProfit = entry + (stopDistance * 2)  // 2:1 minimum
if (takeProfitTarget < minTakeProfit) {
  // Skip trade - insufficient reward for risk
  return "REJECT_TRADE"
}
```

**Trailing Stop** (activates at 80% to TP):
- Move to breakeven (entry price)

### Take Profit Rules

**Target Calculation**:
- Primary: Next major 4H swing high/low
- Secondary: Fibonacci extension (1.272 or 1.618)
- Minimum: 2:1 R/R ratio
- Maximum: 5:1 R/R ratio

### Position Sizing

```javascript
// Fixed 1% risk per trade
riskAmount = accountBalance * 0.01
stopDistance = Math.abs(entryPrice - stopLoss)
positionSize = riskAmount / stopDistance

// Example:
// Balance: $10,000
// Risk: $100 (1%)
// Entry: $90,000 BTC
// Stop: $89,000 BTC
// Distance: $1,000
// Position: $100 / $1,000 = 0.1 BTC
```

### Exit Conditions

- **Take Profit**: TP level reached → WIN
- **Stop Loss**: SL level hit → LOSS
- **Breakeven**: Trailing stop at entry → BREAKEVEN
- **Time-Based**: Position open >72 hours → Close at market
- **Emergency**: Manual override → Immediate close

---

## Risk Management

### Core Parameters

| Parameter | Value | Enforcement |
|-----------|-------|-------------|
| Position Size | 1% risk per trade | Hard-coded |
| Max Positions | 1 concurrent | Database constraint |
| Daily Loss Limit | 3% of balance | Auto-pause |
| Consecutive Loss Limit | 3 losses | 24h pause |
| Leverage | 2-5x | Configurable |
| Min R/R Ratio | 2:1 | AI validation |
| Max Trade Duration | 72 hours | Auto-close |
| Min Account Balance | $100 | Trading disabled below |

### Validation Checks

**Pre-Trade**:
- [ ] Confluence complete and valid
- [ ] AI decision approved
- [ ] Position limit not exceeded
- [ ] Daily loss limit not hit
- [ ] Not 3 consecutive losses
- [ ] Account balance sufficient
- [ ] Coinbase API connected

**Pre-Execution**:
- [ ] Current price within 0.2% of entry
- [ ] Stop loss on correct side (below entry for LONG, above for SHORT)
- [ ] Stop loss based on valid swing level (5M or 4H)
- [ ] Stop loss distance is 0.5%-3% from entry
- [ ] Take profit achievable
- [ ] R/R ratio ≥ 2:1 (calculated from swing-based stop)
- [ ] Position size = 1% of balance

---

## Technical Stack

### Infrastructure
- **Database**: PostgreSQL 16
- **Orchestration**: n8n (Docker)
- **AI Model**: gpt-oss:20b
- **Backend**: Node.js 20 LTS
- **Frontend**: Next.js 14 + React
- **API**: Coinbase Advanced Trade API

### Key Libraries
```json
{
  "dependencies": {
    "pg": "^8.11.0",
    "axios": "^1.6.0",
    "ws": "^8.16.0",
    "zod": "^3.22.0",
    "next": "14.x",
    "react": "18.x",
    "recharts": "^2.10.0",
    "lucide-react": "^0.300.0"
  }
}
```

### Coinbase API Endpoints

**REST API**:
- `GET /api/v3/brokerage/products/BTC-PERP/candles` - Candle data
- `GET /api/v3/brokerage/accounts` - Account balance
- `POST /api/v3/brokerage/orders` - Place orders
- `GET /api/v3/brokerage/orders/{id}` - Order status
- `DELETE /api/v3/brokerage/orders/{id}` - Cancel order

**WebSocket**:
- Channel: `ticker` on `BTC-PERP`
- Real-time price updates

---

## Database Schema

### Core Tables

**candles_4h**
```sql
CREATE TABLE candles_4h (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL UNIQUE,
  open DECIMAL(12,2) NOT NULL,
  high DECIMAL(12,2) NOT NULL,
  low DECIMAL(12,2) NOT NULL,
  close DECIMAL(12,2) NOT NULL,
  volume DECIMAL(18,8) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_4h_timestamp ON candles_4h(timestamp DESC);
```

**candles_5m**
```sql
CREATE TABLE candles_5m (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL UNIQUE,
  open DECIMAL(12,2) NOT NULL,
  high DECIMAL(12,2) NOT NULL,
  low DECIMAL(12,2) NOT NULL,
  close DECIMAL(12,2) NOT NULL,
  volume DECIMAL(18,8) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_5m_timestamp ON candles_5m(timestamp DESC);
```

**swing_levels**
```sql
CREATE TABLE swing_levels (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  timeframe VARCHAR(5) NOT NULL, -- '4H' or '5M'
  swing_type VARCHAR(10) NOT NULL, -- 'HIGH' or 'LOW'
  price DECIMAL(12,2) NOT NULL,
  candle_index INT, -- For reference
  active BOOLEAN DEFAULT true, -- Most recent swing
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_active_swings ON swing_levels(timeframe, swing_type, active, timestamp DESC);
```

**liquidity_sweeps**
```sql
CREATE TABLE liquidity_sweeps (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  sweep_type VARCHAR(10) NOT NULL, -- 'HIGH' or 'LOW'
  price DECIMAL(12,2) NOT NULL,
  bias VARCHAR(10) NOT NULL, -- 'BULLISH' or 'BEARISH'
  swing_level DECIMAL(12,2) NOT NULL,
  swing_level_id INT REFERENCES swing_levels(id), -- Reference to the swing that was swept
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_active_sweeps ON liquidity_sweeps(active, timestamp DESC);
```

**confluence_state**
```sql
CREATE TABLE confluence_state (
  id SERIAL PRIMARY KEY,
  sweep_id INT REFERENCES liquidity_sweeps(id),
  current_state VARCHAR(20) NOT NULL,
    -- 'WAITING_CHOCH' | 'WAITING_FVG' | 'WAITING_BOS' | 'COMPLETE' | 'EXPIRED'

  choch_detected BOOLEAN DEFAULT false,
  choch_time TIMESTAMPTZ,
  choch_price DECIMAL(12,2),

  fvg_detected BOOLEAN DEFAULT false,
  fvg_zone_low DECIMAL(12,2),
  fvg_zone_high DECIMAL(12,2),
  fvg_fill_price DECIMAL(12,2),
  fvg_fill_time TIMESTAMPTZ,

  bos_detected BOOLEAN DEFAULT false,
  bos_time TIMESTAMPTZ,
  bos_price DECIMAL(12,2),

  sequence_valid BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sweep_state ON confluence_state(sweep_id, current_state);
```

**trades**
```sql
CREATE TABLE trades (
  id SERIAL PRIMARY KEY,
  sweep_id INT REFERENCES liquidity_sweeps(id),
  confluence_state_id INT REFERENCES confluence_state(id),

  -- Entry
  entry_time TIMESTAMPTZ NOT NULL,
  direction VARCHAR(10) NOT NULL, -- 'LONG' or 'SHORT'
  entry_price DECIMAL(12,2) NOT NULL,
  position_size_btc DECIMAL(18,8) NOT NULL,
  position_size_usd DECIMAL(12,2) NOT NULL,
  leverage INT NOT NULL,

  -- Risk Management
  stop_loss DECIMAL(12,2) NOT NULL,
  stop_loss_source VARCHAR(10), -- '5M_SWING' | '4H_SWING'
  stop_loss_swing_price DECIMAL(12,2), -- Original swing level before buffer
  stop_loss_distance_percent DECIMAL(5,2), -- % distance from entry
  take_profit DECIMAL(12,2) NOT NULL,
  risk_reward_ratio DECIMAL(5,2),
  trailing_stop_activated BOOLEAN DEFAULT false,

  -- Exit
  exit_time TIMESTAMPTZ,
  exit_price DECIMAL(12,2),
  outcome VARCHAR(10), -- 'WIN' | 'LOSS' | 'BREAKEVEN'
  pnl_usd DECIMAL(12,2),
  pnl_percent DECIMAL(8,4),

  -- Status
  status VARCHAR(10) DEFAULT 'OPEN', -- 'OPEN' | 'CLOSED'

  -- AI
  ai_reasoning TEXT,
  ai_confidence INT,

  -- Coinbase
  coinbase_entry_order_id VARCHAR(255),
  coinbase_stop_order_id VARCHAR(255),
  coinbase_tp_order_id VARCHAR(255),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_status ON trades(status);
CREATE INDEX idx_outcome ON trades(outcome);
CREATE INDEX idx_stop_loss_source ON trades(stop_loss_source);
```

---

## Implementation Phases

### Phase 1: MVP (Days 1-7)

**Day 1-2: Foundation**
- Set up PostgreSQL database
- Create all tables and indexes
- Set up Coinbase API integration
- Test API connectivity and authentication
- Install Ollama and download model

**Day 3-4: Data Pipeline**
- Build 4H candle collector (runs every 4h)
- Build 5M candle collector (runs every 5m)
- Historical backfill (200 4H + 500 5M candles)
- WebSocket for real-time prices
- Data validation and storage

**Day 5: Pattern Detection**
- 4H swing detection algorithm
- 4H liquidity sweep detector
- 5M CHoCH detection
- 5M FVG identification & fill detection
- 5M BOS detection
- State machine implementation

**Day 6: AI & Execution**
- AI prompt engineering
- Ollama API integration
- Decision validation logic
- Trade execution engine
- Order placement (market, SL, TP)
- Basic position monitoring

**Day 7: Testing & Dashboard**
- Build basic Next.js dashboard
- Display system status & open positions
- End-to-end testing
- Paper trading validation
- Bug fixes

### Phase 2: Enhancement (Days 8-14)

**Days 8-9: Position Management**
- Real-time P&L tracking
- Trailing stop implementation
- Position exit logic
- Multiple position tracking (future)

**Days 10-11: Full Dashboard**
- Trading charts (4H + 5M)
- Trade history table
- Performance analytics
- Confluence log viewer
- AI decision reasoner
- Settings panel

**Days 12-13: Notifications & Monitoring**
- Telegram bot integration
- Trade alerts (open/close)
- Confluence notifications
- System health alerts
- Emergency notifications

**Day 14: Testing & Optimization**
- Comprehensive testing
- AI prompt refinement
- Performance optimization
- Bug fixes

### Phase 3: Production (Days 15-28)

**Days 15-18: Hardening**
- Error handling
- API retry logic
- Database connection pooling
- Logging improvements
- Health checks

**Days 19-21: Advanced Risk**
- Daily loss limit enforcement
- Consecutive loss protection
- Emergency stop mechanism
- Risk metric calculations
- Safety overrides

**Days 22-25: Live Testing**
- Paper trading extended validation
- Start with $100 micro capital
- Monitor first 5-10 trades closely
- Refine based on results
- AI prompt adjustments

**Days 26-28: Documentation & Scale**
- Complete documentation
- Operations manual
- Troubleshooting guide
- Performance review
- Plan for capital scaling

---

## Success Metrics

### Primary Metrics

**Win Rate** (Main Goal):
- Target: 90%+
- Calculation: (Wins / Total Trades) × 100
- Track: Rolling 100 trades
- Dashboard: Real-time display with progress bar

**Total P&L**:
- Target: Positive returns
- Track: Daily, Weekly, Monthly, All-Time
- Compare: Against BTC buy & hold

**Risk/Reward Ratio**:
- Target: ≥2:1 average
- Calculation: Avg Win / Avg Loss
- Track: Per trade and aggregate

### Secondary Metrics

- **System Uptime**: 99%+ target
- **Trade Frequency**: 1-3 trades per week expected
- **Avg Trade Duration**: 12-48 hours
- **Max Consecutive Wins**: Track for milestone celebration
- **Max Consecutive Losses**: Max 3 allowed (triggers pause)
- **Largest Win**: Track and analyze
- **Largest Loss**: Should stay within 1% risk

### Review Schedule

**Daily** (First Week):
- Check all closed trades
- Review AI decision quality
- Verify risk limits respected
- Note any anomalies

**Weekly**:
- Win rate trend analysis
- Best/worst trades review
- Pattern success rates
- System health check
- Performance adjustments

**Monthly**:
- Full performance report
- ROI & Sharpe ratio calculation
- Max drawdown analysis
- Benchmark comparison
- Scaling decisions

---

## Emergency Procedures

### Emergency Stop

**When to Trigger**:
- System behaving unexpectedly
- Multiple rapid losses
- API errors or connectivity issues
- Market anomaly detected
- Manual override needed

**How to Execute**:
1. Click red "EMERGENCY STOP" button on dashboard
2. Or run: `UPDATE system_config SET emergency_stop = true`
3. Or stop n8n workflows manually

**What Happens**:
1. Close all open positions immediately (market orders)
2. Cancel all pending orders (SL/TP)
3. Stop all workflows/jobs
4. Set bot status to STOPPED
5. Send urgent notifications
6. Log all actions

**Recovery Process**:
1. Review logs and identify root cause
2. Analyze recent trades
3. Fix underlying issue
4. Run system validation tests
5. Test in paper trading mode
6. Manually re-enable when safe

### System Failures

**Database Connection Lost**:
- Retry 3 times with exponential backoff
- Alert after 3 failures
- Pause trading until restored
- Monitor existing positions when connection returns

**Coinbase API Down**:
- Detect via health checks (ping every 60s)
- Pause new entries immediately
- Keep monitoring existing positions
- Alert immediately
- Resume when API restored

**AI Model Not Responding**:
- 30 second timeout per request
- Retry once
- If still failing: Skip trade opportunity
- Log error and alert for manual review
- Continue monitoring for next setup

**Dashboard Offline**:
- Trading continues (backend is independent)
- Telegram notifications continue
- Fix dashboard without impacting trading
- System operates autonomously

---

## AI Prompt Template

```
You are an expert BTC futures trader using liquidity-based technical analysis.

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
- 4H Sweep: {HIGH|LOW} at ${price} ({BULLISH|BEARISH} bias)
- CHoCH: Detected at ${price} at {time}
- FVG: ${low} - ${high}, filled at ${price}
- BOS: Detected at ${price} at {time}
- Current Price: ${current_price}
- Account Balance: ${balance}

SWING LEVELS (for stop loss calculation):
- Most Recent 5M Swing {High|Low}: ${5m_swing_price} at {time}
- 4H Sweep Swing {High|Low}: ${4h_swing_price} at {time}
- Recommended Stop (with 0.2-0.3% buffer): ${recommended_stop}
- Stop Distance from Entry: {percent}%

ACCOUNT STATUS:
- Open Positions: {count}
- Recent Win Rate: {percent}%
- Consecutive Losses: {count}

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
- If ANY doubt exists, return "NO". Be conservative.
```

---

## Project Structure

```
btc-trading-bot/
├── .env                    # Environment variables (SECRET)
├── README.md               # Project overview
├── package.json            # Dependencies
│
├── database/
│   ├── schema.sql          # Complete DB schema
│   ├── migrations/         # Schema migrations
│   └── queries.js          # Query functions
│
├── lib/
│   ├── coinbase/
│   │   ├── client.js       # API wrapper
│   │   ├── websocket.js    # Real-time data
│   │   └── orders.js       # Order management
│   ├── scanners/
│   │   ├── 4h_scanner.js   # Swing & sweep detection
│   │   ├── 5m_scanner.js   # Confluence state machine
│   │   ├── swing_tracker.js # Track swing highs/lows for both timeframes
│   │   ├── choch.js        # CHoCH algorithm
│   │   ├── fvg.js          # FVG detection & fill
│   │   └── bos.js          # BOS confirmation
│   ├── trading/
│   │   ├── position_sizer.js   # Calculate sizes
│   │   ├── risk_manager.js     # Risk checks
│   │   ├── stop_loss_calculator.js # Swing-based stop loss logic
│   │   ├── executor.js         # Order placement
│   │   └── monitor.js          # Position tracking
│   ├── ai/
│   │   ├── decision.js     # AI integration
│   │   ├── prompts.js      # Prompt templates
│   │   └── validation.js   # Safety checks
│   └── utils/
│       ├── logger.js       # Logging
│       └── notifier.js     # Telegram
│
├── jobs/                   # Cron jobs or n8n workflows
│   ├── collect_4h.js
│   ├── collect_5m.js
│   ├── scan_4h.js
│   ├── scan_5m.js
│   └── monitor_positions.js
│
├── dashboard/              # Next.js frontend
│   ├── app/
│   │   ├── page.tsx        # Main dashboard
│   │   ├── trades/
│   │   ├── analytics/
│   │   ├── settings/
│   │   └── api/            # API routes
│   └── components/
│       ├── SystemStatus.tsx
│       ├── PositionCard.tsx
│       ├── TradesTable.tsx
│       └── EmergencyStop.tsx
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── scripts/
    ├── setup.sh            # One-time setup
    ├── start.sh            # Start all services
    └── backup.sh           # Database backup
```

---

## Quick Start Checklist

### Initial Setup
- [ ] Install PostgreSQL 16
- [ ] Install Node.js 20 LTS
- [ ] Install Ollama + download model
- [ ] Create Coinbase API keys (with trading permissions)
- [ ] Clone repository
- [ ] Copy `.env.example` to `.env`
- [ ] Configure environment variables
- [ ] Run `npm install`
- [ ] Run database migrations
- [ ] Test Coinbase API connection
- [ ] Test AI model connection

### First Run
- [ ] Start database
- [ ] Start Ollama
- [ ] Backfill historical data
- [ ] Start data collectors
- [ ] Verify data flowing into database
- [ ] Start scanners
- [ ] Test confluence detection (wait for signal)
- [ ] Test AI decision (paper mode)
- [ ] Start dashboard
- [ ] Enable paper trading mode

### Go Live
- [ ] Validate 5-10 paper trades successful
- [ ] Verify all risk limits working
- [ ] Fund Coinbase account ($500-1000)
- [ ] Set leverage (2-3x recommended)
- [ ] Disable paper trading mode
- [ ] Enable live trading
- [ ] Monitor first trade closely
- [ ] Celebrate first autonomous trade! 🎉

---

## Final Notes

### Realistic Expectations

- **Development**: 2-4 weeks for complete system
- **MVP**: 1 week for basic trading functionality
- **Testing**: 1 week paper trading validation minimum
- **Capital**: Start with $500-1000 for Phase 1

### Risk Disclaimer

This bot trades with real money. Key risks:
- Market volatility and gap risk
- Execution slippage
- API failures or downtime
- Model failures or bad decisions
- Liquidation risk with leverage

**Always**:
- Start with micro capital
- Monitor closely initially
- Keep emergency stop accessible
- Never risk more than you can afford to lose
- Maintain healthy skepticism of AI decisions

### Success Factors

1. **Patience**: Wait for perfect setups
2. **Discipline**: Follow rules exactly
3. **Risk Management**: 1% per trade, no exceptions
4. **Monitoring**: Check system health regularly
5. **Optimization**: Refine based on results
6. **Psychology**: Trust the process, avoid emotional intervention

---

**Document Version**: 3.0 - Lean & Actionable
**Created**: November 2025
**Status**: IMPLEMENTATION READY

Let's build! 🚀
