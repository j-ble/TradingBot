/**
 * 4H Liquidity Sweep Scanner Unit Tests
 * Tests for PR #9: 4H Liquidity Sweep Detector
 */

import {
  detectHighSweep,
  detectLowSweep,
  getBias,
  getDirection,
  getSweepThreshold,
  isSweepValid,
  createSweepObject,
  SWEEP_TYPES,
  BIAS_TYPES,
  SWEEP_THRESHOLD
} from '../../../lib/scanners/sweep_detector.js';
import { Scanner4H } from '../../../lib/scanners/4h_scanner.js';
import { closePool, testConnection } from '../../../database/connection.js';
import { createLogger } from '../../../lib/utils/logger.js';

const logger = createLogger('test:4h-scanner');

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
  console.log('\n=== PR #9: 4H Liquidity Sweep Scanner Tests ===\n');

  // Check database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('Database connection failed. Ensure PostgreSQL is running.');
    process.exit(1);
  }

  // Test 1: Constants exported correctly
  await test('Constants exported correctly', async () => {
    if (SWEEP_THRESHOLD !== 0.001) throw new Error(`Expected 0.001, got ${SWEEP_THRESHOLD}`);
    if (!SWEEP_TYPES.HIGH) throw new Error('Missing SWEEP_TYPES.HIGH');
    if (!SWEEP_TYPES.LOW) throw new Error('Missing SWEEP_TYPES.LOW');
    if (!BIAS_TYPES.BULLISH) throw new Error('Missing BIAS_TYPES.BULLISH');
    if (!BIAS_TYPES.BEARISH) throw new Error('Missing BIAS_TYPES.BEARISH');
  });

  // Test 2: Detect high sweep
  await test('detectHighSweep returns true when price exceeds threshold', async () => {
    const swingHigh = 90000;
    const threshold = swingHigh * 1.001; // 90090

    // Price just above threshold should detect sweep
    const result = detectHighSweep(90100, swingHigh);
    if (!result) throw new Error('Should detect high sweep at 90100');

    console.log(`    Swing high: $${swingHigh}, Price: $90100, Swept: ${result}`);
  });

  // Test 3: Detect high sweep - below threshold
  await test('detectHighSweep returns false when price below threshold', async () => {
    const swingHigh = 90000;

    // Price at swing level should NOT trigger
    const result1 = detectHighSweep(90000, swingHigh);
    if (result1) throw new Error('Should not detect sweep at exact level');

    // Price slightly above but below 0.1% should NOT trigger
    const result2 = detectHighSweep(90050, swingHigh);
    if (result2) throw new Error('Should not detect sweep below threshold');
  });

  // Test 4: Detect low sweep
  await test('detectLowSweep returns true when price below threshold', async () => {
    const swingLow = 90000;
    const threshold = swingLow * 0.999; // 89910

    // Price just below threshold should detect sweep
    const result = detectLowSweep(89900, swingLow);
    if (!result) throw new Error('Should detect low sweep at 89900');

    console.log(`    Swing low: $${swingLow}, Price: $89900, Swept: ${result}`);
  });

  // Test 5: Detect low sweep - above threshold
  await test('detectLowSweep returns false when price above threshold', async () => {
    const swingLow = 90000;

    // Price at swing level should NOT trigger
    const result1 = detectLowSweep(90000, swingLow);
    if (result1) throw new Error('Should not detect sweep at exact level');

    // Price slightly below but above 0.1% should NOT trigger
    const result2 = detectLowSweep(89950, swingLow);
    if (result2) throw new Error('Should not detect sweep above threshold');
  });

  // Test 6: Invalid inputs return false
  await test('Sweep detection handles invalid inputs', async () => {
    if (detectHighSweep(null, 90000)) throw new Error('Should return false for null price');
    if (detectHighSweep(90000, null)) throw new Error('Should return false for null swing');
    if (detectLowSweep(0, 90000)) throw new Error('Should return false for zero price');
    if (detectLowSweep(90000, 0)) throw new Error('Should return false for zero swing');
  });

  // Test 7: getBias returns correct bias
  await test('getBias returns correct bias for sweep type', async () => {
    const highBias = getBias(SWEEP_TYPES.HIGH);
    if (highBias !== BIAS_TYPES.BEARISH) {
      throw new Error(`Expected BEARISH for HIGH sweep, got ${highBias}`);
    }

    const lowBias = getBias(SWEEP_TYPES.LOW);
    if (lowBias !== BIAS_TYPES.BULLISH) {
      throw new Error(`Expected BULLISH for LOW sweep, got ${lowBias}`);
    }

    console.log(`    HIGH → ${highBias}, LOW → ${lowBias}`);
  });

  // Test 8: getBias throws on invalid type
  await test('getBias throws on invalid sweep type', async () => {
    try {
      getBias('INVALID');
      throw new Error('Should have thrown');
    } catch (error) {
      if (!error.message.includes('Invalid sweep type')) {
        throw new Error('Wrong error message');
      }
    }
  });

  // Test 9: getDirection returns correct direction
  await test('getDirection returns correct trading direction', async () => {
    const bullishDir = getDirection(BIAS_TYPES.BULLISH);
    if (bullishDir !== 'LONG') {
      throw new Error(`Expected LONG for BULLISH, got ${bullishDir}`);
    }

    const bearishDir = getDirection(BIAS_TYPES.BEARISH);
    if (bearishDir !== 'SHORT') {
      throw new Error(`Expected SHORT for BEARISH, got ${bearishDir}`);
    }
  });

  // Test 10: getSweepThreshold calculates correctly
  await test('getSweepThreshold calculates correct thresholds', async () => {
    const highThreshold = getSweepThreshold(90000, SWEEP_TYPES.HIGH);
    // Use approximate comparison for floating point
    if (Math.abs(highThreshold - 90090) > 0.01) {
      throw new Error(`Expected ~90090, got ${highThreshold}`);
    }

    const lowThreshold = getSweepThreshold(90000, SWEEP_TYPES.LOW);
    if (Math.abs(lowThreshold - 89910) > 0.01) {
      throw new Error(`Expected ~89910, got ${lowThreshold}`);
    }

    console.log(`    High threshold: $${highThreshold.toFixed(2)}, Low threshold: $${lowThreshold.toFixed(2)}`);
  });

  // Test 11: isSweepValid checks age
  await test('isSweepValid checks sweep age correctly', async () => {
    // Recent sweep should be valid
    const recentSweep = {
      timestamp: new Date().toISOString()
    };
    if (!isSweepValid(recentSweep, 24)) {
      throw new Error('Recent sweep should be valid');
    }

    // Old sweep should be invalid
    const oldSweep = {
      timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    };
    if (isSweepValid(oldSweep, 24)) {
      throw new Error('25h old sweep should be invalid');
    }

    // Null sweep should be invalid
    if (isSweepValid(null, 24)) {
      throw new Error('Null sweep should be invalid');
    }
  });

  // Test 12: createSweepObject creates correct structure
  await test('createSweepObject creates correct sweep object', async () => {
    const sweep = createSweepObject({
      currentPrice: 90100,
      sweepType: SWEEP_TYPES.HIGH,
      swingLevel: 90000,
      swingLevelId: 123
    });

    if (!sweep.timestamp) throw new Error('Missing timestamp');
    if (sweep.sweep_type !== SWEEP_TYPES.HIGH) throw new Error('Wrong sweep_type');
    if (sweep.price !== 90100) throw new Error('Wrong price');
    if (sweep.bias !== BIAS_TYPES.BEARISH) throw new Error('Wrong bias');
    if (sweep.swing_level !== 90000) throw new Error('Wrong swing_level');
    if (sweep.swing_level_id !== 123) throw new Error('Wrong swing_level_id');
    if (sweep.active !== true) throw new Error('Should be active');

    console.log(`    Created sweep: ${sweep.sweep_type} at $${sweep.price} → ${sweep.bias}`);
  });

  // Test 13: Scanner4H instantiates correctly
  await test('Scanner4H instantiates correctly', async () => {
    const scanner = new Scanner4H();
    if (!scanner) throw new Error('Scanner not created');
    if (typeof scanner.checkForSweeps !== 'function') throw new Error('Missing checkForSweeps');
    if (typeof scanner.storeSweep !== 'function') throw new Error('Missing storeSweep');
    if (typeof scanner.getActiveSweep !== 'function') throw new Error('Missing getActiveSweep');
    if (typeof scanner.startMonitoring !== 'function') throw new Error('Missing startMonitoring');
  });

  // Test 14: Scanner rejects invalid price
  await test('Scanner rejects invalid price for sweep check', async () => {
    const scanner = new Scanner4H();

    const result1 = await scanner.checkForSweeps(null);
    if (result1 !== null) throw new Error('Should return null for null price');

    const result2 = await scanner.checkForSweeps(0);
    if (result2 !== null) throw new Error('Should return null for zero price');

    const result3 = await scanner.checkForSweeps(-100);
    if (result3 !== null) throw new Error('Should return null for negative price');
  });

  // Test 15: Get scanner status
  await test('Scanner getStatus returns correct structure', async () => {
    const scanner = new Scanner4H();
    const status = await scanner.getStatus();

    if (status.monitoring === undefined) throw new Error('Missing monitoring');
    if (!status.lastUpdated) throw new Error('Missing lastUpdated');
    if (!('activeSweep' in status)) throw new Error('Missing activeSweep');
    if (!('swingHigh' in status)) throw new Error('Missing swingHigh');
    if (!('swingLow' in status)) throw new Error('Missing swingLow');

    console.log(`    Status: monitoring=${status.monitoring}, activeSweep=${status.activeSweep ? 'yes' : 'no'}`);
  });

  // Test 16: Scanner can deactivate expired sweeps
  await test('Scanner deactivateExpiredSweeps runs without error', async () => {
    const scanner = new Scanner4H();
    const count = await scanner.deactivateExpiredSweeps();

    if (typeof count !== 'number') {
      throw new Error('Should return a number');
    }

    console.log(`    Deactivated: ${count}`);
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
