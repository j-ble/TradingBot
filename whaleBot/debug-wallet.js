#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

const WALLET = 'gtagyESa99t49VmUqnnfsuowYnigSNKuYXdXWyXWNdd';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Get recent transactions
async function getTransactions() {
  console.log(chalk.cyan('\n🔍 Fetching recent transactions for wallet:'));
  console.log(chalk.dim(`   ${WALLET}\n`));

  const response = await axios.post(RPC_URL, {
    jsonrpc: '2.0',
    id: 'debug',
    method: 'getSignaturesForAddress',
    params: [
      WALLET,
      {
        limit: 20,
        commitment: 'confirmed'
      }
    ]
  });

  const signatures = response.data.result || [];
  console.log(chalk.green(`✓ Found ${signatures.length} recent transactions\n`));

  return signatures;
}

// Get transaction details
async function getTransactionDetails(signature) {
  const response = await axios.post(RPC_URL, {
    jsonrpc: '2.0',
    id: 'debug',
    method: 'getTransaction',
    params: [
      signature,
      {
        encoding: 'jsonParsed',
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      }
    ]
  });

  return response.data.result;
}

// Parse for swaps (same logic as whale-tracker.js)
function parseSwapTransaction(tx) {
  if (!tx || !tx.transaction || !tx.meta) {
    return { isSwap: false, reason: 'Missing tx structure' };
  }

  const postTokenBalances = tx.meta.postTokenBalances || [];
  const preTokenBalances = tx.meta.preTokenBalances || [];
  const SOL_MINT = 'So11111111111111111111111111111111111111112';

  // Calculate SOL spent
  let solSpent = 0;
  for (const postBalance of postTokenBalances) {
    if (postBalance.mint === SOL_MINT) {
      const preBalance = preTokenBalances.find(pre =>
        pre.accountIndex === postBalance.accountIndex
      );
      const preSolAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
      const postSolAmount = postBalance?.uiTokenAmount?.uiAmount || 0;

      if (preSolAmount > postSolAmount) {
        solSpent = preSolAmount - postSolAmount;
      }
    }
  }

  // Find token purchases (balance increases)
  for (const postBalance of postTokenBalances) {
    if (postBalance.mint === SOL_MINT) continue;

    const preBalance = preTokenBalances.find(pre =>
      pre.accountIndex === postBalance.accountIndex
    );

    const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
    const postAmount = postBalance?.uiTokenAmount?.uiAmount || 0;

    if (postAmount > preAmount + 0.001 && postBalance.mint) {
      return {
        isSwap: true,
        tokenMint: postBalance.mint,
        amount: postAmount - preAmount,
        solSpent: solSpent,
        timestamp: tx.blockTime || Date.now() / 1000,
        preAmount,
        postAmount
      };
    }
  }

  return { isSwap: false, reason: 'No token balance increases found', solSpent };
}

// Main debug function
async function debug() {
  try {
    if (!HELIUS_API_KEY) {
      console.log(chalk.red('✗ HELIUS_API_KEY not found in .env'));
      process.exit(1);
    }

    const signatures = await getTransactions();

    let foundLargeSwaps = [];

    for (let i = 0; i < signatures.length; i++) {
      const sig = signatures[i];
      const timeAgo = Math.floor((Date.now() / 1000) - sig.blockTime);
      const timeStr = timeAgo < 60 ? `${timeAgo}s ago` :
                      timeAgo < 3600 ? `${Math.floor(timeAgo / 60)}m ago` :
                      timeAgo < 86400 ? `${Math.floor(timeAgo / 3600)}h ago` :
                      `${Math.floor(timeAgo / 86400)}d ago`;

      console.log(chalk.bold(`\n📝 Transaction #${i + 1} (${timeStr})`));
      console.log(chalk.dim(`   Signature: ${sig.signature.slice(0, 20)}...`));
      console.log(chalk.dim(`   Slot: ${sig.slot}`));

      // Fetch full details
      const txDetails = await getTransactionDetails(sig.signature);

      if (!txDetails) {
        console.log(chalk.red('   ✗ Failed to fetch transaction details'));
        continue;
      }

      // Parse for swap
      const swap = parseSwapTransaction(txDetails);

      if (swap.isSwap) {
        console.log(chalk.green('   ✓ SWAP DETECTED!'));
        console.log(chalk.yellow(`   Token: ${swap.tokenMint.slice(0, 20)}...`));
        console.log(chalk.white(`   SOL Spent: ${swap.solSpent.toFixed(4)} SOL`));
        console.log(chalk.white(`   Token Amount: ${swap.amount.toFixed(2)}`));
        console.log(chalk.dim(`   Pre: ${swap.preAmount} → Post: ${swap.postAmount}`));

        // Track large swaps
        if (swap.solSpent >= 5.0) {
          foundLargeSwaps.push({
            index: i + 1,
            solSpent: swap.solSpent,
            tokenMint: swap.tokenMint,
            timeAgo: timeStr,
            signature: sig.signature
          });
          console.log(chalk.bold.green(`   🔥 LARGE SWAP! ${swap.solSpent.toFixed(4)} SOL`));
        }

        // Check against min_sol_amount threshold
        if (swap.solSpent < 0.05) {
          console.log(chalk.red(`   ✗ FILTERED: SOL amount ${swap.solSpent.toFixed(4)} < 0.05 minimum`));
        } else {
          console.log(chalk.green(`   ✓ Passes min_sol_amount threshold (${swap.solSpent.toFixed(4)} >= 0.05)`));
        }
      } else {
        console.log(chalk.dim(`   ⊗ Not a swap: ${swap.reason}`));
        if (swap.solSpent > 0) {
          console.log(chalk.dim(`   SOL spent: ${swap.solSpent.toFixed(4)} (but no token bought)`));
        }
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(chalk.cyan('\n' + '─'.repeat(70)));

    // Summary of large swaps
    if (foundLargeSwaps.length > 0) {
      console.log(chalk.bold.green(`\n🔥 Found ${foundLargeSwaps.length} LARGE SWAPS (>= 5 SOL):\n`));
      foundLargeSwaps.forEach(swap => {
        console.log(chalk.white(`   #${swap.index}: ${swap.solSpent.toFixed(4)} SOL (${swap.timeAgo})`));
        console.log(chalk.dim(`   Token: ${swap.tokenMint}`));
        console.log(chalk.dim(`   Sig: ${swap.signature.slice(0, 30)}...\n`));
      });
    } else {
      console.log(chalk.yellow('\n⚠️  No large swaps (>= 5 SOL) found in last 20 transactions'));
    }

    console.log(chalk.bold.white('\n💡 Analysis:'));
    console.log('If you are looking for a 9.77 SOL transaction:');
    console.log('  - Check the large swaps list above');
    console.log('  - If not found, it may be:');
    console.log('    • Older than the last 20 transactions');
    console.log('    • A token SELL (balance decrease, not increase)');
    console.log('    • A transfer/stake (not a DEX swap)');
    console.log('    • Split across multiple transactions\n');

  } catch (error) {
    console.error(chalk.red('\n✗ Error:'), error.message);
    if (error.response?.data) {
      console.error(chalk.dim(JSON.stringify(error.response.data, null, 2)));
    }
  }
}

debug();
