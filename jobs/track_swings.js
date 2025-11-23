/**
 * Swing Tracking Job
 * Scheduled job to detect and track swing levels
 *
 * Schedule: After each candle collection
 * - 4H: After 4H candle close (0 0,4,8,12,16,20 * * *)
 * - 5M: After 5M candle close (every 5 minutes)
 */

import { SwingDetector4H } from '../lib/scanners/swing_detector_4h.js';
import { SwingDetector5M } from '../lib/scanners/swing_detector_5m.js';
import { closePool } from '../database/connection.js';
import { createLogger } from '../lib/utils/logger.js';

const logger = createLogger('job:swings');

/**
 * Main job execution
 */
async function main() {
  const startTime = Date.now();
  logger.info('Starting swing tracking job');

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const scan4H = args.includes('--scan-4h') || args.includes('--all');
    const scan5M = args.includes('--scan-5m') || args.includes('--all');
    const showStatus = args.includes('--status');

    // Default to scanning both if no specific flag
    const scanBoth = !scan4H && !scan5M && !showStatus;

    const detector4H = new SwingDetector4H();
    const detector5M = new SwingDetector5M();

    if (showStatus) {
      // Show status only
      const status4H = await detector4H.getStatus();
      const status5M = await detector5M.getStatus();

      console.log('\n=== Swing Tracking Status ===\n');

      console.log('4H Timeframe:');
      if (status4H.activeHigh) {
        console.log(`  High: $${status4H.activeHigh.price} at ${status4H.activeHigh.timestamp}`);
      } else {
        console.log('  High: None');
      }
      if (status4H.activeLow) {
        console.log(`  Low: $${status4H.activeLow.price} at ${status4H.activeLow.timestamp}`);
      } else {
        console.log('  Low: None');
      }

      console.log('\n5M Timeframe:');
      if (status5M.activeHigh) {
        console.log(`  High: $${status5M.activeHigh.price} at ${status5M.activeHigh.timestamp}`);
      } else {
        console.log('  High: None');
      }
      if (status5M.activeLow) {
        console.log(`  Low: $${status5M.activeLow.price} at ${status5M.activeLow.timestamp}`);
      } else {
        console.log('  Low: None');
      }

      console.log(`\nUpdated: ${status4H.lastUpdated}`);
      return;
    }

    // Run scans
    const results = {
      '4H': null,
      '5M': null
    };

    if (scan4H || scanBoth) {
      logger.info('Running 4H swing scan');
      results['4H'] = await detector4H.scan();
    }

    if (scan5M || scanBoth) {
      logger.info('Running 5M swing scan');
      results['5M'] = await detector5M.scan();
    }

    // Log results
    const duration = Date.now() - startTime;
    logger.info('Swing tracking job completed', {
      duration: `${duration}ms`,
      results
    });

    // Print summary
    console.log('\n=== Swing Tracking Results ===');
    if (results['4H']) {
      console.log(`4H: Detected ${results['4H'].detected}, Stored ${results['4H'].stored}, Skipped ${results['4H'].skipped}`);
    }
    if (results['5M']) {
      console.log(`5M: Detected ${results['5M'].detected}, Stored ${results['5M'].stored}, Skipped ${results['5M'].skipped}`);
    }
    console.log(`Duration: ${duration}ms`);

  } catch (error) {
    logger.error('Swing tracking job failed', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  } finally {
    // Close database connection
    await closePool();
  }
}

// Run the job
main().catch((error) => {
  logger.error('Unhandled error in job', { error: error.message });
  process.exit(1);
});
