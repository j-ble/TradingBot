/**
 * 5M Candle Collection Job
 * Scheduled job to collect 5-minute candlestick data
 *
 * Schedule: Every 5 minutes
 * Cron expression: 0/5 * * * * (every 5 minutes)
 */

import { CandleCollector5M } from '../lib/collectors/candle_collector_5m.js';
import { closePool } from '../database/connection.js';
import { createLogger } from '../lib/utils/logger.js';
import { retry } from '../lib/utils/async.js';

const logger = createLogger('job:5m');

// Configuration
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 60000; // 1 minute between retries

/**
 * Main job execution
 */
async function main() {
  const startTime = Date.now();
  logger.info('Starting 5M candle collection job');

  const collector = new CandleCollector5M();

  try {
    // Check command line arguments
    const args = process.argv.slice(2);
    const isBackfill = args.includes('--backfill');
    const isFillGaps = args.includes('--fill-gaps');
    const isStatus = args.includes('--status');
    const isPrune = args.includes('--prune');

    if (isStatus) {
      // Just show status
      const status = await collector.getStatus();
      console.log('\n=== 5M Candle Collection Status ===');
      console.log(`Total candles: ${status.totalCandles}`);
      console.log(`Latest: ${status.latestTimestamp}`);
      console.log(`Gaps: ${status.gapCount}`);
      console.log(`Updated: ${status.lastUpdated}`);
      return;
    }

    if (isPrune) {
      // Prune old candles only
      logger.info('Running prune mode');
      await collector.pruneOldCandles();
      return;
    }

    if (isBackfill) {
      // Full historical backfill
      logger.info('Running backfill mode');
      const count = parseInt(args[args.indexOf('--backfill') + 1]) || 500;
      await retry(
        () => collector.backfill(count),
        MAX_RETRIES,
        RETRY_DELAY_MS
      );
    } else if (isFillGaps) {
      // Fill gaps only
      logger.info('Running gap fill mode');
      await retry(
        () => collector.fillGaps(),
        MAX_RETRIES,
        RETRY_DELAY_MS
      );
    } else {
      // Normal collection (latest candle)
      logger.info('Running normal collection mode');
      await retry(
        () => collector.collectLatest(),
        MAX_RETRIES,
        RETRY_DELAY_MS
      );

      // Also check and fill any gaps
      const gaps = await collector.detectGaps();
      if (gaps.length > 0) {
        logger.info(`Found ${gaps.length} gaps, attempting to fill`);
        await collector.fillGaps();
      }

      // Periodically prune old data (every 6 hours roughly)
      const hour = new Date().getUTCHours();
      const minute = new Date().getUTCMinutes();
      if (hour % 6 === 0 && minute < 5) {
        logger.info('Running periodic pruning');
        await collector.pruneOldCandles();
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`5M candle collection job completed in ${duration}ms`);

  } catch (error) {
    logger.error('5M candle collection job failed', {
      error: error.message,
      stack: error.stack,
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
