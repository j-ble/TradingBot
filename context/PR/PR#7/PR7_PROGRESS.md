# PR#7: WebSocket Real-Time Price Feed

**Status**: Complete
**Date**: 2025-11-23

## Overview

Implemented WebSocket connection for real-time BTC-USD price updates with automatic reconnection, heartbeat monitoring, and event-driven price feed API.

## Files Created

### Event Emitter Utility
- **`lib/utils/event_emitter.js`** - Event handling wrapper
  - `TypedEventEmitter` class extending eventemitter3
  - `waitFor(event, timeout)` - Promise-based event waiting
  - Event count tracking for debugging
  - `destroy()` for cleanup

### WebSocket Client
- **`lib/coinbase/websocket.js`** - Core WebSocket client
  - JWT authentication for Coinbase WebSocket
  - Automatic reconnection with exponential backoff
  - Max 10 retry attempts
  - Heartbeat monitoring (30-second timeout)
  - Event emission for all message types
  - Subscribe/unsubscribe to channels

### Price Feed Manager
- **`lib/coinbase/price_feed.js`** - High-level price API
  - `connect()` / `disconnect()` - Connection management
  - `getCurrentPrice()` - Latest cached price
  - `getHistory(count)` - Price history buffer
  - `getStats()` - Connection statistics
  - `waitForUpdate(timeout)` - Wait for next price
  - `getAveragePrice()` / `getVolatility()` - Analysis helpers
  - Events: `price_update`, `connected`, `disconnected`, `error`

### Tests
- **`tests/integration/websocket.test.js`** - Integration tests (12 tests)

## API Usage

### WebSocket Client
```javascript
import { CoinbaseWebSocket } from './lib/coinbase/websocket.js';

const ws = new CoinbaseWebSocket();

ws.on('ticker', (data) => {
  console.log('Price:', data.price);
});

await ws.connect();
await ws.subscribe([
  { name: 'ticker', product_ids: ['BTC-USD'] }
]);

// Later
ws.disconnect();
```

### Price Feed Manager
```javascript
import { PriceFeed } from './lib/coinbase/price_feed.js';

const priceFeed = new PriceFeed();

priceFeed.on('price_update', (update) => {
  console.log('New price:', update.price);
});

await priceFeed.connect();

// Get current price
const price = priceFeed.getCurrentPrice();

// Get stats
const stats = priceFeed.getStats();
console.log('Updates:', stats.updateCount);

// Disconnect
priceFeed.disconnect();
```

## Configuration

| Setting | Value |
|---------|-------|
| WebSocket URL | `wss://advanced-trade-ws.coinbase.com` |
| Heartbeat timeout | 30 seconds |
| Max reconnect attempts | 10 |
| Base reconnect delay | 1 second |
| Max reconnect delay | 60 seconds |
| JWT expiration | 120 seconds |

## Test Results

```
=== PR #7: WebSocket Real-Time Price Feed Tests ===

✓ WebSocket client instantiates correctly
✓ WebSocket connects successfully
✓ Subscribe to ticker channel
✓ Receive ticker price update
✓ PriceFeed instantiates correctly
✓ PriceFeed connects and receives prices
✓ Get current price from cache
✓ Price history is maintained
✓ Get feed statistics
✓ Event emission tracking works
✓ PriceFeed disconnects cleanly
✓ WebSocket handles reconnection setup

=== Test Summary ===
Passed: 12
Failed: 0
Total: 12

✅ ALL TESTS PASSED
```

## Acceptance Criteria

- [x] WebSocket connects successfully
- [x] Price updates received in real-time
- [x] Automatic reconnection on disconnect (exponential backoff)
- [x] Latest price always available via cache
- [x] Event emission working
- [x] Heartbeat monitoring functional

## Events Emitted

### WebSocket Events
- `connected` - Connection established
- `disconnected` - Connection closed
- `subscribed` - Channel subscription confirmed
- `ticker` - Price ticker update
- `heartbeat` - Heartbeat received
- `error` - Error occurred
- `reconnect_warning` - 5 failed reconnection attempts
- `reconnect_failed` - Max reconnection attempts reached
- `heartbeat_timeout` - No messages for 30 seconds

### Price Feed Events
- `price_update` - New price with change info
- `connected` - Feed started
- `disconnected` - Feed stopped
- `error` - Feed error

## Price Update Format

```javascript
{
  price: 87589.93,
  timestamp: Date,
  change: 5.00,
  changePercent: 0.0057,
  product_id: 'BTC-USD',
  volume_24h: 12345.67,
  low_24h: 85000.00,
  high_24h: 88000.00,
  best_bid: 87589.00,
  best_ask: 87590.00
}
```

## Dependencies

- PR#2 (Coinbase API Client) - Authentication patterns
- PR#3 (Configuration) - Environment variables

## Notes

- Uses `@coinbase/cdp-sdk/auth` for JWT generation
- JWT for WebSocket doesn't require request method/host/path
- Coinbase WebSocket uses channel-based message routing
- Ticker messages contain events array with tickers
- Reconnection preserves channel subscriptions
- History buffer maintains last 100 price updates by default
