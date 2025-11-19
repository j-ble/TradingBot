/**
 * Database Test Script
 * Tests database connection, schema, and all query functions
 */

import { testConnection, closePool, getPoolStatus } from '../database/connection.js';
import * as queries from '../database/queries.js';
import { createLogger } from '../lib/utils/logger.js';

const logger = createLogger('db-test');

/**
 * Test database connection
 */
async function testDatabaseConnection() {
  logger.info('=== Testing Database Connection ===');

  const connected = await testConnection();
  if (!connected) {
    throw new Error('Database connection failed');
  }

  const poolStatus = getPoolStatus();
  logger.info('Pool status:', poolStatus);

  logger.info('✓ Database connection test passed\n');
}

/**
 * Test candles operations
 */
async function testCandles() {
  logger.info('=== Testing Candles Operations ===');

  // Test 4H candle insertion
  const candle4h = {
    timestamp: new Date('2024-01-01T00:00:00Z'),
    open: 90000.00,
    high: 91000.00,
    low: 89500.00,
    close: 90500.00,
    volume: 1234.56789012
  };

  const inserted4h = await queries.insert4HCandle(candle4h);
  logger.info('Inserted 4H candle:', inserted4h);

  // Test 5M candle insertion
  const candle5m = {
    timestamp: new Date('2024-01-01T00:00:00Z'),
    open: 90000.00,
    high: 90100.00,
    low: 89900.00,
    close: 90050.00,
    volume: 123.456
  };

  const inserted5m = await queries.insert5MCandle(candle5m);
  logger.info('Inserted 5M candle:', inserted5m);

  // Test retrieval
  const candles4h = await queries.get4HCandles(10);
  logger.info(`Retrieved ${candles4h.length} 4H candles`);

  const candles5m = await queries.get5MCandles(10);
  logger.info(`Retrieved ${candles5m.length} 5M candles`);

  logger.info('✓ Candles operations test passed\n');
}

/**
 * Test swing levels operations
 */
async function testSwingLevels() {
  logger.info('=== Testing Swing Levels Operations ===');

  // Insert swing high
  const swingHigh = {
    timestamp: new Date('2024-01-01T00:00:00Z'),
    timeframe: '4H',
    swing_type: 'HIGH',
    price: 91000.00,
    active: true
  };

  const insertedHigh = await queries.insertSwingLevel(swingHigh);
  logger.info('Inserted swing high:', insertedHigh);

  // Insert swing low
  const swingLow = {
    timestamp: new Date('2024-01-01T04:00:00Z'),
    timeframe: '4H',
    swing_type: 'LOW',
    price: 89000.00,
    active: true
  };

  const insertedLow = await queries.insertSwingLevel(swingLow);
  logger.info('Inserted swing low:', insertedLow);

  // Test retrieval
  const recentHigh = await queries.getRecentSwing('4H', 'HIGH');
  logger.info('Recent 4H HIGH:', recentHigh);

  const recentLow = await queries.getRecentSwing('4H', 'LOW');
  logger.info('Recent 4H LOW:', recentLow);

  logger.info('✓ Swing levels operations test passed\n');
}

/**
 * Test liquidity sweeps operations
 */
async function testLiquiditySweeps() {
  logger.info('=== Testing Liquidity Sweeps Operations ===');

  // Get a swing level to reference
  const swing = await queries.getRecentSwing('4H', 'LOW');

  if (!swing) {
    logger.warn('No swing level found, creating one for test');
    const testSwing = {
      timestamp: new Date(),
      timeframe: '4H',
      swing_type: 'LOW',
      price: 89000.00,
      active: true
    };
    await queries.insertSwingLevel(testSwing);
  }

  const recentSwing = await queries.getRecentSwing('4H', 'LOW');

  // Insert liquidity sweep
  const sweep = {
    timestamp: new Date(),
    sweep_type: 'LOW',
    price: 88900.00,
    bias: 'BULLISH',
    swing_level: recentSwing.price,
    swing_level_id: recentSwing.id,
    active: true
  };

  const insertedSweep = await queries.insertLiquiditySweep(sweep);
  logger.info('Inserted liquidity sweep:', insertedSweep);

  // Test retrieval
  const activeSweep = await queries.getActiveSweep();
  logger.info('Active sweep:', activeSweep);

  logger.info('✓ Liquidity sweeps operations test passed\n');
}

/**
 * Test confluence state operations
 */
async function testConfluenceState() {
  logger.info('=== Testing Confluence State Operations ===');

  // Get active sweep
  const sweep = await queries.getActiveSweep();

  if (!sweep) {
    logger.warn('No active sweep found, skipping confluence state test');
    return;
  }

  // Create confluence state
  const confluenceState = await queries.createConfluenceState(sweep.id);
  logger.info('Created confluence state:', confluenceState);

  // Update to WAITING_FVG
  const updated = await queries.updateConfluenceState(confluenceState.id, {
    current_state: 'WAITING_FVG',
    choch_detected: true,
    choch_time: new Date(),
    choch_price: 90500.00
  });
  logger.info('Updated confluence state:', updated);

  // Get active confluence
  const activeConfluence = await queries.getActiveConfluence();
  logger.info('Active confluence:', activeConfluence);

  logger.info('✓ Confluence state operations test passed\n');
}

/**
 * Test trades operations
 */
async function testTrades() {
  logger.info('=== Testing Trades Operations ===');

  // Get active confluence (if exists)
  const confluence = await queries.getActiveConfluence();

  // Create test trade
  const trade = {
    confluence_id: confluence?.id || null,
    direction: 'LONG',
    entry_price: 90000.00,
    entry_time: new Date(),
    position_size_btc: 0.011,
    position_size_usd: 990.00,
    stop_loss: 88200.00,
    stop_loss_source: '5M_SWING',
    stop_loss_swing_price: 88500.00,
    stop_loss_distance_percent: 2.00,
    take_profit: 93600.00,
    risk_reward_ratio: 2.00,
    coinbase_entry_order_id: 'test-entry-123',
    coinbase_stop_order_id: 'test-stop-123',
    coinbase_tp_order_id: 'test-tp-123',
    ai_confidence: 85,
    ai_reasoning: 'Test trade with all confluences met',
    status: 'OPEN'
  };

  const insertedTrade = await queries.insertTrade(trade);
  logger.info('Inserted trade:', insertedTrade);

  // Test retrieval
  const openTrades = await queries.getOpenTrades();
  logger.info(`Found ${openTrades.length} open trades`);

  // Test update
  const updatedTrade = await queries.updateTrade(insertedTrade.id, {
    trailing_stop_activated: true,
    trailing_stop_price: 90000.00
  });
  logger.info('Updated trade with trailing stop:', updatedTrade);

  logger.info('✓ Trades operations test passed\n');
}

/**
 * Test system config operations
 */
async function testSystemConfig() {
  logger.info('=== Testing System Config Operations ===');

  // Get system config
  const config = await queries.getSystemConfig();
  logger.info('System config:', config);

  // Update config
  const updated = await queries.updateSystemConfig({
    trading_enabled: true,
    account_balance: 100.00
  });
  logger.info('Updated system config:', updated);

  // Test emergency stop
  await queries.setEmergencyStop(false);
  logger.info('Emergency stop set to false');

  // Get trading metrics
  const metrics = await queries.getTradingMetrics();
  logger.info('Trading metrics:', metrics);

  logger.info('✓ System config operations test passed\n');
}

/**
 * Test database views
 */
async function testViews() {
  logger.info('=== Testing Database Views ===');

  const activeSetup = await queries.getActiveSetupView();
  logger.info('Active setup view:', activeSetup);

  const openPositions = await queries.getOpenPositionsView();
  logger.info(`Open positions view: ${openPositions.length} positions`);

  const recentSwings = await queries.getRecentSwingsView();
  logger.info(`Recent swings view: ${recentSwings.length} swings`);

  const performanceMetrics = await queries.getPerformanceMetricsView();
  logger.info('Performance metrics view:', performanceMetrics);

  logger.info('✓ Database views test passed\n');
}

/**
 * Run all tests
 */
async function runAllTests() {
  logger.info('╔═══════════════════════════════════════════════════════════════╗');
  logger.info('║         BTC Trading Bot - Database Test Suite                ║');
  logger.info('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    await testDatabaseConnection();
    await testCandles();
    await testSwingLevels();
    await testLiquiditySweeps();
    await testConfluenceState();
    await testTrades();
    await testSystemConfig();
    await testViews();

    logger.info('╔═══════════════════════════════════════════════════════════════╗');
    logger.info('║         ✓ ALL DATABASE TESTS PASSED                          ║');
    logger.info('╚═══════════════════════════════════════════════════════════════╝');

    logger.info('\nDatabase is ready for PR#1 completion!');
    logger.info('Next steps:');
    logger.info('  1. Create .env file from .env.example');
    logger.info('  2. Add your Coinbase API credentials');
    logger.info('  3. Proceed to PR#2: Coinbase API Client Wrapper');

  } catch (error) {
    logger.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Close database connection pool
    await closePool();
    logger.info('\nDatabase connection pool closed');
  }
}

// Run tests
runAllTests().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
