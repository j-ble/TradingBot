# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **autonomous AI-powered BTC futures trading bot** for Coinbase Advanced Trade API. The system trades BTC-USD Spots using AI-driven technical analysis based on liquidity sweeps, market structure (CHoCH, FVG, BOS), and strict risk management.

**Primary Goal**: Achieve and maintain 90% win rate over 100+ trades
**Risk Model**: Fixed 1% risk per trade
**Status**: Pre-development / Planning phase

## System Architecture

The bot uses a multi-layer pattern detection system:

```
Data Collection (4H + 5M candles)
    ↓
4H Liquidity Scanner (detects swing high/low sweeps)
    ↓ (activates 5M scanner when sweep detected)
5M Confluence Detector (state machine: CHoCH → FVG Fill → BOS)
    ↓
AI Decision Engine (GPT-OSS 20B via Ollama)
    ↓
Trade Executor (Coinbase API)
    ↓
Position Monitor (trailing stops, P&L tracking)
```

## Technical Stack

- **Orchestration**: n8n (self-hosted workflows on Mac Mini)
- **AI Model**: GPT-OSS 20B (local via Ollama)
- **Database**: PostgreSQL 16
- **Backend**: Node.js 20 LTS
- **Frontend**: Next.js 14 + React
- **Trading API**: Coinbase Advanced Trade API
- **Real-time Data**: WebSockets + REST APIs

## Core Trading Rules

### Entry Requirements (ALL must be met)
1. **4H Liquidity Sweep**: High or low swept with clear bias
   - HIGH swept → BEARISH bias (look for SHORT)
   - LOW swept → BULLISH bias (look for LONG)
2. **5M Confluence Complete**: CHoCH → FVG Fill → BOS (exact order required)
3. **Swing-Based Stop Loss Valid**: 0.5%-3% from entry, allows minimum 2:1 R/R
4. **AI Approval**: Decision = YES, confidence ≥ 70%
5. **Risk Checks**: No open positions, daily loss limit not hit, not 3 consecutive losses

### Stop Loss Strategy (Swing-Based)

**Critical**: Stop losses are NEVER arbitrary percentages. They MUST be placed at market structure swing levels.

**Priority Logic**:
1. Primary: Most recent 5M swing low (LONG) or swing high (SHORT)
2. Fallback: 4H swing level that was swept
3. Validation: Stop must be 0.5%-3% from entry
4. R/R Check: Must allow minimum 2:1 risk/reward
5. If no valid swing meets criteria → REJECT the trade

**Swing Detection Pattern** (3-candle):
```javascript
// For LONG: find most recent swing low
swingLow = candle[i].low < candle[i-2].low && candle[i].low < candle[i+2].low

// For SHORT: find most recent swing high
swingHigh = candle[i].high > candle[i-2].high && candle[i].high > candle[i+2].high
```

**Buffer Zones**:
- LONG: Stop placed 0.2%-0.3% below swing low
- SHORT: Stop placed 0.2%-0.3% above swing high

### Position Sizing
- Fixed 1% of account balance per trade (non-negotiable)
- Calculated: `positionSize = (accountBalance * 0.01) / stopDistance`

### Risk Management
- Max positions: 1 concurrent
- Daily loss limit: 3% of balance → auto-pause
- Consecutive loss limit: 3 losses → 24h pause
- Leverage: 2-5x (configurable)
- Min R/R ratio: 2:1
- Max trade duration: 72 hours → auto-close
- Min account balance: $100 to trade

## Database Schema

### Core Tables

**candles_4h / candles_5m**: OHLCV data storage
**swing_levels**: Tracks both 4H and 5M swing highs/lows
**liquidity_sweeps**: 4H high/low sweep events with bias
**confluence_state**: State machine tracking CHoCH → FVG → BOS sequence
**trades**: Complete trade lifecycle with swing-based stop loss metadata
  - Key fields: `stop_loss_source` ('5M_SWING' | '4H_SWING'), `stop_loss_swing_price`, `stop_loss_distance_percent`

All timestamps use TIMESTAMPTZ. Prices are DECIMAL(12,2). Indexes on active flags and timestamps.

## Pattern Detection Algorithms

### 4H Liquidity Sweep
- Detects 3-candle swing highs/lows
- Tracks when price sweeps these levels (±0.1% threshold)
- Sets trading bias (HIGH swept = BEARISH, LOW swept = BULLISH)
- Stores swing level for stop loss calculation

### 5M Confluence State Machine

**State 1: CHoCH (Change of Character)**
- For BULLISH: Price breaks above recent highs after downtrend
- For BEARISH: Price breaks below recent lows after uptrend

**State 2: FVG (Fair Value Gap) Detection & Fill**
- Identifies 3-candle gaps: `candle1.high < candle3.low` (bullish FVG)
- Gap must be significant (>0.1% of price)
- Fill detected when price enters gap zone

**State 3: BOS (Break of Structure)**
- BULLISH: Break above CHoCH high (+0.1% confirmation)
- BEARISH: Break below CHoCH low (-0.1% confirmation)

**State Transitions**: WAITING_CHOCH → WAITING_FVG → WAITING_BOS → COMPLETE → Trigger AI

Timeout: >12 hours or invalidation → EXPIRED

## AI Integration

### Model Setup
```bash
# Install Ollama on Mac Mini
brew install ollama
ollama pull gpt-oss:20b
```

### System Prompt Requirements
The AI prompt MUST include:
- Entry rules (all 4 confluences required in order)
- Swing-based stop loss calculation methodology
- 1% fixed position sizing (non-negotiable)
- R/R validation (minimum 2:1)
- Conservative bias: when in doubt, return "NO_TRADE"

### AI Response Format (JSON)
```json
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
  "reasoning": "detailed explanation including swing-based stop validation"
}
```

## Coinbase API Integration

**Base URL**: `https://api.coinbase.com`

**Authentication**: JWT Bearer token signed with CDP API Key Secret
```
Authorization: Bearer <jwt_token>
```

### REST Endpoints

*Market Data*:
- `GET /api/v3/brokerage/products/{product_id}/candles` - Historical data (granularity: FIVE_MINUTE, FOUR_HOUR)
- `GET /api/v3/brokerage/best_bid_ask` - Best bid/ask prices
- `GET /api/v3/brokerage/products/{product_id}/ticker` - Recent market trades

*Account*:
- `GET /api/v3/brokerage/accounts` - List all accounts
- `GET /api/v3/brokerage/accounts/{account_uuid}` - Get account balance

*Orders*:
- `POST /api/v3/brokerage/orders` - Create order (market, limit, stop-limit)
- `GET /api/v3/brokerage/orders/historical/{order_id}` - Order status
- `GET /api/v3/brokerage/orders/historical/batch` - List orders
- `POST /api/v3/brokerage/orders/batch_cancel` - Cancel orders
- `POST /api/v3/brokerage/orders/close_position` - Close position

### WebSocket
- Channel: `ticker` on `BTC-USD` for real-time prices

### Order Execution Flow
1. Place market order (LONG/SHORT)
2. Place stop loss order (swing-based level)
3. Place take profit order (min 2:1 R/R)
4. Monitor position (every 1 minute)
5. At 80% to TP → activate trailing stop (move to breakeven)

## Development Phases

### MVP (Week 1) - COMPLETED CHECKLIST
- [x] PostgreSQL database with schema
- [x] Coinbase API integration
- [x] 4H/5M candle data collection
- [x] 4H liquidity sweep detection
- [x] 5M confluence detector (state machine)
- [x] Basic AI decision engine
- [x] Trade execution (market orders + SL/TP)
- [x] Simple dashboard (status + open positions)
- [x] Basic risk management (1% sizing, 1 position max)

### Phase 2 (Week 2) - Enhancement
- Trailing stops, Telegram notifications, full dashboard, AI optimization, paper trading

### Phase 3 (Weeks 3-4) - Production
- Testing suite, system hardening, advanced risk controls, live trading ($100), performance monitoring

## Testing Strategy

**Phase 1: Micro Capital** ($500-1000)
- Validate mechanical execution
- 20-30 trades minimum
- Focus: System reliability, not win rate

**Phase 2: Pattern Validation** ($2000-3000)
- 50-100 trades
- Target: 70%+ win rate
- Refine AI prompts based on losing trades

**Phase 3: Consistency** ($5000-10000)
- 100+ trades
- **Goal: 90% win rate** (PRIMARY OBJECTIVE)
- Analyze every losing trade

**Phase 4: Scale** ($25,000+)
- Full capital deployment
- Continuous monitoring and optimization

## Dashboard Features (Next.js)

Real-time display of:
- Current balance, total P&L, win rate progress to 90%
- Open positions with live P&L, trailing stop status
- Active market setup (4H sweep + 5M confluence state)
- Recent trades log (wins/losses/breakevens)
- System status (n8n, AI model, database, Coinbase API)
- Emergency stop button

## Common Development Tasks

### Run Database Migrations
```bash
psql -U postgres -d trading_bot -f database/schema.sql
```

### Start n8n
```bash
# Mac Mini self-hosted
npx n8n start
```

### Start Ollama AI Model
```bash
ollama serve
# In another terminal
ollama run gpt-oss:20b
```

### Query Win Rate
```sql
SELECT
  COUNT(*) FILTER (WHERE outcome = 'WIN') as wins,
  COUNT(*) as total_trades,
  ROUND((COUNT(*) FILTER (WHERE outcome = 'WIN')::DECIMAL /
         NULLIF(COUNT(*), 0) * 100), 2) as win_rate_percent
FROM trades WHERE status = 'CLOSED';
```

### Check Active Confluence State
```sql
SELECT
  ls.sweep_type, ls.price, ls.bias,
  cs.current_state, cs.choch_detected, cs.fvg_detected, cs.bos_detected
FROM liquidity_sweeps ls
LEFT JOIN confluence_state cs ON cs.sweep_id = ls.id
WHERE ls.active = true
ORDER BY ls.timestamp DESC LIMIT 1;
```

## Critical Implementation Notes

1. **Never Override Swing-Based Stops**: The stop loss MUST be at a swing level (5M or 4H). If neither swing provides a valid stop (0.5%-3% range + 2:1 R/R), the trade must be rejected.

2. **State Machine is Sequential**: 5M confluence MUST occur in exact order: CHoCH first, then FVG fill, then BOS. Out-of-order detection = invalid signal.

3. **1% Risk is Non-Negotiable**: Position sizing is always exactly 1% of account balance. AI cannot override this.

4. **Conservative AI Bias**: The AI should reject marginal setups. "When in doubt, NO_TRADE."

5. **Trailing Stop at 80%**: When unrealized profit reaches 80% of take profit target, move stop to breakeven (entry price).

6. **Emergency Stop Procedure**: Close all positions immediately, cancel all orders, stop all workflows, send urgent notifications.

## Project Documentation

- `PRD/FinalPRD.md` - Complete product requirements (1030 lines, definitive spec)
- `context/trading_bot_gameplan.md` - Detailed technical gameplan with pseudocode
- Empty `README.md` (to be populated)

## Open Questions to Resolve Before Implementation

Reference `context/trading_bot_gameplan.md` lines 1361-1424 for detailed open questions including:
- Mac Mini specs verification for GPT-OSS 20B (requires 40GB+ RAM)
- Notification preferences (Telegram/Discord/SMS)
- Additional time-of-day trading restrictions
- Partial profit taking rules
- Day-of-week preferences

## Key Files When Implementing

### Expected Project Structure
```
btc-trading-bot/
├── database/
│   ├── schema.sql
│   └── queries.js
├── lib/
│   ├── coinbase/ (API wrapper, websocket, orders)
│   ├── scanners/ (4h_scanner, 5m_scanner, swing_tracker, choch, fvg, bos)
│   ├── trading/ (position_sizer, risk_manager, stop_loss_calculator, executor, monitor)
│   ├── ai/ (decision, prompts, validation)
│   └── utils/ (logger, notifier)
├── jobs/ (n8n workflows)
└── dashboard/ (Next.js app)
```

## Success Criteria

**Primary**: 90% win rate over 100+ trades
**Secondary**: Positive total P&L
**Tertiary**: 99%+ system uptime
**Quaternary**: Fully autonomous operation

## MCP Skills & Dynamic Tool Loading

### Overview

This project uses Model Context Protocol (MCP) servers to extend Claude's capabilities with specialized tools. MCP servers are organized into **skills** that can be loaded progressively to manage context usage efficiently.

### Agent Skills Structure

Skills are organized in `.claude/skills/` directory with individual SKILL.md files:

```
.claude/skills/
├── github-integration/     # Repository management, PRs, issues, code search
├── brave-search/           # Web, news, image, video search
├── browser-automation/     # Playwright-based browser control
├── git-ops/                # Local Git operations
├── developer-docs/         # Context7 library documentation
├── content-processing/     # Web content fetching and markdown conversion
└── mcp-management/         # Dynamic MCP server loading
```

See `SKILLS.md` for comprehensive reference of all available MCP tools.

### MCP Configuration

**Configuration Location**: `~/.docker/mcp/registry.yaml`

**Auto-Loaded Servers** (essential tools):
- `brave` - Web search and research
- `context7` - Developer documentation
- `fetch` & `markitdown` - Content processing
- `git` - Local version control
- `github-official` - GitHub API (full toolset)
- `playwright` - Browser automation

**On-Demand Servers** (load when needed):
- `postgres` - PostgreSQL database tools
  - Load with: `mcp-add postgres --activate`
  - Use for: Database schema work, query optimization
  - Token cost: ~5-10k tokens

**Excluded Servers** (not used in this project):
- `openzeppelin-solidity` - Solidity smart contracts (not applicable)
- `youtube_transcript` - Video transcripts (not needed)

### Dynamic Loading Workflow

Use MCP Management tools to load servers on-demand:

```bash
# Discover available servers
mcp-find query="postgres"

# Load server when needed
mcp-add postgres --activate

# PostgreSQL tools now available for database work

# Remove server when done (optional)
mcp-remove postgres
```

### When to Load postgres Server

Load PostgreSQL tools dynamically when:
- Designing or modifying database schema (`database/schema.sql`)
- Writing complex SQL queries for candles, trades, or swing levels
- Optimizing query performance for time-series data
- Debugging database connection issues
- Analyzing data for backtesting

**Benefit**: Saves 5-10k tokens when not working with database.

### Skills Documentation

Each skill directory contains:
- **YAML Frontmatter**: Name and description (loaded at startup)
- **Skill Content**: Detailed documentation (loaded when relevant)
- **Use Cases**: Trading bot-specific examples
- **Best Practices**: Security, performance, integration tips

### Progressive Disclosure Pattern

Claude loads MCP skills in three levels:
1. **Level 1 (Startup)**: Skill names and descriptions from YAML frontmatter
2. **Level 2 (On-Demand)**: Full SKILL.md content when skill is relevant
3. **Level 3 (Optional)**: Additional linked files if needed (not yet implemented)

This approach keeps context usage efficient while maintaining full capability access.

### Token Usage Optimization

**Before Optimization** (all tools loaded):
- MCP tools: ~80k tokens (40% of 200k context)
- System prompt + other: ~40k tokens
- Free space: ~80k tokens

**After Optimization** (selective loading):
- Essential MCP tools: ~60k tokens (30%)
- On-demand tools: Load as needed (+5-10k when active)
- Free space: ~120k tokens (60%)

### Common MCP Workflows for Trading Bot

#### Research Trading Strategies
```
1. brave_web_search: "liquidity sweep detection algorithm"
2. fetch: Extract top articles as markdown
3. Analyze patterns and document insights
```

#### Find Code Examples
```
1. search_code: "FVG detection language:python"
2. get_file_contents: Read implementation
3. Adapt for trading bot
```

#### Database Development
```
1. mcp-add postgres --activate
2. Design schema for new table
3. Test queries
4. mcp-remove postgres (when done)
```

#### API Documentation
```
1. resolve-library-id: "coinbase"
2. get-library-docs: /coinbase/advanced-trade with topic="orders"
3. Implement order execution logic
```

#### Dashboard Testing
```
1. browser_navigate: http://localhost:3000
2. browser_click: Test user interactions
3. browser_console_messages: Check for errors
4. browser_take_screenshot: Document UI
```

### Best Practices

1. **Essential vs Optional**: Auto-load frequently used tools, load others on-demand
2. **Task-Based Loading**: Load postgres only during database work
3. **Skill Reference**: Check `.claude/skills/` or `SKILLS.md` before using tools
4. **Token Awareness**: Monitor context usage with `/context` command
5. **Security First**: Only use browser automation on trusted URLs (localhost, docs)

### Modifying MCP Configuration

**Backup Location**: `~/.docker/mcp/registry.yaml.backup`

To add/remove auto-loaded servers:
1. Edit `~/.docker/mcp/registry.yaml`
2. Add or remove server entries under `registry:`
3. Restart Claude Code to apply changes

To restore original configuration:
```bash
cp ~/.docker/mcp/registry.yaml.backup ~/.docker/mcp/registry.yaml
```

## Warning: Risk Disclosure

This bot trades with real capital. Risks include market volatility, execution slippage, API failures, AI decision errors, and liquidation risk with leverage. Always start with micro capital, monitor closely, and keep emergency stop accessible.
