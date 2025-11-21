# BTC Futures Trading Bot - Complete Gameplan

**Project Start Date**: November 17, 2025  
**Status**: Planning Phase  
**Goal**: Build autonomous AI-powered trading bot with 90% win rate

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Core Architecture](#core-architecture)
3. [Technical Stack](#technical-stack)
4. [System Components](#system-components)
5. [Scanner Logic](#scanner-logic)
6. [AI Integration](#ai-integration)
7. [Trade Execution](#trade-execution)
8. [Database Schema](#database-schema)
9. [Testing Strategy](#testing-strategy)
10. [Dashboard Features](#dashboard-features)
11. [Open Questions](#open-questions)

---

## Project Overview

### Mission Statement
Build an autonomous trading bot that trades BTC futures on Coinbase using AI-powered technical analysis based on liquidity sweeps, market structure, and fair value gaps.

### Key Decisions Made
- ✅ **Platform**: Coinbase Advanced Trade API (Futures & Derivatives)
- ✅ **Blockchain**: No L2 smart contracts needed
- ✅ **Instrument**: BTC-USD Spots
- ✅ **Position Sizing**: Fixed 1% of account per trade
- ✅ **Database**: PostgreSQL
- ✅ **AI Model**: GPT-OSS 20B (hosted locally on Mac Mini)
- ✅ **Orchestration**: n8n (self-hosted on Mac Mini)
- ✅ **Frontend**: Next.js
- ✅ **Backend**: Node.js
- ✅ **Testing**: Real capital from start (small amounts)

### Success Criteria
- **Primary Goal**: Achieve and maintain 90% win rate
- **Metrics**: Track Wins / Losses / Break-evens
- **ROI**: Positive returns with controlled drawdown
- **Automation**: Fully autonomous operation via n8n

---

## Core Architecture

```
┌──────────────────────────────────────────────────────┐
│             DATA COLLECTION (Continuous)              │
│  • Coinbase API: 4H + 5M BTC futures candles         │
│  • Store in PostgreSQL                                │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────┐
│           4H SCANNER (Liquidity Detection)            │
│                                                       │
│  Monitors:                                           │
│  • 4H swing highs                                    │
│  • 4H swing lows                                     │
│  • External liquidity zones                          │
│                                                       │
│  Trigger: When high/low is HIT or PASSED            │
│  ├─ If 4H high swept → Look for SHORT setup         │
│  └─ If 4H low swept  → Look for LONG setup          │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼ (Only when 4H sweep detected)
┌──────────────────────────────────────────────────────┐
│              5M SCANNER (Entry Confirmation)          │
│                                                       │
│  ⚠️  MUST HAPPEN IN THIS EXACT ORDER:                │
│                                                       │
│  Step 1: CHoCH detected (Change of Character)        │
│          ↓                                           │
│  Step 2: FVG FILL detected (Fair Value Gap filled)   │
│          ↓                                           │
│  Step 3: BOS detected (Break of Structure)           │
│          ↓                                           │
│  ✅ All 3 conditions met IN ORDER = ENTRY SIGNAL     │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────┐
│           GPT-OSS 20B (Decision Engine)               │
│                                                       │
│  Input Context:                                      │
│  • 4H liquidity sweep (high or low)                  │
│  • 5M CHoCH → FVG fill → BOS sequence               │
│  • Your rule book                                    │
│  • Trading psychology rules                          │
│  • Risk management parameters                        │
│  • Current market conditions                         │
│                                                       │
│  AI Decides:                                         │
│  • LONG or SHORT?                                    │
│  • Entry price                                       │
│  • Stop loss placement                               │
│  • Take profit target                                │
│  • Reasoning/confidence score                        │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────┐
│         COINBASE API EXECUTION (Automated)            │
│                                                       │
│  1. Calculate position size: 1% of account balance   │
│  2. Place market order (LONG or SHORT)               │
│  3. Set STOP LOSS order                              │
│  4. Set TAKE PROFIT order                            │
│  5. Monitor position continuously                    │
│  6. At 80% of take profit → Trail stop loss          │
│  7. Log trade to PostgreSQL                          │
└─────────────────────┬────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────┐
│          NEXT.JS DASHBOARD (Real-time Stats)          │
│                                                       │
│  • Live open positions                               │
│  • Win / Loss / Break-even count                     │
│  • ROI % (total profit/loss)                         │
│  • Win rate % (path to 90% goal)                     │
│  • Current account balance                           │
│  • Active confluences detected                       │
│  • AI decision reasoning log                         │
└──────────────────────────────────────────────────────┘
```

---

## Technical Stack

| Component | Technology | Location |
|-----------|-----------|----------|
| **Orchestration** | n8n | Self-hosted on Mac Mini |
| **AI Model** | GPT-OSS 20B | Local on Mac Mini |
| **Database** | PostgreSQL | Local or cloud |
| **Trading API** | Coinbase Advanced Trade API | Cloud |
| **Frontend** | Next.js | Deployed (Vercel/local) |
| **Backend** | Node.js | Local/cloud |
| **Data Streaming** | WebSockets + REST APIs | Coinbase |
| **Hosting** | Mac Mini (local server) | Local network |

---

## System Components

### 1. Data Collection Layer

**Purpose**: Continuously fetch and store market data

**n8n Workflow**: `Data_Collector`

```javascript
// Runs every 5 minutes
Trigger: Schedule (*/5 * * * *)
  ↓
Action 1: Fetch 4H candles from Coinbase
  GET /api/v3/brokerage/products/BTC-USD/candles
  { granularity: "FOUR_HOUR", limit: 50 }
  ↓
Action 2: Fetch 5M candles from Coinbase
  GET /api/v3/brokerage/products/BTC-USD/candles
  { granularity: "FIVE_MINUTE", limit: 100 }
  ↓
Action 3: Store in PostgreSQL
  INSERT INTO candles_4h (timestamp, open, high, low, close, volume)
  INSERT INTO candles_5m (timestamp, open, high, low, close, volume)
```

### 2. 4H Scanner (Liquidity Detection)

**Purpose**: Detect when 4-hour highs or lows are swept (liquidity taken)

**n8n Workflow**: `4H_Liquidity_Monitor`

**Logic**:
```javascript
// Runs every 4 hours on candle close
Trigger: Schedule (0 */4 * * *)
  ↓
Action 1: Get last 50 x 4H candles from PostgreSQL
  ↓
Action 2: Identify swing highs/lows
  - Swing High: candle.high > prev2.high AND candle.high > next2.high
  - Swing Low: candle.low < prev2.low AND candle.low < next2.low
  ↓
Action 3: Get current price from Coinbase
  ↓
Action 4: Check if liquidity swept
  IF current_price > last_swing_high:
    sweep_type = "HIGH"
    bias = "BEARISH" (expect reversal for SHORT)
  
  IF current_price < last_swing_low:
    sweep_type = "LOW"
    bias = "BULLISH" (expect reversal for LONG)
  ↓
Action 5: IF SWEEP DETECTED:
  - Store in liquidity_sweeps table
  - Set active = true
  - Activate 5M Scanner
  - Send notification
```

**Key Variables**:
- `last_swing_high`: Most recent 4H swing high
- `last_swing_low`: Most recent 4H swing low
- `sweep_threshold`: Price must exceed level by X% (e.g., 0.1%)

### 3. 5M Scanner (Confluence Detection)

**Purpose**: Detect CHoCH → FVG Fill → BOS in exact order

**n8n Workflow**: `5M_Confluence_Detector`

**State Machine Logic**:
```javascript
// Runs every 5 minutes on candle close
// Only active when 4H sweep is detected

Trigger: Schedule (*/5 * * * *) + Check active_sweep = true
  ↓
Action 1: Get last 100 x 5M candles from PostgreSQL
  ↓
Action 2: Load current state from confluence_state table
  - current_state: "WAITING_CHOCH" | "WAITING_FVG" | "WAITING_BOS" | "COMPLETE"
  - choch_detected: boolean
  - fvg_detected: boolean
  - bos_detected: boolean
  ↓
Action 3: Run state-based detection

  IF current_state == "WAITING_CHOCH":
    ↓
    Run CHoCH detection algorithm
    ↓
    IF CHoCH detected:
      - Store choch_time, choch_price
      - current_state = "WAITING_FVG"
      - Send notification: "CHoCH detected, waiting for FVG fill"
  
  ELSE IF current_state == "WAITING_FVG":
    ↓
    Run FVG detection algorithm
    Check if price is FILLING any FVG zone
    ↓
    IF FVG filled:
      - Store fvg_fill_time, fvg_zone_low, fvg_zone_high
      - current_state = "WAITING_BOS"
      - Send notification: "FVG filled, waiting for BOS"
  
  ELSE IF current_state == "WAITING_BOS":
    ↓
    Run BOS detection algorithm
    ↓
    IF BOS detected:
      - Store bos_time, bos_price
      - current_state = "COMPLETE"
      - sequence_valid = true
      - Send notification: "ALL CONFLUENCES MET - ENTRY SIGNAL"
      - Trigger AI decision workflow
  ↓
Action 4: Store state in PostgreSQL
  ↓
Action 5: IF state == "COMPLETE":
  - Package all data for AI
  - Call GPT-OSS API
  - Wait for trade decision
```

**Detection Algorithms**:

#### CHoCH (Change of Character)
```javascript
function detectCHoCH(candles) {
  // Identify current market structure (uptrend/downtrend)
  const trend = identifyTrend(candles);
  
  if (trend === "UPTREND") {
    // Look for failure to make higher high
    const lastHigh = findLastSwingHigh(candles);
    const currentHigh = candles[0].high;
    
    if (currentHigh < lastHigh) {
      // Or check if recent higher low was broken
      const lastHigherLow = findLastHigherLow(candles);
      if (candles[0].low < lastHigherLow) {
        return {
          detected: true,
          type: "BEARISH_CHOCH",
          price: candles[0].close
        };
      }
    }
  }
  
  if (trend === "DOWNTREND") {
    // Look for failure to make lower low
    const lastLow = findLastSwingLow(candles);
    const currentLow = candles[0].low;
    
    if (currentLow > lastLow) {
      // Or check if recent lower high was broken
      const lastLowerHigh = findLastLowerHigh(candles);
      if (candles[0].high > lastLowerHigh) {
        return {
          detected: true,
          type: "BULLISH_CHOCH",
          price: candles[0].close
        };
      }
    }
  }
  
  return { detected: false };
}
```

#### FVG (Fair Value Gap) Detection & Fill
```javascript
function detectFVGFill(candles) {
  // Look for FVG in last 20 candles
  const fvgZones = [];
  
  for (let i = 2; i < candles.length; i++) {
    const candle1 = candles[i];
    const candle2 = candles[i-1];
    const candle3 = candles[i-2];
    
    // Bullish FVG: gap between candle1.high and candle3.low
    if (candle1.high < candle3.low) {
      fvgZones.push({
        type: "BULLISH",
        low: candle1.high,
        high: candle3.low,
        created_at: candle3.timestamp
      });
    }
    
    // Bearish FVG: gap between candle1.low and candle3.high
    if (candle1.low > candle3.high) {
      fvgZones.push({
        type: "BEARISH",
        low: candle3.high,
        high: candle1.low,
        created_at: candle3.timestamp
      });
    }
  }
  
  // Check if current price is filling any FVG
  const currentPrice = candles[0].close;
  
  for (const fvg of fvgZones) {
    if (currentPrice >= fvg.low && currentPrice <= fvg.high) {
      return {
        detected: true,
        filled: true,
        zone: fvg,
        fill_price: currentPrice
      };
    }
  }
  
  return { detected: false, filled: false };
}
```

#### BOS (Break of Structure)
```javascript
function detectBOS(candles) {
  // Find last significant swing high/low
  const swingHigh = findLastSwingHigh(candles);
  const swingLow = findLastSwingLow(candles);
  const currentPrice = candles[0].close;
  
  // Bullish BOS: break above swing high
  if (currentPrice > swingHigh.price) {
    return {
      detected: true,
      type: "BULLISH_BOS",
      price: currentPrice,
      broken_level: swingHigh.price
    };
  }
  
  // Bearish BOS: break below swing low
  if (currentPrice < swingLow.price) {
    return {
      detected: true,
      type: "BEARISH_BOS",
      price: currentPrice,
      broken_level: swingLow.price
    };
  }
  
  return { detected: false };
}

function findLastSwingHigh(candles, lookback = 20) {
  let swingHigh = { price: 0, index: 0 };
  
  for (let i = 2; i < lookback && i < candles.length - 2; i++) {
    const candle = candles[i];
    const prev1 = candles[i-1];
    const prev2 = candles[i-2];
    const next1 = candles[i+1];
    const next2 = candles[i+2];
    
    // Check if this is a swing high
    if (candle.high > prev1.high && 
        candle.high > prev2.high && 
        candle.high > next1.high && 
        candle.high > next2.high) {
      if (candle.high > swingHigh.price) {
        swingHigh = { price: candle.high, index: i };
      }
    }
  }
  
  return swingHigh;
}
```

---

## AI Integration

### GPT-OSS 20B Setup (Mac Mini)

**Installation**:
```bash
# Option 1: Using Ollama (Recommended for Mac)
brew install ollama
ollama pull gpt-oss:20b

# Option 2: Using vLLM (Better performance)
pip install vllm
python -m vllm.entrypoints.api_server \
  --model gpt-oss-20b \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype float16
```

**System Prompt Template**:
```
You are an expert BTC futures trader following a strict rule-based system.

=== ENTRY RULES ===
You may ONLY enter a trade when ALL conditions are met IN ORDER:
1. 4H liquidity sweep (high or low taken out)
2. 5M Change of Character (CHoCH)
3. 5M Fair Value Gap FILL
4. 5M Break of Structure (BOS)

=== POSITION RULES ===
- Position size: ALWAYS 1% of account balance (fixed, non-negotiable)
- Direction: 
  • If 4H HIGH swept → Look for SHORT after bearish reversal
  • If 4H LOW swept → Look for LONG after bullish reversal

=== STOP LOSS RULES ===
[TO BE DEFINED]
- Initial stop placement: [Your specific rule]
- Stop distance from entry: [Your rule]
- Never risk more than 1% of account

=== TAKE PROFIT RULES ===
[TO BE DEFINED]
- Take profit target: [Your specific rule - R:R ratio? Fixed pips? Next liquidity?]
- Profit target calculation method: [Your rule]

=== TRAILING STOP RULES ===
[TO BE DEFINED]
- When price reaches 80% of take profit target:
  • Move stop to: [Your rule - breakeven? 50% locked? Other?]

=== RISK MANAGEMENT ===
- Max risk per trade: 1% of account
- Position sizing: ALWAYS 1% of balance in USD
- Never override position sizing rules
- Max number of concurrent positions: [Your rule - 1? 2? 3?]
- Max daily loss limit: [Optional - e.g., 3% of account]

=== TRADING PSYCHOLOGY ===
- Patience: Wait for all 4 confluences in exact order
- Discipline: Follow the rules exactly, no exceptions
- Objectivity: Ignore emotions, trade the setup
- Consistency: Same rules every single trade
- [Add your other mental/psychological rules]

=== TRADING VOCABULARY ===
- Liquidity Sweep: Price takes out recent high/low to grab stop losses
- CHoCH: Change of Character - early sign of trend weakening
- FVG: Fair Value Gap - price imbalance that gets filled
- BOS: Break of Structure - confirms new trend direction
- External Liquidity: Obvious levels where stops cluster
- [Add any other terms specific to your system]

=== MARKET CONTEXT ===
- Primary Timeframe: 4H for bias
- Execution Timeframe: 5M for entry
- Trading Session: 24/7 (crypto markets)
- Asset: BTC-USD Spots

===========================

CURRENT MARKET SITUATION:
4H Liquidity Sweep:
  - Type: {HIGH or LOW}
  - Price: ${sweep_price}
  - Time: {sweep_timestamp}
  - Bias: {BULLISH or BEARISH}

5M Confluence Sequence:
  1. CHoCH:
     - Type: {BULLISH or BEARISH}
     - Price: ${choch_price}
     - Time: {choch_timestamp}
  
  2. FVG Fill:
     - Zone: ${fvg_low} - ${fvg_high}
     - Fill Price: ${fill_price}
     - Time: {fill_timestamp}
  
  3. BOS:
     - Type: {BULLISH or BEARISH}
     - Price: ${bos_price}
     - Broken Level: ${broken_level}
     - Time: {bos_timestamp}

Current Market Data:
  - Current Price: ${current_price}
  - Account Balance: ${account_balance}
  - 1% Position Size: ${position_size_usd}
  - Recent Volatility: {high/medium/low}

Previous Trade Context (if any):
  - Last trade outcome: {WIN/LOSS/BREAKEVEN}
  - Recent win rate: {percentage}
  - Consecutive wins/losses: {number}

===========================

Based on the rules above and current market situation, provide your trading decision in this EXACT JSON format:

{
  "action": "LONG" | "SHORT" | "NO_TRADE",
  "entry_price": <number>,
  "stop_loss": <number>,
  "take_profit": <number>,
  "position_size_usd": <number> (must equal 1% of account),
  "leverage": <number> (e.g., 3, 5),
  "confidence": <number 0-100>,
  "reasoning": "<detailed explanation of why this trade follows all rules and setup is valid>",
  "risk_reward_ratio": <number>,
  "expected_outcome": "WIN" | "LOSS" | "BREAKEVEN"
}

CRITICAL REQUIREMENTS:
- If any rule is violated, return action: "NO_TRADE"
- position_size_usd MUST equal exactly 1% of account_balance
- Provide clear reasoning that references specific rules
- Be conservative: when in doubt, NO_TRADE
- Validate that all 4 confluences happened in correct order
```

**n8n Workflow**: `AI_Decision_Engine`
```javascript
Trigger: Receive confluence complete event
  ↓
Action 1: Prepare data payload
  {
    sweep_data: { ... },
    confluence_data: { ... },
    account_data: { ... },
    market_data: { ... }
  }
  ↓
Action 2: Generate full prompt with system + user context
  ↓
Action 3: Call GPT-OSS API
  POST http://localhost:8000/v1/completions
  {
    "model": "gpt-oss-20b",
    "prompt": full_prompt,
    "temperature": 0.3,
    "max_tokens": 500,
    "stop": ["}"]
  }
  ↓
Action 4: Parse JSON response
  ↓
Action 5: Validate response
  - Is JSON valid?
  - Is action LONG/SHORT/NO_TRADE?
  - Is position_size exactly 1% of balance?
  - Are stop_loss and take_profit set?
  ↓
Action 6: IF valid → Send to trade executor
         ELSE → Log error and alert
```

---

## Trade Execution

### Coinbase API Order Flow

**n8n Workflow**: `Trade_Executor`

```javascript
Receive AI Decision (validated JSON)
  ↓
Validation Check:
  - action is LONG or SHORT? (not NO_TRADE)
  - All required fields present?
  - Position size = 1% of balance?
  ↓
Step 1: Get current account balance
  GET /api/v3/brokerage/accounts
  Response: { available_balance: $5000 }
  ↓
Step 2: Verify position size
  calculated_size = balance * 0.01
  IF ai_position_size != calculated_size:
    ERROR: Position size mismatch
    ABORT TRADE
  ↓
Step 3: Calculate contract quantity
  // BTC futures use contracts, not USD
  btc_price = current_price
  contracts = position_size_usd / btc_price
  ↓
Step 4: Place MARKET order
  POST /api/v3/brokerage/orders
  {
    "client_order_id": "bot_entry_{timestamp}",
    "product_id": "BTC-USD",
    "side": "BUY" (for LONG) or "SELL" (for SHORT),
    "order_configuration": {
      "market_market_ioc": {
        "quote_size": position_size_usd (for market orders in USD)
      }
    },
    "leverage": "3" (or your chosen leverage)
  }
  ↓
  Wait for fill confirmation
  GET /api/v3/brokerage/orders/{order_id}
  ↓
  Store: actual_entry_price, actual_fill_time, coinbase_order_id
  ↓
Step 5: Immediately place STOP LOSS order
  POST /api/v3/brokerage/orders
  {
    "client_order_id": "bot_stop_{timestamp}",
    "product_id": "BTC-USD",
    "side": "SELL" (if LONG) or "BUY" (if SHORT),
    "order_configuration": {
      "stop_limit_stop_limit": {
        "base_size": contracts,
        "limit_price": ai_decision.stop_loss * 0.999, // Slight buffer
        "stop_price": ai_decision.stop_loss,
        "stop_direction": "STOP_DIRECTION_STOP_DOWN" (for LONG)
      }
    }
  }
  ↓
  Store: stop_order_id
  ↓
Step 6: Place TAKE PROFIT order
  POST /api/v3/brokerage/orders
  {
    "client_order_id": "bot_tp_{timestamp}",
    "product_id": "BTC-USD",
    "side": "SELL" (if LONG) or "BUY" (if SHORT),
    "order_configuration": {
      "limit_limit_gtc": {
        "base_size": contracts,
        "limit_price": ai_decision.take_profit,
        "post_only": false
      }
    }
  }
  ↓
  Store: tp_order_id
  ↓
Step 7: Record trade in PostgreSQL
  INSERT INTO trades (
    confluence_event_id,
    entry_time,
    direction,
    entry_price,
    position_size_usd,
    stop_loss,
    take_profit,
    ai_reasoning,
    coinbase_order_id,
    stop_order_id,
    tp_order_id,
    status
  ) VALUES (...)
  ↓
Step 8: Activate position monitor
  Create monitoring job for this position
  ↓
Step 9: Send notifications
  - Discord/Telegram: "Trade opened"
  - Dashboard: Update UI
  - Log: Record in system logs
```

### Position Monitor & Trailing Stop

**n8n Workflow**: `Position_Monitor`

```javascript
// Runs every 1 minute for all open positions
Trigger: Schedule (*/1 * * * *)
  ↓
Action 1: Query all open positions from PostgreSQL
  SELECT * FROM trades WHERE status = 'OPEN'
  ↓
Action 2: For each open position:
  ↓
  Get current price from Coinbase WebSocket or API
    current_price = getCoinbasePrice('BTC-USD')
  ↓
  Calculate unrealized P&L:
    IF direction == 'LONG':
      pnl_usd = (current_price - entry_price) * contracts
      pnl_percent = ((current_price - entry_price) / entry_price) * 100
    
    IF direction == 'SHORT':
      pnl_usd = (entry_price - current_price) * contracts
      pnl_percent = ((entry_price - current_price) / entry_price) * 100
  ↓
  Calculate progress to take profit:
    profit_target = take_profit - entry_price (for LONG)
    current_profit = current_price - entry_price (for LONG)
    progress_percent = (current_profit / profit_target) * 100
  ↓
  Update database with current P&L:
    UPDATE trades 
    SET 
      current_price = current_price,
      unrealized_pnl = pnl_usd,
      unrealized_pnl_percent = pnl_percent,
      updated_at = NOW()
    WHERE id = trade_id
  ↓
  Check trailing stop condition:
  IF progress_percent >= 80:
    ↓
    IF trailing_stop_activated == false:
      ↓
      [APPLY YOUR TRAILING STOP RULE]
      
      // Example rules (TO BE DEFINED BY YOU):
      // Option 1: Move stop to breakeven
      new_stop = entry_price
      
      // Option 2: Lock in 50% of profit
      new_stop = entry_price + (profit_target * 0.50)
      
      // Option 3: Trail by fixed amount
      new_stop = current_price - $100 (for LONG)
      ↓
      Cancel old stop loss order:
        POST /api/v3/brokerage/orders/{stop_order_id}/cancel
      ↓
      Place new stop order:
        POST /api/v3/brokerage/orders
        {
          "product_id": "BTC-USD",
          "side": opposite_side,
          "order_configuration": {
            "stop_limit_stop_limit": {
              "base_size": contracts,
              "stop_price": new_stop,
              "limit_price": new_stop * 0.999
            }
          }
        }
      ↓
      Update database:
        UPDATE trades
        SET 
          stop_loss = new_stop,
          trailing_stop_activated = true,
          trailing_stop_time = NOW()
        WHERE id = trade_id
      ↓
      Send notification: "Trailing stop activated at $X"
  ↓
  Check if position was closed:
    GET /api/v3/brokerage/orders/{tp_order_id}
    GET /api/v3/brokerage/orders/{stop_order_id}
    
    IF either order is filled:
      ↓
      Record trade outcome:
        final_exit_price = filled_order.price
        final_pnl = calculate_final_pnl()
        
        IF final_pnl > 0:
          outcome = 'WIN'
        ELSE IF final_pnl < 0:
          outcome = 'LOSS'
        ELSE:
          outcome = 'BREAKEVEN'
      ↓
      Update trades table:
        UPDATE trades
        SET
          exit_time = NOW(),
          exit_price = final_exit_price,
          outcome = outcome,
          pnl_usd = final_pnl,
          pnl_percent = (final_pnl / position_size_usd) * 100,
          status = 'CLOSED'
        WHERE id = trade_id
      ↓
      Deactivate 4H sweep:
        UPDATE liquidity_sweeps
        SET active = false
        WHERE id = sweep_id
      ↓
      Reset 5M scanner state:
        DELETE FROM confluence_state WHERE sweep_id = sweep_id
      ↓
      Update account balance:
        new_balance = old_balance + final_pnl
      ↓
      Calculate updated win rate:
        total_trades = COUNT(trades WHERE status = 'CLOSED')
        wins = COUNT(trades WHERE outcome = 'WIN')
        win_rate = (wins / total_trades) * 100
      ↓
      Send notifications:
        - "Trade closed: {outcome}"
        - "P&L: ${final_pnl} ({pnl_percent}%)"
        - "Win rate: {win_rate}%"
      ↓
      Check if 90% win rate achieved:
        IF win_rate >= 90 AND total_trades >= 100:
          ALERT: "🎉 90% WIN RATE ACHIEVED - READY FOR SCALE"
```

---

## Database Schema

### PostgreSQL Tables

#### 1. `candles_4h` - Four Hour Candle Data
```sql
CREATE TABLE candles_4h (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL UNIQUE,
  open DECIMAL(12,2) NOT NULL,
  high DECIMAL(12,2) NOT NULL,
  low DECIMAL(12,2) NOT NULL,
  close DECIMAL(12,2) NOT NULL,
  volume DECIMAL(18,8) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_4h_timestamp (timestamp DESC)
);
```

#### 2. `candles_5m` - Five Minute Candle Data
```sql
CREATE TABLE candles_5m (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL UNIQUE,
  open DECIMAL(12,2) NOT NULL,
  high DECIMAL(12,2) NOT NULL,
  low DECIMAL(12,2) NOT NULL,
  close DECIMAL(12,2) NOT NULL,
  volume DECIMAL(18,8) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_5m_timestamp (timestamp DESC)
);
```

#### 3. `liquidity_sweeps` - 4H Liquidity Events
```sql
CREATE TABLE liquidity_sweeps (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  sweep_type VARCHAR(10) NOT NULL, -- 'HIGH' or 'LOW'
  price DECIMAL(12,2) NOT NULL,
  bias VARCHAR(10) NOT NULL, -- 'BULLISH' or 'BEARISH'
  swing_level DECIMAL(12,2) NOT NULL, -- The high/low that was swept
  active BOOLEAN DEFAULT true,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_active_sweeps (active, timestamp DESC)
);
```

#### 4. `confluence_state` - 5M Scanner State Machine
```sql
CREATE TABLE confluence_state (
  id SERIAL PRIMARY KEY,
  sweep_id INT REFERENCES liquidity_sweeps(id),
  current_state VARCHAR(20) NOT NULL, 
    -- 'WAITING_CHOCH' | 'WAITING_FVG' | 'WAITING_BOS' | 'COMPLETE'
  
  -- CHoCH data
  choch_detected BOOLEAN DEFAULT false,
  choch_time TIMESTAMPTZ,
  choch_price DECIMAL(12,2),
  choch_type VARCHAR(20), -- 'BULLISH_CHOCH' | 'BEARISH_CHOCH'
  
  -- FVG data
  fvg_detected BOOLEAN DEFAULT false,
  fvg_fill_time TIMESTAMPTZ,
  fvg_zone_low DECIMAL(12,2),
  fvg_zone_high DECIMAL(12,2),
  fvg_fill_price DECIMAL(12,2),
  fvg_type VARCHAR(20), -- 'BULLISH_FVG' | 'BEARISH_FVG'
  
  -- BOS data
  bos_detected BOOLEAN DEFAULT false,
  bos_time TIMESTAMPTZ,
  bos_price DECIMAL(12,2),
  bos_type VARCHAR(20), -- 'BULLISH_BOS' | 'BEARISH_BOS'
  broken_level DECIMAL(12,2),
  
  sequence_valid BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_sweep_state (sweep_id, current_state)
);
```

#### 5. `trades` - All Trade Records
```sql
CREATE TABLE trades (
  id SERIAL PRIMARY KEY,
  sweep_id INT REFERENCES liquidity_sweeps(id),
  confluence_state_id INT REFERENCES confluence_state(id),
  
  -- Entry data
  entry_time TIMESTAMPTZ NOT NULL,
  direction VARCHAR(10) NOT NULL, -- 'LONG' or 'SHORT'
  entry_price DECIMAL(12,2) NOT NULL,
  position_size_usd DECIMAL(12,2) NOT NULL,
  contracts DECIMAL(18,8) NOT NULL,
  leverage INT NOT NULL,
  
  -- Risk management
  stop_loss DECIMAL(12,2) NOT NULL,
  take_profit DECIMAL(12,2) NOT NULL,
  risk_reward_ratio DECIMAL(5,2),
  
  -- Trailing stop
  trailing_stop_activated BOOLEAN DEFAULT false,
  trailing_stop_time TIMESTAMPTZ,
  original_stop_loss DECIMAL(12,2),
  
  -- Exit data
  exit_time TIMESTAMPTZ,
  exit_price DECIMAL(12,2),
  outcome VARCHAR(10), -- 'WIN', 'LOSS', 'BREAKEVEN'
  pnl_usd DECIMAL(12,2),
  pnl_percent DECIMAL(8,4),
  
  -- Current status (for open trades)
  status VARCHAR(10) DEFAULT 'OPEN', -- 'OPEN' or 'CLOSED'
  current_price DECIMAL(12,2),
  unrealized_pnl DECIMAL(12,2),
  unrealized_pnl_percent DECIMAL(8,4),
  
  -- AI decision
  ai_reasoning TEXT,
  ai_confidence INT, -- 0-100
  
  -- Coinbase order IDs
  coinbase_entry_order_id VARCHAR(255),
  coinbase_stop_order_id VARCHAR(255),
  coinbase_tp_order_id VARCHAR(255),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_status (status),
  INDEX idx_outcome (outcome),
  INDEX idx_entry_time (entry_time DESC)
);
```

#### 6. `account_balance` - Balance Tracking
```sql
CREATE TABLE account_balance (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  balance_usd DECIMAL(12,2) NOT NULL,
  available_balance DECIMAL(12,2) NOT NULL,
  margin_used DECIMAL(12,2),
  equity DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_timestamp (timestamp DESC)
);
```

#### 7. `system_logs` - General System Logs
```sql
CREATE TABLE system_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  log_level VARCHAR(10) NOT NULL, -- 'INFO', 'WARNING', 'ERROR'
  component VARCHAR(50) NOT NULL, -- '4H_SCANNER', '5M_SCANNER', 'AI', 'EXECUTOR'
  message TEXT NOT NULL,
  data JSONB, -- Additional structured data
  
  INDEX idx_level_time (log_level, timestamp DESC)
);
```

### Database Queries

**Get Current Win Rate**:
```sql
SELECT 
  COUNT(*) FILTER (WHERE outcome = 'WIN') as wins,
  COUNT(*) FILTER (WHERE outcome = 'LOSS') as losses,
  COUNT(*) FILTER (WHERE outcome = 'BREAKEVEN') as breakevens,
  COUNT(*) as total_trades,
  ROUND(
    (COUNT(*) FILTER (WHERE outcome = 'WIN')::DECIMAL / 
     NULLIF(COUNT(*), 0) * 100), 2
  ) as win_rate_percent
FROM trades
WHERE status = 'CLOSED';
```

**Get Total P&L**:
```sql
SELECT 
  SUM(pnl_usd) as total_pnl_usd,
  AVG(pnl_percent) as avg_pnl_percent,
  MAX(pnl_usd) as best_trade,
  MIN(pnl_usd) as worst_trade
FROM trades
WHERE status = 'CLOSED';
```

**Get Active Setup Status**:
```sql
SELECT 
  ls.sweep_type,
  ls.price as sweep_price,
  ls.bias,
  cs.current_state,
  cs.choch_detected,
  cs.fvg_detected,
  cs.bos_detected
FROM liquidity_sweeps ls
LEFT JOIN confluence_state cs ON cs.sweep_id = ls.id
WHERE ls.active = true
ORDER BY ls.timestamp DESC
LIMIT 1;
```

---

## Testing Strategy

### Phase 1: Micro Capital Validation (Weeks 1-4)

**Objective**: Prove the system works mechanically without significant risk

**Capital**: $500 - $1,000  
**Position Size**: 1% = $5 - $10 per trade  
**Leverage**: 2-3x (conservative)

**Success Criteria**:
- ✅ All n8n workflows execute without errors
- ✅ 4H scanner correctly identifies liquidity sweeps
- ✅ 5M scanner detects CHoCH → FVG → BOS in order
- ✅ AI makes logical decisions based on confluences
- ✅ Orders execute on Coinbase successfully
- ✅ Stop losses and take profits work correctly
- ✅ Trailing stop activates at 80% profit
- ✅ Database records all data accurately
- ✅ Dashboard displays real-time information

**Minimum Trades**: 20-30 trades

**Metrics to Track**:
- Technical execution rate: 100% (no failed orders)
- Confluence detection accuracy
- AI reasoning quality (manual review)
- System uptime %

**Expected Outcome**: System operates reliably, even if win rate is lower than target

---

### Phase 2: Pattern Validation (Weeks 5-8)

**Objective**: Build win rate and validate trading edge

**Capital**: $2,000 - $3,000  
**Position Size**: 1% = $20 - $30 per trade  
**Leverage**: 3-5x

**Success Criteria**:
- ✅ Win rate trending toward 70%+
- ✅ Positive total P&L (even if small)
- ✅ AI decision quality improving
- ✅ Risk management holding (max 1% per trade)
- ✅ No catastrophic losses
- ✅ System runs autonomously without intervention

**Minimum Trades**: 50-100 trades

**Adjustments to Make**:
- Fine-tune AI prompts based on losing trades
- Adjust confluence detection parameters if needed
- Refine stop loss and take profit rules
- Optimize trailing stop behavior

**Metrics to Track**:
- Win rate %
- Average R:R per trade
- Largest drawdown
- Consecutive losses (max streak)
- Time to 80% profit on winners

**Expected Outcome**: Win rate improves, system reliability proven

---

### Phase 3: Consistency Testing (Weeks 9-12)

**Objective**: Achieve 90% win rate consistently

**Capital**: $5,000 - $10,000  
**Position Size**: 1% = $50 - $100 per trade  
**Leverage**: 3-5x

**Success Criteria**:
- ✅ **90% win rate over 100+ trades** (PRIMARY GOAL)
- ✅ Max drawdown stays under 10%
- ✅ System runs fully autonomously
- ✅ No manual interventions needed
- ✅ Consistent performance week-over-week

**Minimum Trades**: 100+ trades

**Analysis**:
- Review every losing trade: Why did it lose?
- Identify patterns in wins vs losses
- Ensure rules are being followed exactly
- Validate that confluences are high-quality

**Metrics to Track**:
- Win rate (must reach 90%)
- Sharpe ratio
- Maximum consecutive losses
- Recovery time from losses
- System reliability (uptime)

**Expected Outcome**: 90% win rate achieved and maintained

---

### Phase 4: Scale to Full Capital (Week 13+)

**Objective**: Deploy with full confidence

**Capital**: Full intended amount (e.g., $25,000+)  
**Position Size**: 1% = $250+ per trade  
**Leverage**: 3-5x

**Ongoing Activities**:
- Continuous monitoring of win rate
- Regular AI prompt refinement
- System performance optimization
- Risk management validation
- Drawdown monitoring

**Safety Measures**:
- Emergency stop button (close all positions)
- Daily loss limit (e.g., 3% of account)
- Maximum consecutive loss limit (e.g., 3 losses = pause)
- Weekly performance review
- Monthly AI retraining on new data

---

## Dashboard Features

### Next.js Frontend - Real-Time Display

**Main Dashboard View**:

```
┌──────────────────────────────────────────────────────────────┐
│                  BTC FUTURES TRADING BOT                     │
│                     Live Dashboard                           │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────── ACCOUNT OVERVIEW ─────────────────────┐
│                                                               │
│  💰 Current Balance: $8,543.27                               │
│  📈 Total P&L: +$3,543.27 (+70.87%)                         │
│  🎯 Win Rate: 89.2% (115W / 14L / 0BE)                      │
│  📊 Total Trades: 129                                        │
│                                                               │
│  [  ████████████████████████████████████████░░░░░ 89.2%  ]  │
│  Progress to 90% Goal: Almost there! (0.8% to go)           │
│                                                               │
└──────────────────────────────────────────────────────────────┘

┌────────────────────── PERFORMANCE STATS ─────────────────────┐
│                                                               │
│  Average Win: +$52.30 (+2.1%)                                │
│  Average Loss: -$18.75 (-0.75%)                              │
│  Risk:Reward Ratio: 2.79:1                                   │
│  Largest Win: +$213.50 (+8.5%)                               │
│  Largest Loss: -$25.00 (-1.0%)                               │
│  Max Consecutive Wins: 12                                    │
│  Max Consecutive Losses: 2                                   │
│  Current Streak: 🔥 5 wins                                   │
│                                                               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────── OPEN POSITIONS ──────────────────────┐
│                                                               │
│  📍 BTC LONG @ $43,250.00                                    │
│     Opened: Today at 2:45 PM (1h 23m ago)                   │
│     Position Size: $85.43 (1% of balance)                   │
│     Leverage: 3x                                             │
│                                                               │
│     💵 Current P&L: +$38.20 (+44.7%)                        │
│     📊 Progress to TP: ████████████░░░░░ 82%                │
│                                                               │
│     🎯 Take Profit: $43,650.00 ($400 away)                  │
│     🛑 Stop Loss: $43,050.00 (trailing activated ✅)        │
│     🔒 Original Stop: $43,100.00                            │
│                                                               │
│     🤖 AI Confidence: 87%                                    │
│     💭 Reasoning: "All 4 confluences aligned perfectly.     │
│        4H low swept at $42,980, followed by bullish CHoCH   │
│        at $43,100, FVG fill at $43,200, and BOS at         │
│        $43,250. Strong bullish setup with high probability." │
│                                                               │
│     [Close Position Manually]                                │
│                                                               │
└──────────────────────────────────────────────────────────────┘

┌─────────────────── ACTIVE MARKET SETUP ──────────────────────┐
│                                                               │
│  📊 4H Liquidity Sweep:                                      │
│     ✅ Status: DETECTED                                      │
│     Type: LOW swept                                          │
│     Price: $42,980.00                                        │
│     Time: Today at 12:00 PM                                 │
│     Bias: BULLISH (looking for LONG)                        │
│                                                               │
│  🔍 5M Confluence Detection:                                 │
│     1. ✅ CHoCH: Detected at $43,100 (2:15 PM)              │
│     2. ✅ FVG Fill: Zone $43,180-$43,220 filled (2:35 PM)   │
│     3. ✅ BOS: Detected at $43,250 (2:45 PM)                │
│                                                               │
│     Status: ALL CONFLUENCES MET ✅                           │
│     Trade Signal: LONG ENTRY EXECUTED                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘

┌────────────────────── RECENT TRADES ─────────────────────────┐
│                                                               │
│  1. ✅ WIN  | BTC SHORT @ $44,100 → $43,850 | +$62.50       │
│     Today 10:30 AM | R:R 2.5:1 | 1h 45m duration            │
│                                                               │
│  2. ✅ WIN  | BTC LONG @ $43,500 → $43,900  | +$48.20       │
│     Yesterday 4:15 PM | R:R 2.0:1 | 3h 20m duration         │
│                                                               │
│  3. ❌ LOSS | BTC LONG @ $43,200 → $43,100  | -$18.50       │
│     Yesterday 11:00 AM | R:R N/A | 25m duration (stopped)   │
│                                                               │
│  4. ✅ WIN  | BTC SHORT @ $44,500 → $44,050 | +$95.40       │
│     2 days ago | R:R 3.0:1 | 5h 10m duration                │
│                                                               │
│  [View All Trades]                                           │
│                                                               │
└──────────────────────────────────────────────────────────────┘

┌───────────────────── SYSTEM STATUS ──────────────────────────┐
│                                                               │
│  🟢 Bot Status: ACTIVE & TRADING                             │
│  🟢 n8n Server: Running (Mac Mini)                           │
│  🟢 GPT-OSS 20B: Online                                      │
│  🟢 Database: Connected                                      │
│  🟢 Coinbase API: Connected                                  │
│  🟢 WebSocket: Streaming                                     │
│                                                               │
│  Last Update: Just now                                       │
│  System Uptime: 12 days, 4 hours                            │
│                                                               │
│  [⏸ Pause Bot] [⏹ Emergency Stop] [⚙️ Settings]            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Additional Dashboard Pages**:

1. **Detailed Analytics**
   - Win rate over time (chart)
   - P&L curve
   - Drawdown analysis
   - Trade duration statistics
   - Best/worst trading hours

2. **AI Decision Log**
   - All AI decisions with full reasoning
   - Confidence scores over time
   - Decision accuracy analysis
   - Manual review and rating system

3. **Confluence History**
   - All detected 4H sweeps
   - 5M confluence sequences
   - Success rate per confluence type
   - Pattern quality scoring

4. **System Logs**
   - Real-time log stream
   - Error tracking
   - Performance metrics
   - API call monitoring

5. **Settings & Controls**
   - Bot enable/disable
   - Position size adjustment (always 1%)
   - Leverage settings
   - Notification preferences
   - API key management
   - Emergency stop configuration

---

## Open Questions

### Critical Items to Define Before Building:

1. **Stop Loss Placement Rule**
   - ❓ Where exactly do you place the initial stop loss?
   - Options: Below/above FVG zone? Fixed pips from entry? ATR-based?
   - Example: "Stop loss 50 pips below entry" or "Stop below FVG low"

2. **Take Profit Target Rule**
   - ❓ How do you determine the take profit level?
   - Options: Fixed R:R ratio (e.g., 2:1)? Next liquidity level? % move?
   - Example: "Always 2:1 R:R" or "Target next 4H high/low"

3. **Trailing Stop at 80% Profit Rule**
   - ❓ What happens when price reaches 80% of take profit?
   - Options: 
     - Move stop to breakeven (entry price)
     - Lock in 50% of profit
     - Trail by fixed amount ($50, $100)
     - Trail by %
   - Example: "Move stop to breakeven" or "Lock in 50% profit"

4. **Position Management**
   - ❓ Max number of concurrent open positions?
   - Options: Only 1 at a time? Allow 2-3?
   - Recommendation: Start with 1, expand later

5. **Risk Limits**
   - ❓ Daily loss limit?
   - ❓ Max consecutive losses before pause?
   - Example: "Stop trading after 3 consecutive losses" or "Max 3% daily loss"

6. **Leverage**
   - ❓ What leverage will you use?
   - Options: 2x (conservative), 3x, 5x (aggressive)
   - Consideration: Higher leverage = higher liquidation risk

7. **Starting Capital**
   - ❓ What's your Phase 1 testing budget?
   - Recommendation: Start with $500-$1,000 for safety

8. **Mac Mini Specs**
   - ❓ Can your Mac Mini run GPT-OSS 20B?
   - Requirements: 
     - RAM: 40GB+ (for 20B parameter model)
     - Storage: 50GB+ free
     - M-series chip recommended
   - Alternative: Use cloud GPU if Mac Mini isn't powerful enough

9. **Additional Trading Rules**
   - ❓ Any time-of-day restrictions? (avoid low liquidity hours?)
   - ❓ Any day-of-week preferences?
   - ❓ Max trade duration before force close?
   - ❓ Partial profit taking at certain levels?

10. **Notification Preferences**
    - ❓ Where to send alerts? (Telegram, Discord, SMS, Email?)
    - ❓ What events should trigger notifications?
      - Trade opened/closed
      - Confluence detected
      - Win rate milestones
      - System errors

---

## Next Steps

### Immediate Actions:

1. **Answer Open Questions** ⬆️
   - Define all trading rules clearly
   - Specify risk parameters
   - Confirm Mac Mini capabilities

2. **Environment Setup**
   - Install n8n on Mac Mini
   - Install PostgreSQL database
   - Set up GPT-OSS 20B (Ollama or vLLM)
   - Configure Coinbase API keys

3. **Database Setup**
   - Create PostgreSQL database
   - Run all table creation scripts
   - Set up indexes for performance

4. **n8n Workflow Development**
   - Data Collection workflow
   - 4H Scanner workflow
   - 5M Scanner workflow (state machine)
   - AI Decision Engine workflow
   - Trade Executor workflow
   - Position Monitor workflow

5. **AI Prompt Engineering**
   - Create complete system prompt
   - Test AI responses
   - Refine based on quality of decisions

6. **Coinbase API Integration**
   - Test API connectivity
   - Implement order placement
   - Test stop loss and take profit orders
   - Implement WebSocket for real-time prices

7. **Frontend Development**
   - Set up Next.js project
   - Create dashboard components
   - Implement real-time updates
   - Build trading log view

8. **Testing & Validation**
   - Test each component individually
   - Test full system end-to-end
   - Simulate trades before going live
   - Start Phase 1 with micro capital

### Development Timeline (Estimated):

- **Week 1-2**: Setup + Core Infrastructure
  - Environment setup
  - Database creation
  - Basic n8n workflows
  - Coinbase API integration

- **Week 3-4**: Scanner Development
  - 4H liquidity scanner
  - 5M confluence detector
  - State machine logic
  - Testing detection accuracy

- **Week 5-6**: AI & Execution
  - GPT-OSS integration
  - AI prompt refinement
  - Trade executor workflow
  - Position monitor workflow

- **Week 7-8**: Frontend & Testing
  - Next.js dashboard
  - Real-time data display
  - End-to-end system testing
  - Bug fixes and refinements

- **Week 9+**: Live Trading
  - Phase 1: Micro capital ($500-$1,000)
  - Monitor and adjust
  - Refine AI prompts
  - Improve confluence detection
  - Progress toward 90% win rate

---

## Project Principles

### Core Values:
1. **Discipline**: Follow the rules exactly, every single time
2. **Patience**: Wait for all confluences before entering
3. **Risk Management**: Never risk more than 1% per trade
4. **Continuous Improvement**: Learn from every trade
5. **Automation**: Let the system run autonomously
6. **Transparency**: Track every decision and outcome

### Success Metrics:
- **Primary**: 90% win rate over 100+ trades
- **Secondary**: Positive total P&L
- **Tertiary**: System reliability and uptime
- **Quaternary**: Autonomous operation without intervention

### Warning Signs to Watch For:
- Win rate dropping below 70%
- Consecutive losses exceeding 3
- AI making illogical decisions
- System errors or downtime
- Emotional trading decisions (manually overriding bot)

---

## Document Version Control

**Version**: 1.0  
**Last Updated**: November 17, 2025  
**Status**: Planning Phase  
**Next Review**: After answering open questions

---

**Ready to build when you are! Let's answer those open questions and start development. 🚀**