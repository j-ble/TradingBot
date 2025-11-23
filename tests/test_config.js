/**
 * Configuration and Validation Tests
 * Tests for PR #3: Environment Configuration and Error Handling
 */

import config, {
  getDatabaseConfig,
  getCoinbaseConfig,
  getTradingConfig,
  getAIConfig,
  isPaperTrading,
  isEmergencyStop,
} from '../lib/config/index.js';

import {
  validatePrice,
  validatePositionSize,
  validateRiskReward,
  validateStopDistance,
  validateDirection,
  validateSide,
  validateProductId,
  validateConfidence,
  validateBalance,
} from '../lib/utils/validation.js';

import { createLogger } from '../lib/utils/logger.js';

const logger = createLogger('test:config');

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

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertThrows(fn, expectedMessage) {
  try {
    fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (expectedMessage && !error.message.includes(expectedMessage)) {
      throw new Error(`Expected error containing "${expectedMessage}", got "${error.message}"`);
    }
  }
}

async function runTests() {
  console.log('\n=== PR #3: Configuration Tests ===\n');

  // Config loading tests
  console.log('--- Config Loading ---');

  test('Config loads successfully', () => {
    if (!config) throw new Error('Config is undefined');
  });

  test('Database config has required fields', () => {
    const db = getDatabaseConfig();
    if (!db.host) throw new Error('Missing host');
    if (!db.port) throw new Error('Missing port');
    if (!db.database) throw new Error('Missing database');
    if (!db.user) throw new Error('Missing user');
    if (!db.password) throw new Error('Missing password');
  });

  test('Coinbase config has credentials', () => {
    const cb = getCoinbaseConfig();
    if (!cb.apiKey) throw new Error('Missing API key');
    if (!cb.apiSecret) throw new Error('Missing API secret');
  });

  test('Trading config has defaults', () => {
    const trading = getTradingConfig();
    assertEqual(typeof trading.paperMode, 'boolean', 'paperMode type');
    assertEqual(typeof trading.accountBalance, 'number', 'accountBalance type');
    assertEqual(typeof trading.leverage, 'number', 'leverage type');
    assertEqual(typeof trading.riskPerTrade, 'number', 'riskPerTrade type');
  });

  test('AI config has defaults', () => {
    const ai = getAIConfig();
    if (!ai.host) throw new Error('Missing host');
    if (!ai.model) throw new Error('Missing model');
  });

  test('isPaperTrading returns boolean', () => {
    assertEqual(typeof isPaperTrading(), 'boolean', 'isPaperTrading type');
  });

  test('isEmergencyStop returns boolean', () => {
    assertEqual(typeof isEmergencyStop(), 'boolean', 'isEmergencyStop type');
  });

  // Validation tests
  console.log('\n--- Input Validation ---');

  test('validatePrice accepts positive numbers', () => {
    validatePrice(100);
    validatePrice(0.001);
    validatePrice(99999.99);
  });

  test('validatePrice rejects invalid values', () => {
    assertThrows(() => validatePrice(-1), 'positive');
    assertThrows(() => validatePrice(0), 'positive');
    assertThrows(() => validatePrice('100'), 'number');
    assertThrows(() => validatePrice(NaN), 'number');
  });

  test('validatePositionSize accepts valid sizes', () => {
    validatePositionSize(0.001);
    validatePositionSize(1);
    validatePositionSize(10);
  });

  test('validatePositionSize rejects invalid sizes', () => {
    assertThrows(() => validatePositionSize(0.00001), 'at least');
    assertThrows(() => validatePositionSize(1000), 'exceed');
    assertThrows(() => validatePositionSize(-1), 'at least');
  });

  test('validateRiskReward accepts valid ratios', () => {
    validateRiskReward(2);
    validateRiskReward(3);
    validateRiskReward(5);
  });

  test('validateRiskReward rejects low ratios', () => {
    assertThrows(() => validateRiskReward(1), 'at least 2:1');
    assertThrows(() => validateRiskReward(1.5), 'at least 2:1');
  });

  test('validateStopDistance accepts valid percentages', () => {
    validateStopDistance(0.5);
    validateStopDistance(1.5);
    validateStopDistance(3);
  });

  test('validateStopDistance rejects invalid percentages', () => {
    assertThrows(() => validateStopDistance(0.1), 'between');
    assertThrows(() => validateStopDistance(5), 'between');
  });

  test('validateDirection accepts LONG/SHORT', () => {
    validateDirection('LONG');
    validateDirection('SHORT');
  });

  test('validateDirection rejects invalid values', () => {
    assertThrows(() => validateDirection('long'), 'LONG or SHORT');
    assertThrows(() => validateDirection('BUY'), 'LONG or SHORT');
  });

  test('validateSide accepts BUY/SELL', () => {
    validateSide('BUY');
    validateSide('SELL');
  });

  test('validateSide rejects invalid values', () => {
    assertThrows(() => validateSide('buy'), 'BUY or SELL');
    assertThrows(() => validateSide('LONG'), 'BUY or SELL');
  });

  test('validateProductId accepts valid format', () => {
    validateProductId('BTC-USD');
    validateProductId('ETH-USDT');
  });

  test('validateProductId rejects invalid format', () => {
    assertThrows(() => validateProductId('BTCUSD'), 'format');
    assertThrows(() => validateProductId('btc-usd'), 'format');
  });

  test('validateConfidence accepts valid scores', () => {
    validateConfidence(70);
    validateConfidence(85);
    validateConfidence(100);
  });

  test('validateConfidence rejects invalid scores', () => {
    assertThrows(() => validateConfidence(69), 'at least 70');
    assertThrows(() => validateConfidence(-1), 'between 0 and 100');
    assertThrows(() => validateConfidence(101), 'between 0 and 100');
  });

  test('validateBalance accepts sufficient balance', () => {
    validateBalance(100);
    validateBalance(10000);
  });

  test('validateBalance rejects insufficient balance', () => {
    assertThrows(() => validateBalance(50), 'at least $100');
    assertThrows(() => validateBalance(0), 'at least $100');
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
