# Coinbase API Authentication Issue - Analysis

## Current Situation

**Status:** Still receiving 401 Unauthorized errors after switching to spot products (BTC-USD)

**What We've Tried:**
1. ✅ Implemented JWT authentication with ES256 algorithm
2. ✅ JWT generation works correctly (verified with debug script)
3. ✅ Changed from perpetual futures (`BTC-PERP-INTX`) to spot products (`BTC-USD`)
4. ❌ Still getting 401 Unauthorized

## Root Cause Analysis

### API Key Format Indicates Wrong API Product

**Your API Key Format:**
```
organizations/dcfc015b-d7dc-4875-8f62-04f71294165c/apiKeys/3085703d-fb38-45e9-a5ee-589a68b4ffd9
```

This format (`organizations/{org_id}/apiKeys/{key_id}`) is specific to:
- **Coinbase Cloud API** (formerly Coinbase Developer Platform)
- **NOT** Coinbase Advanced Trade API

### The Problem

Coinbase has multiple separate API platforms:

1. **Coinbase Advanced Trade API** (Retail Trading)
   - Base URL: `https://api.coinbase.com/api/v3/brokerage`
   - Products: Spot trading (BTC-USD, ETH-USD)
   - Authentication: Simple API key + secret (not JWT)
   - **Your current target**

2. **Coinbase Cloud API / CDP** (Developer Platform)
   - Base URL: `https://api.coinbase.com` (same, but different endpoints)
   - Purpose: Wallets, addresses, transactions, blockchain data
   - Authentication: JWT with `organizations/{org_id}/apiKeys/{key_id}` format
   - **Your current API keys**

3. **Coinbase Commerce API** (Payment Processing)
   - For merchant payments
   - Different authentication

4. **Coinbase International Exchange (INTX)** (Derivatives)
   - For perpetual futures
   - Separate platform

### What This Means

**Your API keys are for Coinbase Cloud/CDP, NOT Advanced Trade.**

The Cloud API is for:
- Creating and managing wallets
- Blockchain data and transactions
- Not for trading on exchanges

## Solutions

### Option 1: Create Advanced Trade API Keys (Recommended for Trading)

**Steps:**
1. Log into Coinbase.com (retail trading platform)
2. Go to Settings → API
3. Create new API keys for "Advanced Trade"
4. Grant permissions: View + Trade
5. **Note:** Advanced Trade API uses different authentication (not JWT)
   - Uses API Key + API Secret + Passphrase
   - Uses HMAC-SHA256 signatures (not JWT)
   - **We'll need to rewrite the authentication layer**

**Pros:**
- Access to spot trading (BTC-USD, ETH-USD, etc.)
- Can place real trades
- Retail-friendly interface

**Cons:**
- Need to rewrite authentication (HMAC instead of JWT)
- No perpetual futures

### Option 2: Use Coinbase Cloud API (Keep Current Keys)

**Steps:**
1. Update implementation to use Cloud API endpoints
2. Focus on wallet/transaction management, not trading
3. Can query blockchain data, create wallets, etc.

**Pros:**
- Current API keys work as-is
- JWT authentication already implemented correctly

**Cons:**
- Cannot place trades
- Not suitable for a trading bot
- Would need to pivot the entire project

### Option 3: Switch to Coinbase International Exchange (For Futures)

**Steps:**
1. Sign up for Coinbase International Exchange
2. Complete KYC/verification
3. Create INTX-specific API credentials
4. Update base URL to INTX endpoints
5. Can trade perpetual futures

**Pros:**
- Access to BTC-PERP and other futures
- Matches original goal

**Cons:**
- Requires separate account setup
- May have geographic restrictions
- Different API (need research on authentication)

## Recommended Path Forward

### Immediate Action: Verify API Key Source

**Check where you created these API keys:**
```bash
# Your API key starts with:
organizations/dcfc015b-d7dc-4875-8f62-04f71294165c

# This is definitely Cloud/CDP API
```

**Questions to answer:**
1. Did you create these keys at `cloud.coinbase.com`?
2. Or at `coinbase.com` under trading settings?
3. What was the interface when you created them?

### Next Steps Based on Your Goal

**If you want to build a TRADING bot:**
→ **Create new Advanced Trade API keys**
→ Rewrite authentication to use HMAC-SHA256 (not JWT)
→ Continue with spot trading or explore INTX for futures

**If you want to use current Cloud API keys:**
→ Pivot project to wallet/blockchain management
→ Not suitable for trading bot

## Authentication Method Comparison

### Coinbase Advanced Trade (What You Need)
```javascript
// Authentication: HMAC-SHA256
const timestamp = Date.now() / 1000;
const message = timestamp + method + requestPath + body;
const signature = crypto.createHmac('sha256', apiSecret)
  .update(message)
  .digest('hex');

headers = {
  'CB-ACCESS-KEY': apiKey,
  'CB-ACCESS-SIGN': signature,
  'CB-ACCESS-TIMESTAMP': timestamp,
  'CB-ACCESS-PASSPHRASE': passphrase
};
```

### Coinbase Cloud API (What You Currently Have)
```javascript
// Authentication: JWT with ES256
const jwt = generateJWT(apiKey, privateKey, method, path);
headers = {
  'Authorization': `Bearer ${jwt}`
};
// ✓ Already implemented!
```

## Files That Need Changes (If Switching to Advanced Trade)

1. **`lib/coinbase/auth.js`** - Replace JWT with HMAC authentication
2. **`.env`** - Add `COINBASE_PASSPHRASE` variable
3. **`lib/coinbase/client.js`** - Update buildAuthHeaders call
4. **Tests** - Verify new authentication works

## Temporary Workaround

While deciding, you can:
1. Continue development on other PRs (PR#3, PR#4, PR#5-7)
2. Use mock data for Coinbase responses
3. Come back to authentication when you have correct API keys

## Summary

**Bottom Line:**
- Your JWT implementation is correct
- Your API keys are for the wrong Coinbase product
- Need to either:
  a) Get Advanced Trade API keys + rewrite auth (HMAC), OR
  b) Pivot project to use Cloud API for blockchain/wallet features

**My Recommendation:**
If this is a trading bot, get Advanced Trade API keys and I'll help you implement HMAC authentication. It's a relatively small change (~100 lines in auth.js).

---

**Questions?**
1. Where did you create your API keys?
2. Do you want to proceed with trading (need new keys)?
3. Or explore Cloud API capabilities (keep current keys)?
