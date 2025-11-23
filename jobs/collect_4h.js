/**
 * 4H Candle Collection Job
 * Scheduled job to collect 4-hour candlestick data
 *
 * Schedule: Every 4 hours at minute 0
 * Cron: 0 0,4,8,12,16,20 * * *
 */

import { CandleCollector4H } from '../lib/collectors/candle_collector_4h.js';
import { closePool } from '../database/connection.js';
import { createLogger } from '../lib/utils/logger.js';
import { retry } from '../lib/utils/async.js';

const logger = createLogger('job:4h');

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds between retries

/**
 * Main job execution
 */
async function main() {
  const startTime = Date.now();
  logger.info('Starting 4H candle collection job');

  const collector = new CandleCollector4H();

  try {
    // Check command line arguments
    const args = process.argv.slice(2);
    const isBackfill = args.includes('--backfill');
    const isFillGaps = args.includes('--fill-gaps');
    const isStatus = args.includes('--status');

    if (isStatus) {
      // Just show status
      const status = await collector.getStatus();
      console.log('\n=== 4H Candle Collection Status ===');
      console.log(`Total candles: ${status.totalCandles}`);
      console.log(`Latest: ${status.latestTimestamp}`);
      console.log(`Gaps: ${status.gapCount}`);
      console.log(`Updated: ${status.lastUpdated}`);
      return;
    }

    if (isBackfill) {
      // Full historical backfill
      logger.info('Running backfill mode');
      const count = parseInt(args[args.indexOf('--backfill') + 1]) || 200;
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
    }

    const duration = Date.now() - startTime;
    logger.info(`4H candle collection job completed in ${duration}ms`);

  } catch (error) {
    logger.error('4H candle collection job failed', {
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
