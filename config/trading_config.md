# Trading Bot Configuration
## Finalized Settings - Ready for Implementation

**Last Updated:** 2025-11-18
**Status:** APPROVED - Ready for Development

---

## Risk Management

### Position Sizing
- **Risk Per Trade:** 1% of account balance (FIXED, non-negotiable)
- **Calculation:** `positionSize = (accountBalance * 0.01) / stopDistance`
- **Example:** $100 balance × 1% = $1 risk per trade

### Position Limits
- **Max Concurrent Positions:** 1
- **Daily Loss Limit:** 3% of account balance → auto-pause trading
- **Consecutive Loss Limit:** 3 losses → 24-hour pause
- **Min Account Balance:** $100 (trading disabled below this)

### Leverage
- **Leverage:** 2x (Conservative)
- **Rationale:** Lower liquidation risk during testing phase
- **Liquidation Protection:** With 2x leverage and 1% risk, multiple losses needed before liquidation

---

## Entry Requirements (ALL must be met)

### 1. 4H Liquidity Sweep
- **Detection:** 3-candle swing high/low swept by current price
- **Threshold:** ±0.1% beyond swing level
- **Bias Assignment:**
  - HIGH swept → BEARISH bias (look for SHORT)
  - LOW swept → BULLISH bias (look for LONG)

### 2. 5M Confluence Complete (Sequential Order Required)
Must occur in exact order:

**Step 1: CHoCH (Change of Character)**
- BULLISH: Price breaks above recent highs
- BEARISH: Price breaks below recent lows

**Step 2: FVG (Fair Value Gap) Fill**
- Gap detected between 3 candles
- Gap size: >0.1% of current price
- Price fills into gap zone

**Step 3: BOS (Break of Structure)**
- BULLISH: Break above CHoCH high (+0.1% confirmation)
- BEARISH: Break below CHoCH low (-0.1% confirmation)

**Timeout:** >12 hours without completion → state EXPIRED

### 3. Swing-Based Stop Loss Valid
- **Priority Logic:**
  1. Primary: Most recent 5M swing (opposite side of trade)
  2. Fallback: 4H swing level that was swept
- **Distance Constraint:** 0.5%-3% from entry price
- **R/R Validation:** Must allow minimum 2:1 risk/reward
- **Rejection Rule:** If no valid swing meets criteria → NO TRADE

### 4. AI Approval
- **Decision:** YES (not NO or MAYBE)
- **Confidence:** ≥70%
- **Reasoning:** Must include swing-based stop validation

### 5. Risk Checks Passed
- No open positions (max 1 enforced)
- Daily loss limit not hit (<3%)
- Not 3 consecutive losses
- Account balance ≥$100

---

## Stop Loss Strategy (Swing-Based)

### Critical Rule
Stop losses are NEVER arbitrary percentages. They MUST be placed at market structure swing levels.

### Swing Detection Pattern (3-Candle)
```javascript
// For LONG: Find most recent swing low
swingLow = candle[i].low < candle[i-2].low && candle[i].low < candle[i+2].low

// For SHORT: Find most recent swing high
swingHigh = candle[i].high > candle[i-2].high && candle[i].high > candle[i+2].high
```

### Buffer Zones
- **LONG trades:** Stop placed 0.2%-0.3% below swing low
- **SHORT trades:** Stop placed 0.2%-0.3% above swing high

### Priority Logic
1. **Try 5M swing first** (most recent minor structure)
   - If valid (0.5%-3% distance + allows 2:1 R/R) → USE IT
2. **Fallback to 4H swing** (the swept level)
   - If valid (0.5%-3% distance + allows 2:1 R/R) → USE IT
3. **If both invalid** → REJECT TRADE

### Example Calculation
```
Entry Price: $90,000 (LONG)
5M Swing Low: $88,500
Buffer: 0.2% = $177
Stop Loss: $88,500 - $177 = $88,323

Distance Check: ($90,000 - $88,323) / $90,000 = 1.86% ✓ (within 0.5%-3%)
R/R Check: Take Profit must be at least $90,000 + ($1,677 × 2) = $93,354
```

---

## Take Profit Strategy

### Method
**Fixed 2:1 Risk/Reward Ratio**

### Calculation
```javascript
stopDistance = Math.abs(entryPrice - stopLoss)
takeProfit = direction === 'LONG'
  ? entryPrice + (stopDistance * 2)
  : entryPrice - (stopDistance * 2)
```

### Example
```
Entry: $90,000 (LONG)
Stop Loss: $88,323
Stop Distance: $1,677
Take Profit: $90,000 + ($1,677 × 2) = $93,354

Risk: $1 (1% of $100 account)
Reward: $2 (2% of $100 account)
R/R Ratio: 2:1 ✓
```

### Minimum Enforcement
- AI cannot suggest take profit with R/R < 2:1
- If swing-based stop doesn't allow 2:1 R/R → REJECT TRADE

---

## Position Management

### Trailing Stop (Profit Protection)
- **Activation Trigger:** When price reaches 80% of distance to take profit
- **Action:** Move stop loss to breakeven (entry price)
- **Purpose:** Lock in zero-loss outcome, let winners run
- **Notification:** Send Telegram alert when trailing activated

### Example
```
Entry: $90,000
Take Profit: $93,354
Distance: $3,354

80% Threshold: $90,000 + ($3,354 × 0.8) = $92,683

When price hits $92,683:
→ Cancel original stop loss order
→ Place new stop at $90,000 (breakeven)
→ Send Telegram notification
```

### Time-Based Exit
- **Max Trade Duration:** 72 hours from entry
- **Action:** Close position at market price (regardless of P/L)
- **Rationale:** Prevent stale positions, capital efficiency

### Manual Exit (Emergency Stop)
- Close all positions immediately at market
- Cancel all pending orders
- Stop all jobs/workflows
- Send urgent Telegram notification
- Set emergency_stop flag in database

---

## AI Decision Engine

### Model Configuration
- **Model:** GPT-OSS 20B (local via Ollama)
- **Host:** http://localhost:11434
- **Temperature:** 0.3 (low for consistency)
- **Timeout:** 30 seconds

### Conservative Bias
- **Default Stance:** When in doubt, return NO_TRADE
- **Reasoning Required:** Must explain swing-based stop validation
- **Confidence Threshold:** ≥70% (below 70% = auto-reject)

### AI Cannot Override
- 1% position sizing (non-negotiable)
- Swing-based stop placement (no arbitrary stops)
- Minimum 2:1 R/R ratio
- Risk management limits

---

## Testing & Capital Plan

### Phase 1: Micro Capital ($100 - Current Phase)
- **Goal:** Validate mechanical execution, system reliability
- **Duration:** 20-30 trades
- **Success Metric:** System uptime, no critical errors
- **Not Focused On:** Win rate (too small sample)

### Phase 2: Pattern Validation ($500-$1,000)
- **Goal:** 50-100 trades, validate pattern edge
- **Target:** 70%+ win rate
- **Action:** Refine AI prompts based on losing trades

### Phase 3: Consistency ($2,000-$3,000)
- **Goal:** 100+ trades
- **Target:** **90% win rate** (PRIMARY OBJECTIVE)
- **Action:** Analyze every losing trade, optimize

### Phase 4: Scale ($5,000-$25,000+)
- **Goal:** Full capital deployment
- **Target:** Maintain 90%+ win rate
- **Action:** Continuous monitoring and optimization

---

## Notifications (Telegram)

### Setup Required
- Create Telegram bot via @BotFather
- Save bot token to `.env` as `TELEGRAM_BOT_TOKEN`
- Get chat ID and save as `TELEGRAM_CHAT_ID`

### Notification Events

**Critical (Immediate Alert):**
- Trade opened
- Trade closed (WIN/LOSS)
- Emergency stop triggered
- System errors
- Daily loss limit hit
- 3 consecutive losses

**Info (Silent):**
- Confluence detected (CHoCH, FVG, BOS stages)
- Trailing stop activated
- 4H liquidity sweep detected

**Daily Summary:**
- Win rate update
- Total P/L
- Trades count
- System status

### Message Format
```
🚀 Trade Opened

Direction: LONG
Entry: $90,000
Stop Loss: $88,323 (5M_SWING)
Take Profit: $93,354
R/R Ratio: 2:1
Size: 0.011 BTC ($1 risk)
Confidence: 85%

Reasoning: [AI explanation]
```

---

## Database Configuration

### PostgreSQL Settings
- **Version:** PostgreSQL 16
- **Database:** `trading_bot`
- **User:** `trading_bot_user` (to be created)
- **Password:** (set in `.env`)
- **Host:** localhost
- **Port:** 5432
- **Connection Pool:** Max 20 connections

### Tables (7 Total)
1. `candles_4h` - 4-hour OHLCV data
2. `candles_5m` - 5-minute OHLCV data
3. `swing_levels` - Swing high/low tracking
4. `liquidity_sweeps` - 4H sweep detection results
5. `confluence_state` - 5M confluence state machine
6. `trades` - Trade execution and history
7. `system_config` - Bot configuration and emergency controls

---

## Environment Variables (.env)

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trading_bot
DB_USER=trading_bot_user
DB_PASSWORD=<your_secure_password>

# Coinbase API
COINBASE_API_KEY=<your_api_key>
COINBASE_API_SECRET=<your_api_secret>
COINBASE_PASSPHRASE=<your_passphrase>

# Trading
PAPER_TRADING_MODE=true  # Set to false for live trading
ACCOUNT_BALANCE=100
LEVERAGE=2
RISK_PER_TRADE=0.01
DAILY_LOSS_LIMIT=0.03
CONSECUTIVE_LOSS_LIMIT=3
MAX_TRADE_DURATION_HOURS=72

# AI
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=gpt-oss:20b
AI_TEMPERATURE=0.3
AI_CONFIDENCE_THRESHOLD=70

# Telegram
TELEGRAM_BOT_TOKEN=<your_bot_token>
TELEGRAM_CHAT_ID=<your_chat_id>

# System
LOG_LEVEL=info  # debug | info | warn | error
EMERGENCY_STOP=false
NODE_ENV=development
```

---

## Success Criteria

### Primary Goal
**90% win rate over 100+ trades**

### Secondary Goals
- Positive total P/L
- 99%+ system uptime
- Fully autonomous operation (no manual intervention needed)

### Risk Disclosure
This bot trades with real capital. Risks include:
- Market volatility and gap risk
- Execution slippage
- API failures and downtime
- AI decision errors
- Liquidation risk with leverage

**Always start with micro capital, monitor closely, and keep emergency stop accessible.**

---

## Implementation Status

- [x] Configuration finalized
- [ ] Environment verified
- [ ] Database created
- [ ] PR#1: Database Schema
- [ ] PR#2: Coinbase API Client
- [ ] PR#3-22: Remaining PRs per prPRD.md

**Next Step:** Verify environment setup, then begin PR#1
