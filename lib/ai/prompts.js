/**
 * AI Prompt Template Builder
 *
 * Builds structured prompts for the AI decision engine.
 * Includes all trading rules, confluence data, and constraints.
 */

const logger = require('../utils/logger');

/**
 * Build complete AI prompt for trade decision
 *
 * @param {Object} setupData - Complete market setup data
 * @returns {string} Formatted prompt
 */
function buildPrompt(setupData) {
  const {
    // 4H Sweep Data
    sweepType,
    sweepPrice,
    bias,
    swingLevel,

    // 5M Confluence Data
    chochPrice,
    chochTime,
    fvgLow,
    fvgHigh,
    fvgFillPrice,
    fvgFillTime,
    bosPrice,
    bosTime,

    // Current Market Data
    currentPrice,
    accountBalance,

    // Swing Levels for Stop Loss
    swing5MType,
    swing5MPrice,
    swing5MTime,
    swing4HType,
    swing4HPrice,
    swing4HTime,
    recommendedStop,
    stopDistancePercent,

    // Account Status
    openPositions,
    winRate,
    consecutiveLosses,

    // Additional Context
    direction,
    minimumTakeProfit
  } = setupData;

  const prompt = `You are an expert BTC futures trader using liquidity-based technical analysis.

GOAL: Achieve 90% win rate through disciplined trade selection.

ENTRY RULES (ALL 4 MUST BE MET):
- Trade ONLY when all 4 confluences align:
  1. ✅ 4H liquidity sweep (high or low swept)
  2. ✅ 5M CHoCH (change of character)
  3. ✅ 5M FVG fill (fair value gap filled)
  4. ✅ 5M BOS (break of structure)

CRITICAL: All 4 confluences have been detected and validated. You must now decide if the setup quality is sufficient to take the trade.

RISK RULES (NON-NEGOTIABLE):
- Position size: ALWAYS 1% of account balance
- Stop loss: MUST use swing-based placement (5M or 4H swing level)
- Stop loss distance: MUST be 0.5%-3% from entry
- Take profit: Minimum 2:1 R/R ratio (based on swing stop)
- If swing-based stop doesn't allow 2:1 R/R, REJECT the trade
- Never override safety checks

CURRENT SETUP:
=============
4H LIQUIDITY SWEEP:
- Sweep Type: ${sweepType} swept at $${sweepPrice}
- Market Bias: ${bias}
- Swing Level: $${swingLevel}

5M CONFLUENCE PATTERN:
- CHoCH: Detected at $${chochPrice} (${chochTime})
- FVG Zone: $${fvgLow} - $${fvgHigh}
- FVG Fill: Price filled at $${fvgFillPrice} (${fvgFillTime})
- BOS: Confirmed at $${bosPrice} (${bosTime})

CURRENT MARKET:
- Current Price: $${currentPrice}
- Expected Direction: ${direction}
- Account Balance: $${accountBalance}

SWING LEVELS FOR STOP LOSS:
===========================
Priority 1 - Most Recent 5M Swing:
- Type: ${swing5MType}
- Price: $${swing5MPrice}
- Time: ${swing5MTime}

Priority 2 - 4H Sweep Swing (Fallback):
- Type: ${swing4HType}
- Price: $${swing4HPrice}
- Time: ${swing4HTime}

RECOMMENDED STOP LOSS:
- Stop Price: $${recommendedStop} (with 0.2-0.3% buffer)
- Distance from Entry: ${stopDistancePercent}%
- Minimum Take Profit: $${minimumTakeProfit} (2:1 R/R)

ACCOUNT STATUS:
==============
- Open Positions: ${openPositions}
- Win Rate: ${winRate}%
- Consecutive Losses: ${consecutiveLosses}

STOP LOSS CALCULATION (CRITICAL):
=================================
For LONG trades:
1. Use most recent 5M swing low (Priority 1)
2. Apply 0.2% buffer BELOW swing low
3. If invalid, try 4H swing low (Priority 2)
4. Verify stop is 0.5%-3% from entry
5. Verify 2:1 R/R is achievable

For SHORT trades:
1. Use most recent 5M swing high (Priority 1)
2. Apply 0.3% buffer ABOVE swing high
3. If invalid, try 4H swing high (Priority 2)
4. Verify stop is 0.5%-3% from entry
5. Verify 2:1 R/R is achievable

If BOTH swings invalid → return "NO"

DECISION CRITERIA:
==================
Return "YES" ONLY if:
✓ All 4 confluences properly formed (CHoCH → FVG → BOS sequence)
✓ Swing-based stop loss valid (0.5%-3% distance)
✓ Minimum 2:1 R/R achievable
✓ Price action clean and directional
✓ No conflicting signals
✓ High confidence (≥70%)

Return "NO" if:
✗ Stop loss doesn't meet 0.5%-3% constraint
✗ R/R ratio < 2:1 with swing-based stop
✗ Price action choppy or indecisive
✗ Confluence pattern unclear or weak
✗ Recent consecutive losses (risk management)
✗ ANY doubt exists

CONSERVATIVE BIAS:
- When in doubt, return "NO"
- Quality over quantity
- Protecting capital is priority #1
- Target: 90% win rate (requires extreme selectivity)

RESPONSE FORMAT (JSON ONLY):
{
  "trade_decision": "YES" or "NO",
  "direction": "${direction}",
  "entry_price": ${currentPrice},
  "stop_loss": ${recommendedStop},
  "stop_loss_source": "5M_SWING" or "4H_SWING",
  "stop_loss_swing_price": ${swing5MPrice || swing4HPrice},
  "take_profit": ${minimumTakeProfit},
  "position_size_btc": (calculated from 1% risk),
  "risk_reward_ratio": 2.0 or higher,
  "confidence": 0-100 (integer),
  "reasoning": "Detailed explanation including:
    - Quality of confluence pattern
    - Why the swing-based stop is valid
    - Price action assessment
    - R/R ratio justification
    - Why you chose YES or NO"
}

CRITICAL REMINDERS:
- Stop loss MUST be based on swing levels, NOT arbitrary percentages
- If stop doesn't meet 0.5%-3% constraint, return "NO"
- If R/R ratio < 2:1 with swing-based stop, return "NO"
- Position size calculated from: (Account Balance × 0.01) ÷ Stop Distance
- Confidence must be ≥70% for "YES" decision
- Return ONLY the JSON object, no additional text

Analyze the setup and provide your decision:`;

  logger.debug('Prompt built', {
    promptLength: prompt.length,
    bias,
    direction,
    currentPrice
  });

  return prompt;
}

/**
 * Build setup data object from confluence and market data
 *
 * @param {Object} confluenceState - Confluence state from database
 * @param {Object} sweepData - Liquidity sweep data
 * @param {Object} swingData - Swing levels data
 * @param {Object} marketData - Current market data
 * @param {Object} accountData - Account status data
 * @returns {Object} Complete setup data
 */
function buildSetupData(confluenceState, sweepData, swingData, marketData, accountData) {
  const bias = sweepData.bias || confluenceState.bias;
  const direction = bias === 'BULLISH' ? 'LONG' : 'SHORT';

  const setupData = {
    // 4H Sweep
    sweepType: sweepData.sweep_type,
    sweepPrice: parseFloat(sweepData.price),
    bias: bias,
    swingLevel: parseFloat(sweepData.swing_level),

    // 5M Confluence
    chochPrice: parseFloat(confluenceState.choch_price),
    chochTime: confluenceState.choch_time,
    fvgLow: parseFloat(confluenceState.fvg_zone_low),
    fvgHigh: parseFloat(confluenceState.fvg_zone_high),
    fvgFillPrice: parseFloat(confluenceState.fvg_fill_price),
    fvgFillTime: confluenceState.fvg_fill_time,
    bosPrice: parseFloat(confluenceState.bos_price),
    bosTime: confluenceState.bos_time,

    // Market Data
    currentPrice: parseFloat(marketData.currentPrice),
    accountBalance: parseFloat(accountData.accountBalance),

    // Swing Data
    swing5MType: swingData.swing5M?.swing_type || 'N/A',
    swing5MPrice: swingData.swing5M ? parseFloat(swingData.swing5M.price) : 0,
    swing5MTime: swingData.swing5M?.timestamp || 'N/A',
    swing4HType: swingData.swing4H?.swing_type || 'N/A',
    swing4HPrice: swingData.swing4H ? parseFloat(swingData.swing4H.price) : 0,
    swing4HTime: swingData.swing4H?.timestamp || 'N/A',
    recommendedStop: parseFloat(swingData.recommendedStop),
    stopDistancePercent: parseFloat(swingData.stopDistancePercent).toFixed(2),

    // Account Status
    openPositions: accountData.openPositions || 0,
    winRate: parseFloat(accountData.winRate || 0).toFixed(2),
    consecutiveLosses: accountData.consecutiveLosses || 0,

    // Derived
    direction: direction,
    minimumTakeProfit: parseFloat(swingData.minimumTakeProfit)
  };

  logger.debug('Setup data built', {
    bias,
    direction,
    currentPrice: setupData.currentPrice,
    stopDistance: setupData.stopDistancePercent
  });

  return setupData;
}

/**
 * Validate required setup data fields
 *
 * @param {Object} setupData - Setup data to validate
 * @returns {Object} { valid: boolean, missingFields: Array }
 */
function validateSetupData(setupData) {
  const requiredFields = [
    'sweepType', 'sweepPrice', 'bias', 'swingLevel',
    'chochPrice', 'chochTime', 'fvgLow', 'fvgHigh',
    'fvgFillPrice', 'bosPrice', 'currentPrice',
    'accountBalance', 'recommendedStop', 'stopDistancePercent',
    'direction', 'minimumTakeProfit'
  ];

  const missingFields = [];

  for (const field of requiredFields) {
    if (setupData[field] === undefined || setupData[field] === null) {
      missingFields.push(field);
    }
  }

  const valid = missingFields.length === 0;

  if (!valid) {
    logger.error('Setup data validation failed', { missingFields });
  }

  return {
    valid,
    missingFields
  };
}

/**
 * Build simplified prompt for testing
 *
 * @param {Object} basicData - Basic trade data
 * @returns {string} Simple prompt
 */
function buildTestPrompt(basicData) {
  const prompt = `You are a BTC trading AI. Analyze this setup and respond with JSON only.

Setup:
- Direction: ${basicData.direction}
- Entry: $${basicData.entry}
- Stop: $${basicData.stop}
- Target: $${basicData.target}
- R/R: ${basicData.rrRatio}:1

Respond with JSON:
{
  "trade_decision": "YES" or "NO",
  "direction": "${basicData.direction}",
  "entry_price": ${basicData.entry},
  "stop_loss": ${basicData.stop},
  "stop_loss_source": "5M_SWING",
  "take_profit": ${basicData.target},
  "position_size_btc": 0.01,
  "risk_reward_ratio": ${basicData.rrRatio},
  "confidence": 75,
  "reasoning": "Test decision"
}`;

  return prompt;
}

module.exports = {
  buildPrompt,
  buildSetupData,
  validateSetupData,
  buildTestPrompt
};
