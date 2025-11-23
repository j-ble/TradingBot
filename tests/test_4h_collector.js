/**
 * 4H Candle Collector Tests
 * Integration tests for PR #5
 */

import { CandleCollector4H } from '../lib/collectors/candle_collector_4h.js';
import { get4HCandles } from '../database/queries.js';
import { closePool, testConnection } from '../database/connection.js';
import { createLogger } from '../lib/utils/logger.js';

const logger = createLogger('test:4h');

// Test results tracking
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n=== PR #5: 4H Candle Collector Tests ===\n');

  // Check database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Database connection failed. Ensure PostgreSQL is running.');
    process.exit(1);
  }

  const collector = new CandleCollector4H();

  // Test 1: Collector instantiation
  await test('Collector initializes correctly', async () => {
    if (!collector.client) throw new Error('Client not initialized');
    if (!collector.productId) throw new Error('Product ID not set');
  });

  // Test 2: Fetch candles from API
  await test('Fetch candles from Coinbase API', async () => {
    const now = Date.now();
    const start = now - (24 * 60 * 60 * 1000); // 24 hours ago
    const end = now;

    const candles = await collector.fetchCandles(start, end);

    if (!Array.isArray(candles)) {
      throw new Error('Candles should be an array');
    }
    if (candles.length === 0) {
      throw new Error('No candles returned');
    }

    // Check candle structure
    const candle = candles[0];
    if (!candle.timestamp) throw new Error('Missing timestamp');
    if (!candle.open) throw new Error('Missing open');
    if (!candle.high) throw new Error('Missing high');
    if (!candle.low) throw new Error('Missing low');
    if (!candle.close) throw new Error('Missing close');
    if (candle.volume === undefined) throw new Error('Missing volume');

    console.log(`    Retrieved ${candles.length} candles`);
  });

  // Test 3: Validate candle data
  await test('Candle validation works correctly', async () => {
    // Valid candle
    const validCandle = {
      timestamp: new Date().toISOString(),
      open: 90000,
      high: 91000,
      low: 89000,
      close: 90500,
      volume: 100,
    };

    if (!collector.validateCandle(validCandle)) {
      throw new Error('Valid candle rejected');
    }

    // Invalid candle (high < low)
    const invalidCandle = {
      timestamp: new Date().toISOString(),
      open: 90000,
      high: 89000, // Invalid: high < low
      low: 91000,
      close: 90500,
      volume: 100,
    };

    if (collector.validateCandle(invalidCandle)) {
      throw new Error('Invalid candle accepted');
    }
  });

  // Test 4: Store candles in database
  await test('Store candles in database', async () => {
    const now = Date.now();
    const start = now - (12 * 60 * 60 * 1000); // 12 hours ago
    const end = now;

    const candles = await collector.fetchCandles(start, end);
    const results = await collector.storeCandles(candles);

    if (results.inserted === undefined) throw new Error('Missing inserted count');
    if (results.skipped === undefined) throw new Error('Missing skipped count');

    console.log(`    Inserted: ${results.inserted}, Skipped: ${results.skipped}`);
  });

  // Test 5: Collect latest candle
  await test('Collect latest closed candle', async () => {
    const results = await collector.collectLatest();

    if (results.inserted === undefined) throw new Error('Missing inserted count');

    console.log(`    Latest collection: ${results.inserted} inserted`);
  });

  // Test 6: Get candles from database
  await test('Retrieve candles from database', async () => {
    const candles = await get4HCandles(10);

    if (!Array.isArray(candles)) {
      throw new Error('Should return array');
    }

    console.log(`    Retrieved ${candles.length} candles from database`);

    // Verify chronological order
    if (candles.length >= 2) {
      const firstTime = new Date(candles[0].timestamp).getTime();
      const lastTime = new Date(candles[candles.length - 1].timestamp).getTime();
      if (firstTime > lastTime) {
        throw new Error('Candles not in chronological order');
      }
    }
  });

  // Test 7: Gap detection
  await test('Gap detection works', async () => {
    const gaps = await collector.detectGaps();

    if (!Array.isArray(gaps)) {
      throw new Error('Gaps should be an array');
    }

    console.log(`    Detected ${gaps.length} gaps`);
  });

  // Test 8: Get status
  await test('Get collector status', async () => {
    const status = await collector.getStatus();

    if (status.totalCandles === undefined) throw new Error('Missing totalCandles');
    if (!status.lastUpdated) throw new Error('Missing lastUpdated');

    console.log(`    Total candles: ${status.totalCandles}`);
    console.log(`    Latest: ${status.latestTimestamp || 'none'}`);
  });

  // Test 9: Backfill (small amount for testing)
  await test('Backfill historical candles', async () => {
    // Only backfill 10 candles for testing
    const results = await collector.backfill(10);

    if (results.inserted === undefined) throw new Error('Missing inserted count');

    console.log(`    Backfill: ${results.inserted} inserted, ${results.skipped} skipped`);
  });

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  // Cleanup
  await closePool();

  if (failed > 0) {
    console.log('\n❌ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED');
  }
}

runTests().catch(async (error) => {
  console.error('Test runner failed:', error);
  await closePool();
  process.exit(1);
});
