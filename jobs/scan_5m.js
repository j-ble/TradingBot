/**
 * 5M Confluence Scanner Job
 * Runs every 5 minutes to detect CHoCH → FVG Fill → BOS sequence
 *
 * This job is activated when a 4H liquidity sweep is detected.
 * It monitors the 5M timeframe for confluence patterns that confirm
 * the trade setup.
 *
 * Cron: * /5 * * * * (every 5 minutes)
 */

import { createLogger } from '../lib/utils/logger.js';
import { runScan, getScanner } from '../lib/scanners/5m_scanner.js';
import { getActiveConfluence, getSystemConfig } from '../database/queries.js';

const logger = createLogger('scan_5m_job');

/**
 * Main job execution
 */
async function main() {
  logger.info('Starting 5M confluence scan job');

  try {
    // Check system config for emergency stop
    const config = await getSystemConfig();
    if (config?.emergency_stop) {
      logger.warn('Emergency stop is active, skipping scan');
      return;
    }

    // Check if there's an active confluence to scan
    const activeConfluence = await getActiveConfluence();
    if (!activeConfluence) {
      logger.debug('No active confluence state, skipping scan');
      return;
    }

    logger.info('Active confluence found', {
      id: activeConfluence.id,
      state: activeConfluence.current_state,
      bias: activeConfluence.bias
    });

    // Run the scan
    await runScan();

    // Get updated status
    const scanner = getScanner();
    const status = await scanner.getStatus(activeConfluence.id);

    if (status) {
      logger.info('Scan complete', {
        confluenceId: status.id,
        currentState: status.currentState,
        chochDetected: status.choch.detected,
        fvgDetected: status.fvg.detected,
        bosDetected: status.bos.detected,
        timeRemainingMin: Math.round(status.timeRemaining / 60000)
      });

      // Check if confluence is complete
      if (status.currentState === 'COMPLETE') {
        logger.info('CONFLUENCE COMPLETE - Triggering AI decision', {
          confluenceId: status.id
        });
        // TODO: Trigger AI decision engine (PR#15)
      }
    }

  } catch (error) {
    logger.error('5M scan job failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

// Run the job
main()
  .then(() => {
    logger.info('5M scan job completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('5M scan job exited with error', { error: error.message });
    process.exit(1);
  });

export default main;
