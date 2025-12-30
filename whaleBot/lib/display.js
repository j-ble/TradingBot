import chalk from 'chalk';
import { formatNumber, formatAddress, getTimeAgo, formatHoldingTime, calculateTokenAge } from './utils.js';

// ==================== COLOR HELPERS ====================

export function getLiquidityColor(liquidity) {
  if (liquidity >= 200000) return chalk.green;
  if (liquidity >= 100000) return chalk.yellow;
  return chalk.red;
}

export function getPriceChangeColor(change) {
  if (change > 0) return chalk.green;
  if (change < 0) return chalk.red;
  return chalk.white;
}

export function getRiskScoreColor(score) {
  if (score >= 8) return chalk.green.bold;
  if (score >= 6) return chalk.yellow.bold;
  if (score >= 4) return chalk.orange.bold;
  return chalk.red.bold;
}

export function getRiskLevel(score) {
  if (score >= 8) return chalk.green('(Low Risk)');
  if (score >= 6) return chalk.yellow('(Medium Risk)');
  if (score >= 4) return chalk.orange('(High Risk)');
  return chalk.red('(Very High Risk)');
}

// ==================== DISPLAY FUNCTIONS ====================

export function displayBanner(config, wallets) {
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

export function displayBasicWhaleAlert(whale, swap) {
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
  if (swap.signature) {
    console.log(`   Transaction: ${chalk.blue('https://solscan.io/tx/' + swap.signature)}`);
  }

  console.log(chalk.yellow('\n' + '━'.repeat(70) + '\n'));
}

export function displayWhaleAlert(whale, token, swap, riskScore, config) {
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
  if (swap.signature) {
    console.log(`   Buy Transaction: ${chalk.blue('https://solscan.io/tx/' + swap.signature)}`);
  }

  console.log(chalk.cyan('\n' + '━'.repeat(70) + '\n'));
}

export function displayWhaleSellAlert(whale, token, exitInfo, config) {
  const isProfitable = exitInfo.profitLossPercent > 0;
  const headerColor = isProfitable ? chalk.bold.bgGreen.black : chalk.bold.bgRed.white;
  const borderColor = isProfitable ? chalk.green : chalk.red;

  console.log('\n' + headerColor(' 🐋 WHALE SELL ALERT '));
  console.log(borderColor('━'.repeat(70)));

  console.log(chalk.bold.white(`\n🔔 ${whale.name}`) + chalk.dim(` (${formatAddress(whale.address)})`));

  const holdingTime = formatHoldingTime(exitInfo.holdingTimeSeconds);

  const exitTypeEmoji = exitInfo.exitType === 'FULL' ? '📤' : '📊';
  const exitTypeColor = exitInfo.exitType === 'FULL' ? chalk.red : chalk.yellow;

  console.log(exitTypeColor(`\n${exitTypeEmoji} ${exitInfo.exitType} POSITION EXIT`));
  console.log(chalk.dim(`   Transaction: ${getTimeAgo(exitInfo.timestamp || Date.now() / 1000)}`));
  console.log(chalk.dim(`   Holding Time: ${chalk.bold(holdingTime)}`));

  if (exitInfo.exitType === 'PARTIAL') {
    console.log(chalk.yellow(`   Amount Sold: ${exitInfo.percentSold.toFixed(1)}% of position`));
    console.log(chalk.dim(`   Remaining: ${exitInfo.currentAmount.toFixed(2)} tokens`));
  }

  console.log(chalk.bold.yellow(`\n📊 ${exitInfo.tokenName} (${exitInfo.tokenSymbol})`));
  console.log(chalk.dim(`   Token: ${formatAddress(exitInfo.tokenMint, config.display.show_full_addresses)}`));

  // P&L Section
  const plColor = isProfitable ? chalk.green : chalk.red;
  const plSymbol = isProfitable ? '+' : '';

  console.log(chalk.white('\n💰 Trade Performance:'));
  console.log(`   Entry Price: ${chalk.cyan(exitInfo.avgEntryPriceSOL.toFixed(8) + ' SOL/token')}`);
  console.log(`   Exit Price: ${chalk.cyan(exitInfo.avgExitPriceSOL.toFixed(8) + ' SOL/token')}`);
  console.log(`   SOL Received: ${chalk.bold.white(exitInfo.solReceived.toFixed(4) + ' SOL')}`);
  console.log(`   P&L (SOL): ${plColor(plSymbol + exitInfo.profitLossSOL.toFixed(4) + ' SOL')}`);
  console.log(`   P&L (%): ${plColor.bold(plSymbol + exitInfo.profitLossPercent.toFixed(2) + '%')}`);

  // Token details if available
  if (token) {
    console.log(chalk.white('\n📈 Current Token Metrics:'));
    console.log(`   Price: ${chalk.green('$' + token.priceUsd.toFixed(8))}`);
    console.log(`   Liquidity: ${getLiquidityColor(token.liquidityUsd)('$' + formatNumber(token.liquidityUsd))}`);
    console.log(`   24h Volume: ${chalk.blue('$' + formatNumber(token.volume24h))}`);
    console.log(`   24h Change: ${getPriceChangeColor(token.priceChange24h)(token.priceChange24h.toFixed(2) + '%')}`);
  }

  console.log(chalk.white('\n🔗 Links:'));
  if (token && token.url) {
    console.log(`   DexScreener: ${chalk.blue(token.url)}`);
  }
  console.log(`   Token: ${chalk.blue('https://solscan.io/token/' + exitInfo.tokenMint)}`);
  console.log(`   Wallet: ${chalk.blue('https://solscan.io/account/' + whale.address)}`);
  if (exitInfo.entrySignature) {
    console.log(`   Buy Transaction: ${chalk.blue('https://solscan.io/tx/' + exitInfo.entrySignature)}`);
  }
  if (exitInfo.exitSignature) {
    console.log(`   Sell Transaction: ${chalk.blue('https://solscan.io/tx/' + exitInfo.exitSignature)}`);
  }

  console.log(borderColor('\n' + '━'.repeat(70) + '\n'));
}
