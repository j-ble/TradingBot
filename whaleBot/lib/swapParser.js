import chalk from 'chalk';

// ==================== SWAP TRANSACTION PARSING ====================

const SOL_MINT = 'So11111111111111111111111111111111111111112';

export function parseSwapTransaction(tx, signature, debug = false) {
  // Parse Solana transaction to detect token swaps (both BUYs and SELLs)
  try {
    if (!tx || !tx.transaction || !tx.meta) {
      if (debug) console.log(chalk.dim('    Debug: Missing tx structure'));
      return [];
    }

    // Extract token changes from post/pre token balances
    const postTokenBalances = tx.meta.postTokenBalances || [];
    const preTokenBalances = tx.meta.preTokenBalances || [];

    if (debug) {
      console.log(chalk.dim(`    Debug: Post token balances: ${postTokenBalances.length}, Pre: ${preTokenBalances.length}`));
    }

    const swaps = [];
    const timestamp = tx.blockTime || Date.now() / 1000;

    // Calculate SOL spent/received by checking SOL balance changes
    let solSpent = 0;
    let solReceived = 0;

    for (const postBalance of postTokenBalances) {
      if (postBalance.mint === SOL_MINT) {
        const preBalance = preTokenBalances.find(pre =>
          pre.accountIndex === postBalance.accountIndex
        );
        const preSolAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
        const postSolAmount = postBalance?.uiTokenAmount?.uiAmount || 0;

        // If SOL decreased, this is the amount spent (BUY)
        if (preSolAmount > postSolAmount) {
          solSpent = preSolAmount - postSolAmount;
          if (debug) {
            console.log(chalk.dim(`    SOL spent: ${solSpent.toFixed(4)} SOL`));
          }
        }
        // If SOL increased, this is the amount received (SELL)
        else if (postSolAmount > preSolAmount) {
          solReceived = postSolAmount - preSolAmount;
          if (debug) {
            console.log(chalk.dim(`    SOL received: ${solReceived.toFixed(4)} SOL`));
          }
        }
      }
    }

    // Check all token balance changes
    for (const postBalance of postTokenBalances) {
      // Skip SOL balances (handled separately above)
      if (postBalance.mint === SOL_MINT) continue;

      const preBalance = preTokenBalances.find(pre =>
        pre.accountIndex === postBalance.accountIndex
      );

      const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
      const postAmount = postBalance?.uiTokenAmount?.uiAmount || 0;
      const change = postAmount - preAmount;

      if (debug && postBalance.mint !== SOL_MINT) {
        console.log(chalk.dim(`    Token ${postBalance.mint?.slice(0, 8)}: ${preAmount} → ${postAmount} (${change > 0 ? '+' : ''}${change.toFixed(4)})`));
      }

      // BUY: Token balance increased significantly
      if (change > 0.001 && postBalance.mint) {
        swaps.push({
          isSwap: true,
          direction: 'BUY',
          tokenMint: postBalance.mint,
          amount: change,
          solSpent: solSpent,
          timestamp: timestamp,
          signature: signature
        });
      }

      // SELL: Token balance decreased significantly
      else if (change < -0.001 && postBalance.mint) {
        swaps.push({
          isSwap: true,
          direction: 'SELL',
          tokenMint: postBalance.mint,
          amount: Math.abs(change),
          solReceived: solReceived,
          timestamp: timestamp,
          signature: signature
        });
      }
    }

    if (debug && swaps.length === 0) {
      console.log(chalk.dim('    Debug: No token balance changes found'));
    }

    return swaps;
  } catch (error) {
    if (debug) console.log(chalk.dim(`    Debug: Error - ${error.message}`));
    return [];
  }
}

export function filterMultiHopSwaps(swaps, debug = false) {
  // Identify tokens that were both bought AND sold in the same transaction (intermediate tokens)
  const boughtTokens = new Set(swaps.filter(s => s.direction === 'BUY').map(s => s.tokenMint));
  const soldTokens = new Set(swaps.filter(s => s.direction === 'SELL').map(s => s.tokenMint));
  const intermediateTokens = new Set([...boughtTokens].filter(token => soldTokens.has(token)));

  if (intermediateTokens.size > 0 && debug) {
    console.log(chalk.magenta(`  Multi-hop swap detected - ${intermediateTokens.size} intermediate token(s)`));
    intermediateTokens.forEach(token => {
      console.log(chalk.dim(`    Intermediate: ${token.slice(0, 8)}...`));
    });
  }

  // Filter swaps: Remove intermediate token SELLs and BUYs, keep only final tokens
  const filteredSwaps = swaps.filter(swap => {
    // If this is a SELL of an intermediate token, skip it (it's just routing)
    if (swap.direction === 'SELL' && intermediateTokens.has(swap.tokenMint)) {
      if (debug) {
        console.log(chalk.dim(`    Skipping intermediate SELL: ${swap.tokenMint.slice(0, 8)}...`));
      }
      return false;
    }

    // If this is a BUY of an intermediate token, skip it (it's just routing)
    if (swap.direction === 'BUY' && intermediateTokens.has(swap.tokenMint)) {
      if (debug) {
        console.log(chalk.dim(`    Skipping intermediate BUY: ${swap.tokenMint.slice(0, 8)}...`));
      }
      return false;
    }

    return true;
  });

  if (debug) {
    console.log(chalk.cyan(`  Processing ${filteredSwaps.length}/${swaps.length} swaps (filtered out ${swaps.length - filteredSwaps.length} intermediate)`));
  }

  return filteredSwaps;
}
