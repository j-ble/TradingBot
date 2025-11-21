# PR #2: Coinbase API Client Wrapper - COMPLETE

## Status: ✅ COMPLETE

## Files Created/Updated
- [x] `lib/coinbase/auth.js` - JWT generation with Ed25519/EdDSA via CDP SDK
- [x] `lib/coinbase/client.js` - Main API wrapper with all methods
- [x] `lib/coinbase/endpoints.js` - API endpoint constants (fixed granularity)
- [x] `lib/coinbase/errors.js` - Custom error classes (pre-existing)
- [x] `tests/test_coinbase.js` - Test script (pre-existing)

## Dependencies Installed
```bash
npm install @coinbase/cdp-sdk axios
```

## API Methods Implemented

### Market Data
- [x] `getCandles(productId, granularity, start, end)` - Historical candlestick data
- [x] `getCurrentPrice(productId)` - Current price (mid-point of bid/ask)
- [x] `getBestBidAsk(productIds)` - Best bid/ask prices
- [x] `getMarketTrades(productId, limit)` - Recent market trades
- [x] `getProduct(productId)` - Product details

### Accounts
- [x] `getAccounts()` - List all accounts
- [x] `getAccountBalance(accountId)` - Get account balance

### Orders
- [x] `placeMarketOrder(productId, side, size)` - Market order
- [x] `placeStopLossOrder(productId, side, size, stopPrice)` - Stop loss order
- [x] `placeTakeProfitOrder(productId, side, size, limitPrice)` - Take profit order
- [x] `getOrder(orderId)` - Get order by ID
- [x] `listOrders(productId, status)` - List orders with filters
- [x] `cancelOrder(orderId)` - Cancel single order
- [x] `cancelOrders(orderIds)` - Cancel multiple orders
- [x] `closePosition(productId, size)` - Close position
- [x] `previewOrder(productId, side, orderConfiguration)` - Preview order

## Key Features Implemented

### Authentication (Ed25519)
- Uses `@coinbase/cdp-sdk` for JWT generation
- Supports Ed25519 keys (recommended) and legacy UUID format
- JWT expires every 2 minutes (auto-regenerated per request)
- Base64 encoded private key support

### Rate Limiting
- Public endpoints: 10 req/sec
- Private endpoints: 15 req/sec
- Order endpoints: 5 req/sec
- Token bucket implementation with automatic throttling

### Error Handling
- Custom error classes: `CoinbaseError`, `AuthenticationError`, `RateLimitError`, etc.
- Automatic retry with exponential backoff
- Max 3 retries for transient failures
- Proper error parsing from API responses

### Retry Logic
- Retryable errors: Network, Timeout, Server (5xx), Rate Limit
- Non-retryable: Authentication, Validation, Not Found
- Exponential backoff: 1s, 2s, 4s... up to 30s max
- Jitter added to prevent thundering herd

## Acceptance Criteria
- [x] All API methods implemented
- [x] JWT authentication working with Ed25519 keys
- [x] Rate limiting prevents exceeding limits
- [x] Retry logic handles transient failures
- [x] Comprehensive error handling
- [x] Test script passing

## Test Results
```
✓ Client initialized successfully
✓ Current BTC-USD spot price: $86,649
✓ Retrieved 288 candles (5M, 24 hours)
✓ BTC-USD product info retrieved
✓ Retrieved 19 accounts
✓ Account balance: $0.426
✓ Rate limiting: 15 requests in 587ms (39ms avg)

ALL COINBASE API TESTS PASSED
```

## Environment Variables
```
COINBASE_API_KEY=<uuid-format-key>
COINBASE_API_SECRET=<base64-encoded-ed25519-private-key>
```

## Key Code Changes

### auth.js - Updated for Ed25519
```javascript
import { generateJwt } from '@coinbase/cdp-sdk/auth';

export async function generateJWT(apiKey, apiSecret, requestMethod, requestPath) {
  const token = await generateJwt({
    apiKeyId: apiKey,
    apiKeySecret: privateKey,
    requestMethod: requestMethod,
    requestHost: 'api.coinbase.com',
    requestPath: requestPath,
    expiresIn: 120
  });
  return token;
}
```

### endpoints.js - Fixed Granularity
```javascript
// Changed from numeric values to string enums
export const GRANULARITIES = {
  ONE_MINUTE: 'ONE_MINUTE',
  FIVE_MINUTE: 'FIVE_MINUTE',
  FIFTEEN_MINUTE: 'FIFTEEN_MINUTE',
  // ... etc
};
```

### client.js - Async Auth Headers
```javascript
// buildAuthHeaders is now async
const headers = await buildAuthHeaders(this.apiKey, this.apiSecret, method, path);
```

## Dependencies for Next PRs
- PR#5 (4H Candles): Uses `getCandles()` with granularity 'SIX_HOUR'
- PR#6 (5M Candles): Uses `getCandles()` with granularity 'FIVE_MINUTE'
- PR#7 (WebSocket): Will use endpoints from `endpoints.js`
- PR#14 (Trade Execution): Uses order methods

## Notes
- Coinbase doesn't have 4H candles, using 6H as fallback
- Price validation uses min order sizes from endpoints.js
- All sizes/prices sent as strings to API for precision
- Cursor-based pagination supported for list endpoints

## Testing Command
```bash
node tests/test_coinbase.js
```

## Completed: November 21, 2025
