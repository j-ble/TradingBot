#!/usr/bin/env node

import chalk from 'chalk';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import API clients
import { HeliusAPI } from './lib/api/helius.js';
import { DexScreenerAPI } from './lib/api/dexscreener.js';

// Import utilities
import { sleep } from './lib/utils.js';

// Import modules
import { displayBanner } from './lib/display.js';
import { loadPositions, savePositions } from './lib/positions.js';
import { checkWhaleWallet } from './lib/whaleTracker.js';

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==================== GLOBAL STATE ====================

let config;
let wallets;
const alertedTokens = new Map(); // Cache of tokens we've already alerted on
const processedSignatures = new Map(); // Cache of transaction signatures we've already processed
const whalePositions = new Map(); // Track open positions: "walletAddress:tokenMint" -> position object
let isFirstScan = true; // Flag to track if this is the initial scan

// ==================== CONFIGURATION ====================

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

const helius = new HeliusAPI();
const dexscreener = new DexScreenerAPI();

// ==================== MAIN SCANNER ====================

async function scanAllWhales() {
  const enabledWallets = wallets.solana.filter(w => w.enabled !== false);

  if (enabledWallets.length === 0) {
    console.log(chalk.yellow('\n⚠️  No enabled whale wallets found!'));
    console.log(chalk.yellow('   Add whale wallet addresses to wallets.json and set enabled: true\n'));
    return;
  }

  // Silent monitoring - only show timestamp
  if (isFirstScan) {
    console.log(chalk.yellow(`[${new Date().toLocaleTimeString()}] Initial scan - caching existing transactions...`));
  } else {
    console.log(chalk.dim(`[${new Date().toLocaleTimeString()}] Monitoring...`));
  }

  for (const whale of enabledWallets) {
    await checkWhaleWallet(
      whale,
      helius,
      dexscreener,
      config,
      alertedTokens,
      processedSignatures,
      whalePositions,
      isFirstScan
    );
    await sleep(2000); // Rate limiting between wallets
  }

  // After first complete scan, mark as no longer first scan
  if (isFirstScan) {
    isFirstScan = false;
    console.log(chalk.green(`✓ Initial scan complete - now monitoring for NEW transactions only\n`));
  }
}

// ==================== MAIN ====================

async function main() {
  console.log(chalk.bold.cyan('\n🚀 Starting Whale Wallet Tracker...\n'));

  // Load configuration
  await loadConfig();

  // Load existing positions
  await loadPositions(whalePositions);

  // Display banner
  displayBanner(config, wallets);

  // Validate API keys
  if (!process.env.HELIUS_API_KEY) {
    console.log(chalk.red('✗ No Helius API key found!'));
    console.log(chalk.yellow('   Please add HELIUS_API_KEY to your .env file'));
    console.log(chalk.yellow('   Get a free API key at: https://www.helius.dev/\n'));
    process.exit(1);
  }

  // Initial scan
  await scanAllWhales();

  // Set up scan interval
  setInterval(async () => {
    await scanAllWhales();
  }, config.scanner.interval_seconds * 1000);

  // Set up periodic position saving (every 5 minutes)
  setInterval(async () => {
    await savePositions(whalePositions, config);
  }, 5 * 60 * 1000);
}

// ==================== START ====================

main().catch(error => {
  console.error(chalk.red('\n✗ Fatal error:'), error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\n👋 Shutting down whale tracker...'));
  console.log(chalk.dim('  Saving positions...'));
  await savePositions(whalePositions, config);
  console.log(chalk.green('✓ Goodbye!\n'));
  process.exit(0);
});
