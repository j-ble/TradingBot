import chalk from 'chalk';
import fs from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==================== POSITION MANAGEMENT ====================

export function openPosition(whalePositions, whale, tokenMint, amount, solSpent, tokenDetails, timestamp, signature, config) {
  const positionKey = `${whale.address}:${tokenMint}`;

  const existing = whalePositions.get(positionKey);

  if (existing) {
    // Adding to existing position
    const oldAmount = existing.currentAmount;
    const oldSolSpent = existing.entrySOLSpent;

    existing.currentAmount += amount;
    existing.entrySOLSpent += solSpent;

    if (config.debug?.enable_verbose_logging) {
      console.log(chalk.yellow(`  [${whale.name}] Position increase: ${oldAmount.toFixed(2)} → ${existing.currentAmount.toFixed(2)} tokens (+${solSpent.toFixed(4)} SOL)`));
    }

    return { type: 'INCREASE', position: existing };
  } else {
    // New position
    const newPosition = {
      walletAddress: whale.address,
      walletName: whale.name,
      tokenMint: tokenMint,
      entryAmount: amount,
      entryTimestamp: timestamp,
      entrySOLSpent: solSpent,
      currentAmount: amount,
      tokenSymbol: tokenDetails?.symbol || 'UNKNOWN',
      tokenName: tokenDetails?.name || 'Unknown Token',
      entrySignature: signature
    };

    whalePositions.set(positionKey, newPosition);

    if (config.debug?.enable_verbose_logging) {
      console.log(chalk.green(`  [${whale.name}] New position opened: ${amount.toFixed(2)} tokens for ${solSpent.toFixed(4)} SOL`));
    }

    return { type: 'NEW', position: newPosition };
  }
}

export function closePosition(whalePositions, whale, tokenMint, amountSold, solReceived, timestamp, exitSignature, config) {
  const positionKey = `${whale.address}:${tokenMint}`;
  const position = whalePositions.get(positionKey);

  if (!position) {
    // No tracked position (might have been bought before tracker started)
    if (config.debug?.enable_verbose_logging) {
      console.log(chalk.yellow(`  [${whale.name}] Sell detected but no position tracked (may predate tracker)`));
    }
    return null;
  }

  // Calculate metrics
  const holdingTimeSeconds = timestamp - position.entryTimestamp;
  const percentSold = (amountSold / position.currentAmount) * 100;

  // Calculate P&L
  const avgEntryPriceSOL = position.entrySOLSpent / position.currentAmount;
  const avgExitPriceSOL = amountSold > 0 ? solReceived / amountSold : 0;
  const profitLossSOL = solReceived - (avgEntryPriceSOL * amountSold);
  const profitLossPercent = avgEntryPriceSOL > 0 ? ((avgExitPriceSOL - avgEntryPriceSOL) / avgEntryPriceSOL) * 100 : 0;

  // Update or close position
  if (amountSold >= position.currentAmount * 0.99) {
    // Full exit (99%+ sold)
    whalePositions.delete(positionKey);

    if (config.debug?.enable_verbose_logging) {
      console.log(chalk.red(`  [${whale.name}] Position closed: ${profitLossPercent > 0 ? 'PROFIT' : 'LOSS'} ${profitLossPercent.toFixed(2)}%`));
    }

    return {
      ...position,
      exitType: 'FULL',
      amountSold: amountSold,
      solReceived: solReceived,
      holdingTimeSeconds: holdingTimeSeconds,
      profitLossSOL: profitLossSOL,
      profitLossPercent: profitLossPercent,
      avgEntryPriceSOL: avgEntryPriceSOL,
      avgExitPriceSOL: avgExitPriceSOL,
      exitSignature: exitSignature,
      timestamp: timestamp
    };
  } else {
    // Partial exit
    const oldAmount = position.currentAmount;
    position.currentAmount -= amountSold;

    // Adjust the remaining SOL spent proportionally
    const solSpentOnSold = avgEntryPriceSOL * amountSold;
    position.entrySOLSpent -= solSpentOnSold;

    if (config.debug?.enable_verbose_logging) {
      console.log(chalk.yellow(`  [${whale.name}] Partial exit: ${oldAmount.toFixed(2)} → ${position.currentAmount.toFixed(2)} tokens (${percentSold.toFixed(1)}% sold)`));
    }

    return {
      ...position,
      exitType: 'PARTIAL',
      amountSold: amountSold,
      solReceived: solReceived,
      percentSold: percentSold,
      holdingTimeSeconds: holdingTimeSeconds,
      profitLossSOL: profitLossSOL,
      profitLossPercent: profitLossPercent,
      avgEntryPriceSOL: avgEntryPriceSOL,
      avgExitPriceSOL: avgExitPriceSOL,
      exitSignature: exitSignature,
      timestamp: timestamp
    };
  }
}

export async function savePositions(whalePositions, config) {
  try {
    // Convert Map to array for JSON serialization
    const positionsArray = Array.from(whalePositions.entries()).map(([key, value]) => ({
      key,
      ...value
    }));

    await fs.writeFile(
      join(__dirname, '..', 'positions.json'),
      JSON.stringify(positionsArray, null, 2),
      'utf-8'
    );

    if (config.debug?.enable_verbose_logging) {
      console.log(chalk.dim(`  Saved ${positionsArray.length} positions to positions.json`));
    }
  } catch (error) {
    console.error(chalk.red('Error saving positions:'), error.message);
  }
}

export async function loadPositions(whalePositions) {
  try {
    const data = await fs.readFile(join(__dirname, '..', 'positions.json'), 'utf-8');
    const positionsArray = JSON.parse(data);

    // Convert array back to Map
    for (const position of positionsArray) {
      const { key, ...positionData } = position;
      whalePositions.set(key, positionData);
    }

    console.log(chalk.green(`✓ Loaded ${whalePositions.size} existing positions`));
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet - this is fine on first run
      console.log(chalk.dim('  No existing positions file found - starting fresh'));
    } else {
      console.error(chalk.yellow('Warning: Could not load positions:'), error.message);
    }
  }
}
