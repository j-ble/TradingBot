/**
 * 4H Liquidity Sweep Scan Job
 * Scheduled job to detect 4H liquidity sweeps
 *
 * Schedule: After each 4H candle close (0 0,4,8,12,16,20 * * *)
 *
 * Usage:
 *   node jobs/scan_4h.js --check      # Single sweep check with current price
 *   node jobs/scan_4h.js --status     # Show current scanner status
 *   node jobs/scan_4h.js --monitor    # Start real-time monitoring
 *   node jobs/scan_4h.js --deactivate # Deactivate expired sweeps
 */

import { Scanner4H } from '../lib/scanners/4h_scanner.js';
import { PriceFeed } from '../lib/coinbase/price_feed.js';
import { closePool } from '../database/connection.js';
import { createLogger } from '../lib/utils/logger.js';

const logger = createLogger('job:scan-4h');

/**
 * Main job execution
 */
async function main() {
  const startTime = Date.now();
  logger.info('Starting 4H sweep scan job');

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const doCheck = args.includes('--check');
    const showStatus = args.includes('--status');
    const doMonitor = args.includes('--monitor');
    const doDeactivate = args.includes('--deactivate');

    const scanner = new Scanner4H();

    // Show status
    if (showStatus) {
      const status = await scanner.getStatus();

      console.log('\n=== 4H Sweep Scanner Status ===\n');
      console.log(`Monitoring: ${status.monitoring ? 'Active' : 'Inactive'}`);

      if (status.activeSweep) {
        console.log('\nActive Sweep:');
        console.log(`  Type: ${status.activeSweep.type}`);
        console.log(`  Bias: ${status.activeSweep.bias}`);
        console.log(`  Price: $${status.activeSweep.price}`);
        console.log(`  Timestamp: ${status.activeSweep.timestamp}`);
      } else {
        console.log('\nActive Sweep: None');
      }

      console.log('\n4H Swing Levels:');
      if (status.swingHigh) {
        console.log(`  High: $${status.swingHigh.price} at ${status.swingHigh.timestamp}`);
      } else {
        console.log('  High: None');
      }
      if (status.swingLow) {
        console.log(`  Low: $${status.swingLow.price} at ${status.swingLow.timestamp}`);
      } else {
        console.log('  Low: None');
      }

      console.log(`\nLast Updated: ${status.lastUpdated}`);
      return;
    }

    // Deactivate expired sweeps
    if (doDeactivate) {
      const count = await scanner.deactivateExpiredSweeps();
      console.log(`\nDeactivated ${count} expired sweep(s)`);
      return;
    }

    // Start real-time monitoring
    if (doMonitor) {
      console.log('\n=== Starting Real-Time Sweep Monitoring ===\n');
      console.log('Press Ctrl+C to stop\n');

      await scanner.startMonitoring();

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n\nShutting down...');
        scanner.stopMonitoring();
        await closePool();
        process.exit(0);
      });

      // Keep process running
      await new Promise(() => {}); // Never resolves
      return;
    }

    // Default: Single check with current price
    if (doCheck || (!showStatus && !doMonitor && !doDeactivate)) {
      console.log('\n=== 4H Sweep Check ===\n');

      // Get current price
      const priceFeed = new PriceFeed();
      await priceFeed.connect();

      // Wait for first price
      const priceUpdate = await priceFeed.waitForPrice(10000);
      const currentPrice = priceUpdate.price;

      console.log(`Current Price: $${currentPrice.toFixed(2)}`);

      // Check for sweeps
      const sweep = await scanner.checkForSweeps(currentPrice);

      if (sweep) {
        console.log('\nSWEEP DETECTED!');
        console.log(`  Type: ${sweep.sweep_type}`);
        console.log(`  Bias: ${sweep.bias}`);
        console.log(`  Price: $${sweep.price}`);
        console.log(`  Swing Level: $${sweep.swing_level}`);
      } else {
        const status = await scanner.getStatus();
        if (status.activeSweep) {
          console.log('\nExisting active sweep:');
          console.log(`  Type: ${status.activeSweep.type}`);
          console.log(`  Bias: ${status.activeSweep.bias}`);
        } else {
          console.log('\nNo sweep detected');
        }
      }

      priceFeed.disconnect();
    }

    // Log completion
    const duration = Date.now() - startTime;
    logger.info('4H sweep scan job completed', { duration: `${duration}ms` });
    console.log(`\nDuration: ${duration}ms`);

  } catch (error) {
    logger.error('4H sweep scan job failed', {
      error: error.message,
      stack: error.stack
    });
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  } finally {
    // Close database connection (unless monitoring)
    if (!process.argv.includes('--monitor')) {
      await closePool();
    }
  }
}

// Run the job
main().catch((error) => {
  logger.error('Unhandled error in job', { error: error.message });
  process.exit(1);
});
