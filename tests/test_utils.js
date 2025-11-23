/**
 * Utility Tests
 * Tests for PR #4: Basic Utilities and Helpers
 */

import {
  calculatePercentageChange,
  roundToDecimals,
  calculateRiskReward,
  calculateBTCPositionSize,
  calculateStopDistance,
  calculateTargetPrice,
  calculatePnL,
  calculateMidPrice,
} from '../lib/utils/math.js';

import {
  getUnixTimestamp,
  formatTimestamp,
  formatDuration,
  getCandle4HTimestamp,
  getCandle5MTimestamp,
  isOlderThan,
  isWithinTimeRange,
} from '../lib/utils/time.js';

import {
  formatPrice,
  formatBTC,
  formatPercentage,
  formatUSD,
  formatCompact,
  formatRiskReward,
} from '../lib/utils/format.js';

import {
  sleep,
  retry,
  timeout,
  waitFor,
} from '../lib/utils/async.js';

// Test results tracking
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
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

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertApproxEqual(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: expected ~${expected}, got ${actual}`);
  }
}

async function runTests() {
  console.log('\n=== PR #4: Utility Tests ===\n');

  // Math utilities
  console.log('--- Math Utilities ---');

  test('calculatePercentageChange positive', () => {
    const result = calculatePercentageChange(100, 110);
    assertEqual(result, 10, 'Percentage change');
  });

  test('calculatePercentageChange negative', () => {
    const result = calculatePercentageChange(100, 90);
    assertEqual(result, -10, 'Percentage change');
  });

  test('roundToDecimals', () => {
    assertEqual(roundToDecimals(1.23456, 2), 1.23, 'Round to 2 decimals');
    assertEqual(roundToDecimals(1.23456, 4), 1.2346, 'Round to 4 decimals');
  });

  test('calculateRiskReward', () => {
    // LONG: entry 90000, stop 87300, target 95400
    const rr = calculateRiskReward(90000, 87300, 95400);
    assertEqual(rr, 2, 'R/R ratio');
  });

  test('calculateBTCPositionSize', () => {
    // Balance $10000, 1% risk, entry $90000, stop $87300
    const result = calculateBTCPositionSize(10000, 0.01, 90000, 87300);
    assertEqual(result.riskAmount, 100, 'Risk amount');
    assertApproxEqual(result.positionSizeBTC, 0.037, 0.001, 'Position size BTC');
    assertApproxEqual(result.stopDistancePercent, 3, 0.1, 'Stop distance %');
  });

  test('calculateStopDistance', () => {
    const distance = calculateStopDistance(90000, 87300);
    assertEqual(distance, 3, 'Stop distance %');
  });

  test('calculateTargetPrice LONG', () => {
    const target = calculateTargetPrice(90000, 87300, 2, 'LONG');
    assertEqual(target, 95400, 'Target price LONG');
  });

  test('calculateTargetPrice SHORT', () => {
    const target = calculateTargetPrice(90000, 92700, 2, 'SHORT');
    assertEqual(target, 84600, 'Target price SHORT');
  });

  test('calculatePnL WIN LONG', () => {
    const result = calculatePnL(90000, 95400, 0.037, 'LONG');
    assertApproxEqual(result.pnlUSD, 199.8, 1, 'P&L USD');
  });

  test('calculatePnL LOSS SHORT', () => {
    const result = calculatePnL(90000, 92700, 0.037, 'SHORT');
    assertApproxEqual(result.pnlUSD, -99.9, 1, 'P&L USD');
  });

  test('calculateMidPrice', () => {
    const mid = calculateMidPrice(89990, 90010);
    assertEqual(mid, 90000, 'Mid price');
  });

  // Time utilities
  console.log('\n--- Time Utilities ---');

  test('getUnixTimestamp returns number', () => {
    const ts = getUnixTimestamp();
    if (typeof ts !== 'number') throw new Error('Not a number');
    if (ts < 1700000000) throw new Error('Timestamp too small');
  });

  test('formatTimestamp returns ISO string', () => {
    const result = formatTimestamp(1700000000000);
    if (!result.includes('2023-11-14')) throw new Error('Wrong date');
    if (!result.includes('Z')) throw new Error('Not ISO format');
  });

  test('formatDuration', () => {
    assertEqual(formatDuration(0), '0s', 'Zero duration');
    assertEqual(formatDuration(5000), '5s', '5 seconds');
    assertEqual(formatDuration(90000), '1m 30s', '90 seconds');
    assertEqual(formatDuration(3665000), '1h 1m 5s', 'Complex duration');
  });

  test('getCandle4HTimestamp', () => {
    // 2024-01-01 10:30:00 UTC should align to 08:00
    const date = new Date('2024-01-01T10:30:00Z');
    const aligned = getCandle4HTimestamp(date);
    assertEqual(aligned.getUTCHours(), 8, '4H alignment');
    assertEqual(aligned.getUTCMinutes(), 0, '4H minutes');
  });

  test('getCandle5MTimestamp', () => {
    // 10:37 should align to 10:35
    const date = new Date('2024-01-01T10:37:00Z');
    const aligned = getCandle5MTimestamp(date);
    assertEqual(aligned.getUTCMinutes(), 35, '5M alignment');
  });

  test('isOlderThan', () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    const newDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

    assertEqual(isOlderThan(oldDate, 24), true, 'Old date');
    assertEqual(isOlderThan(newDate, 24), false, 'New date');
  });

  test('isWithinTimeRange', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const end = new Date('2024-01-01T12:00:00Z');
    const inside = new Date('2024-01-01T06:00:00Z');
    const outside = new Date('2024-01-01T18:00:00Z');

    assertEqual(isWithinTimeRange(inside, start, end), true, 'Inside range');
    assertEqual(isWithinTimeRange(outside, start, end), false, 'Outside range');
  });

  // Format utilities
  console.log('\n--- Format Utilities ---');

  test('formatPrice', () => {
    assertEqual(formatPrice(90123.456), '90,123.46', 'Format price');
    assertEqual(formatPrice(1234567.89), '1,234,567.89', 'Large price');
  });

  test('formatBTC', () => {
    assertEqual(formatBTC(0.12345678), '0.12345678', 'Format BTC');
    assertEqual(formatBTC(1.5), '1.50000000', 'Format BTC whole');
  });

  test('formatPercentage', () => {
    assertEqual(formatPercentage(5.5), '+5.50%', 'Positive %');
    assertEqual(formatPercentage(-2.3), '-2.30%', 'Negative %');
    assertEqual(formatPercentage(0), '+0.00%', 'Zero %');
  });

  test('formatUSD', () => {
    assertEqual(formatUSD(1234.56), '$1,234.56', 'Format USD');
    assertEqual(formatUSD(-500), '-$500.00', 'Negative USD');
  });

  test('formatCompact', () => {
    assertEqual(formatCompact(1500), '1.5K', 'Thousands');
    assertEqual(formatCompact(2500000), '2.5M', 'Millions');
    assertEqual(formatCompact(3200000000), '3.2B', 'Billions');
  });

  test('formatRiskReward', () => {
    assertEqual(formatRiskReward(2.5), '2.5:1', 'R/R format');
    assertEqual(formatRiskReward(3), '3.0:1', 'R/R whole number');
  });

  // Async utilities
  console.log('\n--- Async Utilities ---');

  await testAsync('sleep works', async () => {
    const start = Date.now();
    await sleep(100);
    const elapsed = Date.now() - start;
    if (elapsed < 90) throw new Error('Sleep too short');
    if (elapsed > 200) throw new Error('Sleep too long');
  });

  await testAsync('retry succeeds on first try', async () => {
    let attempts = 0;
    const result = await retry(async () => {
      attempts++;
      return 'success';
    }, 3, 10);
    assertEqual(attempts, 1, 'Attempts');
    assertEqual(result, 'success', 'Result');
  });

  await testAsync('retry retries on failure', async () => {
    let attempts = 0;
    const result = await retry(async () => {
      attempts++;
      if (attempts < 3) throw new Error('Fail');
      return 'success';
    }, 3, 10);
    assertEqual(attempts, 3, 'Attempts');
    assertEqual(result, 'success', 'Result');
  });

  await testAsync('timeout succeeds within limit', async () => {
    const result = await timeout(
      Promise.resolve('done'),
      1000
    );
    assertEqual(result, 'done', 'Result');
  });

  await testAsync('timeout throws on exceed', async () => {
    try {
      await timeout(
        new Promise((resolve) => setTimeout(resolve, 1000)),
        50
      );
      throw new Error('Should have timed out');
    } catch (error) {
      if (!error.message.includes('timed out')) {
        throw error;
      }
    }
  });

  await testAsync('waitFor succeeds when condition met', async () => {
    let counter = 0;
    await waitFor(async () => {
      counter++;
      return counter >= 3;
    }, 10, 1000);
    if (counter < 3) throw new Error('Condition not met');
  });

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed > 0) {
    console.log('\n❌ SOME TESTS FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED');
  }
}

runTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
