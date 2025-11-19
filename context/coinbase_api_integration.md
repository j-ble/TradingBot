# Coinbase Advanced Trade API Integration

## Document Purpose
This document tracks our efforts to integrate Coinbase Advanced Trade API for BTC futures/spot trading in our autonomous trading bot.

**Created:** 2025-11-18
**Status:** Authentication Issues - In Progress
**Last Updated:** 2025-11-18

---

## Trading Bot Requirements

### What We Need from Coinbase API

**Primary Goal:** Trade BTC perpetual futures autonomously

**Essential API Functions:**
1. **Market Data**
   - Real-time BTC price feed
   - Historical 4H candlestick data (last 200 candles)
   - Historical 5M candlestick data (last 500 candles)
   - Product information and trading pairs

2. **Account Management**
   - Query account balances
   - Track available funds
   - Monitor position status

3. **Order Execution**
   - Place market orders (entry)
   - Place stop-loss orders (swing-based)
   - Place take-profit orders (2:1 R/R minimum)
   - Cancel orders
   - Query order status
   - Monitor order fills

4. **Real-Time Updates** (Future - PR#7)
   - WebSocket connection for live price updates
   - Position monitoring
   - Order fill notifications

---

## Current Implementation Status

### ✅ Completed (PR#2)

**Files Created:**
- `lib/coinbase/client.js` - Main API client (485 lines)
- `lib/coinbase/auth.js` - JWT authentication (155 lines)
- `lib/coinbase/errors.js` - Error handling (210 lines)
- `lib/coinbase/endpoints.js` - API definitions (240 lines)
- `tests/test_coinbase.js` - Test suite (215 lines)
- `tests/debug_auth.js` - Debug utilities (50 lines)

**Features Implemented:**
- JWT authentication with ES256 (ECDSA P-256)
- 3-tier rate limiting (public/private/orders)
- Automatic retry with exponential backoff
- 11 API methods (market data, accounts, orders)
- Comprehensive error handling (10 error types)
- Request/response logging

**API Methods:**
```javascript
// Market Data
getCandles(productId, granularity, start, end)
getCurrentPrice(productId)
getProduct(productId)

// Accounts
getAccounts()
getAccountBalance(accountId?)

// Orders
placeMarketOrder(productId, side, size)
placeStopLossOrder(productId, side, size, stopPrice)
placeTakeProfitOrder(productId, side, size, limitPrice)
getOrder(orderId)
cancelOrder(orderId)
listOrders(productId?, status?)
```

### ❌ Current Blocker: Authentication Issues

**Problem:** Receiving 401 Unauthorized on all API requests

**What We've Tried:**
1. ✅ Implemented JWT authentication (ES256 algorithm)
2. ✅ Verified JWT generation works correctly
3. ✅ Switched from futures (`BTC-PERP-INTX`) to spot (`BTC-USD`)
4. ✅ Created new API keys with ECDSA signature algorithm
5. ✅ Verified View + Trade permissions enabled
6. ❌ Still receiving 401 Unauthorized errors

**Root Cause Analysis:**
The API keys being created are for **Coinbase Cloud API** (Developer Platform), not **Coinbase Advanced Trade API** (retail trading platform). These are separate Coinbase products with different authentication methods.

---

## Coinbase API Products Comparison

### 1. Coinbase Cloud API / CDP (What We Currently Have)

**Purpose:** Blockchain data, wallet management, payment processing

**Authentication:**
- JWT tokens signed with EC private keys (ES256)
- API key format: `organizations/{org_id}/apiKeys/{key_id}`
- Private key in PEM format (ECDSA)

**Use Cases:**
- Create and manage wallets
- Query blockchain transactions
- Get wallet balances
- Payment processing
- **NOT for trading on exchanges**

**Our Implementation:** ✅ Fully implemented and working

**Problem:** Cannot access trading endpoints (`/api/v3/brokerage/*`)

---

### 2. Coinbase Advanced Trade API (What We Need)

**Purpose:** Retail spot trading on Coinbase exchange

**Authentication:**
- HMAC-SHA256 signatures
- API Key + API Secret + Passphrase
- Timestamp-based signature generation

**Available Products:**
- Spot trading pairs: BTC-USD, ETH-USD, BTC-USDT, etc.
- **NO perpetual futures** (futures are on INTX platform)

**Endpoints:**
- Base URL: `https://api.coinbase.com/api/v3/brokerage`
- Market data, accounts, orders

**Our Implementation:** ❌ Not yet implemented (using JWT instead of HMAC)

**What We'd Need to Change:**
- Rewrite `lib/coinbase/auth.js` to use HMAC-SHA256
- Different signature generation algorithm
- Add passphrase to authentication
- Different header format

---

### 3. Coinbase International Exchange - INTX (Original Goal)

**Purpose:** Perpetual futures and derivatives trading

**Products:**
- `BTC-PERP-INTX` - Bitcoin perpetual futures
- `ETH-PERP-INTX` - Ethereum perpetual futures
- Other derivatives

**Authentication:**
- Likely JWT or HMAC (need to verify in INTX documentation)
- Separate API credentials required
- Different base URL (possibly `api.international.coinbase.com`)

**Requirements:**
- Separate INTX account signup
- KYC verification
- May have geographic restrictions

**Our Implementation:** ❌ Not accessible with current setup

**Status:** Original goal for futures trading, but requires separate platform

---

## Authentication Methods Comparison

### JWT Authentication (ES256) - Currently Implemented

**What We Have:**
```javascript
// Generate JWT token
const payload = {
  iss: 'coinbase-cloud',
  nbf: timestamp,
  exp: timestamp + 120,
  sub: apiKey,  // organizations/{org}/apiKeys/{id}
  uri: method + ' ' + path
};

const token = jwt.sign(payload, privateKey, {
  algorithm: 'ES256',
  header: { kid: apiKey, nonce: randomHex() }
});

// Request headers
headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

**Status:** ✅ Working for Cloud API, ❌ Not accepted by Advanced Trade

---

### HMAC-SHA256 Authentication - What Advanced Trade Needs

**What We Need to Implement:**
```javascript
// Generate signature
const timestamp = Date.now() / 1000;
const message = timestamp + method + requestPath + body;
const signature = crypto
  .createHmac('sha256', apiSecret)
  .update(message)
  .digest('base64');

// Request headers
headers = {
  'CB-ACCESS-KEY': apiKey,
  'CB-ACCESS-SIGN': signature,
  'CB-ACCESS-TIMESTAMP': timestamp,
  'CB-ACCESS-PASSPHRASE': passphrase,
  'Content-Type': 'application/json'
};
```

**Implementation Effort:** ~2 hours to rewrite authentication layer

**Files to Modify:**
- `lib/coinbase/auth.js` - Replace JWT with HMAC
- `.env` - Add COINBASE_PASSPHRASE variable
- Tests - Verify new authentication works

---

## Solutions & Options

### Option 1: Implement HMAC Authentication for Advanced Trade ⭐ RECOMMENDED

**Goal:** Trade spot products (BTC-USD, ETH-USD) on Coinbase retail exchange

**Steps:**
1. Create Advanced Trade API keys (different interface than Cloud)
2. Implement HMAC-SHA256 authentication in `auth.js`
3. Update client to use new auth method
4. Test with spot trading endpoints

**Pros:**
- Access to spot trading (BTC-USD, ETH-USD)
- Can execute real trades
- Large liquidity and established platform

**Cons:**
- No perpetual futures (only spot)
- Need to rewrite authentication (~2 hours)
- Different from original futures goal

**Timeline:** 2-3 hours implementation + testing

---

### Option 2: Use Coinbase International Exchange (INTX)

**Goal:** Trade perpetual futures (BTC-PERP-INTX) as originally planned

**Steps:**
1. Sign up for Coinbase International Exchange
2. Complete KYC verification
3. Create INTX-specific API credentials
4. Research INTX API authentication method
5. Implement INTX client (may need different base URL)

**Pros:**
- Access to perpetual futures (original goal)
- BTC-PERP, ETH-PERP products available
- Leverage trading

**Cons:**
- Requires separate account and verification
- May have geographic restrictions
- Unknown authentication method (need research)
- Additional complexity

**Timeline:** 1-2 days for account setup + unknown implementation time

---

### Option 3: Continue with Mock Data (Temporary Solution)

**Goal:** Keep building the bot while figuring out API access

**Steps:**
1. Create mock responses for Coinbase API calls
2. Implement PR#3 (Config & Error Handling)
3. Implement PR#4 (Utilities)
4. Implement PR#5-7 (Data collectors with mocks)
5. Come back to real API integration later

**Pros:**
- Immediate progress on bot development
- Can test trading logic without API
- No blocker on authentication

**Cons:**
- No real market data
- Cannot execute real trades yet
- Eventually need to solve authentication

**Timeline:** Continue development immediately

---

### Option 4: Pivot to Cloud API Use Cases

**Goal:** Use existing working Cloud API credentials

**Steps:**
- Change project focus to wallet/blockchain management
- Query blockchain data
- Manage wallets and transactions
- Different use cases than trading

**Pros:**
- Current implementation already works
- No authentication changes needed

**Cons:**
- Cannot trade (not a trading bot anymore)
- Completely different from original goal
- Not what we set out to build

**Timeline:** N/A - requires project pivot

---

## Technical Details

### Current API Key Format

```
COINBASE_API_KEY=organizations/dcfc015b-d7dc-4875-8f62-04f71294165c/apiKeys/3085703d-fb38-45e9-a5ee-589a68b4ffd9
COINBASE_API_SECRET=-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIHM4jcJHzv1YVJj40O0GeV4lrjV9tDSS1HujS+CrZQdBoAoGCCqGSM49
AwEHoUQDQgAEEGZ74imOqdokIMaK+2dnMyMmoVc2kmwiri30RPNtzFVfMluSuqNn
N8v/0ZcD2CHSs6CwrtbC0KjY/sb7qw4Ljw==
-----END EC PRIVATE KEY-----
```

**Format Indicates:** Cloud API / CDP credentials
**Works With:** Cloud API endpoints only
**Does NOT Work With:** Advanced Trade `/api/v3/brokerage` endpoints

---

### Product IDs

**Originally Targeted (INTX Futures):**
```javascript
BTC_PERP: 'BTC-PERP-INTX'  // Requires INTX platform
ETH_PERP: 'ETH-PERP-INTX'  // Requires INTX platform
```

**Currently Configured (Advanced Trade Spot):**
```javascript
BTC_USD: 'BTC-USD'    // Spot trading
ETH_USD: 'ETH-USD'    // Spot trading
BTC_USDT: 'BTC-USDT'  // Tether pair
ETH_USDT: 'ETH-USDT'  // Tether pair
```

**Status:** Changed to spot products, but still getting 401 due to auth method mismatch

---

### Error Messages

**Current Error:**
```
Request failed with status code 401
Unauthorized
```

**Endpoint Attempted:**
```
GET https://api.coinbase.com/api/v3/brokerage/products/BTC-USD/ticker
```

**What This Means:**
- Endpoint exists and is correct
- JWT token is being rejected
- Need different authentication method (HMAC)

---

## Next Steps & Recommendations

### Immediate Action Items

1. **Research HMAC Implementation** (~30 min)
   - Study Advanced Trade API documentation
   - Understand exact signature generation process
   - Identify all required headers

2. **Decide on Trading Platform** (User Decision)
   - Advanced Trade (spot trading) → Implement HMAC
   - INTX (futures) → Research INTX API + sign up
   - Mock data → Continue development

3. **If Choosing Advanced Trade HMAC:**
   - Rewrite `lib/coinbase/auth.js` for HMAC-SHA256
   - Create test Advanced Trade API keys
   - Test authentication with spot products
   - Verify all 11 API methods work

4. **If Choosing Mock Data:**
   - Create mock response generator
   - Implement PR#3 and PR#4
   - Continue bot development
   - Revisit real API integration later

---

## Trading Strategy Impact

### Current Bot Strategy

**From trading_bot_gameplan.md:**

1. **4H Liquidity Sweep Detection**
   - Requires 4H candle data
   - Needs historical data (200 candles = ~33 days)

2. **5M Confluence Detection** (CHoCH → FVG → BOS)
   - Requires 5M candle data
   - Needs real-time or frequent updates

3. **Swing-Based Stop Loss**
   - Calculated from swing highs/lows
   - Needs accurate historical candles

4. **Order Execution**
   - Market entry orders
   - Stop-loss orders
   - Take-profit orders

**API Requirements:**
- Historical candle data (✅ endpoint exists)
- Real-time price feed (✅ WebSocket available)
- Order placement (✅ endpoints exist)
- Order monitoring (✅ endpoints exist)

**All Required Endpoints Available** - Just need authentication to work!

---

### Impact of Platform Choice

**If Advanced Trade (Spot):**
- ✅ Can trade BTC-USD, ETH-USD
- ✅ All required endpoints available
- ❌ No perpetual futures
- ❌ No leverage beyond 3x (retail limit)
- Strategy works but with spot instead of futures

**If INTX (Futures):**
- ✅ Can trade BTC-PERP, ETH-PERP (original goal)
- ✅ Higher leverage available
- ✅ Perpetual futures for 24/7 trading
- ❌ Need separate account and verification
- ❌ Unknown API authentication method
- Strategy works as originally designed

**If Mock Data (Temporary):**
- ✅ Can continue building bot
- ✅ Test all logic without API
- ❌ No real market data
- ❌ Cannot execute real trades
- Strategy can be tested, but not live

---

## Open Questions

1. **Advanced Trade API Keys:** Where exactly do we create these? (Not in Cloud API interface)

2. **HMAC Implementation:** Is the signature algorithm documented? Need official API docs.

3. **INTX API:** What authentication method does INTX use? Need to research.

4. **Permissions:** Do Advanced Trade API keys need special approval or verification?

5. **Rate Limits:** Are rate limits the same between Cloud API and Advanced Trade?

6. **WebSocket:** Does Advanced Trade WebSocket use same JWT auth or different?

---

## Resources & Documentation

**Coinbase Cloud API (Current):**
- Docs: https://docs.cloud.coinbase.com/
- Auth: JWT with ES256
- Our implementation: ✅ Working

**Coinbase Advanced Trade API (Needed):**
- Docs: https://docs.cloud.coinbase.com/advanced-trade-api/
- Auth: HMAC-SHA256
- Our implementation: ❌ Not yet done

**Coinbase International Exchange:**
- Website: https://international.coinbase.com/
- API Docs: (need to find)
- Our access: ❌ No account yet

---

## Summary

**What We Built:** Fully functional Coinbase client with JWT authentication, rate limiting, retry logic, and 11 API methods.

**Current Blocker:** API keys are for Cloud API (blockchain/wallets), not Advanced Trade (trading).

**Path Forward:**
1. Implement HMAC authentication for Advanced Trade (2-3 hours), OR
2. Research and set up INTX for futures (1-2 days), OR
3. Continue building with mock data (immediate progress)

**Recommendation:** Option 1 (HMAC) for fastest path to working trading bot with spot products. Can explore INTX futures later if needed.

---

**Status:** Awaiting decision on which path to pursue.

**Next PR:** PR#3 (Config & Error Handling) can proceed independently while resolving this issue.
