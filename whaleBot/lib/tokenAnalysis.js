import chalk from 'chalk';
import { calculateTokenAge } from './utils.js';

// ==================== TOKEN ANALYSIS ====================

export async function getTokenDetails(dexscreener, tokenAddress) {
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

export function calculateRiskScore(tokenDetails) {
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

export function passesFilters(tokenDetails, config) {
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

  return true;
}
