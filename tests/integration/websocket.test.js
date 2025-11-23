/**
 * WebSocket Integration Tests
 * Tests for PR #7: WebSocket Real-Time Price Feed
 */

import { CoinbaseWebSocket } from '../../lib/coinbase/websocket.js';
import { PriceFeed } from '../../lib/coinbase/price_feed.js';
import { WS_CHANNELS } from '../../lib/coinbase/endpoints.js';
import { createLogger } from '../../lib/utils/logger.js';

const logger = createLogger('test:websocket');

// Test results tracking
let passed = 0;
let failed = 0;

async function test(name, fn, timeout = 30000) {
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout')), timeout)
      )
    ]);
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n=== PR #7: WebSocket Real-Time Price Feed Tests ===\n');

  // Test 1: WebSocket client instantiation
  await test('WebSocket client instantiates correctly', async () => {
    const ws = new CoinbaseWebSocket();
    if (!ws) throw new Error('WebSocket client not created');
    if (ws.isConnected) throw new Error('Should not be connected on init');
  });

  // Test 2: WebSocket connection
  let wsClient;
  await test('WebSocket connects successfully', async () => {
    wsClient = new CoinbaseWebSocket();

    const connectPromise = new Promise((resolve, reject) => {
      wsClient.on('connected', resolve);
      wsClient.on('error', reject);
    });

    await wsClient.connect();
    await connectPromise;

    if (!wsClient.connected) {
      throw new Error('WebSocket not connected');
    }

    console.log('    Connected to Coinbase WebSocket');
  });

  // Test 3: Subscribe to ticker channel
  await test('Subscribe to ticker channel', async () => {
    if (!wsClient?.connected) throw new Error('WebSocket not connected');

    const subscribePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Subscribe timeout')), 10000);
      wsClient.on('subscribed', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    await wsClient.subscribe([
      {
        name: WS_CHANNELS.TICKER,
        product_ids: ['BTC-USD']
      }
    ]);

    await subscribePromise;
    console.log('    Subscribed to ticker channel');
  });

  // Test 4: Receive ticker message
  await test('Receive ticker price update', async () => {
    if (!wsClient?.connected) throw new Error('WebSocket not connected');

    const tickerPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Ticker timeout')), 15000);
      wsClient.once('ticker', (message) => {
        clearTimeout(timeout);
        resolve(message);
      });
    });

    const ticker = await tickerPromise;

    if (!ticker.product_id) throw new Error('Missing product_id');
    if (!ticker.price) throw new Error('Missing price');

    console.log(`    Received ticker: $${ticker.price} for ${ticker.product_id}`);
  });

  // Disconnect WebSocket client
  if (wsClient) {
    wsClient.disconnect();
  }

  // Test 5: PriceFeed instantiation
  await test('PriceFeed instantiates correctly', async () => {
    const feed = new PriceFeed();
    if (!feed) throw new Error('PriceFeed not created');
    if (feed.currentPrice !== null) throw new Error('Price should be null initially');
  });

  // Test 6: PriceFeed connection and price updates
  let priceFeed;
  await test('PriceFeed connects and receives prices', async () => {
    priceFeed = new PriceFeed();

    await priceFeed.connect();

    if (!priceFeed.isConnected()) {
      throw new Error('PriceFeed not connected');
    }

    // Wait for first price update
    const update = await priceFeed.waitForUpdate(15000);

    if (!update.price) throw new Error('Missing price in update');
    if (!update.timestamp) throw new Error('Missing timestamp');

    console.log(`    Received price update: $${update.price}`);
  });

  // Test 7: Get current price
  await test('Get current price from cache', async () => {
    if (!priceFeed) throw new Error('PriceFeed not available');

    const price = priceFeed.getCurrentPrice();

    if (price === null) throw new Error('Current price is null');
    if (typeof price !== 'number') throw new Error('Price should be a number');
    if (price <= 0) throw new Error('Price should be positive');

    console.log(`    Current price: $${price}`);
  });

  // Test 8: Price history
  await test('Price history is maintained', async () => {
    if (!priceFeed) throw new Error('PriceFeed not available');

    // Wait for a few more updates
    await new Promise(resolve => setTimeout(resolve, 3000));

    const history = priceFeed.getHistory();

    if (!Array.isArray(history)) throw new Error('History should be array');
    if (history.length === 0) throw new Error('History should not be empty');

    console.log(`    History entries: ${history.length}`);
  });

  // Test 9: Feed statistics
  await test('Get feed statistics', async () => {
    if (!priceFeed) throw new Error('PriceFeed not available');

    const stats = priceFeed.getStats();

    if (stats.connected !== true) throw new Error('Should be connected');
    if (stats.updateCount === 0) throw new Error('Should have updates');
    if (stats.uptime === 0) throw new Error('Should have uptime');

    console.log(`    Updates: ${stats.updateCount}, Uptime: ${Math.round(stats.uptime / 1000)}s`);
  });

  // Test 10: Event emission counts
  await test('Event emission tracking works', async () => {
    if (!priceFeed) throw new Error('PriceFeed not available');

    const count = priceFeed.getEventCount('price_update');

    if (count === 0) throw new Error('Should have emitted price_update events');

    console.log(`    price_update events emitted: ${count}`);
  });

  // Test 11: Disconnect
  await test('PriceFeed disconnects cleanly', async () => {
    if (!priceFeed) throw new Error('PriceFeed not available');

    priceFeed.disconnect();

    // Give it a moment to disconnect
    await new Promise(resolve => setTimeout(resolve, 500));

    if (priceFeed.isConnected()) {
      throw new Error('Should be disconnected');
    }

    console.log('    Disconnected successfully');
  });

  // Test 12: Reconnection capability (brief test)
  await test('WebSocket handles reconnection setup', async () => {
    const ws = new CoinbaseWebSocket();

    let reconnectWarningReceived = false;
    ws.on('reconnect_warning', () => {
      reconnectWarningReceived = true;
    });

    // Just verify the reconnection logic exists
    if (typeof ws.scheduleReconnect !== 'function') {
      throw new Error('scheduleReconnect method missing');
    }

    console.log('    Reconnection logic available');
  });

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  // Cleanup
  if (priceFeed?.isConnected()) {
    priceFeed.disconnect();
  }

  if (failed > 0) {
    console.log('\n❌ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED');
  }
}

runTests().catch(async (error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
