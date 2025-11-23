/**
 * Swing Tracker Unit Tests
 * Tests for PR #8: Swing Level Tracking System
 */

import { SwingTracker, TIMEFRAMES, SWING_TYPES } from '../../../lib/scanners/swing_tracker.js';
import { SwingDetector4H } from '../../../lib/scanners/swing_detector_4h.js';
import { SwingDetector5M } from '../../../lib/scanners/swing_detector_5m.js';
import { closePool, testConnection } from '../../../database/connection.js';
import { createLogger } from '../../../lib/utils/logger.js';

const logger = createLogger('test:swing-tracker');

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

// Generate test candle data
function generateCandles(count, basePrice = 90000) {
  const candles = [];
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    // Create some price movement
    const change = (Math.random() - 0.5) * 200;
    price += change;

    const open = price;
    const close = price + (Math.random() - 0.5) * 100;
    const high = Math.max(open, close) + Math.random() * 50;
    const low = Math.min(open, close) - Math.random() * 50;

    candles.push({
      timestamp: new Date(Date.now() - (count - i) * 5 * 60 * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume: Math.random() * 100
    });
  }

  return candles;
}

// Generate candles with a clear swing high
function generateSwingHighCandles() {
  return [
    { timestamp: '2024-01-01T00:00:00Z', open: 90000, high: 90100, low: 89900, close: 90050, volume: 100 },
    { timestamp: '2024-01-01T00:05:00Z', open: 90050, high: 90200, low: 89950, close: 90150, volume: 100 },
    { timestamp: '2024-01-01T00:10:00Z', open: 90150, high: 90500, low: 90100, close: 90400, volume: 100 }, // Swing high
    { timestamp: '2024-01-01T00:15:00Z', open: 90400, high: 90300, low: 90000, close: 90100, volume: 100 },
    { timestamp: '2024-01-01T00:20:00Z', open: 90100, high: 90200, low: 89800, close: 89900, volume: 100 },
  ];
}

// Generate candles with a clear swing low
function generateSwingLowCandles() {
  return [
    { timestamp: '2024-01-01T00:00:00Z', open: 90000, high: 90100, low: 89900, close: 89950, volume: 100 },
    { timestamp: '2024-01-01T00:05:00Z', open: 89950, high: 90000, low: 89800, close: 89850, volume: 100 },
    { timestamp: '2024-01-01T00:10:00Z', open: 89850, high: 89900, low: 89500, close: 89600, volume: 100 }, // Swing low
    { timestamp: '2024-01-01T00:15:00Z', open: 89600, high: 89900, low: 89700, close: 89850, volume: 100 },
    { timestamp: '2024-01-01T00:20:00Z', open: 89850, high: 90100, low: 89800, close: 90000, volume: 100 },
  ];
}

async function runTests() {
  console.log('\n=== PR #8: Swing Level Tracking Tests ===\n');

  // Check database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Database connection failed. Ensure PostgreSQL is running.');
    process.exit(1);
  }

  const tracker = new SwingTracker();

  // Test 1: Tracker instantiation
  await test('SwingTracker instantiates correctly', async () => {
    if (!tracker) throw new Error('Tracker not created');
    if (typeof tracker.detectSwingHigh !== 'function') throw new Error('Missing detectSwingHigh');
    if (typeof tracker.detectSwingLow !== 'function') throw new Error('Missing detectSwingLow');
  });

  // Test 2: Swing high detection
  await test('Detect swing high correctly', async () => {
    const candles = generateSwingHighCandles();
    const isSwingHigh = tracker.detectSwingHigh(candles, 2);

    if (!isSwingHigh) {
      throw new Error('Failed to detect swing high');
    }

    console.log(`    Swing high detected at $${candles[2].high}`);
  });

  // Test 3: Swing low detection
  await test('Detect swing low correctly', async () => {
    const candles = generateSwingLowCandles();
    const isSwingLow = tracker.detectSwingLow(candles, 2);

    if (!isSwingLow) {
      throw new Error('Failed to detect swing low');
    }

    console.log(`    Swing low detected at $${candles[2].low}`);
  });

  // Test 4: Edge case - not enough candles before
  await test('Reject swing at index < 2', async () => {
    const candles = generateSwingHighCandles();
    const result = tracker.detectSwingHigh(candles, 1);

    if (result !== false) {
      throw new Error('Should reject swing at index 1');
    }
  });

  // Test 5: Edge case - not enough candles after
  await test('Reject swing at index >= length - 2', async () => {
    const candles = generateSwingHighCandles();
    const result = tracker.detectSwingHigh(candles, 4);

    if (result !== false) {
      throw new Error('Should reject swing at last valid index');
    }
  });

  // Test 6: Scan for swings
  await test('Scan candles for multiple swings', async () => {
    const candles = generateCandles(20);
    const swings = tracker.scanForSwings(candles, TIMEFRAMES.FIVE_MINUTE);

    if (!Array.isArray(swings)) {
      throw new Error('Should return array');
    }

    console.log(`    Found ${swings.length} swings in ${candles.length} candles`);
  });

  // Test 7: Find most recent swing
  await test('Find most recent swing of type', async () => {
    const swings = [
      { timestamp: '2024-01-01T00:00:00Z', swing_type: SWING_TYPES.HIGH, price: 90000 },
      { timestamp: '2024-01-01T01:00:00Z', swing_type: SWING_TYPES.HIGH, price: 91000 },
      { timestamp: '2024-01-01T02:00:00Z', swing_type: SWING_TYPES.LOW, price: 89000 },
    ];

    const recentHigh = tracker.findMostRecentSwing(swings, SWING_TYPES.HIGH);

    if (!recentHigh) throw new Error('Should find recent high');
    if (recentHigh.price !== 91000) throw new Error('Should find most recent high');

    console.log(`    Most recent high: $${recentHigh.price}`);
  });

  // Test 8: Store swing in database
  await test('Store swing level in database', async () => {
    const swing = {
      timestamp: new Date().toISOString(),
      timeframe: TIMEFRAMES.FIVE_MINUTE,
      swing_type: SWING_TYPES.HIGH,
      price: 90500
    };

    const result = await tracker.storeSwing(swing);

    if (!result) {
      throw new Error('Failed to store swing');
    }

    console.log(`    Stored swing: $${result.price}`);
  });

  // Test 9: Get active swings
  await test('Get active swings for timeframe', async () => {
    const swings = await tracker.getActiveSwings(TIMEFRAMES.FIVE_MINUTE);

    if (!swings) throw new Error('Should return swings object');
    if (!('high' in swings)) throw new Error('Should have high property');
    if (!('low' in swings)) throw new Error('Should have low property');

    console.log(`    Active high: ${swings.high ? '$' + swings.high.price : 'None'}`);
  });

  // Test 10: 4H Detector instantiation
  await test('SwingDetector4H instantiates correctly', async () => {
    const detector = new SwingDetector4H();
    if (!detector) throw new Error('Detector not created');
    if (!detector.tracker) throw new Error('Missing tracker');
    if (detector.timeframe !== TIMEFRAMES.FOUR_HOUR) throw new Error('Wrong timeframe');
  });

  // Test 11: 5M Detector instantiation
  await test('SwingDetector5M instantiates correctly', async () => {
    const detector = new SwingDetector5M();
    if (!detector) throw new Error('Detector not created');
    if (!detector.tracker) throw new Error('Missing tracker');
    if (detector.timeframe !== TIMEFRAMES.FIVE_MINUTE) throw new Error('Wrong timeframe');
  });

  // Test 12: 5M Detector scan (requires candle data)
  await test('5M Detector scans for swings', async () => {
    const detector = new SwingDetector5M();
    const results = await detector.scan(50);

    if (results.detected === undefined) throw new Error('Missing detected count');
    if (results.stored === undefined) throw new Error('Missing stored count');

    console.log(`    Detected: ${results.detected}, Stored: ${results.stored}`);
  });

  // Test 13: Get detector status
  await test('Get 5M detector status', async () => {
    const detector = new SwingDetector5M();
    const status = await detector.getStatus();

    if (!status.timeframe) throw new Error('Missing timeframe');
    if (!status.lastUpdated) throw new Error('Missing lastUpdated');

    console.log(`    Status retrieved for ${status.timeframe}`);
  });

  // Test 14: Constants exported correctly
  await test('Constants exported correctly', async () => {
    if (!TIMEFRAMES.FOUR_HOUR) throw new Error('Missing FOUR_HOUR');
    if (!TIMEFRAMES.FIVE_MINUTE) throw new Error('Missing FIVE_MINUTE');
    if (!SWING_TYPES.HIGH) throw new Error('Missing HIGH');
    if (!SWING_TYPES.LOW) throw new Error('Missing LOW');
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
