import chalk from 'chalk';
import { sleep, calculateTokenAge } from './utils.js';
import { parseSwapTransaction, filterMultiHopSwaps } from './swapParser.js';
import { getTokenDetails, calculateRiskScore, passesFilters } from './tokenAnalysis.js';
import { openPosition, closePosition, savePositions } from './positions.js';
import { displayBasicWhaleAlert, displayWhaleAlert, displayWhaleSellAlert } from './display.js';

// ==================== CACHE MANAGEMENT ====================

export function cleanAlertCache(alertedTokens, processedSignatures, config) {
  const maxAge = config.cache.remember_alerted_tokens_hours * 60 * 60 * 1000;
  const now = Date.now();

  // Clean alerted tokens cache
  for (const [key, timestamp] of alertedTokens.entries()) {
    if (now - timestamp > maxAge) {
      alertedTokens.delete(key);
    }
  }

  // Also limit cache size
  if (alertedTokens.size > config.cache.max_cached_tokens) {
    const entries = Array.from(alertedTokens.entries());
    entries.sort((a, b) => a[1] - b[1]); // Sort by timestamp

    // Remove oldest half
    const toRemove = entries.slice(0, Math.floor(entries.length / 2));
    toRemove.forEach(([key]) => alertedTokens.delete(key));
  }

  // Clean processed signatures cache (keep for 24 hours)
  const signatureMaxAge = 24 * 60 * 60 * 1000; // 24 hours
  for (const [signature, timestamp] of processedSignatures.entries()) {
    if (now - timestamp > signatureMaxAge) {
      processedSignatures.delete(signature);
    }
  }

  // Limit signature cache size to prevent unbounded growth
  if (processedSignatures.size > 1000) {
    const entries = Array.from(processedSignatures.entries());
    entries.sort((a, b) => a[1] - b[1]); // Sort by timestamp

    // Remove oldest half
    const toRemove = entries.slice(0, Math.floor(entries.length / 2));
    toRemove.forEach(([signature]) => processedSignatures.delete(signature));
  }
}

// ==================== WHALE TRACKING ====================

export async function checkWhaleWallet(
  whale,
  helius,
  dexscreener,
  config,
  alertedTokens,
  processedSignatures,
  whalePositions,
  isFirstScan
) {
  try {
    // Get recent transaction signatures
    const signatures = await helius.getWalletTransactions(
      whale.address,
      config.scanner.transaction_lookback_count
    );

    if (!signatures || signatures.length === 0) {
      return;
    }

    // If this is the first scan, cache older transactions but process the most recent ones
    if (isFirstScan) {
      // Process only the 5 most recent transactions on first scan to catch recent whale activity
      const recentToProcess = Math.min(5, signatures.length);
      const toCache = signatures.slice(recentToProcess);
      const toProcess = signatures.slice(0, recentToProcess);

      // Cache older transactions
      for (const sig of toCache) {
        processedSignatures.set(sig.signature, Date.now());
      }

      if (config.debug?.enable_verbose_logging) {
        console.log(chalk.dim(`  [${whale.name}] First scan - processing ${toProcess.length} recent txs, caching ${toCache.length} older txs`));
      }

      // Continue processing the recent transactions below (don't return)
      // Update signatures to only include the ones we want to process
      signatures.splice(0, signatures.length, ...toProcess);
    }

    // Filter out already processed signatures
    const newSignatures = signatures.filter(sig => !processedSignatures.has(sig.signature));

    // Debug logging
    if (config.debug?.enable_verbose_logging) {
      console.log(chalk.dim(`  [${whale.name}] Total txs: ${signatures.length}, New: ${newSignatures.length}, Cached: ${signatures.length - newSignatures.length}`));
    }

    if (newSignatures.length === 0) {
      return;
    }

    // Fetch full transaction details for each signature
    for (const sig of newSignatures) {
      const signature = sig.signature;

      // Mark signature as processed immediately to avoid re-processing
      processedSignatures.set(signature, Date.now());

      // Fetch full transaction details
      const txDetails = await helius.getTransactionDetails(signature);

      if (!txDetails) continue;

      // Parse transaction for token swaps (returns array of swaps)
      const swaps = parseSwapTransaction(txDetails, signature, config.debug?.enable_verbose_logging || false);

      if (!swaps || swaps.length === 0) {
        // Debug: Log non-swap transactions if verbose mode enabled
        if (config.debug?.enable_verbose_logging) {
          console.log(chalk.dim(`  [${whale.name}] No swaps detected in transaction`));
        }
        continue;
      }

      // Filter multi-hop swaps
      const filteredSwaps = filterMultiHopSwaps(swaps, config.debug?.enable_verbose_logging || false);

      // Process each swap in the transaction (filtered to remove intermediates)
      for (const swap of filteredSwaps) {
        if (!swap.isSwap || !swap.tokenMint) continue;

        // Debug: Log detected swaps
        if (config.debug?.enable_verbose_logging) {
          if (swap.direction === 'BUY') {
            console.log(chalk.yellow(`  [${whale.name}] BUY DETECTED - ${swap.solSpent.toFixed(4)} SOL → ${swap.amount.toFixed(2)} tokens of ${swap.tokenMint.slice(0, 8)}...`));
          } else {
            console.log(chalk.magenta(`  [${whale.name}] SELL DETECTED - ${swap.amount.toFixed(2)} tokens → ${swap.solReceived.toFixed(4)} SOL from ${swap.tokenMint.slice(0, 8)}...`));
          }
        }

        // ===== HANDLE BUY =====
        if (swap.direction === 'BUY') {
          // Filter: Check minimum SOL amount spent
          if (swap.solSpent < config.safety_thresholds.min_sol_amount) {
            if (config.debug?.enable_verbose_logging) {
              console.log(chalk.dim(`  [${whale.name}] FILTERED - SOL amount ${swap.solSpent.toFixed(4)} < ${config.safety_thresholds.min_sol_amount} minimum`));
            }
            continue;
          }

          // Check if we've already alerted on this token recently
          const cacheKey = `${whale.address}:${swap.tokenMint}`;
          const lastAlert = alertedTokens.get(cacheKey);

          if (lastAlert) {
            const hoursSinceAlert = (Date.now() - lastAlert) / (1000 * 60 * 60);
            if (hoursSinceAlert < config.cache.remember_alerted_tokens_hours) {
              continue; // Skip - already alerted recently
            }
          }

          // Get token details from DexScreener
          const tokenDetails = await getTokenDetails(dexscreener, swap.tokenMint);

          if (!tokenDetails) {
            // No DexScreener data - show basic alert anyway
            if (config.debug?.enable_verbose_logging) {
              console.log(chalk.red(`  [${whale.name}] No DexScreener data for token ${swap.tokenMint.slice(0, 8)}... - showing basic alert`));
            }
            displayBasicWhaleAlert(whale, swap);

            // Track position even without DexScreener data
            openPosition(whalePositions, whale, swap.tokenMint, swap.amount, swap.solSpent, null, swap.timestamp, swap.signature, config);

            // Cache this alert
            alertedTokens.set(cacheKey, Date.now());
            cleanAlertCache(alertedTokens, processedSignatures, config);
            await sleep(2000);
            continue;
          }

          // Apply safety filters
          if (!passesFilters(tokenDetails, config)) {
            if (config.debug?.enable_verbose_logging) {
              console.log(chalk.dim(`  [${whale.name}] FILTERED - Failed safety checks (liquidity: $${tokenDetails.liquidityUsd.toFixed(0)}, age: ${calculateTokenAge(tokenDetails.pairCreatedAt)?.ageMinutes || 'unknown'} min)`));
            }
            continue;
          }

          // Calculate risk score
          const riskScore = calculateRiskScore(tokenDetails);

          if (riskScore < config.safety_thresholds.risk_score_min) {
            if (config.debug?.enable_verbose_logging) {
              console.log(chalk.dim(`  [${whale.name}] FILTERED - Risk score ${riskScore}/10 < ${config.safety_thresholds.risk_score_min} minimum`));
            }
            continue;
          }

          // WHALE BUY ALERT!
          displayWhaleAlert(whale, tokenDetails, swap, riskScore, config);

          // Track this position
          openPosition(whalePositions, whale, swap.tokenMint, swap.amount, swap.solSpent, tokenDetails, swap.timestamp, swap.signature, config);

          // Cache this alert
          alertedTokens.set(cacheKey, Date.now());

          // Clean old cache entries
          cleanAlertCache(alertedTokens, processedSignatures, config);

          // Save positions to disk
          await savePositions(whalePositions, config);

          // Rate limiting pause
          await sleep(2000);
        }

        // ===== HANDLE SELL =====
        else if (swap.direction === 'SELL') {
          // Try to close/update the position
          const exitInfo = closePosition(whalePositions, whale, swap.tokenMint, swap.amount, swap.solReceived, swap.timestamp, swap.signature, config);

          // Only show sell alert if config allows and we have position data
          if (exitInfo && config.alerts.show_whale_sells) {
            // Get current token details for sell alert
            const tokenDetails = await getTokenDetails(dexscreener, swap.tokenMint);

            // Display sell alert with P&L
            displayWhaleSellAlert(whale, tokenDetails, exitInfo, config);

            // Save positions to disk
            await savePositions(whalePositions, config);

            // Rate limiting pause
            await sleep(2000);
          } else if (!exitInfo && config.debug?.enable_verbose_logging) {
            console.log(chalk.dim(`  [${whale.name}] Sell detected but not alerted (no tracked position or alerts disabled)`));
          }
        }
      }
    }

  } catch (error) {
    console.error(chalk.red(`Error checking whale ${whale.name}:`), error.message);
  }
}
