#!/usr/bin/env node

import axios from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==================== CONFIGURATION ====================

let config;
let wallets;
const alertedTokens = new Map(); // Cache of tokens we've already alerted on
const processedSignatures = new Map(); // Cache of transaction signatures we've already processed (sig -> timestamp)

async function loadConfig() {
  try {
    const configData = await fs.readFile(join(__dirname, 'config.json'), 'utf-8');
    config = JSON.parse(configData);

    const walletsData = await fs.readFile(join(__dirname, 'wallets.json'), 'utf-8');
    wallets = JSON.parse(walletsData);

    console.log(chalk.green('✓ Configuration loaded successfully'));
  } catch (error) {
    console.error(chalk.red('✗ Failed to load configuration:'), error.message);
    process.exit(1);
  }
}

// ==================== API CLIENTS ====================

class HeliusAPI {
  constructor() {
    this.apiKey = process.env.HELIUS_API_KEY;
    this.rpcURL = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
  }

  async getWalletTransactions(walletAddress, limit = 10) {
    try {
      if (!this.apiKey) {
        console.log(chalk.yellow('⚠️  Helius API key required'));
        return [];
      }

      // Use Helius enhanced transactions API with 'confirmed' commitment for faster updates
      const response = await axios.post(this.rpcURL, {
        jsonrpc: '2.0',
        id: 'whale-tracker',
        method: 'getSignaturesForAddress',
        params: [
          walletAddress,
          {
            limit: limit,
            commitment: 'confirmed'  // Get confirmed transactions (faster than finalized)
          }
        ]
      });

      if (response.data && response.data.result) {
        return response.data.result;
      }

      return [];
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(chalk.yellow('⚠️  Rate limited by Helius - waiting 60s...'));
        await sleep(60000);
        return [];
      }
      console.log(chalk.dim(`  Error fetching transactions: ${error.message}`));
      return [];
    }
  }

  async getTransactionDetails(signature) {
    try {
      if (!this.apiKey) {
        return null;
      }

      // Use Helius enhanced transaction API for parsed data with confirmed commitment
      const response = await axios.post(this.rpcURL, {
        jsonrpc: '2.0',
        id: 'whale-tracker',
        method: 'getTransaction',
        params: [
          signature,
          {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'  // Match commitment level with getSignaturesForAddress
          }
        ]
      });

      if (response.data && response.data.result) {
        return response.data.result;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async getTokenAccountInfo(walletAddress) {
    try {
      if (!this.apiKey) {
        return [];
      }

      const response = await axios.post(this.rpcURL, {
        jsonrpc: '2.0',
        id: 'whale-tracker',
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          {
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
          },
          {
            encoding: 'jsonParsed'
          }
        ]
      });

      if (response.data && response.data.result && response.data.result.value) {
        return response.data.result.value;
      }

      return [];
    } catch (error) {
      return [];
    }
  }
}

class DexScreenerAPI {
  constructor() {
    this.baseURL = 'https://api.dexscreener.com/latest';
  }

  async getTokenPairs(chainId, tokenAddress) {
    try {
      const response = await axios.get(
        `${this.baseURL}/dex/tokens/${chainId}/${tokenAddress}`
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(chalk.yellow('⚠️  Rate limited by DexScreener - waiting 20s...'));
        await sleep(20000);
        return null;
      }
      return null;
    }
  }

  async searchToken(query) {
    try {
      const response = await axios.get(
        `${this.baseURL}/dex/search`,
        { params: { q: query } }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }
}

const helius = new HeliusAPI();
const dexscreener = new DexScreenerAPI();

// ==================== UTILITY FUNCTIONS ====================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatNumber(num, decimals = 2) {
  if (!num) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(decimals)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(decimals)}k`;
  return num.toFixed(decimals);
}

function formatAddress(address, showFull = false) {
  if (showFull) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() / 1000) - timestamp);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ==================== TOKEN DETECTION ====================

function parseSwapTransaction(tx, debug = false) {
  // Parse Solana transaction to detect token swaps
  try {
    if (!tx || !tx.transaction || !tx.meta) {
      if (debug) console.log(chalk.dim('    Debug: Missing tx structure'));
      return { isSwap: false };
    }

    // Extract token changes from post/pre token balances
    const postTokenBalances = tx.meta.postTokenBalances || [];
    const preTokenBalances = tx.meta.preTokenBalances || [];

    if (debug) {
      console.log(chalk.dim(`    Debug: Post token balances: ${postTokenBalances.length}, Pre: ${preTokenBalances.length}`));
    }

    // Find tokens that increased (likely tokens bought)
    // Skip SOL (So11111111111111111111111111111111111111112) to avoid noise
    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    // Calculate SOL spent by checking SOL balance decrease
    let solSpent = 0;
    for (const postBalance of postTokenBalances) {
      if (postBalance.mint === SOL_MINT) {
        const preBalance = preTokenBalances.find(pre =>
          pre.accountIndex === postBalance.accountIndex
        );
        const preSolAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
        const postSolAmount = postBalance?.uiTokenAmount?.uiAmount || 0;

        // If SOL decreased, this is the amount spent
        if (preSolAmount > postSolAmount) {
          solSpent = preSolAmount - postSolAmount;
          if (debug) {
            console.log(chalk.dim(`    SOL spent: ${solSpent.toFixed(4)} SOL`));
          }
        }
      }
    }

    for (const postBalance of postTokenBalances) {
      // Skip SOL balances (too much noise from transaction fees, etc.)
      if (postBalance.mint === SOL_MINT) continue;

      const preBalance = preTokenBalances.find(pre =>
        pre.accountIndex === postBalance.accountIndex
      );

      const preAmount = preBalance?.uiTokenAmount?.uiAmount || 0;
      const postAmount = postBalance?.uiTokenAmount?.uiAmount || 0;

      if (debug && postBalance.mint !== SOL_MINT) {
        console.log(chalk.dim(`    Token ${postBalance.mint?.slice(0, 8)}: ${preAmount} → ${postAmount}`));
      }

      // If token balance increased significantly, this is likely a buy
      // Require at least 0.001 token increase to filter out dust/rounding errors
      if (postAmount > preAmount + 0.001 && postBalance.mint) {
        return {
          isSwap: true,
          tokenMint: postBalance.mint,
          amount: postAmount - preAmount,
          solSpent: solSpent,
          timestamp: tx.blockTime || Date.now() / 1000
        };
      }
    }

    if (debug) console.log(chalk.dim('    Debug: No token balance increases found'));
    return { isSwap: false };
  } catch (error) {
    if (debug) console.log(chalk.dim(`    Debug: Error - ${error.message}`));
    return { isSwap: false };
  }
}

async function getTokenDetails(tokenAddress) {
  try {
    const data = await dexscreener.getTokenPairs('solana', tokenAddress);

    if (!data || !data.pairs || data.pairs.length === 0) {
      return null;
    }

    // Get the pair with highest liquidity
    const bestPair = data.pairs.sort((a, b) =>
      (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];

    return {
      address: tokenAddress,
      symbol: bestPair.baseToken.symbol,
      name: bestPair.baseToken.name,
      priceUsd: parseFloat(bestPair.priceUsd || 0),
      liquidityUsd: bestPair.liquidity?.usd || 0,
      volume24h: bestPair.volume?.h24 || 0,
      priceChange24h: bestPair.priceChange?.h24 || 0,
      pairAddress: bestPair.pairAddress,
      dexId: bestPair.dexId,
      pairCreatedAt: bestPair.pairCreatedAt,
      txns24h: bestPair.txns?.h24 || {},
      fdv: bestPair.fdv || 0,
      marketCap: bestPair.marketCap || 0,
      url: bestPair.url
    };
  } catch (error) {
    console.error(chalk.red('Error fetching token details:'), error.message);
    return null;
  }
}

function calculateTokenAge(pairCreatedAt) {
  if (!pairCreatedAt) return null;

  const ageMs = Date.now() - pairCreatedAt;
  const ageMinutes = ageMs / (1000 * 60);
  const ageHours = ageMinutes / 60;

  return { ageMinutes, ageHours };
}

function calculateRiskScore(tokenDetails) {
  let score = 10;

  if (!tokenDetails) return 0;

  // Liquidity score (max -4 points)
  if (tokenDetails.liquidityUsd < 50000) score -= 4;
  else if (tokenDetails.liquidityUsd < 100000) score -= 2;
  else if (tokenDetails.liquidityUsd < 200000) score -= 1;

  // Age score (max -3 points)
  const age = calculateTokenAge(tokenDetails.pairCreatedAt);
  if (age) {
    if (age.ageMinutes < 30) score -= 3;
    else if (age.ageHours < 2) score -= 2;
    else if (age.ageHours < 6) score -= 1;
  }

  // Volume score (max -2 points)
  if (tokenDetails.volume24h < 10000) score -= 2;
  else if (tokenDetails.volume24h < 50000) score -= 1;

  // Buy/sell ratio score (max -1 point)
  const txns = tokenDetails.txns24h;
  if (txns.buys && txns.sells) {
    const buyRatio = txns.buys / (txns.buys + txns.sells);
    if (buyRatio > 0.9 || buyRatio < 0.4) score -= 1; // Too skewed
  }

  return Math.max(0, Math.min(10, score));
}

// ==================== WHALE TRACKING ====================

async function checkWhaleWallet(whale) {
  try {
    // Get recent transaction signatures
    const signatures = await helius.getWalletTransactions(
      whale.address,
      config.scanner.transaction_lookback_count
    );

    if (!signatures || signatures.length === 0) {
      return;
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

      // Parse transaction for token swaps
      const swap = parseSwapTransaction(txDetails, config.debug?.enable_verbose_logging || false);

      if (!swap.isSwap || !swap.tokenMint) {
        // Debug: Log non-swap transactions if verbose mode enabled
        if (config.debug?.enable_verbose_logging && swap.solSpent > 0) {
          console.log(chalk.dim(`  [${whale.name}] Not a swap - SOL: ${swap.solSpent.toFixed(4)}, Reason: No token balance increase`));
        }
        continue;
      }

      // Debug: Log detected swaps
      if (config.debug?.enable_verbose_logging) {
        console.log(chalk.yellow(`  [${whale.name}] SWAP DETECTED - ${swap.solSpent.toFixed(4)} SOL → Token: ${swap.tokenMint.slice(0, 8)}...`));
      }

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
      const tokenDetails = await getTokenDetails(swap.tokenMint);

      if (!tokenDetails) {
        // No DexScreener data - show basic alert anyway
        if (config.debug?.enable_verbose_logging) {
          console.log(chalk.red(`  [${whale.name}] No DexScreener data for token ${swap.tokenMint.slice(0, 8)}... - showing basic alert`));
        }
        displayBasicWhaleAlert(whale, swap);

        // Cache this alert
        const cacheKey = `${whale.address}:${swap.tokenMint}`;
        alertedTokens.set(cacheKey, Date.now());
        cleanAlertCache();
        await sleep(2000);
        continue;
      }

      // Apply safety filters
      if (!passesFilters(tokenDetails)) {
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

      // WHALE ALERT!
      displayWhaleAlert(whale, tokenDetails, swap, riskScore);

      // Cache this alert
      alertedTokens.set(cacheKey, Date.now());

      // Clean old cache entries
      cleanAlertCache();

      // Rate limiting pause
      await sleep(2000);
    }

  } catch (error) {
    console.error(chalk.red(`Error checking whale ${whale.name}:`), error.message);
  }
}

function passesFilters(tokenDetails) {
  const { safety_thresholds } = config;

  // Liquidity check
  if (tokenDetails.liquidityUsd < safety_thresholds.min_liquidity_usd) {
    return false;
  }

  // Token age check
  const age = calculateTokenAge(tokenDetails.pairCreatedAt);
  if (age) {
    if (age.ageMinutes < safety_thresholds.min_token_age_minutes) {
      return false;
    }
    if (age.ageHours > safety_thresholds.max_token_age_hours) {
      return false;
    }
  }

  // Minimum buy amount check (if we can determine it)
  // This is simplified - would need more accurate swap amount parsing

  return true;
}

function cleanAlertCache() {
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

// ==================== DISPLAY ====================

function displayBasicWhaleAlert(whale, swap) {
  console.log('\n' + chalk.bold.bgYellow.black(' 🐋 WHALE ALERT (Limited Data) '));
  console.log(chalk.yellow('━'.repeat(70)));

  console.log(chalk.bold.white(`\n🔔 ${whale.name}`) + chalk.dim(` (${formatAddress(whale.address)})`));

  console.log(chalk.green('\n🆕 NEW TOKEN PURCHASE'));
  console.log(chalk.dim(`   Transaction: ${getTimeAgo(swap.timestamp)}`));
  console.log(chalk.bold.white(`   Swap Size: ${swap.solSpent.toFixed(4)} SOL`));
  console.log(chalk.yellow(`   Token Amount: ${swap.amount.toFixed(2)}`));

  console.log(chalk.bold.yellow(`\n📊 Token Address:`));
  console.log(chalk.dim(`   ${swap.tokenMint}`));

  console.log(chalk.red('\n⚠️  No DexScreener Data Available'));
  console.log(chalk.dim('   This token may be:'));
  console.log(chalk.dim('   • Too new (not indexed yet)'));
  console.log(chalk.dim('   • Not traded on major DEXs'));
  console.log(chalk.dim('   • A private/unlisted token'));

  console.log(chalk.white('\n🔗 Links:'));
  console.log(`   Token: ${chalk.blue('https://solscan.io/token/' + swap.tokenMint)}`);
  console.log(`   Wallet: ${chalk.blue('https://solscan.io/account/' + whale.address)}`);

  console.log(chalk.yellow('\n' + '━'.repeat(70) + '\n'));
}

function displayWhaleAlert(whale, token, swap, riskScore) {
  console.log('\n' + chalk.bold.bgCyan.black(' 🐋 WHALE ALERT '));
  console.log(chalk.cyan('━'.repeat(70)));

  console.log(chalk.bold.white(`\n🔔 ${whale.name}`) + chalk.dim(` (${formatAddress(whale.address)})`));

  const age = calculateTokenAge(token.pairCreatedAt);
  const ageStr = age
    ? age.ageHours < 1
      ? `${Math.floor(age.ageMinutes)} minutes`
      : `${age.ageHours.toFixed(1)} hours`
    : 'unknown';

  console.log(chalk.green('\n🆕 NEW TOKEN PURCHASE'));
  console.log(chalk.dim(`   Transaction: ${getTimeAgo(swap.timestamp)}`));
  console.log(chalk.bold.white(`   Swap Size: ${swap.solSpent.toFixed(4)} SOL`));

  console.log(chalk.bold.yellow(`\n📊 ${token.name} (${token.symbol})`));
  console.log(chalk.dim(`   Token: ${formatAddress(token.address, config.display.show_full_addresses)}`));
  console.log(chalk.dim(`   Pair: ${token.dexId} - ${formatAddress(token.pairAddress)}`));

  console.log(chalk.white('\n💰 Token Metrics:'));
  console.log(`   Price: ${chalk.green('$' + token.priceUsd.toFixed(8))}`);
  console.log(`   Market Cap: ${chalk.yellow('$' + formatNumber(token.marketCap))}`);
  console.log(`   Liquidity: ${getLiquidityColor(token.liquidityUsd)('$' + formatNumber(token.liquidityUsd))}`);
  console.log(`   24h Volume: ${chalk.blue('$' + formatNumber(token.volume24h))}`);
  console.log(`   24h Change: ${getPriceChangeColor(token.priceChange24h)(token.priceChange24h.toFixed(2) + '%')}`);
  console.log(`   Token Age: ${chalk.magenta(ageStr)}`);

  if (token.txns24h.buys && token.txns24h.sells) {
    const total = token.txns24h.buys + token.txns24h.sells;
    const buyRatio = ((token.txns24h.buys / total) * 100).toFixed(1);
    const sellRatio = ((token.txns24h.sells / total) * 100).toFixed(1);
    console.log(`   Buy/Sell Ratio: ${chalk.green(buyRatio + '%')} / ${chalk.red(sellRatio + '%')}`);
  }

  // Risk score
  const scoreColor = getRiskScoreColor(riskScore);
  console.log(`\n⚠️  Risk Score: ${scoreColor(riskScore + '/10')} ${getRiskLevel(riskScore)}`);

  console.log(chalk.white('\n🔗 Links:'));
  console.log(`   DexScreener: ${chalk.blue(token.url)}`);
  console.log(`   Wallet: ${chalk.blue('https://solscan.io/account/' + whale.address)}`);

  console.log(chalk.cyan('\n' + '━'.repeat(70) + '\n'));
}

function getLiquidityColor(liquidity) {
  if (liquidity >= 200000) return chalk.green;
  if (liquidity >= 100000) return chalk.yellow;
  return chalk.red;
}

function getPriceChangeColor(change) {
  if (change > 0) return chalk.green;
  if (change < 0) return chalk.red;
  return chalk.white;
}

function getRiskScoreColor(score) {
  if (score >= 8) return chalk.green.bold;
  if (score >= 6) return chalk.yellow.bold;
  if (score >= 4) return chalk.orange.bold;
  return chalk.red.bold;
}

function getRiskLevel(score) {
  if (score >= 8) return chalk.green('(Low Risk)');
  if (score >= 6) return chalk.yellow('(Medium Risk)');
  if (score >= 4) return chalk.orange('(High Risk)');
  return chalk.red('(Very High Risk)');
}

function displayBanner() {
  if (!config.display.show_banner) return;

  console.clear();
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('           🐋 WHALE WALLET TRACKER - CONSOLE SCANNER 🐋        ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════════╝\n'));

  const enabledWallets = wallets.solana.filter(w => w.enabled !== false);
  console.log(chalk.white(`📡 Monitoring: ${chalk.bold(enabledWallets.length)} whale wallets`));
  console.log(chalk.white(`⏱️  Scan Interval: ${chalk.bold(config.scanner.interval_seconds + 's')}`));
  console.log(chalk.white(`🔒 Safety: Min liquidity $${chalk.bold(formatNumber(config.safety_thresholds.min_liquidity_usd))}, Min risk score ${chalk.bold(config.safety_thresholds.risk_score_min)}/10`));
  console.log(chalk.yellow(`\n💡 Quiet Mode: Only whale alerts will be displayed`));
  console.log(chalk.dim(`Press Ctrl+C to stop\n`));
}

// ==================== MAIN SCANNER ====================

async function scanAllWhales() {
  const enabledWallets = wallets.solana.filter(w => w.enabled !== false);

  if (enabledWallets.length === 0) {
    console.log(chalk.yellow('\n⚠️  No enabled whale wallets found!'));
    console.log(chalk.yellow('   Add whale wallet addresses to wallets.json and set enabled: true\n'));
    return;
  }

  // Silent monitoring - only show timestamp
  console.log(chalk.dim(`[${new Date().toLocaleTimeString()}] Monitoring...`));

  for (const whale of enabledWallets) {
    await checkWhaleWallet(whale);
    await sleep(2000); // Rate limiting between wallets
  }
}

async function main() {
  console.log(chalk.bold.cyan('\n🚀 Starting Whale Wallet Tracker...\n'));

  // Load configuration
  await loadConfig();

  // Display banner
  displayBanner();

  // Validate API keys
  if (!process.env.HELIUS_API_KEY) {
    console.log(chalk.red('✗ No Helius API key found!'));
    console.log(chalk.yellow('   Please add HELIUS_API_KEY to your .env file'));
    console.log(chalk.yellow('   Get a free API key at: https://www.helius.dev/\n'));
    process.exit(1);
  }

  // Initial scan
  await scanAllWhales();

  // Set up interval
  setInterval(async () => {
    await scanAllWhales();
  }, config.scanner.interval_seconds * 1000);
}

// ==================== START ====================

main().catch(error => {
  console.error(chalk.red('\n✗ Fatal error:'), error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down whale tracker...'));
  console.log(chalk.green('✓ Goodbye!\n'));
  process.exit(0);
});
