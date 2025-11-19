/**
 * Coinbase API Client Test Script
 * Tests authentication, API connectivity, and basic functionality
 */

import { CoinbaseClient } from '../lib/coinbase/client.js';
import { PRODUCTS } from '../lib/coinbase/endpoints.js';
import { createLogger } from '../lib/utils/logger.js';

const logger = createLogger('coinbase-test');

/**
 * Test Coinbase client initialization
 */
async function testClientInitialization() {
  logger.info('=== Testing Client Initialization ===');

  try {
    const client = new CoinbaseClient();
    logger.info('✓ Coinbase client initialized successfully');

    const status = client.getRateLimiterStatus();
    logger.info('Rate limiter status:', status);

    return client;
  } catch (error) {
    logger.error('✗ Client initialization failed:', error.message);
    throw error;
  }
}

/**
 * Test getting current BTC price
 */
async function testGetCurrentPrice(client) {
  logger.info('\n=== Testing Get Current Price ===');

  try {
    const price = await client.getCurrentPrice(PRODUCTS.BTC_USD);
    logger.info(`✓ Current BTC-USD spot price: $${price.toLocaleString()}`);
    return price;
  } catch (error) {
    logger.error('✗ Failed to get current price:', error.message);
    throw error;
  }
}

/**
 * Test getting historical candles
 */
async function testGetCandles(client) {
  logger.info('\n=== Testing Get Candles ===');

  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago

    logger.info('Fetching 5M candles for last 24 hours...');

    const candles = await client.getCandles(
      PRODUCTS.BTC_USD,
      '5M',
      startTime,
      endTime
    );

    logger.info(`✓ Retrieved ${candles.length} candles`);

    if (candles.length > 0) {
      const latest = candles[candles.length - 1];
      logger.info('Latest candle:', {
        timestamp: latest.timestamp.toISOString(),
        open: latest.open,
        high: latest.high,
        low: latest.low,
        close: latest.close,
        volume: latest.volume
      });
    }

    return candles;
  } catch (error) {
    logger.error('✗ Failed to get candles:', error.message);
    throw error;
  }
}

/**
 * Test getting accounts
 */
async function testGetAccounts(client) {
  logger.info('\n=== Testing Get Accounts ===');

  try {
    const accounts = await client.getAccounts();
    logger.info(`✓ Retrieved ${accounts.length} accounts`);

    accounts.forEach((account, index) => {
      logger.info(`Account ${index + 1}:`, {
        name: account.name,
        currency: account.currency,
        available: account.available_balance?.value,
        hold: account.hold?.value
      });
    });

    return accounts;
  } catch (error) {
    logger.error('✗ Failed to get accounts:', error.message);
    throw error;
  }
}

/**
 * Test getting account balance
 */
async function testGetAccountBalance(client) {
  logger.info('\n=== Testing Get Account Balance ===');

  try {
    const balance = await client.getAccountBalance();
    logger.info('✓ Account balance:', {
      total: `$${balance.total_balance.toLocaleString()}`,
      available: `$${balance.available_balance.toLocaleString()}`,
      accountCount: balance.accounts.length
    });

    return balance;
  } catch (error) {
    logger.error('✗ Failed to get account balance:', error.message);
    throw error;
  }
}

/**
 * Test getting product info
 */
async function testGetProduct(client) {
  logger.info('\n=== Testing Get Product Info ===');

  try {
    const product = await client.getProduct(PRODUCTS.BTC_USD);
    logger.info('✓ BTC-USD spot product info:', {
      productId: product.product_id,
      status: product.status,
      baseCurrency: product.base_currency_id,
      quoteCurrency: product.quote_currency_id,
      baseIncrement: product.base_increment,
      quoteIncrement: product.quote_increment
    });

    return product;
  } catch (error) {
    logger.error('✗ Failed to get product info:', error.message);
    throw error;
  }
}

/**
 * Test rate limiting
 */
async function testRateLimiting(client) {
  logger.info('\n=== Testing Rate Limiting ===');

  try {
    const startTime = Date.now();

    logger.info('Making 15 rapid requests to test rate limiting...');

    // Make 15 rapid requests
    const promises = [];
    for (let i = 0; i < 15; i++) {
      promises.push(client.getCurrentPrice(PRODUCTS.BTC_USD));
    }

    await Promise.all(promises);

    const duration = Date.now() - startTime;
    logger.info(`✓ Completed 15 requests in ${duration}ms`);
    logger.info(`Average: ${Math.round(duration / 15)}ms per request`);

    const status = client.getRateLimiterStatus();
    logger.info('Rate limiter status after test:', status);

  } catch (error) {
    logger.error('✗ Rate limiting test failed:', error.message);
    throw error;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  logger.info('╔═══════════════════════════════════════════════════════════════╗');
  logger.info('║         Coinbase API Client - Test Suite                     ║');
  logger.info('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    const client = await testClientInitialization();
    await testGetCurrentPrice(client);
    await testGetCandles(client);
    await testGetProduct(client);
    await testGetAccounts(client);
    await testGetAccountBalance(client);
    await testRateLimiting(client);

    logger.info('\n╔═══════════════════════════════════════════════════════════════╗');
    logger.info('║         ✓ ALL COINBASE API TESTS PASSED                      ║');
    logger.info('╚═══════════════════════════════════════════════════════════════╝');

    logger.info('\nCoinbase API client is ready!');
    logger.info('Next steps:');
    logger.info('  1. Implement data collectors (PR#5-7)');
    logger.info('  2. Set up WebSocket for real-time price feed');
    logger.info('  3. Implement pattern detection (PR#8-11)');

  } catch (error) {
    logger.error('\n❌ Test suite failed:', error.message);
    logger.error('Error details:', error);

    if (error.name === 'AuthenticationError') {
      logger.error('\n⚠️  Authentication failed. Please check:');
      logger.error('   - COINBASE_API_KEY is correct in .env');
      logger.error('   - COINBASE_API_SECRET is correct in .env');
      logger.error('   - API keys have correct permissions');
    }

    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
